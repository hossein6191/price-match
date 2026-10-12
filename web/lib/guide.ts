// What a visitor is told whenever they wait, in five plain lines: what is happening now and who it
// waits for, how long that takes or the exact time, what is needed from them, whether they can close
// the page, and where the money is right now. The same words for every in-between state of the site:
// a wallet prompt, a transaction on its way, the validators opening a competitor's page, the guarantee
// window running, an order waiting to be released, the demo shop topping up its bond, and the end of
// an order.
//
// Pure, with no React: the state, the viewer's role and the clock in, the words out. The waiting panel
// (components/wait-panel.tsx) renders a guide; the rows of /mine and the merchant desk print the
// one-line form. tests/unit/guide.test.mjs runs every state for every role. Nothing here may promise
// what contracts/price_match.py does not do.

import { clockTime, gen, span, windowLabel } from "./format.ts";
import type { EndedBy, OrderStatus } from "./rules.ts";
import type { WriteFn } from "./types.ts";

/** Who is looking: the buyer of the order, the owner of its shop, or anyone else. */
export type Role = "buyer" | "owner" | "visitor";

/** Whose move it is now. "done" is a closed order: nobody's. */
export type Waiter = "you" | "validators" | "demo" | "clock" | "anyone" | "nobody" | "done";

export type GuideTone = "busy" | "clock" | "late" | "ready" | "done";

export type Guide = {
  /** a stable name for the state, written on the panel for tests and tools */
  id: string;
  tone: GuideTone;
  waitsFor: Waiter;
  /** the small capitals above the line: who it waits for */
  kicker: string;
  /** 1. what is happening now */
  now: string;
  /** 2. how long it usually takes, or the exact time */
  time: string;
  /** 3. what is needed from the viewer right now */
  need: string;
  /** 4. whether the viewer can close the page, and where the thing stays */
  leave: string;
  canLeave: boolean;
  /** 5. where the money is right now, with the amount */
  money: string;
  /** one more sentence when the state needs it */
  note?: string;
  /** seconds left on the contract's clock, for a countdown */
  left?: number;
  leftLabel?: string;
};

export const KICKERS: Record<Waiter, string> = {
  you: "Waiting for you",
  validators: "Waiting for the validators",
  demo: "Waiting for the demo shop",
  clock: "Guarantee running",
  anyone: "Open to anyone",
  nobody: "Nothing is waiting on you",
  done: "Closed · nothing left to do",
};

export const NOTHING_NEEDED = "Nothing is needed from you.";
export const NOTHING_LEFT = "Nothing is left to do here.";

type Lines = Omit<Guide, "kicker"> & { kicker?: string };
const make = (g: Lines): Guide => ({ ...g, kicker: g.kicker ?? KICKERS[g.waitsFor] });

const ABOUT_30 = (mock?: boolean) => (mock ? "A few seconds in this demo build; about 30 seconds on Studio." : "About 30 seconds.");
const READING_TIME = (mock?: boolean) =>
  mock
    ? "A few seconds in this demo build; 2 to 5 minutes on Studio, where every validator fetches the page itself."
    : "Usually 2 to 5 minutes: every validator fetches the page itself and asks its model four questions about it.";

/** "You can close this page; O4 stays under My orders" (no full stop). */
function keep(id: string, role: Role): string {
  if (role === "buyer") return `You can close this page; ${id} stays under My orders`;
  if (role === "owner") return `You can close this page; ${id} stays on your merchant desk`;
  return "You can close this page and come back to this address later";
}

// ---- the wallet prompt --------------------------------------------------------------------------------

export type SignInput = {
  fn: WriteFn;
  /** what the call does, e.g. "Buying P1 for 2 GEN" */
  label: string;
  /** the value sent with it, or the amount it moves */
  amountAtto?: string;
  mock?: boolean;
};

