// The demo shop and the forty-nine competitor pages it promises to match.
//
// The demo shop, Harbour Lane Goods, is opened by a throwaway Studio key the site's server holds
// (DEMO_SHOP_KEY; tools/open-demo-shop.mjs), with a bond and the nine products below. It accepts
// pages below three competitor prefixes on raw.githubusercontent.com, pinned to one commit of the
// public repository, so every validator fetches the same bytes. A visitor buys from it with their own
// wallet and claims with one of the pages below: for each product there is one page per outcome, and
// the kettle and the earbuds also have a cheaper page that is sold out and one on pre-order only. The
// site serves copies of the same pages under /competitors/ so a visitor can open them and see for
// themselves what the validators will read. Every shop and brand is fictional. Pure, so node runs it
// in tests/unit.

import { ATTO, MAX_PRICE, MIN_PRICE, idNumber, type Outcome, type ProductWord, type StockWord } from "./rules.ts";

export const DEMO_SHOP_NAME = "Harbour Lane Goods";
/** Seconds each demo product's guarantee runs: long enough for two claims on a slow Studio. */
export const DEMO_WINDOW = 1800;
/** The bond the demo shop opens with (about two open sales of every product at once), and what one top-up adds. */
export const DEMO_BOND = 40n * ATTO;
export const RESTOCK_AMOUNT = 10n * ATTO;

export type CompetitorKey = "northgate" | "bright-basket" | "corner-hardware";

export const COMPETITORS: { key: CompetitorKey; name: string; short: string }[] = [
  { key: "northgate", name: "Northgate Electronics", short: "Northgate" },
  { key: "bright-basket", name: "Bright Basket", short: "Bright Basket" },
  { key: "corner-hardware", name: "Corner Hardware", short: "Corner Hardware" },
];

export type DemoProductKey = "kettle" | "earbuds" | "bag" | "lamp" | "daypack" | "grinder" | "bottle" | "powerbank" | "throw";

export type DemoProduct = { key: DemoProductKey; title: string; spec: string; priceAtto: string; window: number; noun: string };

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    key: "kettle",
    noun: "kettle",
    title: "Lumio K3 kettle, 1.7 L, brushed steel",
    spec: "Lumio K3 electric kettle. Brand: Lumio. Model: K3-170. Capacity: 1.7 litres. Finish: brushed stainless steel. Condition: new, sealed in the original box.",
    priceAtto: (2n * ATTO).toString(),
    window: DEMO_WINDOW,
  },
  {
    key: "earbuds",
    noun: "earbuds",
    title: "Arcwave X200 wireless earbuds, black",
    spec: "Arcwave X200 wireless earbuds. Brand: Arcwave. Model: X200-BK. Colour: black. Includes the charging case. Condition: new, sealed in the original box.",
    priceAtto: ((35n * ATTO) / 10n).toString(),
    window: DEMO_WINDOW,
  },
  {
    key: "bag",
    noun: "dry bag",
    title: "Tidewell 20 L dry bag, orange",
    spec: "Tidewell roll-top dry bag. Brand: Tidewell. Model: DB-20. Capacity: 20 litres. Colour: orange. Condition: new, with the original tags.",
    priceAtto: ((12n * ATTO) / 10n).toString(),
    window: DEMO_WINDOW,
  },
  {
    key: "lamp",
    noun: "desk lamp",
    title: "Brightloom L2 desk lamp, white",
    spec: "Brightloom L2 LED desk lamp. Brand: Brightloom. Model: L2-WH. Size: 40 cm arm. Colour: white. Condition: new, sealed in the original box.",
    priceAtto: ((15n * ATTO) / 10n).toString(),
    window: DEMO_WINDOW,
  },
  {
    key: "daypack",
    noun: "daypack",
    title: "Kestrel 28 L daypack, grey",
    spec: "Kestrel 28 L daypack. Brand: Kestrel. Model: KD-28. Capacity: 28 litres. Colour: grey. Condition: new, with the original tags.",
    priceAtto: ((24n * ATTO) / 10n).toString(),
    window: DEMO_WINDOW,
  },
  {
    key: "grinder",
    noun: "coffee grinder",
    title: "Millhaven C1 burr coffee grinder, black",
    spec: "Millhaven C1 electric burr coffee grinder. Brand: Millhaven. Model: C1-BK. Capacity: 250 g bean hopper. Colour: black. Condition: new, sealed in the original box.",
    priceAtto: ((28n * ATTO) / 10n).toString(),
    window: DEMO_WINDOW,
  },
  {
    key: "bottle",
    noun: "bottle",
    title: "Pinecrest 1 L insulated bottle, green",
    spec: "Pinecrest insulated steel bottle. Brand: Pinecrest. Model: IB-1000. Capacity: 1 litre. Colour: green. Condition: new, with the original tags.",
    priceAtto: ((9n * ATTO) / 10n).toString(),
    window: DEMO_WINDOW,
  },
  {
    key: "powerbank",
    noun: "power bank",
    title: "Voltleaf P10 power bank, 10,000 mAh, white",
    spec: "Voltleaf P10 portable power bank. Brand: Voltleaf. Model: P10-WH. Capacity: 10,000 mAh. Colour: white. Includes a USB-C cable. Condition: new, sealed in the original box.",
    priceAtto: ((16n * ATTO) / 10n).toString(),
    window: DEMO_WINDOW,
  },
  {
    key: "throw",
    noun: "wool throw",
    title: "Larkfield wool throw, 130 x 170 cm, navy",
    spec: "Larkfield woven wool throw. Brand: Larkfield. Model: WT-130. Size: 130 x 170 cm. Colour: navy. Condition: new, with the original tags.",
    priceAtto: ((22n * ATTO) / 10n).toString(),
    window: DEMO_WINDOW,
  },
];

