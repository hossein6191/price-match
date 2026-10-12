// The lines a claim's receipt prints, top to bottom. Pure, with no React: a judged claim (or a round
// that stored nothing) and the order's price in, the lines out. components/receipt.tsx prints them
// one by one; tests/unit/receipt.test.mjs checks every outcome. Nothing here may say more than the
// contract stored: the product word, the agreed price or none, the outcome, the refund and where the
// claim fee went.

import { pagePath, tagPrice } from "./format.ts";
import type { Claim } from "./types.ts";

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

/** The receipt of one judged claim. */
export function claimLines(c: Claim, ourPriceAtto: string): ReceiptLine[] {
  const lines: ReceiptLine[] = [row("COMPETITOR PAGE READ", undefined, "yes"), note(pagePath(c.url) || c.url)];
  if (c.product === "same") lines.push(row("SAME PRODUCT", undefined, "yes"));
  else if (c.product === "different") lines.push(row("DIFFERENT PRODUCT", undefined, "no"));
  else lines.push(row("SAME PRODUCT?", "UNCLEAR", "maybe"));
  if (c.product !== "same") lines.push(row("THEIR PRICE", "NOT ASKED"));
  else if (c.priceAtto) lines.push(row("THEIR PRICE", money(c.priceAtto)));
  else lines.push(row("THEIR PRICE", "NOT AGREED", "maybe"));
  lines.push(row("OUR PRICE", money(ourPriceAtto)));
  lines.push(RULE);
  if (c.outcome === "matched") lines.push(row("REFUND", money(c.refundAtto), undefined, true));
  else if (c.outcome === "not_cheaper") lines.push(row("NOT CHEAPER", "REFUND 0.00 GEN"));
  else lines.push(row("REFUND", "0.00 GEN"));
  lines.push(c.feeTo === "shop" ? row("CLAIM FEE", "0.01 GEN TO SHOP") : row("CLAIM FEE", "KEPT BY BUYER"));
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
