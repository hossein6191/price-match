// Chain access for Price Match: the ONE file that knows the contract's interface.
//
// Every method name, argument order, view shape and outcome word of contracts/price_match.py that the
// site depends on is written here and nowhere else. Pages import typed reads, typed call builders and
// mapped outcomes from this module; when the contract's interface changes, this is the file to edit,
// with lib/chain-mock.ts, which stands in for the contract in mock mode and answers in the contract's
// own JSON so the mappers below run in both modes.
//
// Reads go through readContract (gen_call) with the retry policy in lib/rpc.ts: eight tries over
// about forty seconds, because Studio answers "Contract not found" for a healthy contract for about a
// minute after a deploy. A failed read is never "no data" and never proof that a write failed. Studio
// allows 30 gen_call a minute from one browser (the faucet shares them), so every view answer is
// cached for 30 s, two components asking for the same view share one request, and invalidateReads()
// drops the cache once a transaction is final. Every view here takes a short id, two small numbers or
// one address.

import * as mock from "./chain-mock";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { getAddress, type Address } from "viem";
import { notify } from "./browser-store";
import { contractAddress, demoShopFallback } from "./config";
import { RATE_LIMITED, createReadCache, decodeTx, isMissingMethodError, noteFailure, rpc, sleep, waitForCooldown, withRetry, type RawTx } from "./rpc";
import {
  ORDER_STATUSES,
  OUTCOMES,
  PAGE,
  PRODUCT_WORDS,
  STOCK_WORDS,
  claimPhaseOf,
  idNumber,
  phaseOf,
  sentence,
  type AppealResult,
  type ClaimPhase,
  type EndedBy,
  type FeeTo,
  type OrderStatus,
  type Outcome,
  type Phase,
  type ProductWord,
  type Reprice,
  type SettledBy,
  type Side,
  type StockWord,
} from "./rules";
import type { Account, Arg, Call, Claim, DemoAnswer, DemoStatus, Order, Paged, Product, ReadResult, Reading, RestockAnswer, Rules, Shop, Stats, TxStatus, WriteFn } from "./types";
import { chainName, getChainId, getSigner } from "./wallet";

export { RATE_LIMITED, cooldownRemainingMs } from "./rpc";
export { contractAddress };

export const CHAIN_ID = 61999;
export const RPC_URL = "https://studio.genlayer.com/api";
export const EXPLORER_URL = "https://explorer-studio.genlayer.com";

export const isMock = process.env.NEXT_PUBLIC_MOCK === "1";

export const NETWORK_ERROR = "could not reach the network";
/** Thrown by reads while the site has no contract address. */
export const NO_CONTRACT = "the contract is not deployed yet";
/** What the faucet says when Studio refused sim_fundAccount three times. */
export const FAUCET_REFUSED = "Studio refused the faucet request (it allows 30 requests a minute from one browser). Try again in a minute.";

/** True when this site has a contract to read: always in mock mode. */
export const hasContract = (): boolean => isMock || !!contractAddress();

/** The contract the explorer links point at. */
export const contractInUse = (): string => (isMock ? mock.MOCK_CONTRACT : contractAddress());

// ---- low-level view access ------------------------------------------------------------------------

// The SDK's studionet object carries another explorer URL; the RPC and explorer hosts are set here.
export const studio = {
  ...studionet,
  rpcUrls: { ...studionet.rpcUrls, default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "GenLayer Studio Explorer", url: EXPLORER_URL } },
};

const reader = () => createClient({ chain: studio });

type Row = Record<string, unknown>;

const num = (v: unknown, dflt = 0): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : dflt;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return Number(v);
  return dflt;
};
const str = (v: unknown, dflt = ""): string => (v === undefined || v === null ? dflt : String(v));
const atto = (v: unknown): string => {
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? BigInt(Math.trunc(v)).toString() : "0";
  const s = str(v, "0").trim();
  return /^\d+$/.test(s) ? s : "0";
};
/** An agreed price: digits, or "" when none was agreed. */
const priceText = (v: unknown): string => {
  const s = str(v).trim();
  return /^[1-9]\d*$/.test(s) ? s : "";
};
const addr = (v: unknown): string => str(v).toLowerCase();
/** Seconds; the contract writes -1 or 0 when a call had no readable clock. */
const secs = (v: unknown): number => Math.max(0, num(v));
const asRow = (v: unknown): Row => (v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {});
const rowsOf = (v: unknown): Row[] => (Array.isArray(v) ? v.filter((r): r is Row => !!r && typeof r === "object" && !Array.isArray(r)) : []);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string").map(String) : []);