export type DemoPage = {
  competitor: CompetitorKey;
  file: string;
  product: DemoProductKey;
  /** the page's own heading */
  heading: string;
  /** the model code the page states */
  model: string;
  refurbished: boolean;
  /** what the page itself says about buying it now */
  availability: "in_stock" | "sold_out" | "pre_order";
  /** the one price the page states, in atto; "" when it shows none */
  priceAtto: string;
  /** what the page is, in a few words, for its chip */
  says: string;
  /** what the demo expects the network to make of it against its own product */
  expect: Outcome;
};

const g = (hundredths: bigint) => ((hundredths * ATTO) / 100n).toString();

export const DEMO_PAGES: DemoPage[] = [
  { competitor: "northgate", file: "lumio-k3-kettle.html", product: "kettle", heading: "Lumio K3 electric kettle, 1.7 L, brushed stainless steel", model: "K3-170", refurbished: false, availability: "in_stock", priceAtto: g(180n), says: "same kettle, 1.80 GEN", expect: "matched" },
  { competitor: "bright-basket", file: "lumio-k2-kettle.html", product: "kettle", heading: "Lumio K2 electric kettle, 1.5 L, white", model: "K2-150", refurbished: false, availability: "in_stock", priceAtto: g(140n), says: "a Lumio K2, 1.5 L", expect: "different" },
  { competitor: "corner-hardware", file: "lumio-k3-kettle-refurbished.html", product: "kettle", heading: "Lumio K3 electric kettle, 1.7 L, refurbished", model: "K3-170", refurbished: true, availability: "in_stock", priceAtto: g(130n), says: "refurbished", expect: "different" },
  { competitor: "bright-basket", file: "lumio-k3-kettle.html", product: "kettle", heading: "Lumio K3 electric kettle, 1.7 L, brushed stainless steel", model: "K3-170", refurbished: false, availability: "in_stock", priceAtto: g(230n), says: "same kettle, 2.30 GEN", expect: "not_cheaper" },
  { competitor: "northgate", file: "lumio-k3-kettle-sold-out.html", product: "kettle", heading: "Lumio K3 electric kettle, 1.7 L, brushed stainless steel", model: "K3-170", refurbished: false, availability: "sold_out", priceAtto: g(180n), says: "same kettle, 1.80 GEN, sold out", expect: "not_in_stock" },
  { competitor: "northgate", file: "lumio-k3-kettle-pre-order.html", product: "kettle", heading: "Lumio K3 electric kettle, 1.7 L, brushed stainless steel", model: "K3-170", refurbished: false, availability: "pre_order", priceAtto: g(180n), says: "same kettle, 1.80 GEN, pre-order only", expect: "not_in_stock" },
  { competitor: "corner-hardware", file: "lumio-k3-kettle.html", product: "kettle", heading: "Lumio K3 electric kettle, 1.7 L, brushed stainless steel", model: "K3-170", refurbished: false, availability: "in_stock", priceAtto: "", says: "same kettle, no price shown", expect: "unclear" },
  { competitor: "bright-basket", file: "arcwave-x200-earbuds.html", product: "earbuds", heading: "Arcwave X200 wireless earbuds, black", model: "X200-BK", refurbished: false, availability: "in_stock", priceAtto: g(320n), says: "same earbuds, 3.20 GEN", expect: "matched" },
  { competitor: "northgate", file: "arcwave-x100-earbuds.html", product: "earbuds", heading: "Arcwave X100 wireless earbuds, white", model: "X100-WH", refurbished: false, availability: "in_stock", priceAtto: g(260n), says: "an Arcwave X100, white", expect: "different" },
  { competitor: "northgate", file: "arcwave-x200-earbuds-refurbished.html", product: "earbuds", heading: "Arcwave X200 wireless earbuds, black, refurbished", model: "X200-BK", refurbished: true, availability: "in_stock", priceAtto: g(240n), says: "refurbished", expect: "different" },
  { competitor: "corner-hardware", file: "arcwave-x200-earbuds.html", product: "earbuds", heading: "Arcwave X200 wireless earbuds, black", model: "X200-BK", refurbished: false, availability: "in_stock", priceAtto: g(380n), says: "same earbuds, 3.80 GEN", expect: "not_cheaper" },
  { competitor: "bright-basket", file: "arcwave-x200-earbuds-sold-out.html", product: "earbuds", heading: "Arcwave X200 wireless earbuds, black", model: "X200-BK", refurbished: false, availability: "sold_out", priceAtto: g(320n), says: "same earbuds, 3.20 GEN, sold out", expect: "not_in_stock" },
  { competitor: "bright-basket", file: "arcwave-x200-earbuds-pre-order.html", product: "earbuds", heading: "Arcwave X200 wireless earbuds, black", model: "X200-BK", refurbished: false, availability: "pre_order", priceAtto: g(320n), says: "same earbuds, 3.20 GEN, pre-order only", expect: "not_in_stock" },
  { competitor: "northgate", file: "arcwave-x200-earbuds.html", product: "earbuds", heading: "Arcwave X200 wireless earbuds, black", model: "X200-BK", refurbished: false, availability: "in_stock", priceAtto: "", says: "same earbuds, no price shown", expect: "unclear" },
  { competitor: "corner-hardware", file: "tidewell-dry-bag-20l.html", product: "bag", heading: "Tidewell roll-top dry bag, 20 L, orange", model: "DB-20", refurbished: false, availability: "in_stock", priceAtto: g(95n), says: "same bag, 0.95 GEN", expect: "matched" },
  { competitor: "bright-basket", file: "tidewell-dry-bag-10l.html", product: "bag", heading: "Tidewell roll-top dry bag, 10 L, orange", model: "DB-10", refurbished: false, availability: "in_stock", priceAtto: g(80n), says: "a Tidewell DB-10, 10 L", expect: "different" },
  { competitor: "corner-hardware", file: "tidewell-dry-bag-20l-refurbished.html", product: "bag", heading: "Tidewell roll-top dry bag, 20 L, orange, refurbished", model: "DB-20", refurbished: true, availability: "in_stock", priceAtto: g(70n), says: "refurbished", expect: "different" },
  { competitor: "northgate", file: "tidewell-dry-bag-20l.html", product: "bag", heading: "Tidewell roll-top dry bag, 20 L, orange", model: "DB-20", refurbished: false, availability: "in_stock", priceAtto: g(145n), says: "same bag, 1.45 GEN", expect: "not_cheaper" },
  { competitor: "bright-basket", file: "tidewell-dry-bag-20l.html", product: "bag", heading: "Tidewell roll-top dry bag, 20 L, orange", model: "DB-20", refurbished: false, availability: "in_stock", priceAtto: "", says: "same bag, no price shown", expect: "unclear" },
  { competitor: "northgate", file: "brightloom-l2-desk-lamp.html", product: "lamp", heading: "Brightloom L2 LED desk lamp, white", model: "L2-WH", refurbished: false, availability: "in_stock", priceAtto: g(135n), says: "same lamp, 1.35 GEN", expect: "matched" },
  { competitor: "bright-basket", file: "brightloom-l1-desk-lamp.html", product: "lamp", heading: "Brightloom L1 LED desk lamp, white", model: "L1-WH", refurbished: false, availability: "in_stock", priceAtto: g(110n), says: "a Brightloom L1, 30 cm arm", expect: "different" },
  { competitor: "northgate", file: "brightloom-l2-desk-lamp-refurbished.html", product: "lamp", heading: "Brightloom L2 LED desk lamp, white, refurbished", model: "L2-WH", refurbished: true, availability: "in_stock", priceAtto: g(105n), says: "refurbished", expect: "different" },
  { competitor: "corner-hardware", file: "brightloom-l2-desk-lamp.html", product: "lamp", heading: "Brightloom L2 LED desk lamp, white", model: "L2-WH", refurbished: false, availability: "in_stock", priceAtto: g(175n), says: "same lamp, 1.75 GEN", expect: "not_cheaper" },
  { competitor: "bright-basket", file: "brightloom-l2-desk-lamp.html", product: "lamp", heading: "Brightloom L2 LED desk lamp, white", model: "L2-WH", refurbished: false, availability: "in_stock", priceAtto: "", says: "same lamp, no price shown", expect: "unclear" },
  { competitor: "bright-basket", file: "kestrel-daypack-28l.html", product: "daypack", heading: "Kestrel daypack, 28 L, grey", model: "KD-28", refurbished: false, availability: "in_stock", priceAtto: g(215n), says: "same daypack, 2.15 GEN", expect: "matched" },
  { competitor: "corner-hardware", file: "kestrel-daypack-18l.html", product: "daypack", heading: "Kestrel daypack, 18 L, grey", model: "KD-18", refurbished: false, availability: "in_stock", priceAtto: g(170n), says: "a Kestrel KD-18, 18 L", expect: "different" },
  { competitor: "bright-basket", file: "kestrel-daypack-28l-refurbished.html", product: "daypack", heading: "Kestrel daypack, 28 L, grey, refurbished", model: "KD-28", refurbished: true, availability: "in_stock", priceAtto: g(160n), says: "refurbished", expect: "different" },
  { competitor: "northgate", file: "kestrel-daypack-28l.html", product: "daypack", heading: "Kestrel daypack, 28 L, grey", model: "KD-28", refurbished: false, availability: "in_stock", priceAtto: g(290n), says: "same daypack, 2.90 GEN", expect: "not_cheaper" },
  { competitor: "corner-hardware", file: "kestrel-daypack-28l.html", product: "daypack", heading: "Kestrel daypack, 28 L, grey", model: "KD-28", refurbished: false, availability: "in_stock", priceAtto: "", says: "same daypack, no price shown", expect: "unclear" },
  { competitor: "corner-hardware", file: "millhaven-c1-grinder.html", product: "grinder", heading: "Millhaven C1 electric burr coffee grinder, black", model: "C1-BK", refurbished: false, availability: "in_stock", priceAtto: g(245n), says: "same grinder, 2.45 GEN", expect: "matched" },
  { competitor: "northgate", file: "millhaven-c2-grinder.html", product: "grinder", heading: "Millhaven C2 electric burr coffee grinder, black", model: "C2-BK", refurbished: false, availability: "in_stock", priceAtto: g(330n), says: "a Millhaven C2, 350 g hopper", expect: "different" },
  { competitor: "corner-hardware", file: "millhaven-c1-grinder-refurbished.html", product: "grinder", heading: "Millhaven C1 electric burr coffee grinder, black, refurbished", model: "C1-BK", refurbished: true, availability: "in_stock", priceAtto: g(190n), says: "refurbished", expect: "different" },
  { competitor: "bright-basket", file: "millhaven-c1-grinder.html", product: "grinder", heading: "Millhaven C1 electric burr coffee grinder, black", model: "C1-BK", refurbished: false, availability: "in_stock", priceAtto: g(320n), says: "same grinder, 3.20 GEN", expect: "not_cheaper" },
  { competitor: "northgate", file: "millhaven-c1-grinder.html", product: "grinder", heading: "Millhaven C1 electric burr coffee grinder, black", model: "C1-BK", refurbished: false, availability: "in_stock", priceAtto: "", says: "same grinder, no price shown", expect: "unclear" },
  { competitor: "bright-basket", file: "pinecrest-bottle-1l.html", product: "bottle", heading: "Pinecrest insulated steel bottle, 1 L, green", model: "IB-1000", refurbished: false, availability: "in_stock", priceAtto: g(80n), says: "same bottle, 0.80 GEN", expect: "matched" },
  { competitor: "northgate", file: "pinecrest-bottle-500ml.html", product: "bottle", heading: "Pinecrest insulated steel bottle, 500 ml, green", model: "IB-500", refurbished: false, availability: "in_stock", priceAtto: g(65n), says: "a Pinecrest IB-500, 500 ml", expect: "different" },
  { competitor: "corner-hardware", file: "pinecrest-bottle-1l-refurbished.html", product: "bottle", heading: "Pinecrest insulated steel bottle, 1 L, green, refurbished", model: "IB-1000", refurbished: true, availability: "in_stock", priceAtto: g(60n), says: "refurbished", expect: "different" },
  { competitor: "corner-hardware", file: "pinecrest-bottle-1l.html", product: "bottle", heading: "Pinecrest insulated steel bottle, 1 L, green", model: "IB-1000", refurbished: false, availability: "in_stock", priceAtto: g(115n), says: "same bottle, 1.15 GEN", expect: "not_cheaper" },
  { competitor: "northgate", file: "pinecrest-bottle-1l.html", product: "bottle", heading: "Pinecrest insulated steel bottle, 1 L, green", model: "IB-1000", refurbished: false, availability: "in_stock", priceAtto: "", says: "same bottle, no price shown", expect: "unclear" },
  { competitor: "northgate", file: "voltleaf-p10-power-bank.html", product: "powerbank", heading: "Voltleaf P10 portable power bank, 10,000 mAh, white", model: "P10-WH", refurbished: false, availability: "in_stock", priceAtto: g(145n), says: "same power bank, 1.45 GEN", expect: "matched" },
  { competitor: "bright-basket", file: "voltleaf-p20-power-bank.html", product: "powerbank", heading: "Voltleaf P20 portable power bank, 20,000 mAh, white", model: "P20-WH", refurbished: false, availability: "in_stock", priceAtto: g(210n), says: "a Voltleaf P20, 20,000 mAh", expect: "different" },
  { competitor: "northgate", file: "voltleaf-p10-power-bank-refurbished.html", product: "powerbank", heading: "Voltleaf P10 portable power bank, 10,000 mAh, white, refurbished", model: "P10-WH", refurbished: true, availability: "in_stock", priceAtto: g(110n), says: "refurbished", expect: "different" },
  { competitor: "bright-basket", file: "voltleaf-p10-power-bank.html", product: "powerbank", heading: "Voltleaf P10 portable power bank, 10,000 mAh, white", model: "P10-WH", refurbished: false, availability: "in_stock", priceAtto: g(190n), says: "same power bank, 1.90 GEN", expect: "not_cheaper" },
  { competitor: "corner-hardware", file: "voltleaf-p10-power-bank.html", product: "powerbank", heading: "Voltleaf P10 portable power bank, 10,000 mAh, white", model: "P10-WH", refurbished: false, availability: "in_stock", priceAtto: "", says: "same power bank, no price shown", expect: "unclear" },
  { competitor: "corner-hardware", file: "larkfield-wool-throw-130.html", product: "throw", heading: "Larkfield woven wool throw, 130 x 170 cm, navy", model: "WT-130", refurbished: false, availability: "in_stock", priceAtto: g(195n), says: "same throw, 1.95 GEN", expect: "matched" },
  { competitor: "corner-hardware", file: "larkfield-wool-throw-150.html", product: "throw", heading: "Larkfield woven wool throw, 150 x 200 cm, navy", model: "WT-150", refurbished: false, availability: "in_stock", priceAtto: g(270n), says: "a Larkfield WT-150, 150 x 200 cm", expect: "different" },
  { competitor: "bright-basket", file: "larkfield-wool-throw-130-refurbished.html", product: "throw", heading: "Larkfield woven wool throw, 130 x 170 cm, navy, refurbished", model: "WT-130", refurbished: true, availability: "in_stock", priceAtto: g(150n), says: "refurbished", expect: "different" },
  { competitor: "northgate", file: "larkfield-wool-throw-130.html", product: "throw", heading: "Larkfield woven wool throw, 130 x 170 cm, navy", model: "WT-130", refurbished: false, availability: "in_stock", priceAtto: g(260n), says: "same throw, 2.60 GEN", expect: "not_cheaper" },
  { competitor: "bright-basket", file: "larkfield-wool-throw-130.html", product: "throw", heading: "Larkfield woven wool throw, 130 x 170 cm, navy", model: "WT-130", refurbished: false, availability: "in_stock", priceAtto: "", says: "same throw, no price shown", expect: "unclear" },
];

