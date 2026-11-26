// What a visitor is told whenever they wait, in five plain lines: what is happening now and who it
// waits for, how long that takes or the exact time, what is needed from them, whether they can close
// the page, and where the money is right now. The same words for every in-between state of the site:
// a wallet prompt, a transaction on its way, the validators opening a competitor's page, a finding
// pending for its appeal window, an appeal's second reading, a finding waiting to be settled, a price
// drop owed, the guarantee window running, an order waiting to be released, the demo shop topping up
// its bond, repricing or appealing, and the end of an order.
//
// Pure, with no React: the state, the viewer's role and the clock in, the words out. The waiting panel
// (components/wait-panel.tsx) renders a guide; the rows of /mine and the merchant desk print the
// one-line form. tests/unit/guide.test.mjs runs every state for every role. Nothing here may promise
// what contracts/price_match.py does not do.

import { clockTime, gen, span, windowLabel } from "./format.ts";
import { FEE_NOTE } from "./fees.ts";
import type { EndedBy, OrderStatus, Outcome, Side } from "./rules.ts";
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
    : "Usually 2 to 5 minutes: every validator fetches the page itself and asks its model up to six questions about it.";

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
    case "appeal":
      return "Nothing leaves your wallet: the appeal stakes 0.05 GEN of the credit you already deposited.";
    case "settle":
      return "Nothing leaves your wallet: settling moves the claim's money as its finding says.";
    case "claim_drop":
      return `Nothing leaves your wallet: ${amount} of the shop's reserved bond comes to it.`;
    case "reprice":
      return "Repricing sends no GEN; the change is recorded in the product's price history for good.";
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
    money: `${money} ${FEE_NOTE}`,
  });
}

// ---- a plain transaction on its way ---------------------------------------------------------------------

export type SendingInput = {
  fn: Exclude<WriteFn, "claim" | "appeal">;
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
        now: `Releasing ${s.target}: any price drop still owed goes to the buyer, then its reservation goes back to the shop's free bond`,
        time: `${ABOUT_30(s.mock)} No page is read.`,
        leave: "You can close this page; the release lands whether or not this page is open.",
        canLeave: true,
        money: `${amount} of the shop's bond stops being reserved; apart from a price drop still owed to the buyer, nothing leaves the contract and nothing goes to anyone.`,
      });
    case "settle":
      return make({
        ...base,
        id: "settle",
        now: `Settling ${s.target}: its money moves as the finding says`,
        time: `${ABOUT_30(s.mock)} No page is read.`,
        leave: "You can close this page; the settlement lands whether or not this page is open.",
        canLeave: true,
        money: `Matched: ${amount} goes to the buyer from the reserved bond and the order closes. Different: the 0.01 GEN fee goes to the shop. Anything else: the fee goes back to the buyer's credit.`,
      });
    case "claim_drop":
      return make({
        ...base,
        id: "claim_drop",
        now: `Claiming the price drop on ${s.target}: the shop's own price history, no page is read`,
        leave: "You can close this page; the payment lands whether or not this page is open.",
        canLeave: true,
        money: `${amount} goes from the order's reserved bond to your wallet in this transaction.`,
      });
    case "reprice":
      return make({
        ...base,
        id: "reprice",
        now: `Recording a new price for ${s.target}`,
        leave: "You can close this page; the change is recorded whether or not this page is open.",
        canLeave: true,
        money: `Repricing sends no GEN; the new price is ${amount}, and every open order bought before it is owed any drop.`,
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

/** The one call the validators judge first: each fetches the page and asks up to six questions about it. */
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
      ? `0.01 GEN of your claim-fee credit is staked and ${price} of the shop's bond is reserved for you. Nothing moves in this call: the finding waits 15 minutes for an appeal, then matched pays you the difference, different sends the fee to the shop, and anything else returns the fee.`
      : `0.01 GEN of the buyer's credit is staked and ${price} of the shop's bond is reserved for the order. Nothing moves in this call: the finding waits 15 minutes for an appeal, then matched pays the buyer the difference, different sends the fee to the shop, and anything else returns the fee.`,
  });
}

