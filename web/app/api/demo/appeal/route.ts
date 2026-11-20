// POST /api/demo/appeal {order, claim}: the demo shop appeals a pending matched finding on one of its
// own orders, with its fixed reason, so a visitor can watch an appeal's second reading. It adds 0.20
// GEN of its own credit first when it holds less than the 0.05 GEN bond. Rate-limited per claim and in
// total, one signature at a time; answers the appeal's hash or why not. Nothing here ever logs or
// returns the key.

import { sendAppeal } from "@/lib/demo-server";
import { parseClaimId, parseOrderId } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Three reads, perhaps a deposit followed until it lands, and one signature.
export const maxDuration = 120;

const noStore = { "cache-control": "no-store" };

export async function POST(request: Request) {
  let order = "";
  let claim = "";
  try {
    const text = await request.text();
    if (text.length > 200) throw new Error("too long");
    const body = JSON.parse(text) as { order?: unknown; claim?: unknown };
    order = typeof body.order === "string" ? parseOrderId(body.order) : "";
    claim = typeof body.claim === "string" ? parseClaimId(body.claim) : "";
  } catch {
    order = "";
  }
  if (!order || !claim) return Response.json({ ok: false, reason: 'send {"order": "O1", "claim": "C1"}' }, { status: 400, headers: noStore });
  const answer = await sendAppeal(order, claim);
  return Response.json(answer.body, { status: answer.status, headers: noStore });
}