export const competitorName = (key: CompetitorKey): string => COMPETITORS.find((c) => c.key === key)?.short ?? key;

/** "owner/name" from a GitHub repository URL; "" when it is not one. */
export function repoOf(url: string): string {
  const m = /^https:\/\/github\.com\/([A-Za-z0-9-]+\/[A-Za-z0-9._-]+?)\/?$/.exec(String(url ?? "").trim());
  return m ? m[1] : "";
}

/** The pinned base every demo prefix starts with. */
export const rawBase = (repo: string, commit: string): string => `https://raw.githubusercontent.com/${repo}/${commit}/competitors/`;

/** The demo shop's three competitor prefixes, in the order it opens with them. */
export const demoPrefixes = (repo: string, commit: string): string[] => COMPETITORS.map((c) => rawBase(repo, commit) + c.key + "/");

/** The competitor a prefix names, when it is one of the three demo directories; null otherwise. */
export function competitorOfPrefix(prefix: string): CompetitorKey | null {
  for (const c of COMPETITORS) if (prefix.endsWith(`/competitors/${c.key}/`)) return c.key;
  return null;
}

/** The demo page an address names, read from its last two segments; null for any other address. */
export function demoPageOf(url: string): DemoPage | null {
  const m = /\/competitors\/([a-z-]+)\/([a-z0-9-]+\.html)$/.exec(String(url ?? ""));
  if (!m) return null;
  return DEMO_PAGES.find((p) => p.competitor === m[1] && p.file === m[2]) ?? null;
}

