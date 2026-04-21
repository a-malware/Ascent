import sql from "@/app/api/utils/sql";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");

  try {
    let query;
    if (wallet) {
      query = sql`SELECT * FROM activity WHERE wallet_address = ${wallet} ORDER BY created_at DESC LIMIT 20`;
    } else {
      query = sql`SELECT * FROM activity ORDER BY created_at DESC LIMIT 50`;
    }
    const activities = await query;
    return Response.json({ activities });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Database error" }, { status: 500 });
  }
}