/** Where the money is while a signature is waiting: nothing has moved yet. */
function moneyBeforeSigning(fn: WriteFn, amount: string): string {
  switch (fn) {
    case "buy":
      return `${amount} is still in your wallet; it leaves only when you confirm, and goes to the shop in the same transaction.`;
    case "fund":
      return `${amount} is still in your wallet; once you confirm it joins your shop's bond, which you can take back while no order has it reserved.`;
    case "deposit":
      return `${amount} is still in your wallet; once you confirm it becomes claim-fee credit that you can withdraw at any time.`;
    case "claim":
      return "Nothing leaves your wallet: the claim stakes 0.01 GEN of the credit you already deposited.";
    case "withdraw":
      return `${amount} of claim-fee credit is held by the contract; withdrawing sends all of it to your wallet.`;
    case "withdraw_bond":
      return `${amount} of free bond is held by the contract; withdrawing sends it to your wallet.`;
    case "release":
      return "Releasing sends no GEN to anyone: the reservation goes back to the shop's free bond.";
    case "list_product":
      return "Listing a product sends no GEN; your bond must cover its price before anyone can buy it.";
    case "open_shop":
      return "Opening a shop sends no GEN; nothing is held until you fund its bond.";
  }
}

/** A transaction is waiting for the visitor's signature (in mock mode: being sent, a moment). */
export function signGuide(s: SignInput): Guide {
  const money = moneyBeforeSigning(s.fn, gen(s.amountAtto ?? "0"));
  if (s.mock)
    return make({
      id: "sign",
      tone: "busy",
      waitsFor: "validators",
      kicker: "Sending",
      now: `${s.label}…`,
      time: "A moment in this demo build.",
      need: NOTHING_NEEDED,
      leave: "Stay on this page for a moment.",
      canLeave: false,
      money,
    });
  return make({
    id: "sign",
    tone: "busy",
    waitsFor: "you",
    kicker: "Your wallet",
    now: `Your wallet is asking you to confirm: ${s.label}`,
    time: "Until you confirm or reject it in the wallet.",
    need: "Confirm it in your wallet, or reject it and nothing is sent.",
    leave: "Stay on this page until you have answered the wallet; this page then follows the transaction for you.",
    canLeave: false,
    money,
  });
}

// ---- a plain transaction on its way ---------------------------------------------------------------------

export type SendingInput = {
  fn: Exclude<WriteFn, "claim">;
  /** "S2", "P4" or "O7": what the call is about */
  target: string;
  /** a product's title, for a purchase */
  title?: string;
  /** the value sent, or the amount moved */
  amountAtto: string;
  /** the guarantee window of a product being bought */
  window?: number;
  mock?: boolean;
};