/** The demo product a spec is, word for word; null for any other spec. */
export const demoProductOf = (spec: string): DemoProduct | null => DEMO_PRODUCTS.find((p) => p.spec === spec) ?? null;

export type PageChip = {
  /** "Northgate: same kettle, 1.80 GEN" */
  label: string;
  /** the address the claim sends: the shop's own prefix and the page's file */
  url: string;
  /** the site's own copy, for a visitor to open */
  local: string;
  page: DemoPage;
  /** true when the page is about this order's own product */
  own: boolean;
};

/**
 * One chip per demo page the shop's prefixes reach, the order's own product first. The address is
 * built from the prefix the shop accepted, so a chip can never point outside it. A shop whose
 * prefixes name none of the three competitor directories gets no chips.
 */
export function pageChips(spec: string, prefixes: string[]): PageChip[] {
  const product = demoProductOf(spec);
  const out: PageChip[] = [];
  for (const page of DEMO_PAGES) {
    const prefix = prefixes.find((p) => competitorOfPrefix(p) === page.competitor);
    if (!prefix) continue;
    const own = !!product && page.product === product.key;
    out.push({
      label: `${competitorName(page.competitor)}: ${own ? page.says : page.heading}`,
      url: prefix + page.file,
      local: `/competitors/${page.competitor}/${page.file}`,
      page,
      own,
    });
  }
  return [...out.filter((c) => c.own), ...out.filter((c) => !c.own)];
}

