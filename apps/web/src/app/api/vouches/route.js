import sql from "@/app/api/utils/sql";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");
  const type = searchParams.get("type"); // 'given' or 'received' or 'eligible'

  try {
    if (type === "received") {
      const vouches =
        await sql`SELECT * FROM vouches WHERE recipient_wallet = ${wallet}`;
      return Response.json({ vouches });
    } else if (type === "given") {
      const vouches =
        await sql`SELECT * FROM vouches WHERE voucher_wallet = ${wallet}`;
      return Response.json({ vouches });
    } else if (type === "eligible") {
      // Users with high reputation who can vouch
      const users =
        await sql`SELECT * FROM users WHERE reputation >= 0.7 AND wallet_address != ${wallet}`;
      return Response.json({ users });
    } else {
      const vouches = await sql`SELECT * FROM vouches LIMIT 50`;
      return Response.json({ vouches });
    }
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { voucher_wallet, recipient_wallet, stake, status } =
      await request.json();

    if (!voucher_wallet || !recipient_wallet) {
      return Response.json(
        { error: "Voucher and recipient wallets are required" },
        { status: 400 },
      );
    }

    const result = await sql`
      INSERT INTO vouches (voucher_wallet, recipient_wallet, stake, status)
      VALUES (${voucher_wallet}, ${recipient_wallet}, ${stake || 0.0}, ${status || "pending"})
      RETURNING *
    `;

    // If accepted, update recipient's status and reputation
    if (status === "accepted") {
      await sql`UPDATE users SET is_vouched = TRUE, phase = 3, reputation = reputation + 0.1, escrow_at_risk = escrow_at_risk + ${stake || 0.0} WHERE wallet_address = ${recipient_wallet}`;

      // Add activity
      await sql`INSERT INTO activity (wallet_address, message, type) VALUES (${recipient_wallet}, 'Vouch accepted by ' || ${voucher_wallet}, 'vouch')`;
    }

    return Response.json({ vouch: result[0] });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}
