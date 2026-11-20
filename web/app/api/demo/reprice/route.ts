// POST /api/demo/reprice {product, direction}: the demo shop lowers one of its demo products' price by
// 0.30 GEN ("down") or raises it back to its list price ("up"), so a visitor can test price protection.
// It keeps two recorded changes in hand, so a lowered price can always be raised back. Rate-limited
// per product and in total, one signature at a time; answers the transaction hash or why not. Nothing
// here ever logs or returns the key.

import { sendReprice } from "@/lib/demo-server";
import { parseProductId } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One read (retried while Studio is slow), perhaps a faucet payment, and one signature.
export const maxDuration = 60;

const noStore = { "cache-control": "no-store" };

export async function POST(request: Request) {
  let id = "";
  let direction = "";
  try {
    const text = await request.text();
    if (text.length > 200) throw new Error("too long");
    const body = JSON.parse(text) as { product?: unknown; direction?: unknown };
    id = typeof body.product === "string" ? parseProductId(body.product) : "";
    direction = body.direction === "down" || body.direction === "up" ? body.direction : "";
  } catch {
    id = "";
  }
  if (!id || !direction) return Response.json({ ok: false, reason: 'send {"product": "P1", "direction": "down"} or "up"' }, { status: 400, headers: noStore });
  const answer = await sendReprice(id, direction as "down" | "up");
  return Response.json(answer.body, { status: answer.status, headers: noStore });
}