/** True when a shop is the demo shop: its owner is the demo key's address and its name is a demo name. */
export function isDemoShop(shop: { owner: string; name: string }, demoOwner: string): boolean {
  return !!demoOwner && shop.owner.toLowerCase() === demoOwner.toLowerCase() && isDemoShopName(shop.name);
}

// ---- reopening the demo shop at a new commit -------------------------------------------------------
//
// A shop's competitor prefixes are fixed for good, and the contract refuses a second shop of the same
// name from one address. So when the demo pages move to a new commit, the demo key opens the next shop
// of one family of names: "Harbour Lane Goods", then "Harbour Lane Goods 2", "Harbour Lane Goods 3".

/** True for the demo name and for the demo name followed by a space and a number from 2 to 99. */
export function isDemoShopName(name: string): boolean {
  if (name === DEMO_SHOP_NAME) return true;
  const m = /^(.*) ([2-9]|[1-9][0-9])$/.exec(name);
  return !!m && m[1] === DEMO_SHOP_NAME;
}

/** The first demo name none of `taken` uses, compared as the contract compares them (case aside). */
export function nextDemoShopName(taken: string[]): string {
  const used = new Set(taken.map((n) => n.toLowerCase()));
  for (let k = 1; k < 100; k++) {
    const name = k === 1 ? DEMO_SHOP_NAME : `${DEMO_SHOP_NAME} ${k}`;
    if (!used.has(name.toLowerCase())) return name;
  }
  return "";
}

