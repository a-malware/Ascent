// ─────────────────────────────────────────────────────────────────────────────
// In-memory mock database for the Ascent PoR demo.
// This replaces the Neon PostgreSQL connection so the demo runs with no DB.
// All state persists for the lifetime of the dev-server process only.
// ─────────────────────────────────────────────────────────────────────────────

export const DEMO_WALLET = '7xKq...9Ab3';

// ─── Seed data ────────────────────────────────────────────────────────────────

const seedUsers = () => [
  {
    id: 1,
    wallet_address: DEMO_WALLET,
    reputation: 0.1,
    phase: 1,
    tasks_completed: 0,
    is_vouched: false,
    escrow_at_risk: 0.0,
    created_at: new Date('2026-04-01').toISOString(),
  },
  // Established nodes eligible to vouch for others
  { id: 2, wallet_address: '8xYz...4Cd7', reputation: 0.92, phase: 3, tasks_completed: 20, is_vouched: true, escrow_at_risk: 5.0, created_at: new Date('2025-10-10').toISOString() },
  { id: 3, wallet_address: '3aRt...7Mn2', reputation: 0.87, phase: 3, tasks_completed: 20, is_vouched: true, escrow_at_risk: 7.5, created_at: new Date('2025-08-05').toISOString() },
  { id: 4, wallet_address: '9pLk...1Wx8', reputation: 0.84, phase: 3, tasks_completed: 20, is_vouched: true, escrow_at_risk: 2.5, created_at: new Date('2025-04-20').toISOString() },
  { id: 5, wallet_address: '4bQs...6Tz5', reputation: 0.81, phase: 3, tasks_completed: 20, is_vouched: true, escrow_at_risk: 12.5, created_at: new Date('2026-01-01').toISOString() },
  { id: 6, wallet_address: '7eVm...2Gh9', reputation: 0.79, phase: 3, tasks_completed: 20, is_vouched: true, escrow_at_risk: 7.5, created_at: new Date('2026-02-10').toISOString() },
  // New nodes eligible to be vouched for (Phase 1, high task score)
  { id: 7, wallet_address: '1fXr...3Nt7', reputation: 0.45, phase: 1, tasks_completed: 19, is_vouched: false, escrow_at_risk: 0, created_at: new Date('2026-03-01').toISOString() },
  { id: 8, wallet_address: '5gYo...0Cq6', reputation: 0.38, phase: 1, tasks_completed: 18, is_vouched: false, escrow_at_risk: 0, created_at: new Date('2026-03-08').toISOString() },
  { id: 9, wallet_address: '2nPs...5Kj1', reputation: 0.32, phase: 1, tasks_completed: 17, is_vouched: false, escrow_at_risk: 0, created_at: new Date('2026-03-12').toISOString() },
  { id: 10, wallet_address: '6cDw...8Lm4', reputation: 0.29, phase: 1, tasks_completed: 16, is_vouched: false, escrow_at_risk: 0, created_at: new Date('2026-03-18').toISOString() },
  { id: 11, wallet_address: '0aJk...9Pz2', reputation: 0.21, phase: 1, tasks_completed: 15, is_vouched: false, escrow_at_risk: 0, created_at: new Date('2026-03-22').toISOString() },
  { id: 12, wallet_address: '3mQr...1Bv8', reputation: 0.18, phase: 1, tasks_completed: 14, is_vouched: false, escrow_at_risk: 0, created_at: new Date('2026-03-25').toISOString() },
];

const seedProposals = () => [
  { id: 1, title: 'Reduce minimum stake to 1.5 SOL',     votes_for: 142, votes_against: 38,  status: 'active', created_at: new Date('2026-03-25').toISOString() },
  { id: 2, title: 'Extend Phase 1 tasks from 20 to 15', votes_for: 89,  votes_against: 61,  status: 'active', created_at: new Date('2026-03-24').toISOString() },
  { id: 3, title: 'Increase reputation decay factor',   votes_for: 55,  votes_against: 110, status: 'active', created_at: new Date('2026-03-23').toISOString() },
];

const seedActivity = () => [
  { id: 1, wallet_address: DEMO_WALLET, type: 'phase',   message: 'Node registered — Phase 1 begins', created_at: new Date('2026-04-01T08:00:00').toISOString() },
];

// ─── Mutable store ─────────────────────────────────────────────────────────────

const store = {
  users:     seedUsers(),
  tasks:     [],
  proposals: seedProposals(),
  activity:  seedActivity(),
  vouches:   [],
};

// ─── Reset helper (called by /api/reset-demo or long-press logo) ──────────────

export function resetMockDb() {
  store.users     = seedUsers();
  store.tasks     = [];
  store.proposals = seedProposals();
  store.activity  = seedActivity();
  store.vouches   = [];
}

export default store;
