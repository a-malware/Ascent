import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const proposals =
      await sql`SELECT * FROM proposals ORDER BY created_at DESC`;
    return Response.json({ proposals });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { proposal_id, vote_type, wallet } = await request.json(); // vote_type: 'for' or 'against'

    if (!proposal_id || !vote_type) {
      return Response.json(
        { error: "Proposal ID and vote type are required" },
        { status: 400 },
      );
    }

    let result;
    if (vote_type === "for") {
      result =
        await sql`UPDATE proposals SET votes_for = votes_for + 1 WHERE id = ${proposal_id} RETURNING *`;
    } else {
      result =
        await sql`UPDATE proposals SET votes_against = votes_against + 1 WHERE id = ${proposal_id} RETURNING *`;
    }

    if (wallet) {
      await sql`INSERT INTO activity (wallet_address, message, type) VALUES (${wallet}, 'Voted ' || ${vote_type} || ' on proposal ' || ${proposal_id}, 'vote')`;
    }

    return Response.json({ proposal: result[0] });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}
