"""
detector.py
-----------
Unsupervised voting anomaly detector for the ColdStart-PoR network.

Uses an Isolation Forest (sklearn) which requires NO pre-labelled training
data.  It learns what "normal" node behaviour looks like from the live network
and flags statistical outliers.

Feature vector per node (computed from voting history):
  [0] alignment_rate     — fraction of past rounds where outcome was honest
                           (populated from RoundOutcomeRecorded events)
  [1] reputation_delta   — change in reputation_bps over last 10 outcomes
  [2] vote_miss_rate     — fraction of expected rounds where node did NOT vote
  [3] slash_proposal_ct  — number of times this node has been proposed for slash

The model is re-fitted every MIN_SAMPLES_TO_FIT samples and every time a new
anomaly flag is requested.  With only a handful of nodes it will have low
confidence; this is expected — it degrades gracefully to "no anomaly" when
data is insufficient.
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

MIN_SAMPLES_TO_FIT   = 10   # need at least this many node histories before fitting
MIN_HISTORY_PER_NODE = 5    # need at least this many round outcomes per node
ANOMALY_THRESHOLD    = -0.3  # IsolationForest score below this → anomaly
CONTAMINATION        = 0.05  # expected fraction of malicious nodes in the network
HISTORY_WINDOW       = 20    # only look at the last N round outcomes per node

# ---------------------------------------------------------------------------
# Per-node history record
# ---------------------------------------------------------------------------

@dataclass
class NodeHistory:
    pubkey: str

    # Round outcomes from RoundOutcomeRecorded events
    outcomes: list[dict] = field(default_factory=list)
    # {round: int, was_honest: bool, reputation_bps: int}

    # Rounds where VoteCast was seen (node showed up)
    voted_rounds: set[int] = field(default_factory=set)

    # Number of slash proposals against this node
    slash_proposal_count: int = 0

    # Last known reputation BPS (updated from RoundOutcomeRecorded)
    last_reputation_bps: int = 0


# ---------------------------------------------------------------------------
# Detector
# ---------------------------------------------------------------------------

class VotingAnomalyDetector:
    """
    Live, self-updating anomaly detector.

    Usage:
        detector = VotingAnomalyDetector()
        detector.record_vote("NodePubkey123", round=5)
        detector.record_outcome("NodePubkey123", round=4, was_honest=True, reputation_bps=7500)
        detector.maybe_refit()
        is_bad = detector.is_anomalous("NodePubkey123")
    """

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
        self._last_fit_at  = 0  # event count at last fit

    # ── Event ingestion ────────────────────────────────────────────────────

    def record_vote(self, node: str, round_: int):
        """Called when a VoteCast event is observed."""
        h = self._get_or_create(node)
        h.voted_rounds.add(round_)
        self._total_events += 1

    def record_outcome(
        self,
        node: str,
        round_: int,
        was_honest: bool,
        reputation_bps: int,
    ):
        """Called when a RoundOutcomeRecorded event is observed."""
        h = self._get_or_create(node)
        h.outcomes.append({
            "round": round_,
            "was_honest": was_honest,
            "reputation_bps": reputation_bps,
        })
        h.last_reputation_bps = reputation_bps
        self._total_events += 1

    def record_slash_proposal(self, candidate: str):
        """Called when a SlashProposed event is observed."""
        h = self._get_or_create(candidate)
        h.slash_proposal_count += 1
        self._total_events += 1

    # ── Feature extraction ─────────────────────────────────────────────────

    def _extract_features(self, node: str) -> Optional[np.ndarray]:
        """
        Returns a 4-dimensional feature vector for `node`, or None if there
        is not enough data yet.
        """
        h = self._histories.get(node)
        if h is None or len(h.outcomes) < MIN_HISTORY_PER_NODE:
            return None

        recent = h.outcomes[-HISTORY_WINDOW:]

        # Feature 0: alignment_rate — how often was this node honest?
        alignment_rate = float(np.mean([1 if o["was_honest"] else 0 for o in recent]))

        # Feature 1: reputation_delta — is rep growing or shrinking?
        rep_values = [o["reputation_bps"] for o in recent]
        reputation_delta = (rep_values[-1] - rep_values[0]) / 10_000.0  # normalise to [-1, 1]

        # Feature 2: vote_miss_rate — rounds where outcome was recorded but
        # we never saw a VoteCast (node participated without broadcasting?)
        outcome_rounds  = {o["round"] for o in recent}
        missed          = outcome_rounds - h.voted_rounds
        vote_miss_rate  = len(missed) / max(len(outcome_rounds), 1)

        # Feature 3: slash_proposal_count (log-scaled to prevent dominance)
        slash_pressure = np.log1p(h.slash_proposal_count)

        return np.array([alignment_rate, reputation_delta, vote_miss_rate, slash_pressure])

    def _build_feature_matrix(self) -> tuple[np.ndarray, list[str]]:
        """Build the feature matrix from all nodes that have sufficient history."""
        nodes    = []
        features = []

        for pubkey, _ in self._histories.items():
            f = self._extract_features(pubkey)
            if f is not None:
                nodes.append(pubkey)
                features.append(f)

        if not features:
            return np.empty((0, 4)), []

        return np.array(features), nodes

    # ── Model fitting ──────────────────────────────────────────────────────

    def maybe_refit(self, force: bool = False):
        """
        Refit the Isolation Forest if enough new events have accumulated since
        the last fit, or if `force=True`.
        """
        new_events = self._total_events - self._last_fit_at
        X, nodes   = self._build_feature_matrix()

        if len(nodes) < MIN_SAMPLES_TO_FIT and not force:
            return  # not enough data yet

        if new_events < 10 and not force:
            return  # not enough new data since last fit

        log.info(f"Fitting IsolationForest on {len(nodes)} nodes ({len(X)} samples)...")
        self._model = IsolationForest(
            contamination=self.contamination,
            random_state=42,
            n_estimators=100,
        )
        self._model.fit(X)
        self._last_fit_at = self._total_events
        log.info("Model re-fitted.")

    # ── Anomaly query ──────────────────────────────────────────────────────

    def is_anomalous(self, node: str) -> bool:
        """
        Returns True if the node's behaviour is statistically anomalous.
        Returns False if the model isn't trained or there isn't enough data.
        """
        if self._model is None:
            log.debug(f"Model not trained yet — skipping anomaly check for {node}")
            return False

        f = self._extract_features(node)
        if f is None:
            log.debug(f"Insufficient history for {node} — skipping anomaly check")
            return False

        score = self._model.score_samples(f.reshape(1, -1))[0]
        is_bad = score < self.anomaly_threshold

        if is_bad:
            log.warning(
                f"ANOMALY DETECTED: {node[:16]}... "
                f"(score={score:.4f}, threshold={self.anomaly_threshold})\n"
                f"  Features: alignment={f[0]:.2f} rep_delta={f[1]:.3f} "
                f"miss_rate={f[2]:.2f} slash_pressure={f[3]:.2f}"
            )

        return is_bad

    def anomaly_score(self, node: str) -> Optional[float]:
        """Return the raw anomaly score for a node, or None if unavailable."""
        if self._model is None:
            return None
        f = self._extract_features(node)
        if f is None:
            return None
        return float(self._model.score_samples(f.reshape(1, -1))[0])

    # ── Diagnostics ────────────────────────────────────────────────────────

    def summary(self) -> dict:
        """Return a snapshot of the detector's current state."""
        return {
            "total_nodes_tracked":  len(self._histories),
            "nodes_with_history":   sum(
                1 for h in self._histories.values()
                if len(h.outcomes) >= MIN_HISTORY_PER_NODE
            ),
            "total_events_seen":    self._total_events,
            "model_trained":        self._model is not None,
        }

    # ── Internal helpers ───────────────────────────────────────────────────

    def _get_or_create(self, node: str) -> NodeHistory:
        if node not in self._histories:
            self._histories[node] = NodeHistory(pubkey=node)
        return self._histories[node]
