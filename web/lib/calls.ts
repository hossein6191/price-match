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
  /** release(order): anyone, once the window has ended with the order still open. */
  release: (order: string): Call => ({ fn: "release", args: [order] }),
};
