// GET /api/demo/status: whether the demo shop can top up its bond now, its owner's public address,
// the shop it runs, and exactly why not when it cannot ("no key set", "the key set is not a 0x
// private key of 64 hex characters", "the contract is not deployed yet", or that the demo shop is not
// open on this contract yet). The key itself is never echoed.

import { demoStatusNow } from "@/lib/demo-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One read of shops_of, retried while Studio is slow.
export const maxDuration = 60;

export async function GET() {
  return Response.json(await demoStatusNow(), { headers: { "cache-control": "no-store" } });
}
