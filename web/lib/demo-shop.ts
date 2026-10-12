// The demo shop and the fifteen competitor pages it promises to match.
//
// The demo shop, Harbour Lane Goods, is opened once by a throwaway Studio key the site's server holds
// (DEMO_SHOP_KEY; tools/open-demo-shop.mjs), with a bond and the three products below. It accepts
// pages below three competitor prefixes on raw.githubusercontent.com, pinned to one commit of the
// public repository, so every validator fetches the same bytes. A visitor buys from it with their own
// wallet and claims with one of the pages below: for each product there is one page per outcome. The
// site serves copies of the same pages under /competitors/ so a visitor can open them and see for
// themselves what the validators will read. Every shop and brand is fictional. Pure, so node runs it
// in tests/unit.

import { ATTO, type Outcome, type ProductWord } from "./rules.ts";

export const DEMO_SHOP_NAME = "Harbour Lane Goods";
/** Seconds each demo product's guarantee runs: long enough for two claims on a slow Studio. */
export const DEMO_WINDOW = 1800;
/** The bond the demo shop opens with, and what one top-up adds. */
export const DEMO_BOND = 30n * ATTO;
export const RESTOCK_AMOUNT = 10n * ATTO;

export type CompetitorKey = "northgate" | "bright-basket" | "corner-hardware";

export const COMPETITORS: { key: CompetitorKey; name: string; short: string }[] = [
  { key: "northgate", name: "Northgate Electronics", short: "Northgate" },
  { key: "bright-basket", name: "Bright Basket", short: "Bright Basket" },
  { key: "corner-hardware", name: "Corner Hardware", short: "Corner Hardware" },
];

export type DemoProductKey = "kettle" | "earbuds" | "bag";

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
  /** the one price the page states, in atto; "" when it shows none */
  priceAtto: string;
  /** what the page is, in a few words, for its chip */
  says: string;
  /** what the demo expects the network to make of it against its own product */
  expect: Outcome;
};

const g = (hundredths: bigint) => ((hundredths * ATTO) / 100n).toString();

export const DEMO_PAGES: DemoPage[] = [
  { competitor: "northgate", file: "lumio-k3-kettle.html", product: "kettle", heading: "Lumio K3 electric kettle, 1.7 L, brushed stainless steel", model: "K3-170", refurbished: false, priceAtto: g(180n), says: "same kettle, 1.80 GEN", expect: "matched" },
  { competitor: "bright-basket", file: "lumio-k2-kettle.html", product: "kettle", heading: "Lumio K2 electric kettle, 1.5 L, white", model: "K2-150", refurbished: false, priceAtto: g(140n), says: "a Lumio K2, 1.5 L", expect: "different" },
  { competitor: "corner-hardware", file: "lumio-k3-kettle-refurbished.html", product: "kettle", heading: "Lumio K3 electric kettle, 1.7 L, refurbished", model: "K3-170", refurbished: true, priceAtto: g(130n), says: "refurbished", expect: "different" },
  { competitor: "bright-basket", file: "lumio-k3-kettle.html", product: "kettle", heading: "Lumio K3 electric kettle, 1.7 L, brushed stainless steel", model: "K3-170", refurbished: false, priceAtto: g(230n), says: "same kettle, 2.30 GEN", expect: "not_cheaper" },
  { competitor: "corner-hardware", file: "lumio-k3-kettle.html", product: "kettle", heading: "Lumio K3 electric kettle, 1.7 L, brushed stainless steel", model: "K3-170", refurbished: false, priceAtto: "", says: "same kettle, no price shown", expect: "unclear" },
  { competitor: "bright-basket", file: "arcwave-x200-earbuds.html", product: "earbuds", heading: "Arcwave X200 wireless earbuds, black", model: "X200-BK", refurbished: false, priceAtto: g(320n), says: "same earbuds, 3.20 GEN", expect: "matched" },
  { competitor: "northgate", file: "arcwave-x100-earbuds.html", product: "earbuds", heading: "Arcwave X100 wireless earbuds, white", model: "X100-WH", refurbished: false, priceAtto: g(260n), says: "an Arcwave X100, white", expect: "different" },
  { competitor: "northgate", file: "arcwave-x200-earbuds-refurbished.html", product: "earbuds", heading: "Arcwave X200 wireless earbuds, black, refurbished", model: "X200-BK", refurbished: true, priceAtto: g(240n), says: "refurbished", expect: "different" },
  { competitor: "corner-hardware", file: "arcwave-x200-earbuds.html", product: "earbuds", heading: "Arcwave X200 wireless earbuds, black", model: "X200-BK", refurbished: false, priceAtto: g(380n), says: "same earbuds, 3.80 GEN", expect: "not_cheaper" },
  { competitor: "northgate", file: "arcwave-x200-earbuds.html", product: "earbuds", heading: "Arcwave X200 wireless earbuds, black", model: "X200-BK", refurbished: false, priceAtto: "", says: "same earbuds, no price shown", expect: "unclear" },
  { competitor: "corner-hardware", file: "tidewell-dry-bag-20l.html", product: "bag", heading: "Tidewell roll-top dry bag, 20 L, orange", model: "DB-20", refurbished: false, priceAtto: g(95n), says: "same bag, 0.95 GEN", expect: "matched" },
  { competitor: "bright-basket", file: "tidewell-dry-bag-10l.html", product: "bag", heading: "Tidewell roll-top dry bag, 10 L, orange", model: "DB-10", refurbished: false, priceAtto: g(80n), says: "a Tidewell DB-10, 10 L", expect: "different" },
  { competitor: "corner-hardware", file: "tidewell-dry-bag-20l-refurbished.html", product: "bag", heading: "Tidewell roll-top dry bag, 20 L, orange, refurbished", model: "DB-20", refurbished: true, priceAtto: g(70n), says: "refurbished", expect: "different" },
  { competitor: "northgate", file: "tidewell-dry-bag-20l.html", product: "bag", heading: "Tidewell roll-top dry bag, 20 L, orange", model: "DB-20", refurbished: false, priceAtto: g(145n), says: "same bag, 1.45 GEN", expect: "not_cheaper" },
  { competitor: "bright-basket", file: "tidewell-dry-bag-20l.html", product: "bag", heading: "Tidewell roll-top dry bag, 20 L, orange", model: "DB-20", refurbished: false, priceAtto: "", says: "same bag, no price shown", expect: "unclear" },
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
 * prefixes name none of the three demo directories gets no chips.
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

/** True when a shop is the demo shop: its owner is the demo key's address and its name is the demo name. */
export function isDemoShop(shop: { owner: string; name: string }, demoOwner: string): boolean {
  return !!demoOwner && shop.owner.toLowerCase() === demoOwner.toLowerCase() && shop.name === DEMO_SHOP_NAME;
}

// ---- the scripted reader of mock mode -------------------------------------------------------------

export type Reading = { product: ProductWord; price: string } | { error: string };

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
  if (page.refurbished || !spec.includes(page.model)) return { product: "different", price: "" };
  return { product: "same", price: page.priceAtto };
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
