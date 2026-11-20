"use client";

// What the validators are doing while a claim's round runs, drawn from the transaction's own stage:
// every validator fetches the competitor's page from the live web, asks its model the askings (same
// product, in stock, price) in both orders, and the contract keeps the one value they agree on exactly. The steps light up as the
// round moves (the propose stage is the leader's reading, commit and reveal are the others' own
// readings and votes). It shows what the stages mean; it does not claim to see inside a validator.

import { IconCheck, IconGlobe } from "@/components/icons";
import type { TxStatus } from "@/lib/types";
import { cx } from "@/lib/cx";

const STEP_AT = ["PROPOSING", "COMMITTING", "REVEALING", "ACCEPTED"];
const ORDER = ["PENDING", "PROPOSING", "COMMITTING", "REVEALING", "ACCEPTED", "FINALIZED"];

export function ReadingScene({ page, status }: { page: string; status: TxStatus | null }) {
  const stage = status ? ORDER.indexOf(status.status) : 0;
  const done = (i: number) => stage > ORDER.indexOf(STEP_AT[i]) || (status?.status === "FINALIZED" && !status.undetermined);
  const now = (i: number) => !done(i) && stage === ORDER.indexOf(STEP_AT[i]);
  const steps = [
    { title: "The leader fetches the page from the live web", detail: page },
    { title: "Every validator fetches it again, itself", detail: "nobody uploads a screenshot; each node reads the page as it is now" },
    { title: "Each asks its model: same product? a different product? the price?", detail: "both framings, both orders; our price is never shown to the model" },
    { title: "The value they agree on exactly is stored", detail: '{"product": same | different | unclear, "price": atto or none}' },
  ];
  return (
    <ol className="grid gap-1.5" aria-label="What the validators do in this round">
      {steps.map((s, i) => (
        <li key={i} className={cx("flex items-start gap-2.5 border-l-4 py-1 pl-2.5", done(i) ? "border-fresh" : now(i) ? "border-tag bg-tag-wash" : "border-line")}>
          <span className={cx("mt-0.5 grid size-5 shrink-0 place-items-center border-2", done(i) ? "border-fresh bg-fresh text-white" : "border-ink-3 text-ink-3")}>
            {done(i) ? <IconCheck size={12} /> : i === 0 ? <IconGlobe size={12} /> : <span className="display text-[11px] font-bold">{i + 1}</span>}
          </span>
          <span className="min-w-0">
            <span className={cx("block text-[13.5px] leading-snug", now(i) ? "font-semibold text-ink" : "text-ink-2")}>{s.title}</span>
            <span className="mono block truncate text-[11px] text-ink-3">{s.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
