// The demo shop, server side only (imported by app/api/demo/*). It holds a throwaway Studio test key
// from the DEMO_SHOP_KEY environment variable and signs exactly one kind of call with it: fund() on
// the demo shop, when one of its products is no longer covered by the free bond, so a visitor's
// purchase is never refused for a bond the visitors before them reserved. The key is never logged,
// never returned and never written anywhere; an answer names the shop's public address at most.

import { createAccount, createClient } from "genlayer-js";
import { getAddress, type Address } from "viem";

import { balanceOf, contractAddress, isMock, readProduct, readShopsOf, studio } from "./chain";
import { cleanKey, keyProblem } from "./demo-key";
import { DEMO_LIMITS, createLimiter } from "./demo-limit";
import { DEMO_SHOP_NAME, RESTOCK_AMOUNT, restockProblem } from "./demo-shop";
import { idNumber } from "./rules";
import { rpc, sleep } from "./rpc";
import type { DemoStatus } from "./types";

type Account = ReturnType<typeof createAccount>;
let account: { key: string; value: Account } | null = null;

/** The demo shop's account, or null when no usable key is configured. */
function demoAccount(): Account | null {
  const raw = process.env.DEMO_SHOP_KEY;
  if (keyProblem(raw)) return null;
  const key = cleanKey(raw);
  if (!account || account.key !== key) account = { key, value: createAccount(key as `0x${string}`) };
  return account.value;
}

export const NOT_OPEN = "the demo shop is not open on this contract yet (tools/open-demo-shop.mjs opens it)";
export const NOT_READ = "could not read the demo shop from Studio; try again in a minute";

// The demo shop's id is read once and kept for five minutes: it never changes for one contract.
let found: { contract: string; owner: string; shop: string; at: number } | null = null;

/** The newest shop this key opened under the demo name, or "" when it has none. */
async function demoShopId(owner: string): Promise<string> {
  const contract = contractAddress().toLowerCase();
  if (found && found.contract === contract && found.owner === owner && Date.now() - found.at < 300_000) return found.shop;
  const rows = (await readShopsOf(owner, 0, 20, { fresh: true })).data.rows;
  const mine = rows.filter((r) => r.name === DEMO_SHOP_NAME).sort((a, b) => idNumber(b.id) - idNumber(a.id));
  const shop = mine[0]?.id ?? "";
  if (shop) found = { contract, owner, shop, at: Date.now() };
  return shop;
}

/** Whether the demo shop can top up its bond now, and exactly why not. */
export async function demoStatusNow(): Promise<DemoStatus> {
  if (isMock) return { online: false, owner: "", shop: "", reason: "in the demo build the demo shop answers in the browser" };
  const problem = keyProblem(process.env.DEMO_SHOP_KEY);
  if (problem) return { online: false, owner: "", shop: "", reason: problem };
  const owner = demoAccount()!.address.toLowerCase();
  if (!contractAddress()) return { online: false, owner, shop: "", reason: "the contract is not deployed yet" };
  let shop = "";
  try {
    shop = await demoShopId(owner);
  } catch {
    return { online: false, owner, shop: "", reason: NOT_READ };
  }
  if (!shop) return { online: false, owner, shop: "", reason: NOT_OPEN };
  return { online: true, owner, shop, reason: "" };
}

const limiter = createLimiter(DEMO_LIMITS);

// One signature at a time: two top-ups signed at once would ask for the same nonce.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

/** The demo key pays for a top-up from its own balance; Studio's faucet refills it when it runs low. */
async function ensureBalance(owner: string, need: bigint): Promise<void> {
  const have = await balanceOf(owner);
  if (have >= need + 10n ** 18n) return;
  await rpc("sim_fundAccount", { account_address: getAddress(owner), amount: 50e18 });
  for (let i = 0; i < 15; i++) {
    await sleep(2000);
    if ((await balanceOf(owner)) > have) return;
  }
  throw new Error("the faucet did not pay");
}

export type DemoAnswer = { status: number; body: { ok: true; hash: string; already?: boolean } | { ok: false; reason: string; retryAfter?: number } };

/** Adds to the demo shop's bond so `product` is covered again, if it is the demo shop's and is not covered. */
export async function sendRestock(product: string): Promise<DemoAnswer> {
  const status = await demoStatusNow();
  if (!status.online) return { status: 503, body: { ok: false, reason: "the demo shop is offline: " + status.reason } };
  const a = demoAccount()!;
  const turn = limiter.attempt(product, Date.now());
  if (!turn.ok) return { status: 429, body: { ok: false, reason: `the demo shop was asked about ${product} a moment ago; try again in ${turn.retryAfter} s`, retryAfter: turn.retryAfter } };
  let row;
  try {
    row = (await readProduct(product, { fresh: true })).data;
  } catch {
    return { status: 502, body: { ok: false, reason: "could not read the product from Studio; try again in a minute" } };
  }
  const problem = restockProblem(row ? { id: row.id, shop: row.shop } : null, status.shop);
  if (problem) return { status: row ? 409 : 404, body: { ok: false, reason: problem } };
  if (row!.covered) return { status: 200, body: { ok: true, hash: "", already: true } };
  const short = BigInt(row!.priceAtto) - BigInt(row!.freeBondAtto);
  const amount = short > RESTOCK_AMOUNT ? short : RESTOCK_AMOUNT;
  try {
    const hash = await serial(async () => {
      await ensureBalance(a.address, amount);
      const client = createClient({ chain: studio, account: a });
      return client.writeContract({ address: contractAddress() as Address, functionName: "fund", args: [status.shop], value: amount });
    });
    if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("no hash");
    limiter.hold(product, DEMO_LIMITS.sentHoldMs, Date.now());
    return { status: 200, body: { ok: true, hash } };
  } catch {
    // Nothing of the error goes out: it is the network's, and it is not the visitor's business.
    return { status: 502, body: { ok: false, reason: "Studio did not take the demo shop's top-up; try again in a minute" } };
  }
}