/** True when two prefix lists hold exactly the same prefixes. */
export function samePrefixes(a: string[], b: string[]): boolean {
  const x = [...a].sort();
  const y = [...b].sort();
  return x.length === y.length && x.every((p, i) => p === y[i]);
}

const newestFirst = <T extends { id: string }>(rows: T[]): T[] => [...rows].sort((a, b) => idNumber(b.id) - idNumber(a.id));

/**
 * What tools/open-demo-shop.mjs does with the shops its key already runs: keep the newest demo-named
 * shop when its prefixes are exactly `prefixes`, else open a new one under the next free demo name.
 */
export function demoShopPlan(rows: { id: string; name: string; competitors: string[] }[], prefixes: string[]): { keep: string } | { open: string; after: string } {
  const newest = newestFirst(rows.filter((r) => isDemoShopName(r.name)))[0];
  if (newest && samePrefixes(newest.competitors, prefixes)) return { keep: newest.id };
  return { open: nextDemoShopName(rows.map((r) => r.name)), after: newest?.id ?? "" };
}

/**
 * The shop the site's server treats as the demo shop, among the key's own: the newest demo-named shop
 * that lists products, so a shop that is still being opened does not empty the shelf; else the newest
 * demo-named shop; "" when there is none.
 */
export function pickDemoShop(rows: { id: string; name: string; products: number }[]): string {
  const demo = newestFirst(rows.filter((r) => isDemoShopName(r.name)));
  return (demo.find((r) => r.products > 0) ?? demo[0])?.id ?? "";
}

