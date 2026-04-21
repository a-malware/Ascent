import { resetMockDb } from "@/app/api/utils/mock-db.js";

/**
 * GET /api/reset-demo
 * Resets the in-memory mock database back to Phase-1 seed state.
 * Called by the client long-press reset action to keep server + client in sync.
 */
export async function GET() {
  resetMockDb();
  return Response.json({ ok: true, message: "Demo reset to Phase 1 state." });
}