export type AppealInput = {
  role: Role;
  /** "C4" */
  claim: string;
  order: string;
  page: string;
  /** who appealed */
  by: Side;
  stage: "busy" | "late";
  mock?: boolean;
};

/** An appeal: every validator reads the same page text again, with the appellant's reason fenced as an argument. */
export function appealGuide(a: AppealInput): Guide {
  const late = a.stage === "late";
  const mine = (a.by === "buyer" && a.role === "buyer") || (a.by === "shop" && a.role === "owner");
  const who = mine ? "your" : a.by === "shop" ? "the shop's" : "the buyer's";
  return make({
    id: late ? "appeal-late" : "appeal",
    tone: late ? "late" : "busy",
    waitsFor: "validators",
    now: late ? `The validators are still reading ${a.page} a second time for ${a.claim}` : `The validators are reading ${a.page} a second time for ${a.claim}, with ${who} reason beside it`,
    time: late
      ? "Over 6 minutes so far. If the page no longer reads as it did, nothing is stored and the first finding still stands."
      : READING_TIME(a.mock),
    need: NOTHING_NEEDED,
    leave: `${keep(a.order, a.role)}; the second reading prints on the same receipt whether or not this page is open.`,
    canLeave: true,
    money: `0.05 GEN of ${who} credit is staked as the appeal bond. Better for the appellant: the second reading replaces the first and the bond comes back. Otherwise the first stands and the bond goes to the other side. Either way the claim settles in this call.`,
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
  /** the claim waiting for its appeal window, when there is one */
  pending?: { id: string; outcome: Outcome; mayAppeal: Side; appealEnd: number; refundAtto: string };
  /** the price drop owed now, from the shop's own price history */
  dropDueAtto?: string;
  mock?: boolean;
};

const OUTCOME_TEXT: Record<Outcome, string> = {
  matched: "matched",
  not_in_stock: "not in stock",
  not_cheaper: "not cheaper",
  different: "a different product",
  unclear: "unclear",
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
      time: "Paid when the claim settled, after its appeal window.",
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

  if (o.pending) {
    const p = o.pending;
    const finding = OUTCOME_TEXT[p.outcome];
    const appealer: Role = p.mayAppeal === "shop" ? "owner" : "buyer";
    const theirs = o.role === appealer;
    const sideWord = p.mayAppeal === "shop" ? "the shop" : "the buyer";
    const pays =
      p.outcome === "matched"
        ? `${gen(p.refundAtto)} is due to the buyer and waits in the ${reserved} reserved from ${bondWord}`
        : p.outcome === "different"
          ? `The 0.01 GEN claim fee is held and will go to the shop; ${reserved} of ${bondWord} stays reserved`
          : `The 0.01 GEN claim fee is held and will go back to the buyer; ${reserved} of ${bondWord} stays reserved`;
    if (o.now >= 0 && o.now < p.appealEnd) {
      const left = p.appealEnd - o.now;
      return make({
        id: theirs ? "pending-appeal" : "pending",
        tone: "clock",
        waitsFor: theirs ? "you" : "clock",
        kicker: "Finding pending · appeal window",
        now: `${p.id} found ${finding}; ${theirs ? "you" : sideWord} may appeal it until ${at(p.appealEnd)}`,
        time: `${span(left)} left to appeal. After that anyone may settle it, about 30 seconds.`,
        need: theirs
          ? "Only if you think the reading is wrong: appeal below with a reason (0.05 GEN of credit). Or settle now to waive your appeal. Doing nothing is fine too."
          : o.role === "buyer" || o.role === "owner"
            ? `Nothing is needed from you: only ${sideWord} may appeal. Once the window closes you or anyone may press Settle.`
            : NOTHING_NEEDED,
        leave: `${stays}; the finding waits on the contract, and nothing moves until it settles.`,
        canLeave: true,
        money: `Nothing has moved yet. ${pays} until it settles.`,
        left,
        leftLabel: "appeal window left",
      });
    }
    return make({
      id: "settle-due",
      tone: "ready",
      waitsFor: "anyone",
      now: `The appeal window of ${p.id} closed at ${at(p.appealEnd)}; anyone may settle it`,
      time: "Now: Settle takes about 30 seconds. No page is read.",
      need: o.role === "visitor" ? "Nothing is needed from you; anyone may press Settle." : "Press Settle to move the money; anyone may, so it may also happen without you.",
      leave: `${stays}; the finding waits until someone settles it.`,
      canLeave: true,
      money: `Nothing has moved yet. ${pays} until someone settles ${p.id}.`,
    });
  }

  const due = o.dropDueAtto && /^\d+$/.test(o.dropDueAtto) ? BigInt(o.dropDueAtto) : 0n;
  if (due > 0n && o.now >= 0 && o.now < o.windowEnd)
    return make({
      id: o.role === "buyer" ? "drop-owed" : "drop-owed-other",
      tone: "ready",
      waitsFor: o.role === "buyer" ? "you" : "clock",
      kicker: "Price drop owed",
      now: o.role === "buyer" ? `The shop lowered the price after you bought: ${gen(due)} is owed to you` : `The shop lowered the price after this purchase: ${gen(due)} is owed to the buyer`,
      time: `Claim Drop takes about 30 seconds; no page is read. It stays owed until ${at(o.windowEnd)}, and a release pays it anyway.`,
      need: o.role === "buyer" ? "Press Claim drop to take it now, or leave it: a release after the window pays it to you first." : NOTHING_NEEDED,
      leave: `${stays}; the drop stays owed even if the price goes back up.`,
      canLeave: true,
      money: `${gen(due)} of the ${reserved} reserved from ${bondWord} is owed to the buyer; it moves when the buyer claims it or the order is released.`,
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
    money: `${reserved} of ${bondWord} is still reserved; Release pays any price drop still owed to the buyer first, then returns the rest to the shop's free bond.`,
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

export type DemoAskInput = {
  state: "asking" | "sending" | "failed";
  kind: "drop" | "raise" | "appeal";
  /** "P1" or "C4" */
  target: string;
  reason?: string;
  mock?: boolean;
};

/** A visitor asked the demo shop to lower or raise a demo product's price, or to appeal a matched finding. */
export function demoAskGuide(d: DemoAskInput): Guide {
  const what =
    d.kind === "drop" ? `lower the price of ${d.target} by 0.30 GEN` : d.kind === "raise" ? `raise the price of ${d.target} back to its list price` : `appeal ${d.target}`;
  const money =
    d.kind === "appeal"
      ? "Your wallet is untouched: the demo shop stakes 0.05 GEN of its own credit. If the second reading is no better for the shop, the bond goes to the buyer's credit."
      : "Your wallet is untouched: a price change moves no GEN; any drop owed to an open order is paid from the shop's reserved bond when it is claimed.";
  if (d.state === "failed")
    return make({
      id: "demo-ask-failed",
      tone: "late",
      waitsFor: "demo",
      now: `The demo shop did not ${what}`,
      time: "Try again in a minute.",
      need: "Press the button again in a minute, or carry on without it.",
      leave: "You can close this page; nothing was sent from your wallet.",
      canLeave: true,
      money,
      note: d.reason,
    });
  return make({
    id: d.state === "asking" ? "demo-ask-asking" : "demo-ask",
    tone: "busy",
    waitsFor: d.kind === "appeal" && d.state === "sending" ? "validators" : "demo",
    now: `The demo shop is asked to ${what}`,
    time: d.kind === "appeal" ? READING_TIME(d.mock) : ABOUT_30(d.mock),
    need: NOTHING_NEEDED,
    leave: d.state === "asking" ? "Stay a few seconds while the demo shop signs." : "You can close this page; the demo shop's transaction lands whether or not this page is open.",
    canLeave: d.state === "sending",
    money,
  });
}

// ---- one line for lists -------------------------------------------------------------------------------

/** The one-line form of an order's state, for the rows of /mine and the merchant desk. */
export function orderLine(o: OrderInput): string {
  const g = orderGuide(o);
  return g.now;
}
