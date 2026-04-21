import { create } from "zustand";

// ─── Initial Phase-1 state ─────────────────────────────────────────────────────
const PHASE1_SEED = {
  wallet: "7xKq...9Ab3",
  portfolioBalance: 42.87,
  portfolioUSD: 8574.23,
  tokens: [
    { symbol: "SOL",  name: "Solana",   balance: 42.87,   price: 199.95,  value: 8574.23, change24h:  5.2,  logo: "⬡"  },
    { symbol: "USDC", name: "USD Coin", balance: 1250.0,  price: 1.0,     value: 1250.0,  change24h:  0.01, logo: "💵" },
    { symbol: "BONK", name: "Bonk",     balance: 1500000, price: 0.000012, value: 18.0,  change24h: -2.4,  logo: "🐶" },
  ],
  nfts: [
    { name: "Mad Lads #4521",  collection: "Mad Lads",               image: "https://images.unsplash.com/photo-1635322966219-b75ed372eb01?w=300&h=300&fit=crop" },
    { name: "SMB #2891",       collection: "Solana Monkey Business", image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&h=300&fit=crop" },
    { name: "Okay Bear #1523", collection: "Okay Bears",             image: "https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?w=300&h=300&fit=crop" },
  ],

  // ── PoR state ────────────────────────────────────────────────────────────────
  reputation:      0.1,
  phase:           1,
  tasksCompleted:  0,
  isVouched:       false,
  escrowAtRisk:    0,
  reputationGrowth:0,
  meritBoost:      1.0,
  graduated:       false,

  // ── Wallet action state ───────────────────────────────────────────────────────
  claimedGenesis:  false,
  slashed:         false,

  // ── UI state ─────────────────────────────────────────────────────────────────
  activeTab:    "home",
  activeModal:  null, // 'send' | 'swap' | 'claim' | 'slash' | null

  // ── Feed ─────────────────────────────────────────────────────────────────────
  activities: [
    { id: 1, type: "phase",   message: "Node registered — Phase 1 begins",    time: "just now" },
    { id: 2, type: "receive", message: "Received 42.87 SOL from faucet", amount: 42.87, token: "SOL", time: "5m ago" },
  ],

  // ── Governance ───────────────────────────────────────────────────────────────
  proposals: [
    { id: 1, title: "Reduce minimum stake to 1.5 SOL",    votes_for: 142, votes_against: 38,  status: "active" },
    { id: 2, title: "Extend Phase 1 tasks from 20 to 15", votes_for: 89,  votes_against: 61,  status: "active" },
    { id: 3, title: "Increase reputation decay factor",   votes_for: 55,  votes_against: 110, status: "active" },
  ],

  // ── Notifications ─────────────────────────────────────────────────────────────
  notifications: [
    { id: 1, message: "Welcome! Complete 5 tasks to advance.", read: false, time: "just now" },
    { id: 2, message: "Phase 1 active — earn reputation by completing tasks.", read: false, time: "just now" },
  ],
};

// ── Helper: compute merit boost from reputation ───────────────────────────────
function computeBoost(rep) {
  return parseFloat(Math.max(1.0, 1.0 + (rep - 0.1) * 0.5).toFixed(2));
}

// ── Helper: recompute portfolio totals from token array ───────────────────────
function totals(tokens) {
  const usd = tokens.reduce((s, t) => s + t.value, 0);
  const sol = tokens.find(t => t.symbol === "SOL")?.balance ?? 0;
  return { portfolioUSD: usd, portfolioBalance: sol };
}

export const useStore = create((set) => ({
  ...PHASE1_SEED,

  // ── Basic setters ─────────────────────────────────────────────────────────────
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

  // Automatically keeps meritBoost in sync with reputation
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

  // ── On-chain sync ─────────────────────────────────────────────────────────────
  // Called by useSyncStore whenever the chain's NodeState changes.
  // Overwrites only the PoR-relevant fields; leaves wallet/token/NFT data intact.
  syncFromChain: (normalized) =>
    set((state) => {
      // normalized comes from accounts.normalizeNodeState():
      // { phase, reputation, tasksCompleted, tasksPassed, honestRounds,
      //   isVouched, voucher, graduated, banned }
      const meritBoost = parseFloat(
        Math.max(1.0, 1.0 + (normalized.reputation - 0.1) * 0.5).toFixed(2)
      );
      const activity =
        normalized.graduated && !state.graduated
          ? [
              {
                id: Date.now(), type: "phase",
                message: "🎓 Graduated to full network participation (on-chain)",
                time: "just now",
              },
              ...state.activities,
            ]
          : state.activities;

      return {
        phase:          normalized.phase,
        reputation:     normalized.reputation,
        tasksCompleted: normalized.tasksCompleted,
        isVouched:      normalized.isVouched,
        graduated:      normalized.graduated,
        meritBoost,
        activities:     activity,
      };
    }),

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

  // ── Wallet actions ─────────────────────────────────────────────────────────────

  execSend: (tokenSymbol, amount, toAddress) =>
    set((state) => {
      const newTokens = state.tokens.map((t) => {
        if (t.symbol !== tokenSymbol) return t;
        const newBal = Math.max(0, t.balance - amount);
        return { ...t, balance: newBal, value: newBal * t.price };
      });
      const short = toAddress.length > 12
        ? `${toAddress.slice(0, 4)}...${toAddress.slice(-4)}`
        : toAddress;
      return {
        tokens:    newTokens,
        ...totals(newTokens),
        activities: [
          { id: Date.now(), type: "send",
            message: `Sent ${amount} ${tokenSymbol} to ${short}`,
            time: "just now" },
          ...state.activities,
        ],
      };
    }),

  execSwap: (fromSymbol, toSymbol, fromAmount, boostedOut) =>
    set((state) => {
      const newTokens = state.tokens.map((t) => {
        if (t.symbol === fromSymbol) {
          const newBal = Math.max(0, t.balance - fromAmount);
          return { ...t, balance: newBal, value: newBal * t.price };
        }
        if (t.symbol === toSymbol) {
          const newBal = t.balance + boostedOut;
          return { ...t, balance: newBal, value: newBal * t.price };
        }
        return t;
      });
      return {
        tokens: newTokens,
        ...totals(newTokens),
        activities: [
          { id: Date.now(), type: "swap",
            message: `Swapped ${fromAmount} ${fromSymbol} → ${boostedOut.toFixed(2)} ${toSymbol} (Merit Boosted)`,
            time: "just now" },
          ...state.activities,
        ],
      };
    }),

  execClaim: () =>
    set((state) => {
      const REWARD = 250;
      const newTokens = state.tokens.map((t) =>
        t.symbol === "USDC"
          ? { ...t, balance: t.balance + REWARD, value: t.value + REWARD }
          : t
      );
      return {
        tokens: newTokens,
        ...totals(newTokens),
        claimedGenesis: true,
        activities: [
          { id: Date.now(), type: "receive",
            message: "Validator Genesis Reward — 250 USDC claimed",
            time: "just now" },
          ...state.activities,
        ],
      };
    }),

  execSlash: () =>
    set((state) => {
      const newRep   = Math.max(0, state.reputation * 0.6);
      const newBoost = computeBoost(newRep);
      return {
        reputation: newRep,
        meritBoost: newBoost,
        slashed:    true,
        activities: [
          { id: Date.now(), type: "phase",
            message: "⚠️ Slashing event — double-sign detected. Reputation −40%",
            time: "just now" },
          ...state.activities,
        ],
      };
    }),

  // ── Demo reset ─────────────────────────────────────────────────────────────────
  resetDemo: () =>
    set({
      tokens:          PHASE1_SEED.tokens.map((t) => ({ ...t })),
      portfolioBalance: PHASE1_SEED.portfolioBalance,
      portfolioUSD:    PHASE1_SEED.portfolioUSD,
      reputation:      PHASE1_SEED.reputation,
      phase:           PHASE1_SEED.phase,
      tasksCompleted:  PHASE1_SEED.tasksCompleted,
      isVouched:       PHASE1_SEED.isVouched,
      escrowAtRisk:    PHASE1_SEED.escrowAtRisk,
      reputationGrowth:PHASE1_SEED.reputationGrowth,
      meritBoost:      PHASE1_SEED.meritBoost,
      graduated:       PHASE1_SEED.graduated,
      claimedGenesis:  false,
      slashed:         false,
      activeModal:     null,
      activities:      [...PHASE1_SEED.activities],
      proposals:       PHASE1_SEED.proposals.map((p) => ({ ...p })),
      notifications:   [...PHASE1_SEED.notifications],
      activeTab:       "home",
    }),
}));
