// A stand-in for the contract, in memory, for NEXT_PUBLIC_MOCK=1. lib/chain.ts delegates here.
//
// It follows contracts/price_match.py on everything deterministic: who may call what and when, the
// order of the checks and their refusal sentences word for word, the guarantee window on the clock,
// the bond and its reservations, where every atto goes, the counters, and every view answered in the
// contract's own JSON shape, so the mappers in lib/chain.ts run on the same rows in both modes. The
// one thing it cannot do is fetch a page and ask a model: the reading of a claimed page is SCRIPTED
// here from what the fifteen demo pages state (lib/demo-shop.ts), any other address cannot be fetched
// and stores nothing, and the demo bar says so on every page.
//
// The visitor acts as one of a few demo accounts. The demo shop runs Harbour Lane Goods and tops up
// its bond when asked (demoRestock, the in-memory twin of POST /api/demo/restock). A few finished
// orders are seeded so the ledger and the receipts have something to show, and the clock can be
// moved on so a closed window can be seen. State lasts as long as the tab.

import type { Call, DemoStatus, RestockAnswer, TxStatus, WriteFn } from "./types.ts";
import { notify } from "./browser-store.ts";
import { REPO_URL } from "./config.ts";
import { DEMO_BOND, DEMO_PAGES, DEMO_PRODUCTS, DEMO_SHOP_NAME, RESTOCK_AMOUNT, demoPrefixes, rawBase, repoOf, restockProblem, scriptedReading } from "./demo-shop.ts";
import {
  ADDRESS_CHARS,
  CLAIM_FEE,
  ID_CHARS,
  MATCH_ON,
  MAX_CLAIMS,
  MAX_NAME,
  MAX_PAGE,
  MAX_PREFIX,
  MAX_PREFIXES,
  MAX_PRICE,
  MAX_PRODUCTS,
  MAX_SPEC,
  MAX_TITLE,
  MAX_URL,
  MAX_WINDOW,
  MIN_NAME,
  MIN_PAGE,
  MIN_PRICE,
  MIN_SPEC,
  MIN_TITLE,
  MIN_WINDOW,
  MONEY_WORDS,
  PAGE,
  QUESTION_DIFFERENT,
  QUESTION_PRICE,
  QUESTION_SAME,
  READING,
  REJUDGE_GAP,
  moneyProblem,
  numberArg,
  outcomeOf,
  phaseOf,
  prefixesProblem,
  pyStrip,
  textProblem,
  under,
  urlProblem,
  type EndedBy,
  type FeeTo,
  type OrderStatus,
  type Outcome,
  type ProductWord,
} from "./rules.ts";

const GEN = 10n ** 18n;
export const MOCK_CONTRACT = "0x0000000000000000000000000000000000c1a1e0";
/** The commit the demo build pretends its demo pages are pinned to. */
export const MOCK_COMMIT = "0123456789abcdef0123456789abcdef01234567";
export const MOCK_REPO = repoOf(REPO_URL) || "demo-owner/price-match";
export const MOCK_PREFIXES = demoPrefixes(MOCK_REPO, MOCK_COMMIT);

