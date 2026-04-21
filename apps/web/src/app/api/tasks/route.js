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
    const tasks =
      await sql`SELECT * FROM tasks WHERE wallet_address = ${wallet} ORDER BY task_index ASC`;
    return Response.json({ tasks });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { wallet, task_index, proof, status } = await request.json();

    if (!wallet || task_index === undefined) {
      return Response.json(
        { error: "Wallet and task_index are required" },
        { status: 400 },
      );
    }

    const result = await sql`
      INSERT INTO tasks (wallet_address, task_index, proof, status)
      VALUES (${wallet}, ${task_index}, ${proof || ""}, ${status || "pending"})
      ON CONFLICT (wallet_address, task_index) DO UPDATE SET
        proof = EXCLUDED.proof,
        status = EXCLUDED.status
      RETURNING *
    `;

    // Automatically update tasks_completed count if status is verified
    if (status === "verified") {
      const verifiedCount =
        await sql`SELECT COUNT(*) FROM tasks WHERE wallet_address = ${wallet} AND status = 'verified'`;
      await sql`UPDATE users SET tasks_completed = ${parseInt(verifiedCount[0].count)} WHERE wallet_address = ${wallet}`;
    }

    return Response.json({ task: result[0] });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}