/** A purchase, a bond change, a deposit, a listing, a release: sent, not final yet. */
export function sendingGuide(s: SendingInput): Guide {
  const amount = gen(s.amountAtto);
  const base = { tone: "busy" as const, waitsFor: "validators" as const, time: ABOUT_30(s.mock), need: NOTHING_NEEDED };
  switch (s.fn) {
    case "buy":
      return make({
        ...base,
        id: "buy",
        now: `Buying ${s.title || s.target}: the validators are checking the purchase`,
        leave: "You can close this page; once it lands, the order stays under My orders. Stay here and it opens by itself.",
        canLeave: true,
        money: `${amount} goes to the shop in this transaction, and the same amount of the shop's bond is reserved for you for ${windowLabel(s.window ?? 0)}. A refused purchase sends all of it back in the same transaction.`,
      });
    case "deposit":
      return make({
        ...base,
        id: "deposit",
        now: `Adding ${amount} of claim-fee credit`,
        leave: "You can close this page; the credit lands whether or not this page is open.",
        canLeave: true,
        money: `${amount} goes from your wallet to your claim-fee credit; withdraw() returns all of it at any time.`,
      });
    case "withdraw":
      return make({
        ...base,
        id: "withdraw",
        now: "Taking back your claim-fee credit",
        leave: "You can close this page; the withdrawal lands whether or not this page is open.",
        canLeave: true,
        money: `${amount} is on its way from the contract to your wallet.`,
      });
    case "fund":
      return make({
        ...base,
        id: "fund",
        now: `Adding ${amount} to the bond of ${s.target}`,
        leave: "You can close this page; the bond grows whether or not this page is open.",
        canLeave: true,
        money: `${amount} goes from your wallet into the bond of ${s.target}. A refused fund sends all of it back in the same transaction.`,
      });
    case "withdraw_bond":
      return make({
        ...base,
        id: "withdraw_bond",
        now: `Taking ${amount} of free bond back from ${s.target}`,
        leave: "You can close this page; the withdrawal lands whether or not this page is open.",
        canLeave: true,
        money: `${amount} is on its way from the bond of ${s.target} to your wallet; reserved bond stays where it is.`,
      });
    case "list_product":
      return make({
        ...base,
        id: "list_product",
        now: `Listing ${s.title || "your product"} in ${s.target}`,
        leave: "You can close this page; once it lands, the product stays on your merchant desk.",
        canLeave: true,
        money: "Listing sends no GEN. A sale is taken only while your free bond covers the product's full price.",
      });
    case "open_shop":
      return make({
        ...base,
        id: "open_shop",
        now: `Opening ${s.title || "your shop"}`,
        leave: "You can close this page; once it lands, the shop stays on your merchant desk.",
        canLeave: true,
        money: "Opening a shop sends no GEN; nothing is held until you fund its bond.",
      });
    case "release":
      return make({
        ...base,
        id: "release",
        now: `Releasing ${s.target}: its reservation goes back to the shop's free bond`,
        time: `${ABOUT_30(s.mock)} No page is read.`,
        leave: "You can close this page; the release lands whether or not this page is open.",
        canLeave: true,
        money: `${amount} of the shop's bond stops being reserved; nothing leaves the contract and nothing goes to anyone.`,
      });
  }
}

/** A final transaction whose effect is not on screen yet: a few seconds. */
export function updatingGuide(what: string): Guide {
  return make({
    id: "updating",
    tone: "busy",
    waitsFor: "nobody",
    kicker: "Final",
    now: what,
    time: "A few seconds.",
    need: NOTHING_NEEDED,
    leave: "You can close this page; the transaction is final. Stay a few seconds to see it here.",
    canLeave: true,
    money: "The transaction is final; this page shows where the money went in a moment.",
  });
}

// ---- a claim: the validators open the competitor's page --------------------------------------------------

export type ClaimInput = {
  role: Role;
  /** "O4" */
  order: string;
  /** what the receipt calls the page, e.g. "northgate/lumio-k3-kettle.html" */
  page: string;
  /** what the buyer paid: the most a match can give back */
  priceAtto: string;
  /** "busy" while it runs, "late" after six minutes */
  stage: "busy" | "late";
  mock?: boolean;
};

/** The one call the validators judge: each fetches the page and asks four questions about it. */
export function claimGuide(c: ClaimInput): Guide {
  const price = gen(c.priceAtto);
  const late = c.stage === "late";
  const buyer = c.role === "buyer";
  return make({
    id: late ? "claim-late" : "claim",
    tone: late ? "late" : "busy",
    waitsFor: "validators",
    now: late ? `The validators are still reading ${c.page}` : `The validators are opening ${c.page} on the live web and reading it`,
    time: late
      ? "Over 6 minutes so far. Studio is slow at times; the receipt still prints here by itself. A round that cannot settle stores nothing, and the claim may be made again."
      : READING_TIME(c.mock),
    need: NOTHING_NEEDED,
    leave: `${keep(c.order, c.role)}; the receipt prints on the order whether or not this page is open.`,
    canLeave: true,
    money: buyer
      ? `0.01 GEN of your claim-fee credit is staked and ${price} of the shop's bond is reserved for you. Matched: the difference comes back to your wallet in this same transaction. Different: the fee goes to the shop. Not cheaper or unclear: nothing moves.`
      : `0.01 GEN of the buyer's credit is staked and ${price} of the shop's bond is reserved for the order. Matched: the difference goes to the buyer in this same transaction. Different: the fee goes to the shop. Not cheaper or unclear: nothing moves.`,
  });
}