// ---- the scripted reader of mock mode -------------------------------------------------------------

export type Reading = { product: ProductWord; stock: StockWord; price: string } | { error: string };

export const FETCH_FAILED = "[TRANSIENT] the page could not be fetched; nothing was stored, and the claim may be made again";

/**
 * What the in-memory contract of mock mode agrees on for a page, in place of the validators: a demo
 * page is read from what it states (its model code, its condition and its one price, or none), and
 * any other address cannot be fetched in the demo build, so the round stores nothing. On chain every
 * validator fetches the page itself and asks its own model.
 */
export function scriptedReading(url: string, spec: string): Reading {
  const page = demoPageOf(url);
  if (!page) return { error: FETCH_FAILED };
  if (page.refurbished || !spec.includes(page.model)) return { product: "different", stock: "", price: "" };
  if (page.availability !== "in_stock") return { product: "same", stock: "out_of_stock", price: "" };
  return { product: "same", stock: "in_stock", price: page.priceAtto };
}

/** The page's own words about buying it now, as a receipt note: the contract stores one word for sold out and pre-order. */
export const AVAILABILITY_WORDS: Record<DemoPage["availability"], string> = { in_stock: "the page says: in stock", sold_out: "the page says: sold out", pre_order: "the page says: pre-order only" };

