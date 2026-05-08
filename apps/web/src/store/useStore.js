import { create } from "zustand";

// ─── Initial state ─────────────────────────────────────────────────────────────
const INITIAL_STATE = {
  // ── Node identity ───────────────────────────────────────────────────────────
  wallet:        "Connecting…",   // displayed node ID abbreviation
  nodeId:        null,
  publicKey:     null,
  peersCount:    0,
  chainHeight:   0,

  // ── Wallet (POR tokens) ─────────────────────────────────────────────────────
  walletBalance: 0,
  walletStaked:  0,
  tokens: [
    { id: "por", symbol: "POR", name: "PoR Native", amount: 100, balance: 100, price: 1.5, value: 150, change24h: +5.2 }
  ],

  // ── PoR state ───────────────────────────────────────────────────────────────
  reputation:       0,
  phase:            1,
  phaseKey:         "PHASE_1",
  tasksCompleted:   0,
  tasksPassed:      0,
  honestRounds:     0,
  isVouched:        false,
  graduated:        false,
  banned:           false,
  meritBoost:       1.0,
  reputationGrowth: 0,
  escrowAtRisk:     0,

  // ── Eligibility flags ────────────────────────────────────────────────────────
  eligibleToVouch:   false,
  eligibleToPropose: false,
  eligibleToVote:    false,

  // ── UI state ─────────────────────────────────────────────────────────────────
  activeTab:   "home",
  activeModal: null,

  // ── Activity feed ────────────────────────────────────────────────────────────
  activities: [
    { id: 1, type: "phase",   message: "Node connecting to PoR network…", time: "just now" },
  ],

  // ── Governance ───────────────────────────────────────────────────────────────
  proposals: [
    { id: 1, title: "Reduce minimum voucher reputation to τ_v = 0.35", votes_for: 142, votes_against: 38,  status: "active" },
    { id: 2, title: "Increase Phase-1 task count N from 20 to 25",      votes_for: 89,  votes_against: 61,  status: "active" },
    { id: 3, title: "Adjust reputation decay λ from 0.80 to 0.85",      votes_for: 55,  votes_against: 110, status: "active" },
  ],

  // ── Notifications ─────────────────────────────────────────────────────────────
  notifications: [
    { id: 1, message: "Welcome to the PoR Network! Complete 20 tasks to advance.", read: false, time: "just now" },
    { id: 2, message: "Phase 1 active — earn reputation by completing tasks.",       read: false, time: "just now" },
  ],
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function computeBoost(rep) {
  return parseFloat(Math.max(1.0, 1.0 + (rep - 0.1) * 0.5).toFixed(2));
}

// ── Store ──────────────────────────────────────────────────────────────────────

export const useStore = create((set) => ({
  ...INITIAL_STATE,

  // ── Basic setters ────────────────────────────────────────────────────────────
  setWallet:         (wallet)         => set({ wallet }),
  setPhase:          (phase)          => set({ phase }),
  setTasksCompleted: (tasksCompleted) => set({ tasksCompleted }),
  setIsVouched:      (isVouched)      => set({ isVouched }),
  setEscrowAtRisk:   (escrowAtRisk)   => set({ escrowAtRisk }),
  setGraduated:      (graduated)      => set({ graduated }),
  setActiveTab:      (activeTab)      => set({ activeTab }),
  setActiveModal:    (activeModal)    => set({ activeModal }),
  setActivities:     (activities)     => set({ activities }),
  setProposals:      (proposals)      => set({ proposals }),

  setReputation: (reputation) =>
    set({ reputation, meritBoost: computeBoost(reputation) }),

  addActivity: (activity) =>
    set((state) => ({ activities: [activity, ...state.activities] })),

  markNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
    })),

  // ── Node sync ─────────────────────────────────────────────────────────────────
  // Called by useSyncStore whenever the Python node state changes.
  // Shape of `normalized` comes from chain/node.js → normalizeNodeState().
  syncFromNode: (normalized) =>
    set((state) => {
      const meritBoost = computeBoost(normalized.reputation);

      // Generate a graduation activity if we just crossed into Full Node
      const justGraduated = normalized.graduated && !state.graduated;
      const activities = justGraduated
        ? [
            {
              id: Date.now(), type: "phase",
              message: "🎓 Graduated — Full network participation unlocked!",
              time: "just now",
            },
            ...state.activities,
          ]
        : state.activities;

      return {
        // Identity
        nodeId:      normalized.nodeId,
        publicKey:   normalized.publicKey,
        peersCount:  normalized.peersCount,
        chainHeight: normalized.chainHeight,

        // Wallet
        walletBalance: normalized.walletBalance,
        walletStaked:  normalized.walletStaked,

        // PoR protocol state
        phase:          normalized.phase,
        phaseKey:       normalized.phaseKey,
        reputation:     normalized.reputation,
        tasksCompleted: normalized.tasksCompleted,
        tasksPassed:    normalized.tasksPassed,
        honestRounds:   normalized.honestRounds,
        isVouched:      normalized.isVouched,
        graduated:      normalized.graduated,
        banned:         normalized.banned,
        meritBoost,

        // Eligibility flags
        eligibleToVouch:   normalized.eligibleToVouch,
        eligibleToPropose: normalized.eligibleToPropose,
        eligibleToVote:    normalized.eligibleToVote,

        activities,
      };
    }),

  // Keep backward compat alias used by old Solana sync hook
  syncFromChain: (normalized) => {
    // Map old Solana-shaped object to new shape when called from legacy code
    const mapped = {
      nodeId:         normalized.nodeId ?? null,
      publicKey:      normalized.publicKey ?? null,
      phase:          normalized.phase,
      phaseKey:       normalized.phaseKey,
      reputation:     normalized.reputation,
      tasksCompleted: normalized.tasksCompleted,
      tasksPassed:    normalized.tasksPassed,
      honestRounds:   normalized.honestRounds,
      isVouched:      normalized.isVouched,
      graduated:      normalized.graduated,
      banned:         normalized.banned,
      peersCount:     0,
      chainHeight:    0,
      walletBalance:  0,
      walletStaked:   0,
      eligibleToVouch: false, eligibleToPropose: false, eligibleToVote: false,
    };
    set((state) => {
      const meritBoost = computeBoost(mapped.reputation);
      return { ...mapped, meritBoost };
    });
  },

  // ── Governance ────────────────────────────────────────────────────────────────
  voteProposal: (id, type) =>
    set((state) => ({
      proposals: state.proposals.map((p) =>
        p.id === id
          ? {
              ...p,
              votes_for:     type === "for"     ? p.votes_for + 1     : p.votes_for,
              votes_against: type === "against" ? p.votes_against + 1 : p.votes_against,
            }
          : p
      ),
    })),

  // ── Wallet actions (now talk to Python REST API via components) ───────────────

  execSend: (tokenSymbol, amount, toAddress) =>
    set((state) => {
      const short = toAddress.length > 12
        ? `${toAddress.slice(0, 4)}...${toAddress.slice(-4)}`
        : toAddress;
      return {
        walletBalance: Math.max(0, state.walletBalance - amount),
        activities: [
          { id: Date.now(), type: "send",
            message: `Sent ${amount} POR to ${short}`,
            time: "just now" },
          ...state.activities,
        ],
      };
    }),

  execSwap: (fromSymbol, toSymbol, fromAmount, boostedOut) =>
    set((state) => ({
      walletBalance: Math.max(0, state.walletBalance - fromAmount) + boostedOut,
      activities: [
        { id: Date.now(), type: "swap",
          message: `Swapped ${fromAmount} ${fromSymbol} → ${boostedOut.toFixed(2)} ${toSymbol} (Merit Boosted)`,
          time: "just now" },
        ...state.activities,
      ],
    })),

  execClaim: () =>
    set((state) => ({
      walletBalance: state.walletBalance + 250,
      activities: [
        { id: Date.now(), type: "receive",
          message: "Validator Genesis Reward — 250 POR claimed",
          time: "just now" },
        ...state.activities,
      ],
    })),

  execSlash: () =>
    set((state) => {
      const newRep   = Math.max(0, state.reputation * 0.6);
      const newBoost = computeBoost(newRep);
      return {
        reputation: newRep,
        meritBoost: newBoost,
        activities: [
          { id: Date.now(), type: "phase",
            message: "⚠️ Slashing event — misbehaviour detected. Reputation −40%",
            time: "just now" },
          ...state.activities,
        ],
      };
    }),

  // ── Demo reset ─────────────────────────────────────────────────────────────────
  resetDemo: () => set({ ...INITIAL_STATE }),
}));
