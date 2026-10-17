// One-click suggestions for every field a visitor types into, so nothing on the site needs typing.
// Every value here is inside the contract's limits; tests/unit/suggestions.test.mjs checks each one
// against lib/rules.ts. Competitor prefixes are not here: the only ones a validator can really fetch
// are the demo shop's own, pinned to a commit, so the merchant desk offers those, read from the chain.

import { DEMO_PRODUCTS } from "./demo-shop.ts";

const GEN = 10n ** 18n;

export type Chip<T> = { label: string; value: T };

/** Shop names a merchant can pick (none of them is the demo shop's name). All fictional. */
export const NAME_CHIPS: string[] = [
  "Quayside Kitchen Supply",
  "Millbrook Outdoor",
  "Tinbox Audio",
  "Fernhill Home Store",
  "Copperleaf Appliances",
  "Saltmarsh Camping Co",
  "Larkspur Housewares",
  "Northfield Gadget Bench",
];

/** A product a merchant can list with one click: every field filled, every value inside the limits. */
export type ProductChip = { label: string; title: string; spec: string; priceAtto: bigint; window: number; note: string };

export const PRODUCT_CHIPS: ProductChip[] = [
  ...DEMO_PRODUCTS.map((p) => ({
    label: p.title.split(",")[0],
    title: p.title,
    spec: p.spec,
    priceAtto: BigInt(p.priceAtto),
    window: p.window,
    note: "the demo pages can be claimed against it",
  })),
  {
    label: "Copperline toaster",
    title: "Copperline T4 toaster, four slots, cream",
    spec: "Copperline T4 four-slot toaster. Brand: Copperline. Model: T4-CR. Size: four slots. Colour: cream. Condition: new, sealed in the original box.",
    priceAtto: (GEN * 3n) / 2n,
    window: 86400,
    note: "your own competitors' pages",
  },
  {
    label: "Ashgrove umbrella",
    title: "Ashgrove U3 folding umbrella, charcoal",
    spec: "Ashgrove U3 folding umbrella. Brand: Ashgrove. Model: U3-CH. Size: 98 cm canopy. Colour: charcoal. Condition: new, in the original sleeve.",
    priceAtto: (GEN * 9n) / 10n,
    window: 7 * 86400,
    note: "your own competitors' pages",
  },
  {
    label: "Redfern lunch box",
    title: "Redfern 1.2 L lunch box, sage",
    spec: "Redfern stainless steel lunch box. Brand: Redfern. Model: LB-12. Capacity: 1.2 litres. Colour: sage. Condition: new, with the original tags.",
    priceAtto: GEN / 2n,
    window: 3600,
    note: "your own competitors' pages",
  },
];

/** Prices, from 0.5 GEN to 10 GEN. */
export const PRICE_CHIPS: Chip<bigint>[] = [
  { label: "0.5 GEN", value: GEN / 2n },
  { label: "1.2 GEN", value: (GEN * 6n) / 5n },
  { label: "2 GEN", value: 2n * GEN },
  { label: "3.5 GEN", value: (GEN * 7n) / 2n },
  { label: "10 GEN", value: 10n * GEN },
];

/** Guarantee windows, from 20 minutes (the contract's least) to 30 days (its most). */
export const WINDOW_CHIPS: Chip<number>[] = [
  { label: "20 min", value: 1200 },
  { label: "30 min", value: 1800 },
  { label: "1 h", value: 3600 },
  { label: "1 day", value: 86400 },
  { label: "7 days", value: 7 * 86400 },
  { label: "30 days", value: 30 * 86400 },
];

/** What an owner may add to a bond: it must cover the full price of every sale while its window runs. */
export const BOND_CHIPS: Chip<bigint>[] = [
  { label: "2 GEN", value: 2n * GEN },
  { label: "5 GEN", value: 5n * GEN },
  { label: "10 GEN", value: 10n * GEN },
  { label: "25 GEN", value: 25n * GEN },
];

/** Claim-fee credit: one claim stakes 0.01 GEN. */
export const CREDIT_CHIPS: Chip<bigint>[] = [
  { label: "0.01 GEN, one claim", value: GEN / 100n },
  { label: "0.02 GEN, two claims", value: GEN / 50n },
  { label: "0.05 GEN", value: GEN / 20n },
];