// ---- one order, on the clock ----------------------------------------------------------------------------

export type OrderInput = {
  role: Role;
  /** the contract's clock, seconds */
  now: number;
  /** "O4" */
  id: string;
  status: OrderStatus;
  endedBy: EndedBy;
  windowEnd: number;
  priceAtto: string;
  /** what the contract still reserves of the shop's bond for this order */
  reservedAtto: string;
  refundedAtto: string;
  claimsLeft: number;
  /** the buyer's claim-fee credit, when the viewer is the buyer */
  creditAtto?: string;
  /** a release of this order is on its way */
  releasing?: boolean;
  mock?: boolean;
};

const FEE = 10n ** 16n;

/** Every state of one order, for its buyer, its shop's owner or anyone else. */
export function orderGuide(o: OrderInput): Guide {
  const price = gen(o.priceAtto);
  const reserved = gen(o.reservedAtto !== "0" ? o.reservedAtto : o.priceAtto);
  const at = (x: number) => clockTime(x, o.now);
  const stays = keep(o.id, o.role);
  const bondWord = o.role === "owner" ? "your bond" : "the shop's bond";

  if (o.releasing)
    return make({
      id: "release",
      tone: "busy",
      waitsFor: "validators",
      now: `Releasing ${o.id}: its reservation goes back to the shop's free bond`,
      time: `${ABOUT_30(o.mock)} No page is read.`,
      need: NOTHING_NEEDED,
      leave: `${stays}; the release lands whether or not this page is open.`,
      canLeave: true,
      money: `${reserved} of ${bondWord} stops being reserved; nothing leaves the contract.`,
    });

  if (o.status === "matched") {
    const refund = gen(o.refundedAtto);
    return make({
      id: "matched",
      tone: "done",
      waitsFor: "done",
      kicker: "Price matched · closed",
      now: o.role === "buyer" ? `Matched: ${refund} came back to you from the shop's bond` : o.role === "owner" ? `Matched: ${refund} went to the buyer from your bond` : `Matched: ${refund} went to the buyer from the shop's bond`,
      time: "Paid in the same transaction as the claim.",
      need: NOTHING_LEFT,
      leave: `${stays}.`,
      canLeave: true,
      money: `The buyer paid ${price}, which went to the shop at purchase; ${refund} of it came back from ${bondWord}, and the rest of the reservation went back to the shop's free bond.`,
    });
  }

  if (o.status === "released") {
    const byClaims = o.endedBy === "claims";
    return make({
      id: byClaims ? "released-claims" : "released-window",
      tone: "done",
      waitsFor: "done",
      kicker: "Released · closed",
      now: byClaims ? "Both judged claims were used without a match" : "The guarantee window ended without a match",
      time: byClaims ? "Closed at the second judged claim." : "Closed when someone released it after the window.",
      need: NOTHING_LEFT,
      leave: `${stays}.`,
      canLeave: true,
      money: `The buyer's ${price} stays with the shop, and the ${price} that was reserved went back to the shop's free bond.`,
    });
  }

  if (o.now < 0)
    return make({
      id: "no-clock",
      tone: "late",
      waitsFor: "nobody",
      kicker: "No clock",
      now: "The network gave no readable clock with this read",
      time: "Read again in a moment.",
      need: NOTHING_NEEDED,
      leave: `${stays}.`,
      canLeave: true,
      money: `${reserved} of ${bondWord} is reserved for ${o.id}.`,
    });

  if (o.now < o.windowEnd) {
    const left = o.windowEnd - o.now;
    const noCredit = o.role === "buyer" && BigInt(o.creditAtto && /^\d+$/.test(o.creditAtto) ? o.creditAtto : "0") < FEE;
    const claimsWord = o.claimsLeft === 1 ? "one judged claim left" : `${o.claimsLeft} judged claims left`;
    if (o.role === "buyer")
      return make({
        id: noCredit ? "window-credit" : "window",
        tone: "clock",
        waitsFor: "clock",
        now: `Your price is guaranteed until ${at(o.windowEnd)}, with ${claimsWord}`,
        time: `${span(left)} left on the guarantee.`,
        need: noCredit
          ? "Only if you found it cheaper: add 0.01 GEN of claim-fee credit, then pick a competitor page below and claim."
          : "Only if you found it cheaper: pick a competitor page below and claim.",
        leave: `${stays}; come back any time before ${at(o.windowEnd)}.`,
        canLeave: true,
        money: `Your ${price} went to the shop. ${reserved} of the shop's bond is reserved for you until ${at(o.windowEnd)}; a matched claim pays you the difference from it.`,
        left,
        leftLabel: "guarantee left",
      });
    return make({
      id: "window",
      tone: "clock",
      waitsFor: "clock",
      now: `The buyer may claim until ${at(o.windowEnd)}, with ${claimsWord}`,
      time: `${span(left)} left on the guarantee.`,
      need: o.role === "owner" ? "Nothing is needed from you: the validators read any page the buyer claims with." : NOTHING_NEEDED,
      leave: `${stays}.`,
      canLeave: true,
      money: `The buyer's ${price} went to the shop. ${reserved} of ${bondWord} is reserved for this order until ${at(o.windowEnd)}; a matched claim pays the buyer the difference from it.`,
      left,
      leftLabel: "guarantee left",
    });
  }

  return make({
    id: "release-due",
    tone: "ready",
    waitsFor: "anyone",
    now: `The guarantee window closed at ${at(o.windowEnd)}; anyone may release ${o.id}`,
    time: "Now: Release takes about 30 seconds.",
    need:
      o.role === "owner"
        ? "Press Release to free your bond; anyone may, so it may also happen without you."
        : o.role === "buyer"
          ? "Nothing is needed from you: no claim can come any more. You may press Release yourself to free the shop's bond."
          : "Nothing is needed from you; anyone may press Release.",
    leave: `${stays}; the reservation waits until someone releases it.`,
    canLeave: true,
    money: `${reserved} of ${bondWord} is still reserved; Release returns it to the shop's free bond. Nothing goes to anyone.`,
  });
}

