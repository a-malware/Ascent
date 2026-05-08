"""
detector.py
-----------
Unsupervised voting anomaly detector for the ColdStart-PoR network.

Uses an Isolation Forest (sklearn) which requires NO pre-labelled training
data.  It learns what "normal" node behaviour looks like from the live network
and flags statistical outliers.

Feature vector per node:
  [0] current_score      — absolute reputation score [0.0 - 1.0]
  [1] reputation_delta   — change in reputation over the tracking window
  [2] honest_round_delta — number of new honest rounds completed
  [3] phase_rank         — numerical representation of phase (BANNED=0, PHASE_1=1, etc.)
"""

import logging
import numpy as np
from dataclasses import dataclass, field
from typing import Optional
from sklearn.ensemble import IsolationForest

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tunable constants
# ---------------------------------------------------------------------------

MIN_SAMPLES_TO_FIT   = 3     # We can lower this since local testnets are small
MIN_HISTORY_PER_NODE = 3     # Need a few data points per node to calculate deltas
ANOMALY_THRESHOLD    = -0.2  # IsolationForest score below this → anomaly
CONTAMINATION        = 0.1   # expected fraction of malicious nodes in the network
HISTORY_WINDOW       = 10    # Look at last N checks

PHASE_RANK = {
    "BANNED": 0,
    "UNKNOWN": 1,
    "PHASE_1": 2,
    "PHASE_2": 3,
    "PHASE_3": 4,
    "UNDER_OBSERVATION": 5,
    "FULL_NODE": 6,
}

# ---------------------------------------------------------------------------
# Per-node history record
# ---------------------------------------------------------------------------

@dataclass
class NodeHistory:
    node_id: str
    states: list[dict] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Detector
# ---------------------------------------------------------------------------

class VotingAnomalyDetector:
    def __init__(
        self,
        contamination: float = CONTAMINATION,
        anomaly_threshold: float = ANOMALY_THRESHOLD,
    ):
        self.contamination    = contamination
        self.anomaly_threshold = anomaly_threshold
        self._histories: dict[str, NodeHistory] = {}
        self._model: Optional[IsolationForest]  = None
        self._total_events = 0
        self._last_fit_at  = 0

    # ── Event ingestion ────────────────────────────────────────────────────

    def record_state_update(self, node_id: str, phase: str, honest_rounds: int, score: float):
        """Called when a NodeStateUpdate is observed."""
        h = self._get_or_create(node_id)
        h.states.append({
            "phase": phase,
            "honest_rounds": honest_rounds,
            "reputation_score": score,
        })
        # Keep only history window
        if len(h.states) > HISTORY_WINDOW:
            h.states.pop(0)
            
        self._total_events += 1

    # ── Feature extraction ─────────────────────────────────────────────────

    def _extract_features(self, node_id: str) -> Optional[np.ndarray]:
        h = self._histories.get(node_id)
        if h is None or len(h.states) < MIN_HISTORY_PER_NODE:
            return None

        recent = h.states
        latest = recent[-1]
        oldest = recent[0]

        # Feature 0: Absolute Score
        current_score = latest["reputation_score"]

        # Feature 1: Reputation Delta
        reputation_delta = current_score - oldest["reputation_score"]

        # Feature 2: Honest Rounds Delta
        honest_round_delta = latest["honest_rounds"] - oldest["honest_rounds"]

        # Feature 3: Phase Rank
        phase_rank = float(PHASE_RANK.get(latest["phase"], 1))

        return np.array([current_score, reputation_delta, float(honest_round_delta), phase_rank])

    def _build_feature_matrix(self) -> tuple[np.ndarray, list[str]]:
        nodes    = []
        features = []

        for node_id, _ in self._histories.items():
            f = self._extract_features(node_id)
            if f is not None:
                nodes.append(node_id)
                features.append(f)

        if not features:
            return np.empty((0, 4)), []

        return np.array(features), nodes

    # ── Model fitting ──────────────────────────────────────────────────────

    def maybe_refit(self, force: bool = False):
        new_events = self._total_events - self._last_fit_at
        X, nodes   = self._build_feature_matrix()

        if len(nodes) < MIN_SAMPLES_TO_FIT and not force:
            return

        if new_events < 5 and not force:
            return

        log.info(f"Fitting IsolationForest on {len(nodes)} nodes ({len(X)} samples)...")
        # Ensure contamination is less than 0.5 and valid for the sample size
        c = min(self.contamination, 0.49)
        if len(nodes) < 5:
            # Not enough samples for a meaningful contamination split, use auto
            self._model = IsolationForest(random_state=42, n_estimators=50)
        else:
            self._model = IsolationForest(
                contamination=c,
                random_state=42,
                n_estimators=100,
            )
            
        self._model.fit(X)
        self._last_fit_at = self._total_events
        log.info("Model re-fitted.")

    # ── Anomaly query ──────────────────────────────────────────────────────

    def is_anomalous(self, node_id: str) -> bool:
        if self._model is None:
            return False

        f = self._extract_features(node_id)
        if f is None:
            return False

        # Do not flag BANNED nodes again (they are already dead)
        latest_phase = self._histories[node_id].states[-1]["phase"]
        if latest_phase == "BANNED":
            return False

        score = self._model.score_samples(f.reshape(1, -1))[0]
        is_bad = score < self.anomaly_threshold

        if is_bad:
            log.warning(
                f"ANOMALY DETECTED: {node_id[:16]}... "
                f"(score={score:.4f}, threshold={self.anomaly_threshold})\n"
                f"  Features: score={f[0]:.2f} rep_delta={f[1]:.3f} "
                f"round_delta={f[2]:.1f} phase_rank={f[3]:.0f}"
            )

        return is_bad

    def anomaly_score(self, node_id: str) -> Optional[float]:
        if self._model is None:
            return None
        f = self._extract_features(node_id)
        if f is None:
            return None
        return float(self._model.score_samples(f.reshape(1, -1))[0])

    # ── Diagnostics ────────────────────────────────────────────────────────

    def summary(self) -> dict:
        return {
            "total_nodes_tracked":  len(self._histories),
            "nodes_with_history":   sum(
                1 for h in self._histories.values()
                if len(h.states) >= MIN_HISTORY_PER_NODE
            ),
            "total_events_seen":    self._total_events,
            "model_trained":        self._model is not None,
        }

    # ── Internal helpers ───────────────────────────────────────────────────

    def _get_or_create(self, node_id: str) -> NodeHistory:
        if node_id not in self._histories:
            self._histories[node_id] = NodeHistory(node_id=node_id)
        return self._histories[node_id]
