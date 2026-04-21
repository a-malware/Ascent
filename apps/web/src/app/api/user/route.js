import sql from "@/app/api/utils/sql";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return Response.json(
      { error: "Wallet address is required" },
      { status: 400 },
    );
  }

  try {
    const users =
      await sql`SELECT * FROM users WHERE wallet_address = ${wallet}`;
    if (users.length === 0) {
      return Response.json({ user: null });
    }
    return Response.json({ user: users[0] });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const {
      wallet,
      reputation,
      phase,
      tasks_completed,
      is_vouched,
      escrow_at_risk,
    } = await request.json();

    if (!wallet) {
      return Response.json(
        { error: "Wallet address is required" },
        { status: 400 },
      );
    }

    const result = await sql`
      INSERT INTO users (wallet_address, reputation, phase, tasks_completed, is_vouched, escrow_at_risk)
      VALUES (${wallet}, ${reputation || 0.0}, ${phase || 1}, ${tasks_completed || 0}, ${is_vouched || false}, ${escrow_at_risk || 0.0})
      ON CONFLICT (wallet_address) DO UPDATE SET
        reputation = EXCLUDED.reputation,
        phase = EXCLUDED.phase,
        tasks_completed = EXCLUDED.tasks_completed,
        is_vouched = EXCLUDED.is_vouched,
        escrow_at_risk = EXCLUDED.escrow_at_risk
      RETURNING *
    `;

    return Response.json({ user: result[0] });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}
