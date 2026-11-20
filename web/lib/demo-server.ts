// The demo shop, server side only (imported by app/api/demo/*). It holds a throwaway Studio test key
// from the DEMO_SHOP_KEY environment variable and signs four kinds of call with it, each only on the
// demo shop's own things: fund(), when one of its products is no longer covered by the free bond, so
// a visitor's purchase is never refused for a bond the visitors before them reserved; reprice(), to
// lower a demo product's price by 0.30 GEN or raise it back, so a visitor can test price protection;
// and deposit() then appeal(), to appeal a pending matched finding on one of its orders, so a visitor
// can watch an appeal. The key is never logged, never returned and never written anywhere; an answer
// names the shop's public address at most.

import { createAccount, createClient } from "genlayer-js";
import { getAddress, type Address } from "viem";

import { balanceOf, contractAddress, isMock, readAccount, readClaims, readOrder, readProduct, readShopsOf, studio, txStatus } from "./chain";
import { cleanKey, keyProblem } from "./demo-key";
import { DEMO_LIMITS, createLimiter } from "./demo-limit";
import { DEMO_APPEAL_REASON, RESTOCK_AMOUNT, demoAppealProblem, pickDemoShop, repricePlan, restockProblem } from "./demo-shop";
import { APPEAL_BOND } from "./rules";
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

// The demo shop's id is read once and kept for five minutes: it changes only when tools/open-demo-shop.mjs
// reopens the demo shop at a new commit, and then the site follows within five minutes.
let found: { contract: string; owner: string; shop: string; at: number } | null = null;

/** The newest shop this key opened under a demo name that lists products (lib/demo-shop.ts pickDemoShop), or "". */
async function demoShopId(owner: string): Promise<string> {
  const contract = contractAddress().toLowerCase();
  if (found && found.contract === contract && found.owner === owner && Date.now() - found.at < 300_000) return found.shop;
  const rows = (await readShopsOf(owner, 0, 20, { fresh: true })).data.rows;
  const shop = pickDemoShop(rows);
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

/** Signs one call with the demo key, after the faucet if its balance is low. Resolves to the hash. */
async function sign(a: Account, functionName: string, args: (string | number)[], value = 0n): Promise<string> {
  return serial(async () => {
    await ensureBalance(a.address, value);
    const client = createClient({ chain: studio, account: a });
    const hash = await client.writeContract({ address: contractAddress() as Address, functionName, args, value });
    if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("no hash");
    return hash;
  });
}

/** Lowers a demo product's price by 0.30 GEN ("down") or raises it back to its list price ("up"). */
export async function sendReprice(product: string, direction: "down" | "up"): Promise<DemoAnswer> {
  const status = await demoStatusNow();
  if (!status.online) return { status: 503, body: { ok: false, reason: "the demo shop is offline: " + status.reason } };
  const a = demoAccount()!;
  const turn = limiter.attempt("reprice:" + product, Date.now());
  if (!turn.ok) return { status: 429, body: { ok: false, reason: `the demo shop was asked about ${product} a moment ago; try again in ${turn.retryAfter} s`, retryAfter: turn.retryAfter } };
  let row;
  try {
    row = (await readProduct(product, { fresh: true })).data;
  } catch {
    return { status: 502, body: { ok: false, reason: "could not read the product from Studio; try again in a minute" } };
  }
  const plan = repricePlan(row ? { id: row.id, shop: row.shop, spec: row.spec, priceAtto: row.priceAtto, repricesLeft: row.repricesLeft } : null, status.shop, direction);
  if ("problem" in plan) return { status: row ? 409 : 404, body: { ok: false, reason: plan.problem } };
  try {
    const hash = await sign(a, "reprice", [product, plan.price.toString()]);
    return { status: 200, body: { ok: true, hash } };
  } catch {
    return { status: 502, body: { ok: false, reason: "Studio did not take the demo shop's price change; try again in a minute" } };
  }
}

/** Waits until a transaction is accepted or final; false when it failed or did not get there in time. */
async function landed(hash: string, ms: number): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    await sleep(3000);
    try {
      const s = await txStatus(hash);
      if (s.status === "ACCEPTED" || s.status === "FINALIZED") return s.exec !== "ERROR" && s.result?.ok !== false;
      if (s.status === "CANCELED" || s.undetermined) return false;
    } catch {
      /* a dropped poll is not a failed transaction */
    }
  }
  return false;
}

/** Appeals a pending matched finding on one of the demo shop's orders, with the demo shop's fixed reason. */
export async function sendAppeal(order: string, claim: string): Promise<DemoAnswer> {
  const status = await demoStatusNow();
  if (!status.online) return { status: 503, body: { ok: false, reason: "the demo shop is offline: " + status.reason } };
  const a = demoAccount()!;
  const turn = limiter.attempt("appeal:" + claim, Date.now());
  if (!turn.ok) return { status: 429, body: { ok: false, reason: `the demo shop was asked about ${claim} a moment ago; try again in ${turn.retryAfter} s`, retryAfter: turn.retryAfter } };
  let o, c, credit;
  try {
    o = (await readOrder(order, { fresh: true })).data;
    c = o ? (await readClaims(order, { fresh: true })).data.find((x) => x.id === claim) ?? null : null;
    credit = BigInt((await readAccount(a.address.toLowerCase(), { fresh: true })).data.creditAtto);
  } catch {
    return { status: 502, body: { ok: false, reason: "could not read the claim from Studio; try again in a minute" } };
  }
  const problem = demoAppealProblem(c ? { id: c.id, state: c.state, mayAppeal: c.mayAppeal, appealEnd: c.appealEnd, outcome: c.first.outcome } : null, o?.shop ?? "", status.shop, Math.floor(Date.now() / 1000));
  if (problem) return { status: c ? 409 : 404, body: { ok: false, reason: problem } };
  try {
    if (credit < APPEAL_BOND) {
      const deposit = await sign(a, "deposit", [], APPEAL_BOND * 4n);
      if (!(await landed(deposit, 90_000))) return { status: 502, body: { ok: false, reason: "the demo shop's credit for the appeal bond did not land in time; try again in a minute" } };
    }
    const hash = await sign(a, "appeal", [claim, DEMO_APPEAL_REASON]);
    limiter.hold("appeal:" + claim, DEMO_LIMITS.sentHoldMs, Date.now());
    return { status: 200, body: { ok: true, hash } };
  } catch {
    return { status: 502, body: { ok: false, reason: "Studio did not take the demo shop's appeal; try again in a minute" } };
  }
}
