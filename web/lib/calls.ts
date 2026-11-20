// One builder per write method of the contract: the method's name, its arguments in the contract's
// order, and the value sent. Pure, so tests/unit/interface.test.mjs checks every builder against the
// signatures in contracts/price_match.py with no browser and no network.

import type { Call } from "./types.ts";

export const calls = {
  /** open_shop(name, competitors_json): anyone; the sender is the owner. The prefixes travel as a JSON list of strings. */
  openShop: (name: string, prefixes: string[]): Call => ({ fn: "open_shop", args: [name, JSON.stringify(prefixes)] }),
  /** fund(shop), payable: the owner adds the value sent to the bond. A refused fund returns it in the same transaction. */
  fund: (shop: string, amountAtto: bigint): Call => ({ fn: "fund", args: [shop], value: amountAtto }),
  /** withdraw_bond(shop, amount_atto): the owner takes back bond no open order has reserved. The amount travels as digits. */
  withdrawBond: (shop: string, amountAtto: bigint): Call => ({ fn: "withdraw_bond", args: [shop, amountAtto.toString()] }),
  /** list_product(shop, title, spec, price_atto, window_seconds): the owner. The price travels as digits, the window as an integer. */
  listProduct: (shop: string, title: string, spec: string, priceAtto: bigint, windowSeconds: number): Call => ({
    fn: "list_product",
    args: [shop, title, spec, priceAtto.toString(), Math.trunc(windowSeconds)],
  }),
  /** buy(product), payable: exactly the price. A refused buy returns what was sent in the same transaction. */
  buy: (product: string, priceAtto: bigint): Call => ({ fn: "buy", args: [product], value: priceAtto }),
  /** deposit(), payable: claim-fee credit for the sender. */
  deposit: (amountAtto: bigint): Call => ({ fn: "deposit", args: [], value: amountAtto }),
  /** withdraw(): the sender takes back all of its claim-fee credit. */
  withdraw: (): Call => ({ fn: "withdraw", args: [] }),
  /** claim(order, url): the buyer, inside the window, a page below an accepted prefix. Judged in the same call. */
  claim: (order: string, url: string): Call => ({ fn: "claim", args: [order, url] }),
  /** appeal(claim, reason): the side the pending finding went against, once, inside the appeal window. Stakes 0.05 GEN of credit; judged in the same call. */
  appeal: (claim: string, reason: string): Call => ({ fn: "appeal", args: [claim, reason] }),
  /** settle(claim): the side that may appeal at any time (which waives it); anyone once the appeal window has closed. */
  settle: (claim: string): Call => ({ fn: "settle", args: [claim] }),
  /** reprice(product, price_atto): the owner; the change is recorded in the product's history. The price travels as digits. */
  reprice: (product: string, priceAtto: bigint): Call => ({ fn: "reprice", args: [product, priceAtto.toString()] }),
  /** claim_drop(order): the buyer, while the order is open and no claim is pending; no model runs. */
  claimDrop: (order: string): Call => ({ fn: "claim_drop", args: [order] }),
  /** release(order): anyone, once the window has ended with the order still open and no claim pending. */
  release: (order: string): Call => ({ fn: "release", args: [order] }),
};
