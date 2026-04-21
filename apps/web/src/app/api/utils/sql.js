// ─────────────────────────────────────────────────────────────────────────────
// Mock SQL tagged-template-literal function.
// Replaces the Neon client — all API routes stay unchanged; only this file
// changes so that no DATABASE_URL is needed for demo purposes.
//
// Pattern matching: strings.raw[0].trim() uniquely identifies every query
// used in this app's API routes. Values are extracted positionally.
// ─────────────────────────────────────────────────────────────────────────────

import store from './mock-db.js';

let _nextId = 200;
const nextId = () => ++_nextId;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function byDateDesc(a, b) {
  return new Date(b.created_at) - new Date(a.created_at);
}

// ─── Main mock sql function ───────────────────────────────────────────────────

const sql = (strings, ...values) => {
  const raw = strings.raw[0].trim();

  // ── USERS ──────────────────────────────────────────────────────────────────

  // GET user by wallet
  if (raw.startsWith('SELECT * FROM users WHERE wallet_address')) {
    const wallet = values[0];
    return Promise.resolve(store.users.filter(u => u.wallet_address === wallet));
  }

  // GET eligible vouchers: reputation >= 0.7 AND wallet_address != ${wallet}
  if (raw.startsWith('SELECT * FROM users WHERE reputation')) {
    const exclude = values[0];
    return Promise.resolve(
      store.users.filter(u => u.reputation >= 0.7 && u.wallet_address !== exclude)
    );
  }

  // UPSERT user
  // INSERT INTO users (wallet_address, reputation, phase, tasks_completed, is_vouched, escrow_at_risk)
  // VALUES (${wallet}, ${rep}, ${phase}, ${tasks}, ${vouched}, ${escrow})
  // ON CONFLICT ... DO UPDATE ... RETURNING *
  if (raw.startsWith('INSERT INTO users')) {
    const [wallet_address, reputation, phase, tasks_completed, is_vouched, escrow_at_risk] = values;
    let user = store.users.find(u => u.wallet_address === wallet_address);
    if (user) {
      Object.assign(user, { reputation, phase, tasks_completed, is_vouched, escrow_at_risk });
    } else {
      user = { id: nextId(), wallet_address, reputation, phase, tasks_completed, is_vouched, escrow_at_risk, created_at: new Date().toISOString() };
      store.users.push(user);
    }
    return Promise.resolve([user]);
  }

  // UPDATE users SET tasks_completed = ${count} WHERE wallet_address = ${wallet}
  if (raw.startsWith('UPDATE users SET tasks_completed')) {
    const [count, wallet] = values;
    const user = store.users.find(u => u.wallet_address === wallet);
    if (user) user.tasks_completed = parseInt(count);
    return Promise.resolve([]);
  }

  // UPDATE users SET is_vouched = TRUE, phase = 3, reputation = reputation + 0.1 ...
  if (raw.startsWith('UPDATE users SET is_vouched')) {
    const [stake, recipient] = values;
    const user = store.users.find(u => u.wallet_address === recipient);
    if (user) {
      user.is_vouched = true;
      user.phase = 3;
      user.reputation = Math.min(1, user.reputation + 0.1);
      user.escrow_at_risk = (user.escrow_at_risk || 0) + (parseFloat(stake) || 0);
    }
    return Promise.resolve([]);
  }

  // ── TASKS ──────────────────────────────────────────────────────────────────

  // SELECT * FROM tasks WHERE wallet_address = ${wallet} ORDER BY task_index ASC
  if (raw.startsWith('SELECT * FROM tasks WHERE wallet_address')) {
    const wallet = values[0];
    return Promise.resolve(
      store.tasks
        .filter(t => t.wallet_address === wallet)
        .sort((a, b) => a.task_index - b.task_index)
    );
  }

  // SELECT COUNT(*) FROM tasks WHERE wallet_address = ${wallet} AND status = 'verified'
  if (raw.startsWith('SELECT COUNT(*) FROM tasks')) {
    const wallet = values[0];
    const count = store.tasks.filter(
      t => t.wallet_address === wallet && t.status === 'verified'
    ).length;
    return Promise.resolve([{ count: String(count) }]);
  }

  // INSERT INTO tasks (wallet_address, task_index, proof, status)
  // VALUES (${wallet}, ${idx}, ${proof}, ${status})
  // ON CONFLICT (wallet_address, task_index) DO UPDATE SET ... RETURNING *
  if (raw.startsWith('INSERT INTO tasks')) {
    const [wallet_address, task_index, proof, status] = values;
    let task = store.tasks.find(
      t => t.wallet_address === wallet_address && t.task_index === task_index
    );
    if (task) {
      Object.assign(task, { proof, status });
    } else {
      task = { id: nextId(), wallet_address, task_index, proof, status, created_at: new Date().toISOString() };
      store.tasks.push(task);
    }
    return Promise.resolve([task]);
  }

  // ── PROPOSALS ──────────────────────────────────────────────────────────────

  // SELECT * FROM proposals ORDER BY created_at DESC
  if (raw.startsWith('SELECT * FROM proposals')) {
    return Promise.resolve([...store.proposals].sort(byDateDesc));
  }

  // UPDATE proposals SET votes_for = votes_for + 1 WHERE id = ${id} RETURNING *
  if (raw.startsWith('UPDATE proposals SET votes_for')) {
    const id = parseInt(values[0]);
    const proposal = store.proposals.find(p => p.id === id);
    if (proposal) proposal.votes_for += 1;
    return Promise.resolve(proposal ? [proposal] : []);
  }

  // UPDATE proposals SET votes_against = votes_against + 1 WHERE id = ${id} RETURNING *
  if (raw.startsWith('UPDATE proposals SET votes_against')) {
    const id = parseInt(values[0]);
    const proposal = store.proposals.find(p => p.id === id);
    if (proposal) proposal.votes_against += 1;
    return Promise.resolve(proposal ? [proposal] : []);
  }

  // ── VOUCHES ────────────────────────────────────────────────────────────────

  // SELECT * FROM vouches WHERE recipient_wallet = ${wallet}
  if (raw.startsWith('SELECT * FROM vouches WHERE recipient_wallet')) {
    const wallet = values[0];
    return Promise.resolve(store.vouches.filter(v => v.recipient_wallet === wallet));
  }

  // SELECT * FROM vouches WHERE voucher_wallet = ${wallet}
  if (raw.startsWith('SELECT * FROM vouches WHERE voucher_wallet')) {
    const wallet = values[0];
    return Promise.resolve(store.vouches.filter(v => v.voucher_wallet === wallet));
  }

  // SELECT * FROM vouches LIMIT 50
  if (raw.startsWith('SELECT * FROM vouches LIMIT')) {
    return Promise.resolve(store.vouches.slice(0, 50));
  }

  // INSERT INTO vouches (voucher_wallet, recipient_wallet, stake, status)
  // VALUES (${voucher}, ${recipient}, ${stake}, ${status})
  if (raw.startsWith('INSERT INTO vouches')) {
    const [voucher_wallet, recipient_wallet, stake, status] = values;
    const vouch = { id: nextId(), voucher_wallet, recipient_wallet, stake, status, created_at: new Date().toISOString() };
    store.vouches.push(vouch);
    return Promise.resolve([vouch]);
  }

  // ── ACTIVITY ───────────────────────────────────────────────────────────────

  // SELECT * FROM activity WHERE wallet_address = ${wallet} ORDER BY created_at DESC LIMIT 20
  if (raw.startsWith('SELECT * FROM activity WHERE wallet_address')) {
    const wallet = values[0];
    return Promise.resolve(
      store.activity
        .filter(a => a.wallet_address === wallet)
        .sort(byDateDesc)
        .slice(0, 20)
    );
  }

  // SELECT * FROM activity ORDER BY created_at DESC LIMIT 50
  if (raw.startsWith('SELECT * FROM activity ORDER BY')) {
    return Promise.resolve([...store.activity].sort(byDateDesc).slice(0, 50));
  }

  // INSERT INTO activity (wallet_address, message, type) VALUES (...)
  // Two call patterns in this app:
  //   (a) 3 values → governance vote:  (wallet, vote_type, proposal_id)
  //   (b) 2 values → vouch accepted:   (recipient_wallet, voucher_wallet)
  if (raw.startsWith('INSERT INTO activity')) {
    let wallet_address, message, type;

    if (values.length === 3) {
      // Governance: 'Voted ' || ${vote_type} || ' on proposal ' || ${proposal_id}
      const [w, vote_type, proposal_id] = values;
      wallet_address = w;
      message = `Voted ${vote_type} on proposal ${proposal_id}`;
      type = 'vote';
    } else if (values.length === 2) {
      // Vouch accepted: 'Vouch accepted by ' || ${voucher_wallet}
      const [recipient, voucher_wallet] = values;
      wallet_address = recipient;
      message = `Vouch accepted by ${voucher_wallet}`;
      type = 'vouch';
    } else {
      wallet_address = values[0];
      message = 'Activity recorded';
      type = 'default';
    }

    const activity = {
      id: nextId(),
      wallet_address,
      message,
      type,
      created_at: new Date().toISOString(),
    };
    store.activity.push(activity);
    return Promise.resolve([activity]);
  }

  // ── Fallback ───────────────────────────────────────────────────────────────
  console.warn('[mock-sql] Unmatched query pattern:', raw.slice(0, 100));
  return Promise.resolve([]);
};

// Support the .transaction() method used by some Neon patterns
sql.transaction = async (fn) => fn(sql);

export default sql;