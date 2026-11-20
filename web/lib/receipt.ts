// The lines a claim's receipt prints, top to bottom. Pure, with no React: a judged claim (or a round
// that stored nothing) and the clock in, the lines out. components/receipt.tsx prints them one by one;
// tests/unit/receipt.test.mjs checks every outcome, the pending state, an appeal and a settlement.
// Nothing here may say more than the contract stored: the product word, the stock word, the agreed
// price or none, the outcome, the refund due or paid, the appeal and where the claim fee went. The one
// addition is a demo page's own words about its stock, labelled as the page's.

import { AVAILABILITY_WORDS, demoPageOf } from "./demo-shop.ts";
import { clockTime, pagePath, tagPrice } from "./format.ts";
import { STOCK_LINE } from "./rules.ts";
import type { Claim, Reading } from "./types.ts";

export type Mark = "yes" | "no" | "maybe";

export type ReceiptLine =
  | { kind: "row"; label: string; value?: string; mark?: Mark; strong?: boolean }
  | { kind: "note"; text: string }
  | { kind: "rule" };

const row = (label: string, value?: string, mark?: Mark, strong?: boolean): ReceiptLine => ({ kind: "row", label, value, mark, strong });
const note = (text: string): ReceiptLine => ({ kind: "note", text });
const RULE: ReceiptLine = { kind: "rule" };
/** An amount as a till prints it: two decimals at least. */
const money = (atto: string): string => `${tagPrice(atto)} GEN`;

const FINDING: Record<Reading["outcome"], string> = {
  matched: "PRICE MATCHED",
  not_in_stock: "NOT IN STOCK",
  not_cheaper: "NOT CHEAPER",
  different: "DIFFERENT PRODUCT",
  unclear: "UNCLEAR",
};

/** What one reading found: same product or not, in stock or not, their price. */
function readingLines(r: Reading, url: string): ReceiptLine[] {
  const lines: ReceiptLine[] = [];
  if (r.product === "same") lines.push(row("SAME PRODUCT", undefined, "yes"));
  else if (r.product === "different") lines.push(row("DIFFERENT PRODUCT", undefined, "no"));
  else lines.push(row("SAME PRODUCT?", "UNCLEAR", "maybe"));
  if (r.product !== "same") lines.push(row("STOCK", "NOT ASKED"));
  else {
    const stock = r.stock || "unclear";
    lines.push(row("STOCK", STOCK_LINE[stock], stock === "in_stock" ? "yes" : stock === "out_of_stock" ? "no" : "maybe"));
    const page = demoPageOf(url);
    if (page && stock === "out_of_stock") lines.push(note(AVAILABILITY_WORDS[page.availability]));
  }
  if (r.product !== "same" || r.stock !== "in_stock") lines.push(row("THEIR PRICE", "NOT ASKED"));
  else if (r.priceAtto) lines.push(row("THEIR PRICE", money(r.priceAtto)));
  else lines.push(row("THEIR PRICE", "NOT AGREED", "maybe"));
  return lines;
}

/** The receipt of one judged claim: its first reading, an appeal's beside it, and how it settled or that it is pending. */
export function claimLines(c: Claim, now: number): ReceiptLine[] {
  const lines: ReceiptLine[] = [row("COMPETITOR PAGE READ", undefined, "yes"), note(pagePath(c.url) || c.url)];
  lines.push(...readingLines(c.first, c.url));
  lines.push(row("OUR PRICE", money(c.oursAtto)));
  lines.push(RULE);
  lines.push(row("FINDING", FINDING[c.first.outcome], undefined, c.first.outcome === "matched"));
  if (c.first.outcome === "matched") lines.push(row("REFUND DUE", money(c.first.refundAtto), undefined, true));
  if (c.appeal) {
    const a = c.appeal;
    lines.push(RULE);
    lines.push(row("APPEAL BY", a.by === "shop" ? "THE SHOP" : "THE BUYER"));
    lines.push(note(`"${a.reason}"`));
    lines.push(row("SECOND READING", "SAME PAGE TEXT"));
    lines.push(...readingLines(a, c.url));
    lines.push(row("FINDING", FINDING[a.outcome]));
    lines.push(row("APPEAL", a.result === "overturned" ? "OVERTURNED" : "UPHELD", undefined, true));
    lines.push(note(a.result === "overturned" ? "the second reading replaces the first" : "the first reading stands"));
    lines.push(row("BOND", a.bondTo === a.by ? "0.05 GEN BACK" : `0.05 GEN TO ${a.bondTo === "shop" ? "SHOP" : "BUYER"}`));
  }
  lines.push(RULE);
  if (c.state === "pending") {
    lines.push(row("PENDING", "NOTHING MOVED YET", "maybe"));
    lines.push(row("APPEAL UNTIL", clockTime(c.appealEnd, now) || "THE WINDOW ENDS"));
    lines.push(row("MAY APPEAL", c.mayAppeal === "shop" ? "THE SHOP" : "THE BUYER"));
    lines.push(row("CLAIM FEE", "0.01 GEN HELD"));
    return lines;
  }
  const how = c.settledBy === "appeal" ? "BY THE APPEAL" : c.settledBy === "waived" ? "APPEAL WAIVED" : "WINDOW CLOSED";
  lines.push(row("SETTLED", how));
  if (c.final === "matched") lines.push(row("REFUND PAID", money(c.paidAtto), undefined, true));
  else lines.push(row("REFUND", "0.00 GEN"));
  lines.push(c.feeTo === "shop" ? row("CLAIM FEE", "0.01 GEN TO SHOP") : row("CLAIM FEE", "BACK TO BUYER"));
  return lines;
}

/** The receipt of a claim whose round stored nothing: the page could not be read, or the validators split. */
export function unreadLines(pageUrl: string, why: string): ReceiptLine[] {
  return [
    row("COMPETITOR PAGE NOT READ", undefined, "no"),
    note(pagePath(pageUrl) || pageUrl || "the page"),
    note(why || "The validators did not agree on a value."),
    RULE,
    row("NOTHING STORED", "NOTHING MOVED"),
    row("CLAIM FEE", "KEPT BY BUYER"),
    note("This round does not count: the claim may be made again."),
  ];
}

/** The plain-text form of a receipt, for a screen reader's summary and the tests. */
export function receiptText(lines: ReceiptLine[]): string {
  return lines
    .map((l) => {
      if (l.kind === "rule") return "----";
      if (l.kind === "note") return l.text;
      const mark = l.mark === "yes" ? " (yes)" : l.mark === "no" ? " (no)" : l.mark === "maybe" ? " (unclear)" : "";
      return `${l.label}${l.value ? " " + l.value : ""}${mark}`;
    })
    .join("\n");
}