const inBrowser = typeof window !== "undefined";
const delay = (ms: number) => (inBrowser ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

// ---- the clock -----------------------------------------------------------------------------------

let clockOffset = 0;
/** The mock's message clock, in seconds: the browser's clock plus however far the visitor moved it on. */
export const mockNow = (): number => Math.floor(Date.now() / 1000) + clockOffset;
/** How far the clock has been moved on, in seconds: a stable snapshot for useSyncExternalStore. */
export const mockClockOffset = (): number => clockOffset;
/** Moves the mock clock on, so a window that is still open can be seen closed. */
export function advanceClock(seconds: number): void {
  clockOffset += Math.max(0, Math.floor(seconds));
  notify();
}

// ---- who the visitor is acting as -----------------------------------------------------------------

export type Persona = { address: string; name: string; note: string };

export const VISITOR = "0x5e1a3c9b07d24f68a1e3c5b7d9f0a2c4e6b8d0f1";
export const MY_SHOP = "0x7a2c4e6f81b3d5a7c9e0f2a4b6d8c0e1f3a5b7c9";
export const DEMO_SHOP = "0xd3e5f7a9b1c2d4e6f8a0b2c4d6e8f0a1b3c5d7e9";
export const EARLIER_BUYER = "0xb4d6f8a0c2e4a6b8d0f2c4e6a8b0d2f4c6e8a0b2";
export const PASSER_BY = "0x91c3e5a7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9";

/** The accounts a visitor can act as in mock mode. The first is a newcomer with test GEN. */
export const PERSONAS: Persona[] = [
  { address: VISITOR, name: "You, a buyer", note: "buy from the demo shop, claim with a competitor page" },
  { address: MY_SHOP, name: "You, a shop owner", note: "Quayside Kitchen runs S2; O6 can be released" },
  { address: EARLIER_BUYER, name: "An earlier buyer", note: "five judged claims, one order still open" },
  { address: PASSER_BY, name: "A passer-by", note: "anyone may release an order once its window ends" },
  { address: DEMO_SHOP, name: "The demo shop", note: "owns Harbour Lane Goods, S1" },
];

let persona = VISITOR;
/** The address the mock treats as the connected wallet. */
export const mockAddress = (): string => persona;
export function setMockPersona(address: string): void {
  if (PERSONAS.some((p) => p.address === address)) persona = address;
  notify();
}

// ---- balances -------------------------------------------------------------------------------------

const balances = new Map<string, bigint>([
  [VISITOR, 25n * GEN],
  [MY_SHOP, 15n * GEN],
  [DEMO_SHOP, 40n * GEN],
  [EARLIER_BUYER, 30n * GEN],
  [PASSER_BY, 3n * GEN],
]);
const balance = (a: string) => balances.get(a.toLowerCase()) ?? 0n;
const credit = (a: string, v: bigint) => {
  balances.set(a.toLowerCase(), balance(a) + v);
  notify();
};
/** The balance as a decimal string: a stable snapshot for useSyncExternalStore. */
export const mockBalanceText = (address: string): string => balance(address).toString();
/** The contract's own balance: every bond plus every claim-fee credit. */
let contractBalance = 0n;
export const mockContractBalance = (): bigint => contractBalance;

// ---- the contract's state -----------------------------------------------------------------------

type ShopRec = {
  owner: string;
  name: string;
  prefixes_json: string;
  bond: bigint;
  reserved: bigint;
  funded: bigint;
  withdrawn: bigint;
  refunded: bigint;
  sales: bigint;
  fees_won: bigint;
  n_products: number;
  n_orders: number;
  n_open: number;
  opened_at: number;
};

type ProductRec = { shop_id: string; title: string; spec: string; price: bigint; window: number; listed_at: number; n_orders: number };

type OrderRec = {
  product_id: string;
  shop_id: string;
  buyer: string;
  price: bigint;
  bought_at: number;
  window_end: number;
  reserved: bigint;
  status: OrderStatus;
  ended_by: EndedBy;
  claims: string[];
  refunded: bigint;
  closed_at: number;
};

type ClaimRec = { order_id: string; url: string; product: ProductWord; price: string; outcome: Outcome; refund: bigint; fee_to: FeeTo; at: number };

const shopRows = new Map<string, ShopRec>();
const productRows = new Map<string, ProductRec>();
const orderRows = new Map<string, OrderRec>();
const claimRows = new Map<string, ClaimRec>();
const shopNames = new Map<string, string>();
const lists = new Map<string, string[]>();
const credits = new Map<string, bigint>();
const n = {
  shop_count: 0,
  product_count: 0,
  order_count: 0,
  claim_count: 0,
  bonds: 0n,
  reserved_total: 0n,
  credits: 0n,
  funded_total: 0n,
  withdrawn_total: 0n,
  sales_total: 0n,
  refunded_total: 0n,
  fees_total: 0n,
  deposited_total: 0n,
  credit_out: 0n,
  returned: 0n,
  n_refused: 0,
  n_matched: 0,
  n_not_cheaper: 0,
  n_different: 0,
  n_unclear: 0,
  n_released: 0,
};

/** A refusal that raises: nothing is stored, and the receipt carries the sentence. */
class Refused extends Error {}
const fail = (message: string): never => {
  throw new Refused("[EXPECTED] " + message);
};
/** A round that stores nothing: the page could not be read. The tag is the contract's. */
class NotSettled extends Error {}

type Ctx = { sender: string; value: bigint; now: number };
type Row = Record<string, unknown>;

const isStr = (v: unknown): v is string => typeof v === "string";

const clock = (c: Ctx): number => {
  if (c.now < 0) fail("no readable clock on this transaction; no window can be measured");
  return c.now;
};

function shopOf(id: string): ShopRec {
  const s = shopRows.get(id);
  if (!s) return fail("no shop " + id.slice(0, ID_CHARS));
  return s;
}
function orderOf(id: string): OrderRec {
  const o = orderRows.get(id);
  if (!o) return fail("no order " + id.slice(0, ID_CHARS));
  return o;
}

const push = (key: string, id: string) => lists.set(key, [...(lists.get(key) ?? []), id]);
const count = (key: string) => (lists.get(key) ?? []).length;
const creditOf = (who: string) => credits.get(who) ?? 0n;

function transfer(to: string, value: bigint): void {
  contractBalance -= value;
  credit(to, value);
}

// ---- the writes -----------------------------------------------------------------------------------

function openShop(c: Ctx, rawName: unknown, rawList: unknown): Row {
  if (!isStr(rawName) || !isStr(rawList)) fail("the name and the competitor list are strings");
  const name = pyStrip(rawName as string);
  let problem = textProblem(name, MIN_NAME, MAX_NAME, "the name");
  if (problem) fail(problem);
  const parsed = prefixesProblem(rawList as string);
  problem = parsed.problem;
  if (problem) fail(problem);
  const who = c.sender;
  const nameKey = who + "|" + name.toLowerCase();
  const existing = shopNames.get(nameKey);
  if (existing) fail("this address already opened a shop named " + name + ", " + existing);
  const now = clock(c);
  n.shop_count++;
  const id = "S" + n.shop_count;
  shopRows.set(id, {
    owner: who, name, prefixes_json: JSON.stringify(parsed.prefixes), bond: 0n, reserved: 0n, funded: 0n, withdrawn: 0n,
    refunded: 0n, sales: 0n, fees_won: 0n, n_products: 0, n_orders: 0, n_open: 0, opened_at: now,
  });
  shopNames.set(nameKey, id);
  push("owner:" + who, id);
  return { ok: true, shop: id, owner: who, name, competitors: parsed.prefixes, opened_at: now };
}

function refuse(sender: string, value: bigint, reason: string, fields: Row): Row {
  n.n_refused++;
  n.returned += value;
  if (value > 0n) transfer(sender, value);
  return { ok: false, ...fields, reason, returned: value.toString() };
}

function fund(c: Ctx, raw: unknown): Row {
  const value = c.value;
  const who = c.sender;
  let problem = "";
  let id = "";
  if (!isStr(raw)) problem = "the shop id is a string";
  else {
    id = pyStrip(raw);
    if (!shopRows.has(id)) problem = "no shop " + id.slice(0, ID_CHARS);
  }
  if (!problem) {
    const shop = shopRows.get(id)!;
    if (who !== shop.owner) problem = "only the owner of " + id + " may fund its bond";
    else if (value <= 0n) problem = "send the amount to add to the bond with the call";
  }
  if (problem) return refuse(who, value, problem, { shop: id.slice(0, ID_CHARS) });
  const shop = shopRows.get(id)!;
  shop.bond += value;
  shop.funded += value;
  n.bonds += value;
  n.funded_total += value;
  return { ok: true, shop: id, added: value.toString(), bond: shop.bond.toString(), reserved: shop.reserved.toString(), free: (shop.bond - shop.reserved).toString() };
}

function withdrawBond(c: Ctx, raw: unknown, rawAmount: unknown): Row {
  if (!isStr(raw)) fail("the shop id is a string");
  const id = pyStrip(raw as string);
  const shop = shopOf(id);
  if (c.sender !== shop.owner) fail("only the owner of " + id + " may withdraw its bond");
  const amount = numberArg(rawAmount);
  const free = shop.bond - shop.reserved;
  if (amount <= 0n) fail("the amount is a whole number of atto above zero");
  if (amount > free)
    fail("only " + free + " atto of the bond of " + id + " is free; " + shop.reserved + " is reserved for open orders until their windows end or their claims settle");
  shop.bond -= amount;
  shop.withdrawn += amount;
  n.bonds -= amount;
  n.withdrawn_total += amount;
  transfer(shop.owner, amount);
  return { ok: true, shop: id, withdrawn: amount.toString(), bond: shop.bond.toString(), reserved: shop.reserved.toString(), free: (free - amount).toString() };
}

function listProduct(c: Ctx, rawShop: unknown, rawTitle: unknown, rawSpec: unknown, rawPrice: unknown, rawWindow: unknown): Row {
  if (!isStr(rawShop) || !isStr(rawTitle) || !isStr(rawSpec)) fail("the shop id, the title and the spec are strings");
  const id = pyStrip(rawShop as string);
  const title = pyStrip(rawTitle as string);
  const spec = pyStrip(rawSpec as string);
  const shop = shopOf(id);
  if (c.sender !== shop.owner) fail("only the owner of " + id + " may list a product in it");
  if (shop.n_products >= MAX_PRODUCTS) fail(id + " already lists " + MAX_PRODUCTS + " products, the most one shop may; open another shop for more");
  let problem = textProblem(title, MIN_TITLE, MAX_TITLE, "the title");
  if (problem) fail(problem);
  problem = textProblem(spec, MIN_SPEC, MAX_SPEC, "the spec");
  if (problem) fail(problem);
  problem = moneyProblem(spec);
  if (problem) fail(problem);
  const price = numberArg(rawPrice);
  const window = numberArg(rawWindow);
  if (price < MIN_PRICE || price > MAX_PRICE) fail("the price is a whole number of atto from " + MIN_PRICE + " (0.1 GEN) to " + MAX_PRICE + " (100 GEN)");
  if (window < BigInt(MIN_WINDOW) || window > BigInt(MAX_WINDOW)) fail("the guarantee window is " + MIN_WINDOW + " to " + MAX_WINDOW + " seconds");
  const now = clock(c);
  n.product_count++;
  const pid = "P" + n.product_count;
  productRows.set(pid, { shop_id: id, title, spec, price, window: Number(window), listed_at: now, n_orders: 0 });
  shop.n_products++;
  push("products:" + id, pid);
  return { ok: true, product: pid, shop: id, title, price: price.toString(), window: Number(window), listed_at: now };
}

function buy(c: Ctx, raw: unknown): Row {
  const value = c.value;
  const who = c.sender;
  let problem = "";
  let pid = "";
  if (!isStr(raw)) problem = "the product id is a string";
  else {
    pid = pyStrip(raw);
    if (!productRows.has(pid)) problem = "no product " + pid.slice(0, ID_CHARS);
  }
  let now = -1;
  if (!problem) {
    const product = productRows.get(pid)!;
    const shop = shopRows.get(product.shop_id)!;
    now = c.now;
    const free = shop.bond - shop.reserved;
    if (who === shop.owner) problem = "the shop that lists " + pid + " may not buy it";
    else if (now < 0) problem = "no readable clock on this transaction; no window can be measured";
    else if (value !== product.price) problem = "send exactly the price of " + product.price + " atto to buy " + pid + "; this one sent " + value;
    else if (free < product.price)
      problem =
        "the free bond of " + product.shop_id + " is " + free + " atto and does not cover the price; a sale is taken only while the bond covers the most a match can give back";
  }
  if (problem) return refuse(who, value, problem, { product: pid.slice(0, ID_CHARS), order: "" });
  const product = productRows.get(pid)!;
  const sid = product.shop_id;
  const shop = shopRows.get(sid)!;
  n.order_count++;
  const oid = "O" + n.order_count;
  const end = now + product.window;
  orderRows.set(oid, {
    product_id: pid, shop_id: sid, buyer: who, price: value, bought_at: now, window_end: end, reserved: value, status: "open",
    ended_by: "", claims: [], refunded: 0n, closed_at: 0,
  });
  product.n_orders++;
  shop.n_orders++;
  shop.n_open++;
  shop.reserved += value;
  shop.sales += value;
  n.reserved_total += value;
  n.sales_total += value;
  push("buyer:" + who, oid);
  push("orders:" + sid, oid);
  transfer(shop.owner, value);
  return {
    ok: true, order: oid, product: pid, shop: sid, buyer: who, price: value.toString(), forwarded: value.toString(), reserved: value.toString(),
    bought_at: now, window_end: end, status: "open",
  };
}

function deposit(c: Ctx): Row {
  const value = c.value;
  const who = c.sender;
  if (value <= 0n) return refuse(who, value, "send the credit to add with the call", {});
  credits.set(who, creditOf(who) + value);
  n.credits += value;
  n.deposited_total += value;
  return { ok: true, address: who, added: value.toString(), credit: creditOf(who).toString() };
}

function withdraw(c: Ctx): Row {
  const who = c.sender;
  const amount = creditOf(who);
  if (amount <= 0n) fail("this address holds no claim-fee credit");
  credits.set(who, 0n);
  n.credits -= amount;
  n.credit_out += amount;
  transfer(who, amount);
  return { ok: true, address: who, withdrawn: amount.toString(), credit: "0" };
}

function lastJudged(order: OrderRec, url: string): number {
  let last = -1;
  for (const id of order.claims.slice(0, MAX_CLAIMS)) {
    const row = claimRows.get(id)!;
    if (row.url === url) last = Math.max(last, row.at);
  }
  return last;
}

/** The single exit for an order: release its reservation, then pay a match from the bond. */
function endOrder(order: OrderRec, endedBy: EndedBy, now: number, refund: bigint): void {
  const shop = shopRows.get(order.shop_id)!;
  const held = order.reserved;
  order.reserved = 0n;
  order.status = endedBy === "match" ? "matched" : "released";
  order.ended_by = endedBy;
  order.closed_at = now;
  order.refunded = refund;
  shop.reserved -= held;
  shop.n_open--;
  n.reserved_total -= held;
  if (endedBy !== "match") n.n_released++;
  if (refund > 0n) {
    shop.bond -= refund;
    shop.refunded += refund;
    n.bonds -= refund;
    n.refunded_total += refund;
    transfer(order.buyer, refund);
  }
}

function claim(c: Ctx, rawOrder: unknown, rawUrl: unknown): Row {
  if (!isStr(rawOrder) || !isStr(rawUrl)) fail("the order id and the page address are strings");
  const oid = pyStrip(rawOrder as string);
  const url = pyStrip(rawUrl as string);
  const order = orderOf(oid);
  const who = c.sender;
  if (who !== order.buyer) fail("only the buyer of " + oid + " may claim on it");
  if (order.status !== "open") fail(oid + " is " + order.status + "; a claim is taken while the order is open");
  const now = clock(c);
  if (now >= order.window_end) fail("the guarantee window of " + oid + " has closed; release(" + oid + ") frees the reserved bond");
  if (order.claims.length >= MAX_CLAIMS) fail(oid + " has had its " + MAX_CLAIMS + " judged claims");
  const shop = shopRows.get(order.shop_id)!;
  const problem = urlProblem(url, MAX_URL, "the page address");
  if (problem) fail(problem);
  if (!under(url, JSON.parse(shop.prefixes_json) as string[]))
    fail("the page is not below any competitor prefix " + order.shop_id + " accepted; shop(" + order.shop_id + ") lists them");
  const last = lastJudged(order, url);
  if (last >= 0 && now - last < REJUDGE_GAP)
    fail(
      "this page was judged for " + oid + " " + (now - last) + " seconds ago; the same page may be judged again " + REJUDGE_GAP +
        " seconds after its last judgment, while the window is open, once its price may have changed; or point at another page now",
    );
  const held = creditOf(who);
  if (held < CLAIM_FEE) fail("a claim stakes " + CLAIM_FEE + " atto (0.01 GEN) of claim-fee credit and this address holds " + held + "; deposit() first");
  const product = productRows.get(order.product_id)!;
  const reading = scriptedReading(url, product.spec);
  if ("error" in reading) throw new NotSettled(reading.error);
  const word = reading.product;
  const price = word === "same" ? reading.price : "";
  const ours = order.price;
  const outcome = outcomeOf(word, price, ours);
  const refund = outcome === "matched" ? ours - BigInt(price) : 0n;
  const feeTo: FeeTo = outcome === "different" ? "shop" : "buyer";
  n.claim_count++;
  const cid = "C" + n.claim_count;
  claimRows.set(cid, { order_id: oid, url, product: word, price, outcome, refund, fee_to: feeTo, at: now });
  order.claims = [...order.claims.slice(0, MAX_CLAIMS), cid];
  if (outcome === "matched") n.n_matched++;
  else if (outcome === "not_cheaper") n.n_not_cheaper++;
  else if (outcome === "different") n.n_different++;
  else n.n_unclear++;
  if (feeTo === "shop") {
    credits.set(who, held - CLAIM_FEE);
    n.credits -= CLAIM_FEE;
    shop.fees_won += CLAIM_FEE;
    n.fees_total += CLAIM_FEE;
  }
  if (outcome === "matched") endOrder(order, "match", now, refund);
  else if (order.claims.length >= MAX_CLAIMS) endOrder(order, "claims", now, 0n);
  if (feeTo === "shop") transfer(shop.owner, CLAIM_FEE);
  return {
    ok: true, order: oid, claim: cid, url, product: word, price, outcome, refund: refund.toString(), fee_to: feeTo, status: order.status,
    claims: order.claims.length, claims_left: order.status === "open" ? MAX_CLAIMS - order.claims.length : 0, reserved: order.reserved.toString(),
    credit: creditOf(who).toString(),
  };
}

function release(c: Ctx, raw: unknown): Row {
  if (!isStr(raw)) fail("the order id is a string");
  const oid = pyStrip(raw as string);
  const order = orderOf(oid);
  if (order.status !== "open") fail(oid + " is " + order.status + "; its reservation was already released");
  const now = clock(c);
  if (now < order.window_end) fail("the guarantee window of " + oid + " runs for another " + (order.window_end - now) + " seconds; its price stays reserved until then");
  const freed = order.reserved;
  endOrder(order, "window", now, 0n);
  const shop = shopRows.get(order.shop_id)!;
  return { ok: true, order: oid, status: "released", freed: freed.toString(), shop: order.shop_id, free: (shop.bond - shop.reserved).toString() };
}

function run(fn: WriteFn, args: unknown[], c: Ctx): Row {
  switch (fn) {
    case "open_shop":
      return openShop(c, args[0], args[1]);
    case "fund":
      return fund(c, args[0]);
    case "withdraw_bond":
      return withdrawBond(c, args[0], args[1]);
    case "list_product":
      return listProduct(c, args[0], args[1], args[2], args[3], args[4]);
    case "buy":
      return buy(c, args[0]);
    case "deposit":
      return deposit(c);
    case "withdraw":
      return withdraw(c);
    case "claim":
      return claim(c, args[0], args[1]);
    case "release":
      return release(c, args[0]);
  }
}

// ---- the views ------------------------------------------------------------------------------------

function shopRow(id: string): Row {
  const s = shopRows.get(id)!;
  return {
    shop: id, owner: s.owner, name: s.name, competitors: JSON.parse(s.prefixes_json), bond: s.bond.toString(), reserved: s.reserved.toString(),
    free: (s.bond - s.reserved).toString(), funded: s.funded.toString(), withdrawn: s.withdrawn.toString(), refunded: s.refunded.toString(),
    sales: s.sales.toString(), fees_won: s.fees_won.toString(), products: s.n_products, orders: s.n_orders, open_orders: s.n_open, opened_at: s.opened_at,
  };
}

function productRow(id: string): Row {
  const p = productRows.get(id)!;
  const s = shopRows.get(p.shop_id)!;
  const free = s.bond - s.reserved;
  return {
    product: id, shop: p.shop_id, shop_name: s.name, owner: s.owner, title: p.title, spec: p.spec, price: p.price.toString(), window: p.window,
    listed_at: p.listed_at, orders: p.n_orders, free_bond: free.toString(), covered: free >= p.price,
  };
}

function orderRow(id: string, now: number): Row {
  const o = orderRows.get(id)!;
  const p = productRows.get(o.product_id)!;
  return {
    order: id, product: o.product_id, shop: o.shop_id, title: p.title, buyer: o.buyer, price: o.price.toString(), bought_at: o.bought_at,
    window_end: o.window_end, reserved: o.reserved.toString(), status: o.status, ended_by: o.ended_by, phase: phaseOf(o.status, o.window_end, now),
    claims: o.claims.slice(0, MAX_CLAIMS), claims_left: o.status === "open" ? MAX_CLAIMS - o.claims.length : 0, refunded: o.refunded.toString(),
    closed_at: o.closed_at, now,
  };
}

function claimRow(id: string): Row {
  const c = claimRows.get(id)!;
  return { claim: id, order: c.order_id, url: c.url, product: c.product, price: c.price, outcome: c.outcome, refund: c.refund.toString(), fee_to: c.fee_to, at: c.at };
}

function page(key: string, offset: unknown, limit: unknown): { total: number; start: number; size: number; ids: string[] } {
  const all = lists.get(key) ?? [];
  const off = numberArg(offset);
  const start = Number(off < 0n ? 0n : off);
  let size = Number(numberArg(limit));
  size = size < 1 || size > PAGE ? PAGE : size;
  return { total: all.length, start, size, ids: all.slice(start, Math.min(all.length, start + size)) };
}

/** rules(), as the contract publishes it. */
const RULES = {
  value: '{"product": "same" | "different" | "unclear", "price": "<atto>" or ""}',
  askings: [
    "1, blocks SPEC then PAGE: " + QUESTION_SAME,
    "2, blocks PAGE then SPEC: " + QUESTION_DIFFERENT,
    "3, blocks SPEC then PAGE: " + QUESTION_PRICE,
    "4, blocks PAGE then SPEC: " + QUESTION_PRICE,
  ],
  reading: READING,
  combine: {
    product: { "yes then no": "same", "no then yes": "different", "anything else": "unclear" },
    price:
      "asked only when the product is same; each answer is read as a plain decimal with at most 18 places and normalised to an integer of atto; kept only when both orders give the same integer, else empty",
  },
  compared:
    "the whole value, by exact equality; every validator fetches the page and asks every asking itself inside one consensus block, and never agrees with a leader that raised",
  model_sees: "the product's spec and the fetched page; never our price, an address, a name or a date",
  match_on: MATCH_ON.slice(0, 4).join(", ") + ", and " + MATCH_ON[4] + "; nothing else in the spec counts",
  outcomes: {
    matched:
      "same, and the page's price is below ours: the difference is paid to the buyer from the reserved bond in the same transaction, the claim fee stays with the buyer, and the order closes",
    not_cheaper: "same, and the page's price is not below ours: nothing moves",
    different: "the page offers another product: the 0.01 GEN claim fee goes to the shop",
    unclear: "anything else, including a same product with no agreed price: nothing moves",
  },
  money: {
    fund: "the owner adds to the shop's bond",
    withdraw_bond: "the owner takes back bond no open order has reserved",
    buy: "the buyer pays exactly the price; it goes to the shop in the same transaction, and the same amount of the shop's bond is reserved for the order",
    deposit: "claim-fee credit; withdraw() returns all of it",
    claim: "stakes 0.01 GEN of credit; back on matched, not cheaper and unclear, to the shop on different",
    release: "after the window, the order's reservation goes back to the shop's free bond",
    refusal: "a refused payable call returns everything sent, in the same transaction",
    balance: "the contract holds exactly every shop's bond plus every address's claim-fee credit",
  },
  who: {
    open_shop: "anyone; the sender is the owner; one shop per name per address; prefixes fixed for good",
    fund: "the owner",
    withdraw_bond: "the owner, up to the free bond",
    list_product: "the owner, at most " + MAX_PRODUCTS + " products per shop",
    buy: "anyone but the owner, with exactly the price, while the free bond covers it",
    deposit: "anyone, for their own credit",
    withdraw: "anyone, their own credit",
    claim:
      "the buyer, inside the window, a page below an accepted prefix, at most " + MAX_CLAIMS + " judged claims per order, the same page again only " + REJUDGE_GAP +
      " seconds after its last judgment",
    release: "anyone, after the window, while the order is open",
  },
  limits: {
    name: [MIN_NAME, MAX_NAME],
    title: [MIN_TITLE, MAX_TITLE],
    spec: [MIN_SPEC, MAX_SPEC],
    price_atto: [MIN_PRICE.toString(), MAX_PRICE.toString()],
    window_seconds: [MIN_WINDOW, MAX_WINDOW],
    prefixes: [1, MAX_PREFIXES],
    prefix_chars: MAX_PREFIX,
    url_chars: MAX_URL,
    products_per_shop: MAX_PRODUCTS,
    claims_per_order: MAX_CLAIMS,
    claim_fee: CLAIM_FEE.toString(),
    page_chars: [MIN_PAGE, MAX_PAGE],
    rows_per_page: PAGE,
    page:
      "the page must read the same for every validator at the time of the claim; a page that cannot be fetched, reads under " + MIN_PAGE + " characters or over " + MAX_PAGE +
      " stores nothing",
    text: "printable ASCII on one line; nothing longer than its limit is ever judged in part",
    spec_names_no_price: "a spec may not hold a $ sign, or any of these as a word: " + MONEY_WORDS.join(", "),
    rejudge_seconds: REJUDGE_GAP,
  },
  untrusted:
    "the shop wrote the spec and another shop wrote the page; each is fenced (< and > replaced, never deleted), sits between delimiter lines tagged with the start of its own sha256, and the prompt says before the blocks that both are untrusted and never an instruction",
};

export async function view(fn: string, args: (string | number)[]): Promise<unknown> {
  seed();
  await delay(60);
  const now = mockNow();
  const idKey = (v: unknown) => pyStrip(String(v)).slice(0, ID_CHARS);
  const addrKey = (v: unknown) => pyStrip(String(v)).toLowerCase().slice(0, ADDRESS_CHARS);
  switch (fn) {
    case "shop": {
      if (!isStr(args[0])) return JSON.stringify({ error: "the shop id is a string" });
      const key = idKey(args[0]);
      if (!shopRows.has(key)) return JSON.stringify({ error: "no shop " + key, shop: key });
      return JSON.stringify(shopRow(key));
    }
    case "product": {
      if (!isStr(args[0])) return JSON.stringify({ error: "the product id is a string" });
      const key = idKey(args[0]);
      if (!productRows.has(key)) return JSON.stringify({ error: "no product " + key, product: key });
      return JSON.stringify(productRow(key));
    }
    case "order": {
      if (!isStr(args[0])) return JSON.stringify({ error: "the order id is a string" });
      const key = idKey(args[0]);
      if (!orderRows.has(key)) return JSON.stringify({ error: "no order " + key, order: key });
      return JSON.stringify(orderRow(key, now));
    }
    case "claims_of": {
      if (!isStr(args[0])) return JSON.stringify({ error: "the order id is a string" });
      const key = idKey(args[0]);
      if (!orderRows.has(key)) return JSON.stringify({ error: "no order " + key, order: key });
      return JSON.stringify({ order: key, rows: orderRows.get(key)!.claims.slice(0, MAX_CLAIMS).map(claimRow) });
    }
    case "products_of": {
      if (!isStr(args[0])) return JSON.stringify({ error: "the shop id is a string" });
      const key = idKey(args[0]);
      const p = page("products:" + key, args[1], args[2]);
      return JSON.stringify({ shop: key, total: p.total, offset: p.start, limit: p.size, rows: p.ids.map(productRow) });
    }
    case "orders_of": {
      if (!isStr(args[0])) return JSON.stringify({ error: "the address is a string" });
      const key = addrKey(args[0]);
      const p = page("buyer:" + key, args[1], args[2]);
      return JSON.stringify({ address: key, credit: creditOf(key).toString(), total: p.total, offset: p.start, limit: p.size, rows: p.ids.map((i) => orderRow(i, now)), now });
    }
    case "orders_of_shop": {
      if (!isStr(args[0])) return JSON.stringify({ error: "the shop id is a string" });
      const key = idKey(args[0]);
      const p = page("orders:" + key, args[1], args[2]);
      return JSON.stringify({ shop: key, total: p.total, offset: p.start, limit: p.size, rows: p.ids.map((i) => orderRow(i, now)), now });
    }
    case "shops_of": {
      if (!isStr(args[0])) return JSON.stringify({ error: "the address is a string" });
      const key = addrKey(args[0]);
      const p = page("owner:" + key, args[1], args[2]);
      return JSON.stringify({ address: key, total: p.total, offset: p.start, limit: p.size, rows: p.ids.map(shopRow) });
    }
    case "shops": {
      const total = n.shop_count;
      const off = numberArg(args[0]);
      const start = Number(off < 0n ? 0n : off);
      let size = Number(numberArg(args[1]));
      size = size < 1 || size > PAGE ? PAGE : size;
      const rows: Row[] = [];
      for (let k = start + 1; k <= Math.min(total, start + size); k++) rows.push(shopRow("S" + k));
      return JSON.stringify({ total, offset: start, limit: size, rows });
    }
    case "account": {
      if (!isStr(args[0])) return JSON.stringify({ error: "the address is a string" });
      const key = addrKey(args[0]);
      return JSON.stringify({ address: key, credit: creditOf(key).toString(), shops: count("owner:" + key), orders: count("buyer:" + key), claim_fee: CLAIM_FEE.toString() });
    }
    case "stats": {
      const judged = n.n_matched + n.n_not_cheaper + n.n_different + n.n_unclear;
      return JSON.stringify({
        shops: n.shop_count, products: n.product_count, orders: n.order_count, claims: n.claim_count, judged, matched: n.n_matched,
        not_cheaper: n.n_not_cheaper, different: n.n_different, unclear: n.n_unclear, released: n.n_released,
        open_orders: n.order_count - n.n_matched - n.n_released, bonds: n.bonds.toString(), reserved: n.reserved_total.toString(),
        credits: n.credits.toString(), held: (n.bonds + n.credits).toString(), funded: n.funded_total.toString(), withdrawn: n.withdrawn_total.toString(),
        sales: n.sales_total.toString(), refunded: n.refunded_total.toString(), fees_to_shops: n.fees_total.toString(), deposited: n.deposited_total.toString(),
        credit_withdrawn: n.credit_out.toString(), refused_payments: n.n_refused, returned: n.returned.toString(),
      });
    }
    case "rules":
      return JSON.stringify(RULES);
    default:
      throw new Error("the mock has no view " + fn);
  }
}

// ---- transactions ---------------------------------------------------------------------------------

type Pending = { fn: string; polls: number; result: Row; error: string; judged: boolean; settled: boolean };
const pending = new Map<string, Pending>();
let txCount = 0;
const fakeHash = () => "0x" + (++txCount).toString(16).padStart(8, "0") + "c1a1e0d5".repeat(7);

/** Runs one call as `sender` and records it as a transaction; the hash comes back at once. */
function send(sender: string, fn: WriteFn, args: unknown[], value: bigint): string {
  if (value > balance(sender)) throw new Error("insufficient funds for this demo account");
  if (value > 0n) {
    credit(sender, -value);
    contractBalance += value;
  }
  let result: Row = {};
  let error = "";
  let settled = true;
  try {
    result = run(fn, args, { sender, value, now: mockNow() });
  } catch (e) {
    if (!(e instanceof Refused) && !(e instanceof NotSettled)) throw e;
    // A raised refusal changes nothing; no write that takes value raises, but the value goes back regardless.
    if (value > 0n) {
      contractBalance -= value;
      credit(sender, value);
    }
    error = e.message;
    settled = !(e instanceof NotSettled);
  }
  const hash = fakeHash();
  pending.set(hash, { fn, polls: 0, result, error, judged: fn === "claim" && (!error || !settled), settled });
  notify();
  return hash;
}

export async function write(call: Call): Promise<string> {
  seed();
  await delay(250);
  return send(persona.toLowerCase(), call.fn, call.args, call.value ?? 0n);
}

const STAGES = ["PENDING", "PROPOSING", "COMMITTING", "REVEALING", "ACCEPTED", "FINALIZED"];
const NO_VOTES = { agree: 0, disagree: 0, idle: 0 };

export async function txStatus(hash: string): Promise<TxStatus> {
  await delay(60);
  const p = pending.get(hash);
  if (!p) return { status: "UNKNOWN", votes: NO_VOTES, applied: null, undetermined: false, exec: null, result: null, message: "" };
  p.polls += 1;
  // A claim is read by every validator, four askings each, so it moves slower than a plain call.
  const stages = p.judged ? Math.max(1, Math.floor(p.polls / 2)) : p.polls;
  const done = stages >= STAGES.length;
  if (!p.settled) {
    // The page could not be read: every validator disagrees with a leader that raised, and the round
    // ends with no majority. Nothing is stored.
    const disagree = done ? 4 : Math.min(Math.max(0, stages - 2), 4);
    return {
      status: done ? "UNDETERMINED" : STAGES[Math.min(stages - 1, STAGES.length - 2)],
      votes: { agree: 0, disagree, idle: done || disagree ? 5 - disagree : 0 },
      applied: done ? false : null,
      undetermined: done,
      exec: done ? "ERROR" : null,
      result: null,
      message: done ? p.error : "",
    };
  }
  // Studio assigns five validators and one is often idle in a round; the mock shows the same shape.
  const agree = done ? 4 : p.judged ? Math.min(Math.max(0, stages - 2), 4) : 0;
  return {
    status: STAGES[Math.min(stages - 1, STAGES.length - 1)],
    votes: { agree, disagree: 0, idle: done || agree ? 5 - agree : 0 },
    applied: done ? true : null,
    undetermined: false,
    exec: done ? (p.error ? "ERROR" : "SUCCESS") : null,
    result: done && !p.error ? p.result : null,
    message: done ? p.error || JSON.stringify(p.result) : "",
  };
}

export async function balanceOf(address: string): Promise<bigint> {
  await delay(40);
  return balance(address);
}

export async function faucet(address: string): Promise<bigint> {
  await delay(500);
  credit(address, 10n * GEN);
  return balance(address);
}

// ---- the demo shop ---------------------------------------------------------------------------------

export function demoStatus(): DemoStatus {
  return { online: true, owner: DEMO_SHOP, shop: "S1", reason: "" };
}

/** The in-memory twin of POST /api/demo/restock: the demo shop adds to its bond when a product is not covered. */
export async function demoRestock(raw: string): Promise<RestockAnswer> {
  seed();
  await delay(300);
  const id = pyStrip(String(raw ?? "")).slice(0, ID_CHARS);
  const p = productRows.get(id);
  const row = p ? { id, shop: p.shop_id, covered: (shopRows.get(p.shop_id)!.bond - shopRows.get(p.shop_id)!.reserved) >= p.price } : null;
  const problem = restockProblem(row, "S1");
  if (problem) return { ok: false, reason: problem };
  if (row!.covered) return { ok: true, hash: "", already: true };
  if (balance(DEMO_SHOP) < RESTOCK_AMOUNT) credit(DEMO_SHOP, 10n * GEN);
  return { ok: true, hash: send(DEMO_SHOP, "fund", ["S1"], RESTOCK_AMOUNT) };
}

// ---- seeding ---------------------------------------------------------------------------------------

let seeded = false;

/** Runs a call at a given instant, outside the transaction log: the seeded past. */
function at(sender: string, now: number, fn: WriteFn, args: unknown[], value = 0n): Row {
  if (value > 0n) {
    credit(sender, -value);
    contractBalance += value;
  }
  return run(fn, args, { sender, value, now });
}

/** The address of a demo page under the demo build's pretend commit. */
export const mockPage = (competitor: string, file: string): string => rawBase(MOCK_REPO, MOCK_COMMIT) + competitor + "/" + file;

function seed(): void {
  if (seeded) return;
  seeded = true;
  const now = mockNow();
  const MIN = 60;
  const HOUR = 3600;
  const DAY = 86400;
  // S1, Harbour Lane Goods: the demo shop, opened three days ago with its bond and its three products.
  at(DEMO_SHOP, now - 3 * DAY, "open_shop", [DEMO_SHOP_NAME, JSON.stringify(MOCK_PREFIXES)]);
  at(DEMO_SHOP, now - 3 * DAY + MIN, "fund", ["S1"], DEMO_BOND);
  for (const p of DEMO_PRODUCTS) at(DEMO_SHOP, now - 3 * DAY + 2 * MIN, "list_product", ["S1", p.title, p.spec, p.priceAtto, p.window]);
  // S2, the "You, a shop owner" persona's own shop, matching the same three demo competitors.
  at(MY_SHOP, now - 5 * DAY, "open_shop", ["Quayside Kitchen Supply", JSON.stringify(MOCK_PREFIXES)]);
  at(MY_SHOP, now - 5 * DAY + MIN, "fund", ["S2"], 6n * GEN);
  at(MY_SHOP, now - 5 * DAY + 2 * MIN, "list_product", ["S2", DEMO_PRODUCTS[0].title, DEMO_PRODUCTS[0].spec, ((GEN * 21n) / 10n).toString(), 2 * HOUR]);
  at(MY_SHOP, now - 5 * DAY + 3 * MIN, "list_product", ["S2", DEMO_PRODUCTS[2].title, DEMO_PRODUCTS[2].spec, ((GEN * 11n) / 10n).toString(), DAY]);
  const E = EARLIER_BUYER;
  const [kettle, earbuds, bag] = ["P1", "P2", "P3"];
  at(E, now - 2 * DAY, "deposit", [], GEN / 20n);
  // O1, the kettle: Northgate's page at 1.80 GEN, matched; 0.20 GEN came back from the bond.
  let t = now - 2 * DAY + 5 * MIN;
  at(E, t, "buy", [kettle], BigInt(DEMO_PRODUCTS[0].priceAtto));
  at(E, t + 6 * MIN, "claim", ["O1", mockPage("northgate", "lumio-k3-kettle.html")]);
  // O2, the earbuds: a refurbished pair, another product; the fee went to the shop. Then the window ran out.
  t = now - 2 * DAY + HOUR;
  at(E, t, "buy", [earbuds], BigInt(DEMO_PRODUCTS[1].priceAtto));
  at(E, t + 4 * MIN, "claim", ["O2", mockPage("northgate", "arcwave-x200-earbuds-refurbished.html")]);
  at(PASSER_BY, t + 40 * MIN, "release", ["O2"]);
  // O3, the dry bag: a dearer page, not cheaper; then a page with no price, unclear: two judged claims, released.
  t = now - DAY;
  at(E, t, "buy", [bag], BigInt(DEMO_PRODUCTS[2].priceAtto));
  at(E, t + 3 * MIN, "claim", ["O3", mockPage("northgate", "tidewell-dry-bag-20l.html")]);
  at(E, t + 9 * MIN, "claim", ["O3", mockPage("bright-basket", "tidewell-dry-bag-20l.html")]);
  // O4: Quayside's kettle, bought an hour ago and still inside its two-hour window.
  at(E, now - HOUR, "buy", ["P4"], (GEN * 21n) / 10n);
  // O5: the earlier buyer's earbuds from the demo shop, bought ten minutes ago; no claim yet.
  at(E, now - 10 * MIN, "buy", [earbuds], BigInt(DEMO_PRODUCTS[1].priceAtto));
  // O6: Quayside's dry bag, bought two days ago; its one-day window is over and nobody has released it.
  at(PASSER_BY, now - 2 * DAY, "buy", ["P5"], (GEN * 11n) / 10n);
}

/** Test hook: the contract's held total (every bond plus every credit) and its own balance, which must be equal. */
export function mockHeld(): { held: bigint; balance: bigint; reserved: bigint } {
  seed();
  return { held: n.bonds + n.credits, balance: contractBalance, reserved: n.reserved_total };
}

/** Every account the mock knows, for the tests' conservation checks. */
export const ACCOUNTS = [VISITOR, MY_SHOP, DEMO_SHOP, EARLIER_BUYER, PASSER_BY];

/** The demo pages the mock can read, for the tests. */
export const MOCK_PAGES = DEMO_PAGES.map((p) => mockPage(p.competitor, p.file));