// ---- the demo shop's price, for testing price protection -------------------------------------------

/** How far the demo shop lowers a product's price when a visitor asks it to: 0.30 GEN. */
export const DEMO_DROP = (3n * ATTO) / 10n;

/**
 * The price the demo shop sets when asked to drop a demo product's price ("down": its list price less
 * DEMO_DROP) or raise it back ("up": its list price), or why it will not. It keeps two recorded changes
 * in hand so a lowered price can always be raised back. Pure: the server and the mock both ask it.
 */
export function repricePlan(
  product: { id: string; shop: string; spec: string; priceAtto: string; repricesLeft: number } | null,
  demoShop: string,
  direction: "down" | "up",
): { price: bigint } | { problem: string } {
  if (!demoShop) return { problem: "the demo shop is not open on this contract yet" };
  if (!product) return { problem: "there is no such product" };
  if (product.shop !== demoShop) return { problem: `${product.id} is not in the demo shop; only its own owner can reprice it` };
  const demo = demoProductOf(product.spec);
  if (!demo) return { problem: `${product.id} is not one of the demo products` };
  const list = BigInt(demo.priceAtto);
  const now = BigInt(product.priceAtto);
  if (direction === "down") {
    if (now < list) return { problem: `${product.id} is already below its list price; ask the shop to raise it back first` };
    if (product.repricesLeft < 2) return { problem: `${product.id} has ${product.repricesLeft} recorded price changes left; the demo shop keeps two to raise it back, so it will not lower it again` };
    const price = list - DEMO_DROP;
    return price >= MIN_PRICE && price <= MAX_PRICE ? { price } : { problem: "that price is outside the contract's range" };
  }
  if (now === list) return { problem: `${product.id} is already at its list price` };
  if (product.repricesLeft < 1) return { problem: `${product.id} has recorded every price change it may` };
  return { price: list };
}

/** The reason the demo shop gives when a visitor asks it to appeal a matched finding: its own words, fenced on chain as one party's argument. */
export const DEMO_APPEAL_REASON = "The shop asks for a second reading: please check the model, the condition, the stock and the one current price on the page again.";

/**
 * Why the demo shop will not appeal this claim now, in words a visitor can act on; "" when it will.
 * Only a pending matched finding on one of its own orders, while the appeal window runs.
 */
export function demoAppealProblem(
  claim: { id: string; state: string; mayAppeal: string; appealEnd: number; outcome: string } | null,
  orderShop: string,
  demoShop: string,
  now: number,
): string {
  if (!demoShop) return "the demo shop is not open on this contract yet";
  if (!claim) return "there is no such claim";
  if (orderShop !== demoShop) return `${claim.id} is not on an order from the demo shop`;
  if (claim.state !== "pending") return `${claim.id} is settled; a claim is appealed once, before it settles`;
  if (claim.mayAppeal !== "shop") return `${claim.id} found ${claim.outcome.replace(/_/g, " ")}; only the buyer may appeal that`;
  if (now >= claim.appealEnd) return `the appeal window of ${claim.id} has closed; anyone may settle it now`;
  return "";
}

// ---- topping up the demo shop's bond ------------------------------------------------------------

/**
 * Why the demo shop will not top up its bond for this product now, in words a visitor can act on;
 * "" when it will. The server asks this of a fresh read before it signs, and so does the mock.
 */
export function restockProblem(product: { id: string; shop: string } | null, demoShop: string): string {
  if (!demoShop) return "the demo shop is not open on this contract yet";
  if (!product) return "there is no such product";
  if (product.shop !== demoShop) return `${product.id} is not in the demo shop; only its own owner can add to that shop's bond`;
  return "";
}

/** How many competitor pages the demonstration carries. */
export const DEMO_PAGE_COUNT = DEMO_PAGES.length;
