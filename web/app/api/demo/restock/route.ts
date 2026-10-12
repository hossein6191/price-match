// POST /api/demo/restock {product}: the demo shop adds to its own bond when one of its products is no
// longer covered by the free bond, so a visitor's purchase is not refused for reservations the
// visitors before them made. Rate-limited per product and in total, one signature at a time; answers
// the transaction hash, "already covered", or why not. Nothing here ever logs or returns the key.

import { sendRestock } from "@/lib/demo-server";
import { parseProductId } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Two reads (retried while Studio is slow), perhaps a faucet payment, and one signature.
export const maxDuration = 60;

const noStore = { "cache-control": "no-store" };

export async function POST(request: Request) {
  let id = "";
  try {
    const text = await request.text();
    if (text.length > 200) throw new Error("too long");
    const body = JSON.parse(text) as { product?: unknown };
    id = typeof body.product === "string" ? parseProductId(body.product) : "";
  } catch {
    id = "";
  }
  if (!id) return Response.json({ ok: false, reason: 'send {"product": "P1"}' }, { status: 400, headers: noStore });
  const answer = await sendRestock(id);
  return Response.json(answer.body, { status: answer.status, headers: noStore });
}
