// The shapes the pages use, in one place with no runtime code: lib/chain.ts maps every view answer
// into these, and lib/chain-mock.ts answers in the contract's own JSON so the same mappers run in
// both modes. Every instant is seconds on the message clock; 0 until it happens. Every amount is a
// decimal string of atto.

import type { AppealResult, ClaimPhase, ClaimState, EndedBy, FeeTo, OrderStatus, Outcome, Phase, ProductWord, Reprice, SettledBy, Side, StockWord } from "./rules.ts";

/** shop(id): one shop, its competitor prefixes and where its bond is. */
export type Shop = {
  /** "S2" */
  id: string;
  owner: string;
  name: string;
  /** the competitor URL prefixes it promised to match, fixed for good */
  competitors: string[];
  /** all the bond held: free plus reserved */
  bondAtto: string;
  reservedAtto: string;
  freeAtto: string;
  fundedAtto: string;
  withdrawnAtto: string;
  refundedAtto: string;
  salesAtto: string;
  feesWonAtto: string;
  /** bond paid back to buyers when the shop lowered a price */
  droppedAtto: string;
  products: number;
  orders: number;
  openOrders: number;
  openedAt: number;
};

/** product(id): one product, its spec, price and window, and whether the free bond covers a sale now. */
export type Product = {
  /** "P3" */
  id: string;
  shop: string;
  shopName: string;
  owner: string;
  title: string;
  spec: string;
  priceAtto: string;
  /** seconds the guarantee runs from each purchase */
  window: number;
  listedAt: number;
  orders: number;
  freeBondAtto: string;
  covered: boolean;
  /** 0 until the shop changes the price */
  repricedAt: number;
  reprices: number;
  repricesLeft: number;
  /** every recorded price change, oldest first, at most sixteen */
  history: Reprice[];
};

/** order(id): one purchase, its window, its reservation and its claims by id. */
export type Order = {
  /** "O7" */
  id: string;
  product: string;
  shop: string;
  title: string;
  buyer: string;
  priceAtto: string;
  /** what the order stands at: the price minus every price drop paid */
  standsAtAtto: string;
  droppedAtto: string;
  /** the price drop owed now, from the shop's own price history; "0" while a claim is pending */
  dropDueAtto: string;
  boughtAt: number;
  windowEnd: number;
  /** the price while it is reserved from the bond; "0" once released */
  reservedAtto: string;
  status: OrderStatus;
  endedBy: EndedBy;
  /** the phase the contract computed when it was read; recomputed on the browser's clock for display */
  phase: Phase;
  /** the claim waiting for its appeal window, or "" */
  pending: string;
  /** this order's claim ids, oldest first, at most two */
  claims: string[];
  claimsLeft: number;
  refundedAtto: string;
  closedAt: number;
  now: number;
};

/** One reading of a competitor's page: the first, or an appeal's second. */
export type Reading = {
  product: ProductWord;
  /** asked only when the product is same; "" otherwise */
  stock: StockWord;
  /** the agreed price in atto, or "" when none was agreed or it was not asked */
  priceAtto: string;
  outcome: Outcome;
  refundAtto: string;
};

/** One judged claim, as claims_of(order) lists it: its first reading, an appeal's beside it, and how it settled. */
export type Claim = {
  /** "C4" */
  id: string;
  order: string;
  url: string;
  /** sha256 of the page text judged; an appeal must read the same text */
  page: string;
  /** what the order stood at when it was judged */
  oursAtto: string;
  /** the first reading */
  first: Reading;
  /** who may appeal it */
  mayAppeal: Side;
  appealEnd: number;
  state: ClaimState;
  phase: ClaimPhase;
  /** the appeal, when there was one: who asked, their words, the second reading and the result */
  appeal: (Reading & { by: Side; reason: string; result: AppealResult; at: number; bondTo: Side | "" }) | null;
  /** the outcome that settled, or the first reading's while pending */
  outcome: Outcome;
  /** "" while pending */
  final: Outcome | "";
  paidAtto: string;
  feeTo: FeeTo;
  settledBy: SettledBy;
  settledAt: number;
  at: number;
};

/** account(address): the claim-fee credit and how many shops and orders it has. */
export type Account = { address: string; creditAtto: string; shops: number; orders: number; claimFeeAtto: string; appealBondAtto: string };

export type Paged<T> = { total: number; offset: number; limit: number; rows: T[]; now: number };

/** stats(): totals only. Amounts in atto. */
export type Stats = {
  shops: number;
  products: number;
  orders: number;
  claims: number;
  judged: number;
  settled: number;
  pending: number;
  matched: number;
  notInStock: number;
  notCheaper: number;
  different: number;
  unclear: number;
  appeals: number;
  overturned: number;
  upheld: number;
  reprices: number;
  drops: number;
  released: number;
  openOrders: number;
  bondsAtto: string;
  reservedAtto: string;
  creditsAtto: string;
  /** claim fees held for pending claims */
  stakesAtto: string;
  heldAtto: string;
  fundedAtto: string;
  withdrawnAtto: string;
  salesAtto: string;
  refundedAtto: string;
  feesToShopsAtto: string;
  droppedAtto: string;
  bondsForfeitedAtto: string;
  depositedAtto: string;
  creditWithdrawnAtto: string;
  refusedPayments: number;
  returnedAtto: string;
};

/** rules(): the contract's own words, kept as it wrote them. */
export type Rules = Record<string, unknown>;

export type Votes = { agree: number; disagree: number; idle: number };

export type TxStatus = {
  /** PENDING | PROPOSING | COMMITTING | REVEALING | ACCEPTED | FINALIZED | CANCELED | UNDETERMINED | UNKNOWN */
  status: string;
  votes: Votes;
  /** null until votes exist */
  applied: boolean | null;
  /** finished with no majority: nothing was stored */
  undetermined: boolean;
  /** SUCCESS | ERROR | null */
  exec: string | null;
  /** the contract's JSON return, if any */
  result: Record<string, unknown> | null;
  /** the decoded return or error text */
  message: string;
};

export type ReadResult<T> = { data: T; source: "chain" | "mock" };

/** The contract's write methods, by name. */
export type WriteFn =
  | "open_shop"
  | "fund"
  | "withdraw_bond"
  | "list_product"
  | "buy"
  | "deposit"
  | "withdraw"
  | "claim"
  | "appeal"
  | "settle"
  | "reprice"
  | "claim_drop"
  | "release";

export type Arg = string | number;

/** One contract call, ready to sign: the method, its arguments in the contract's order, and the value sent. */
export type Call = { fn: WriteFn; args: Arg[]; value?: bigint };

/** Whether the demo shop's key can sign right now, whose it is, which shop it runs, and exactly why not. */
export type DemoStatus = { online: boolean; owner: string; shop: string; reason: string };

/** What the demo shop answered when asked to top up its bond, reprice a product or appeal a finding. */
export type RestockAnswer = { ok: true; hash: string; already?: boolean } | { ok: false; reason: string; retryAfter?: number };
export type DemoAnswer = RestockAnswer;