/** A view returns a JSON string; parse it. Some decoders already hand back the object. */
function parseView(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

/** How long a view answer is reused. */
export const READ_TTL_MS = 30_000;
const onServer = typeof window === "undefined";
const views = createReadCache<unknown>(onServer ? 0 : READ_TTL_MS);

let moved = 0;
/** How many times the chain has moved under this page (a final transaction, a faucet payment): a stable snapshot. */
export const chainVersion = (): number => moved;

/** Forget every cached view answer, and tell the lists on screen to read again. Called once a transaction is final or the faucet paid. */
export const invalidateReads = () => {
  views.clear();
  moved++;
  notify();
};

/**
 * One view call through the cache. Throws RATE_LIMITED when Studio is rate-limiting this browser,
 * NO_CONTRACT when no contract is set, and the plain network error when Studio never answered.
 */
async function view(fn: string, args: Arg[] = [], opts: { fresh?: boolean } = {}): Promise<unknown> {
  if (isMock) return parseView(await mock.view(fn, args));
  const address = contractAddress();
  if (!address) throw new Error(NO_CONTRACT);
  const key = `${address.toLowerCase()}|${fn}|${JSON.stringify(args)}`;
  if (opts.fresh) views.forget(key);
  try {
    const raw = await views.get(key, () =>
      withRetry(() => reader().readContract({ address: address as Address, functionName: fn, args }), {
        bucket: "gen",
        giveUp: isMissingMethodError,
      }),
    );
    return parseView(raw);
  } catch (e) {
    if (e instanceof Error && e.message === RATE_LIMITED) throw e;
    throw new Error(NETWORK_ERROR);
  }
}

const SOURCE: ReadResult<unknown>["source"] = isMock ? "mock" : "chain";
const result = <T>(data: T): ReadResult<T> => ({ data, source: SOURCE });

// ---- row mappers (every missing field gets a default) -----------------------------------------------

const orderStatus = (v: unknown): OrderStatus => (ORDER_STATUSES.includes(str(v) as OrderStatus) ? (str(v) as OrderStatus) : "open");
const PHASES: Phase[] = ["claim", "release", "pending", "closed", "unknown"];
const phase = (v: unknown): Phase => (PHASES.includes(str(v) as Phase) ? (str(v) as Phase) : "unknown");
const ENDINGS: EndedBy[] = ["", "match", "claims", "window"];
const endedBy = (v: unknown): EndedBy => (ENDINGS.includes(str(v) as EndedBy) ? (str(v) as EndedBy) : "");
const productWord = (v: unknown): ProductWord => (PRODUCT_WORDS.includes(str(v) as ProductWord) ? (str(v) as ProductWord) : "unclear");
const outcome = (v: unknown): Outcome => (OUTCOMES.includes(str(v) as Outcome) ? (str(v) as Outcome) : "unclear");
const feeTo = (v: unknown): FeeTo => (str(v) === "shop" ? "shop" : str(v) === "buyer" ? "buyer" : "");
const stockWord = (v: unknown): StockWord => (STOCK_WORDS.includes(str(v) as StockWord) ? (str(v) as StockWord) : "");
const side = (v: unknown): Side => (str(v) === "shop" ? "shop" : "buyer");
const sideOrNone = (v: unknown): Side | "" => (str(v) === "shop" ? "shop" : str(v) === "buyer" ? "buyer" : "");
const CLAIM_PHASES: ClaimPhase[] = ["appeal", "settle", "settled", "unknown"];
const claimPhase = (v: unknown): ClaimPhase => (CLAIM_PHASES.includes(str(v) as ClaimPhase) ? (str(v) as ClaimPhase) : "unknown");
const settledBy = (v: unknown): SettledBy => (["window", "waived", "appeal"].includes(str(v)) ? (str(v) as SettledBy) : "");
const appealResult = (v: unknown): AppealResult => (str(v) === "overturned" ? "overturned" : str(v) === "upheld" ? "upheld" : "");
/** A product's price history: [[seconds, "<atto>"], ...], oldest first. */
const history = (v: unknown): Reprice[] =>
  (Array.isArray(v) ? v : []).filter((h): h is unknown[] => Array.isArray(h) && h.length >= 2).map((h) => ({ at: secs(h[0]), priceAtto: atto(h[1]) }));

/** One reading's words: the stock is kept only beside a same product, the price only beside in stock. */
export function mapReading(r: Row): Reading {
  const word = productWord(r.product);
  const stock = word === "same" ? stockWord(r.stock) || "unclear" : "";
  return {
    product: word,
    stock,
    priceAtto: stock === "in_stock" ? priceText(r.price) : "",
    outcome: outcome(r.outcome),
    refundAtto: atto(r.refund),
  };
}

export function mapShop(r: Row, id = ""): Shop {
  return {
    id: str(r.shop ?? id),
    owner: addr(r.owner),
    name: str(r.name),
    competitors: strings(r.competitors),
    bondAtto: atto(r.bond),
    reservedAtto: atto(r.reserved),
    freeAtto: atto(r.free),
    fundedAtto: atto(r.funded),
    withdrawnAtto: atto(r.withdrawn),
    refundedAtto: atto(r.refunded),
    salesAtto: atto(r.sales),
    feesWonAtto: atto(r.fees_won),
    droppedAtto: atto(r.dropped),
    products: num(r.products),
    orders: num(r.orders),
    openOrders: num(r.open_orders),
    openedAt: secs(r.opened_at),
  };
}

export function mapProduct(r: Row, id = ""): Product {
  return {
    id: str(r.product ?? id),
    shop: str(r.shop),
    shopName: str(r.shop_name),
    owner: addr(r.owner),
    title: str(r.title),
    spec: str(r.spec),
    priceAtto: atto(r.price),
    window: secs(r.window),
    listedAt: secs(r.listed_at),
    orders: num(r.orders),
    freeBondAtto: atto(r.free_bond),
    covered: r.covered === true,
    repricedAt: secs(r.repriced_at),
    reprices: num(r.reprices),
    repricesLeft: num(r.reprices_left),
    history: history(r.history),
  };
}

export function mapOrder(r: Row, id = ""): Order {
  return {
    id: str(r.order ?? id),
    product: str(r.product),
    shop: str(r.shop),
    title: str(r.title),
    buyer: addr(r.buyer),
    priceAtto: atto(r.price),
    standsAtAtto: r.stands_at === undefined ? atto(r.price) : atto(r.stands_at),
    droppedAtto: atto(r.dropped),
    dropDueAtto: atto(r.drop_due),
    boughtAt: secs(r.bought_at),
    windowEnd: secs(r.window_end),
    reservedAtto: atto(r.reserved),
    status: orderStatus(r.status),
    endedBy: endedBy(r.ended_by),
    phase: phase(r.phase),
    pending: /^C[1-9]\d{0,8}$/.test(str(r.pending)) ? str(r.pending) : "",
    claims: strings(r.claims),
    claimsLeft: num(r.claims_left),
    refundedAtto: atto(r.refunded),
    closedAt: secs(r.closed_at),
    now: secs(r.now),
  };
}

export function mapClaim(r: Row): Claim {
  const first = mapReading(r);
  const a = asRow(r.appeal);
  const appealed = sideOrNone(a.by) !== "";
  const final = OUTCOMES.includes(str(r.final) as Outcome) ? (str(r.final) as Outcome) : "";
  const state = str(r.state) === "pending" ? "pending" : "settled";
  return {
    id: str(r.claim),
    order: str(r.order),
    url: str(r.url),
    page: str(r.page),
    oursAtto: atto(r.ours),
    first,
    mayAppeal: side(r.may_appeal),
    appealEnd: secs(r.appeal_end),
    state,
    phase: claimPhase(r.phase),
    appeal: appealed
      ? { ...mapReading(a), by: side(a.by), reason: str(a.reason), result: appealResult(a.result), at: secs(a.at), bondTo: sideOrNone(a.bond_to) }
      : null,
    outcome: final || first.outcome,
    final,
    paidAtto: atto(r.paid),
    feeTo: feeTo(r.fee_to),
    settledBy: settledBy(r.settled_by),
    settledAt: secs(r.settled_at),
    at: secs(r.at),
  };
}

/** A claim's phase on the browser's clock: the contract's own rule, so the appeal countdown that runs out moves the page on. */
export const claimPhaseNow = (c: { state: Claim["state"]; appealEnd: number }, nowSeconds: number): ClaimPhase => claimPhaseOf(c.state, c.appealEnd, nowSeconds);

export function mapStats(r: Row): Stats {
  return {
    shops: num(r.shops),
    products: num(r.products),
    orders: num(r.orders),
    claims: num(r.claims),
    judged: num(r.judged),
    settled: num(r.settled),
    pending: num(r.pending),
    matched: num(r.matched),
    notInStock: num(r.not_in_stock),
    notCheaper: num(r.not_cheaper),
    different: num(r.different),
    unclear: num(r.unclear),
    appeals: num(r.appeals),
    overturned: num(r.overturned),
    upheld: num(r.upheld),
    reprices: num(r.reprices),
    drops: num(r.drops),
    released: num(r.released),
    openOrders: num(r.open_orders),
    bondsAtto: atto(r.bonds),
    reservedAtto: atto(r.reserved),
    creditsAtto: atto(r.credits),
    stakesAtto: atto(r.stakes),
    heldAtto: atto(r.held),
    fundedAtto: atto(r.funded),
    withdrawnAtto: atto(r.withdrawn),
    salesAtto: atto(r.sales),
    refundedAtto: atto(r.refunded),
    feesToShopsAtto: atto(r.fees_to_shops),
    droppedAtto: atto(r.dropped),
    bondsForfeitedAtto: atto(r.bonds_forfeited),
    depositedAtto: atto(r.deposited),
    creditWithdrawnAtto: atto(r.credit_withdrawn),
    refusedPayments: num(r.refused_payments),
    returnedAtto: atto(r.returned),
  };
}

const paged = <T>(value: Row, map: (r: Row) => T): Paged<T> => {
  if (!Array.isArray(value.rows)) throw new Error(NETWORK_ERROR);
  return { total: num(value.total), offset: num(value.offset), limit: num(value.limit, PAGE), rows: rowsOf(value.rows).map(map), now: secs(value.now) };
};

/** The order's phase on the browser's clock: the contract's own rule, so a countdown that runs out moves the page on. */
export const orderPhaseNow = (o: { status: OrderStatus; windowEnd: number; pending?: string }, nowSeconds: number): Phase => phaseOf(o.status, o.windowEnd, nowSeconds, o.pending ?? "");

// ---- reads: one function per view ---------------------------------------------------------------------

type Fresh = { fresh?: boolean };
const pageArgs = (offset: number, limit: number): [number, number] => [Math.max(0, Math.trunc(offset)), Math.max(1, Math.trunc(limit))];

/** shop(id): null when the contract holds no such shop. */
export async function readShop(id: string, opts: Fresh = {}): Promise<ReadResult<Shop | null>> {
  const value = asRow(await view("shop", [id], opts));
  if ("error" in value || !value.owner) return result(null);
  return result(mapShop(value, id));
}

/** product(id): null when there is no such product. */
export async function readProduct(id: string, opts: Fresh = {}): Promise<ReadResult<Product | null>> {
  const value = asRow(await view("product", [id], opts));
  if ("error" in value || !value.title) return result(null);
  return result(mapProduct(value, id));
}

/** order(id): null when there is no such order. */
export async function readOrder(id: string, opts: Fresh = {}): Promise<ReadResult<Order | null>> {
  const value = asRow(await view("order", [id], opts));
  if ("error" in value || !value.buyer) return result(null);
  return result(mapOrder(value, id));
}

/** claims_of(order): the judged claims, oldest first, at most two. */
export async function readClaims(order: string, opts: Fresh = {}): Promise<ReadResult<Claim[]>> {
  const value = asRow(await view("claims_of", [order], opts));
  if ("error" in value) return result([]);
  if (!Array.isArray(value.rows)) throw new Error(NETWORK_ERROR);
  return result(rowsOf(value.rows).map(mapClaim).filter((c) => c.id));
}

/** products_of(shop, offset, limit): one page of a shop's products, oldest first. */
export async function readProductsOf(shop: string, offset = 0, limit = PAGE, opts: Fresh = {}): Promise<ReadResult<Paged<Product>>> {
  return result(paged(asRow(await view("products_of", [shop, ...pageArgs(offset, limit)], opts)), (r) => mapProduct(r)));
}

/** orders_of(address, offset, limit): one page of the orders an address bought, and its claim-fee credit. */
export async function readOrdersOf(address: string, offset = 0, limit = PAGE, opts: Fresh = {}): Promise<ReadResult<Paged<Order> & { creditAtto: string }>> {
  const value = asRow(await view("orders_of", [address.toLowerCase(), ...pageArgs(offset, limit)], opts));
  return result({ ...paged(value, (r) => mapOrder(r)), creditAtto: atto(value.credit) });
}

/** orders_of_shop(shop, offset, limit): one page of the orders a shop took. */
export async function readOrdersOfShop(shop: string, offset = 0, limit = PAGE, opts: Fresh = {}): Promise<ReadResult<Paged<Order>>> {
  return result(paged(asRow(await view("orders_of_shop", [shop, ...pageArgs(offset, limit)], opts)), (r) => mapOrder(r)));
}

/** shops_of(address, offset, limit): one page of the shops an address owns. */
export async function readShopsOf(address: string, offset = 0, limit = PAGE, opts: Fresh = {}): Promise<ReadResult<Paged<Shop>>> {
  return result(paged(asRow(await view("shops_of", [address.toLowerCase(), ...pageArgs(offset, limit)], opts)), (r) => mapShop(r)));
}

/** shops(offset, limit): one page of every shop, oldest first. */
export async function readShops(offset = 0, limit = PAGE, opts: Fresh = {}): Promise<ReadResult<Paged<Shop>>> {
  return result(paged(asRow(await view("shops", pageArgs(offset, limit), opts)), (r) => mapShop(r)));
}

/** The newest shops first: the first page says how many there are, then the newest pages down to `maxPages`. */
export async function readShopsWindow(maxPages = 3, opts: Fresh = {}): Promise<ReadResult<{ total: number; rows: Shop[]; partial: boolean }>> {
  const first = (await readShops(0, PAGE, opts)).data;
  const pages = Math.ceil(first.total / PAGE);
  const rows = [...first.rows];
  for (let p = pages - 1, n = 1; p >= 1 && n < maxPages; p--, n++) rows.push(...(await readShops(p * PAGE, PAGE, opts)).data.rows);
  const unique = new Map(rows.map((r) => [r.id, r]));
  return result({ total: first.total, rows: [...unique.values()].sort((a, b) => idNumber(b.id) - idNumber(a.id)), partial: pages > maxPages });
}

/** account(address): the claim-fee credit, and how many shops it owns and orders it bought. */
export async function readAccount(address: string, opts: Fresh = {}): Promise<ReadResult<Account>> {
  const r = asRow(await view("account", [address.toLowerCase()], opts));
  return result({
    address: addr(r.address),
    creditAtto: atto(r.credit),
    shops: num(r.shops),
    orders: num(r.orders),
    claimFeeAtto: atto(r.claim_fee),
    appealBondAtto: atto(r.appeal_bond),
  });
}

/** stats(): the contract's totals. */
export async function readStats(opts: Fresh = {}): Promise<ReadResult<Stats>> {
  return result(mapStats(asRow(await view("stats", [], opts))));
}

/** rules(): the contract's own words for its askings, who may do what and where the money goes. */
export async function readRules(): Promise<ReadResult<Rules>> {
  return result(asRow(await view("rules", [])));
}

// ---- writes: one builder per method (lib/calls.ts) ------------------------------------------------------

export { calls } from "./calls";

/** True for the calls the validators judge by fetching a page and asking their models: the rail then shows their votes. */
export const isJudged = (fn: WriteFn) => fn === "claim" || fn === "appeal";

const WRONG_CHAIN = (chainId: number | null) => `Your wallet is on ${chainName(chainId)}. Switch it to GenLayer Studio (chain 61999) before signing.`;

/** Sends a call through the connected EIP-1193 provider. Resolves to the transaction hash. */
export async function write(call: Call): Promise<string> {
  if (isMock) return mock.write(call);
  const address = contractAddress();
  if (!address) throw new Error("The contract is not deployed yet, so there is nothing to sign.");
  const signer = getSigner();
  if (!signer) throw new Error("Connect a wallet first.");
  // Studio is gasless and the SDK skips its own chain check for it, so the refusal to sign on
  // another chain lives here, and it says which chain the wallet is on.
  const chainId = await getChainId(signer.provider);
  if (chainId !== CHAIN_ID) throw new Error(WRONG_CHAIN(chainId));
  const client = createClient({ chain: studio, account: signer.address as Address, provider: signer.provider });
  const hash = await client.writeContract({
    address: address as Address,
    functionName: call.fn,
    args: call.args,
    value: call.value ?? 0n,
  });
  if (typeof hash !== "string" || !hash.startsWith("0x")) throw new Error("The wallet returned no transaction hash.");
  return hash;
}

// ---- outcomes: what a finished call's JSON return means ---------------------------------------------

/**
 * True when the leader's return is what the chain stored. A round with no majority, a cancelled tx or
 * one the validators did not accept still carries the leader's JSON, but nothing of it was kept.
 */
export const stored = (s: TxStatus | null): s is TxStatus => !!s && !s.undetermined && s.applied !== false && s.status !== "CANCELED";

/** The tag of a raised error: a rule ([EXPECTED]), a page that could not be read ([TRANSIENT]) or a model failure ([LLM_ERROR]). */
export function errorTag(s: TxStatus | null): "EXPECTED" | "TRANSIENT" | "LLM_ERROR" | "" {
  const m = /\[(EXPECTED|TRANSIENT|LLM_ERROR)\]/.exec(s?.message || "");
  return m ? (m[1] as "EXPECTED" | "TRANSIENT" | "LLM_ERROR") : "";
}

/** The sentence after a raised error's tag, as a sentence; "" when there is none. */
function raisedSentence(s: TxStatus): string {
  const m = /\[(?:EXPECTED|TRANSIENT|LLM_ERROR)\]\s*([^"}\n]+)/.exec(s.message || "");
  return m ? sentence(m[1]) : "";
}

/** The contract's reason for refusing a call, as a sentence; "" when the call was not refused. */
export function refusalReason(s: TxStatus | null): string {
  if (!s) return "";
  const r = s.result;
  if (r && r.ok === false) return sentence(str(r.reason));
  if (s.exec === "ERROR" && !s.undetermined) return raisedSentence(s) || sentence(s.message || "");
  return "";
}

/** True when the transaction finished and the contract did what was asked. */
export function succeeded(s: TxStatus | null): boolean {
  return !!s && s.status === "FINALIZED" && stored(s) && s.exec !== "ERROR" && s.result?.ok !== false;
}

/**
 * A claim whose round stored nothing because the page could not be read or a model call failed: the
 * leader raised and no validator agrees with a leader that raised. The sentence says why, in the
 * contract's words when the leader's error was readable.
 */
export function unreadPage(s: TxStatus | null): string {
  if (!s || !s.undetermined) return "";
  const tag = errorTag(s);
  if (tag === "TRANSIENT" || tag === "LLM_ERROR" || tag === "EXPECTED") return raisedSentence(s);
  return "";
}

/** A plain sentence for a tx that finished without doing what was asked; "" when it did. */
export function failureOf(s: TxStatus | null): string {
  if (!s) return "";
  if (s.undetermined) {
    const why = unreadPage(s);
    return why
      ? `${why} The validators did not agree on a value, so nothing was stored and nothing moved.`
      : "The validators did not reach a majority, so nothing was stored. Sending the same call again is safe.";
  }
  if (s.status === "CANCELED") return "The network cancelled the transaction. Nothing was stored.";
  const reason = refusalReason(s);
  if (reason) return reason;
  if (s.applied === false) return "The validators did not accept this transaction. Nothing was stored.";
  return "";
}

const ok = (s: TxStatus | null): s is TxStatus & { result: Row } => stored(s) && s.result?.ok === true;

/** open_shop()'s return: the new shop's id, or "". */
export const openedShop = (s: TxStatus | null): string => (ok(s) && /^S\d+$/.test(str(s.result.shop)) ? str(s.result.shop) : "");

/** list_product()'s return: the new product's id, or "". */
export const listedProduct = (s: TxStatus | null): string => (ok(s) && /^P\d+$/.test(str(s.result.product)) ? str(s.result.product) : "");

export type Paid = { kind: "done"; result: Row } | { kind: "refused"; reason: string; returnedAtto: string } | { kind: "unknown" };

/** A payable call's return (fund, buy, deposit): taken, or refused with what came back in the same transaction. */
export function paidOutcome(s: TxStatus | null): Paid {
  if (!stored(s) || !s.result) return { kind: "unknown" };
  if (s.result.ok === true) return { kind: "done", result: s.result };
  if (s.result.ok === false) return { kind: "refused", reason: sentence(str(s.result.reason)), returnedAtto: atto(s.result.returned) };
  return { kind: "unknown" };
}

/** buy()'s return: the new order's id, or "". */
export const boughtOrder = (s: TxStatus | null): string => {
  const p = paidOutcome(s);
  return p.kind === "done" && /^O\d+$/.test(str(p.result.order)) ? str(p.result.order) : "";
};

export type ClaimResult = { claim: string; reading: Reading; appealEnd: number; mayAppeal: Side; status: OrderStatus };

/** claim()'s return: the agreed reading, pending for its appeal window. Nothing moved in this call. */
export function claimOutcome(s: TxStatus | null): ClaimResult | null {
  if (!ok(s) || !OUTCOMES.includes(str(s.result.outcome) as Outcome)) return null;
  const r = s.result;
  return { claim: str(r.claim), reading: mapReading(r), appealEnd: secs(r.appeal_end), mayAppeal: side(r.may_appeal), status: orderStatus(r.status) };
}

export type AppealOutcome = { claim: string; reading: Reading; result: AppealResult; bondTo: Side | ""; final: Outcome; paidAtto: string; feeTo: FeeTo };

/** appeal()'s return: the second reading, whether it replaced the first, and how the claim settled in the same call. */
export function appealOutcome(s: TxStatus | null): AppealOutcome | null {
  if (!ok(s) || !OUTCOMES.includes(str(s.result.final) as Outcome)) return null;
  const r = s.result;
  return {
    claim: str(r.claim),
    reading: mapReading(r),
    result: appealResult(r.result),
    bondTo: sideOrNone(r.bond_to),
    final: str(r.final) as Outcome,
    paidAtto: atto(r.paid),
    feeTo: feeTo(r.fee_to),
  };
}

/** settle()'s or claim_drop()'s return: what was paid, "0" when nothing. */
export const paidOf = (s: TxStatus | null): string => (ok(s) ? atto(s.result.paid ?? s.result.drop_paid) : "0");

/** True when GEN moves to or from somebody because of this call, so balances are watched afterwards. */
export function movesMoney(s: TxStatus): boolean {
  const r = s.result;
  if (!r) return false;
  if (r.ok === false) return atto(r.returned) !== "0";
  if (r.ok !== true) return false;
  for (const k of ["added", "withdrawn", "forwarded", "paid", "drop_paid"]) if (atto(r[k]) !== "0") return true;
  return str(r.fee_to) === "shop";
}

// ---- the demo shop ------------------------------------------------------------------------------

let demoCache: { at: number; value: DemoStatus } | null = null;

/** Whether the demo shop's key can sign now, whose it is and which shop it runs. Asked of the site's own server; cached a minute. */
export async function readDemoStatus(): Promise<DemoStatus> {
  if (isMock) return mock.demoStatus();
  if (demoCache && Date.now() - demoCache.at < 60_000) return demoCache.value;
  try {
    const res = await fetch("/api/demo/status", { cache: "no-store" });
    const body = (await res.json()) as Partial<DemoStatus>;
    const shop = /^S[1-9]\d{0,8}$/.test(str(body.shop)) ? str(body.shop) : "";
    const value: DemoStatus = { online: body.online === true, owner: addr(body.owner), shop: shop || demoShopFallback(), reason: str(body.reason) };
    demoCache = { at: Date.now(), value };
    return value;
  } catch {
    return { online: false, owner: "", shop: demoShopFallback(), reason: "the site's server did not answer" };
  }
}

/** Asks the demo shop to add to its bond so `product` is covered again. Resolves to its hash, "already covered", or why not. */
export async function requestRestock(product: string): Promise<RestockAnswer> {
  if (isMock) return mock.demoRestock(product);
  try {
    const res = await fetch("/api/demo/restock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ product }),
    });
    const body = (await res.json()) as Record<string, unknown>;
    if (body.ok === true && body.already === true) return { ok: true, hash: "", already: true };
    if (body.ok === true && typeof body.hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(body.hash)) return { ok: true, hash: body.hash };
    return { ok: false, reason: sentence(str(body.reason, "the demo shop did not answer")), retryAfter: num(body.retryAfter) || undefined };
  } catch {
    return { ok: false, reason: "The site's server did not answer. Try again in a minute." };
  }
}

/** What a visitor may ask the demo shop to do: reprice a product down or back up, or appeal a matched finding. */
export type DemoAsk = { kind: "reprice"; product: string; direction: "down" | "up" } | { kind: "appeal"; order: string; claim: string };

/** Asks the demo shop's server to sign one call for the visitor's test. Resolves to its hash, or why not. */
export async function requestDemo(ask: DemoAsk): Promise<DemoAnswer> {
  if (isMock) return mock.demoAsk(ask);
  try {
    const res = await fetch(ask.kind === "reprice" ? "/api/demo/reprice" : "/api/demo/appeal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ask.kind === "reprice" ? { product: ask.product, direction: ask.direction } : { order: ask.order, claim: ask.claim }),
    });
    const body = (await res.json()) as Record<string, unknown>;
    if (body.ok === true && typeof body.hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(body.hash)) return { ok: true, hash: body.hash };
    return { ok: false, reason: sentence(str(body.reason, "the demo shop did not answer")), retryAfter: num(body.retryAfter) || undefined };
  } catch {
    return { ok: false, reason: "The site's server did not answer. Try again in a minute." };
  }
}

// ---- transactions, balances, the faucet -------------------------------------------------------------

/** One poll of a transaction. Pages call this every 3 s until it is final. */
export async function txStatus(hash: string): Promise<TxStatus> {
  if (isMock) return mock.txStatus(hash);
  // Two quick tries: the caller polls anyway. eth_* has its own bucket and its own retry budget,
  // so neither a gen_call cooldown nor the gen_call retry loops ever stall the rail.
  const tx = await withRetry(() => rpc<RawTx | null>("eth_getTransactionByHash", [hash]), { tries: 2, bucket: "eth", ownBudget: true });
  return decodeTx(tx);
}

/** Balance in atto of an address (eth_getBalance). */
export async function balanceOf(address: string): Promise<bigint> {
  if (isMock) return mock.balanceOf(address);
  const hex = await withRetry(() => rpc<string>("eth_getBalance", [address, "latest"]), { tries: 3, bucket: "eth", ownBudget: true });
  return BigInt(hex || "0x0");
}

const FAUCET_PAUSE_MS = 10_000;
const FAUCET_TRIES = 3;
const FAUCET_WAIT_MS = 60_000;

/**
 * Faucet: sim_fundAccount with 10 GEN, up to three tries ten seconds apart, each after the gen_call
 * cooldown. Resolves when the balance moved. `stillWanted` is asked between balance polls: once it
 * says no (the wallet switched accounts) the wait ends with an error nobody shows.
 */
export async function faucet(address: string, opts: { stillWanted?: () => boolean } = {}): Promise<bigint> {
  if (isMock) return mock.faucet(address);
  // Studio credits only a checksummed address: the lowercase spelling is accepted and never paid.
  let account: string;
  try {
    account = getAddress(address);
  } catch {
    throw new Error("That is not a valid 0x address, so the faucet was not asked.");
  }
  let before: bigint;
  try {
    before = await balanceOf(account);
  } catch {
    throw new Error("Could not read this wallet's balance from Studio, so the faucet was not asked. Try again in a few seconds.");
  }
  let sent = false;
  for (let i = 0; i < FAUCET_TRIES && !sent; i++) {
    await waitForCooldown("gen");
    try {
      // `amount` is wei as a JS number; a decimal string makes the node compare str with int.
      await rpc("sim_fundAccount", { account_address: account, amount: 10e18 });
      sent = true;
    } catch (e) {
      noteFailure(e, Date.now(), "gen");
      if (i === FAUCET_TRIES - 1) throw new Error(FAUCET_REFUSED);
      await sleep(FAUCET_PAUSE_MS);
    }
  }
  const started = Date.now();
  while (Date.now() - started < FAUCET_WAIT_MS) {
    await sleep(2000);
    if (opts.stillWanted && !opts.stillWanted()) throw new Error("The faucet wait ended: the wallet switched accounts.");
    try {
      const now = await balanceOf(account);
      if (now !== before) return now;
    } catch {
      /* a dropped poll is not a failed faucet; keep polling */
    }
  }
  throw new Error("The faucet did not credit the account within 60 s. Try again.");
}

export const txUrl = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER_URL}/address/${address}`;
export const shopPath = (id: string) => `/shop/${id}`;
export const orderPath = (id: string) => `/order/${id}`;