// ---- the demo shop tops up its bond ----------------------------------------------------------------

export type RestockInput = { state: "asking" | "sending" | "failed"; product: string; reason?: string; mock?: boolean };

/** A product of the demo shop the free bond no longer covers: the demo shop is asked to add to it. */
export function restockGuide(r: RestockInput): Guide {
  if (r.state === "failed")
    return make({
      id: "restock-failed",
      tone: "late",
      waitsFor: "demo",
      now: "The demo shop did not top up its bond",
      time: "Try again in a minute, or buy another product the bond still covers.",
      need: "Press Ask again, or pick another product.",
      leave: "You can close this page; nothing was sent from your wallet.",
      canLeave: true,
      money: "Your wallet is untouched: a top-up is the demo shop's own GEN.",
      note: r.reason,
    });
  return make({
    id: r.state === "asking" ? "restock-asking" : "restock",
    tone: "busy",
    waitsFor: "demo",
    now: `The demo shop is adding to its bond so ${r.product} is covered again`,
    time: ABOUT_30(r.mock),
    need: NOTHING_NEEDED,
    leave: r.state === "asking" ? "Stay a few seconds while the demo shop sends its top-up." : "You can close this page; the top-up lands whether or not this page is open.",
    canLeave: r.state === "sending",
    money: "Your wallet is untouched: a top-up is the demo shop's own GEN, added to the bond that pays matches.",
  });
}

// ---- one line for lists -------------------------------------------------------------------------------

/** The one-line form of an order's state, for the rows of /mine and the merchant desk. */
export function orderLine(o: OrderInput): string {
  const g = orderGuide(o);
  return g.now;
}
