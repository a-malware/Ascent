// ─────────────────────────────────────────────────────────────────────────────
// mock-db.js — Shared in-memory store for the mock SQL layer.
//
// This is the single source of truth for all in-memory tables used by the
// mock sql tagged-template function in sql.js.
// ─────────────────────────────────────────────────────────────────────────────

const store = {
  users: [
    {
      id: 1,
      wallet_address: "por-demo-node-001",
      reputation: 0.05,
      phase: 1,
      tasks_completed: 0,
      is_vouched: false,
      escrow_at_risk: 0,
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      wallet_address: "por-demo-node-002",
      reputation: 0.85,
      phase: 4,
      tasks_completed: 20,
      is_vouched: true,
      escrow_at_risk: 0,
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: 3,
      wallet_address: "por-demo-node-003",
      reputation: 0.72,
      phase: 4,
      tasks_completed: 20,
      is_vouched: true,
      escrow_at_risk: 0,
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    },
  ],

  tasks: [],

  proposals: [
    {
      id: 1,
      title: "Reduce minimum voucher reputation to τ_v = 0.35",
      votes_for: 142,
      votes_against: 38,
      status: "active",
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 2,
      title: "Increase Phase-1 task count N from 20 to 25",
      votes_for: 89,
      votes_against: 61,
      status: "active",
      created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    },
    {
      id: 3,
      title: "Adjust reputation decay λ from 0.80 to 0.85",
      votes_for: 55,
      votes_against: 110,
      status: "active",
      created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    },
  ],

  vouches: [],

  activity: [
    {
      id: 1,
      wallet_address: "por-demo-node-001",
      message: "Node connected to PoR network",
      type: "phase",
      created_at: new Date().toISOString(),
    },
  ],
};

export default store;
