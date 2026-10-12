// The thermal receipt: narrow, monospaced, torn top and bottom, printing a claim's result line by
// line (lib/receipt.ts writes the lines). A freshly judged claim prints with a short delay per line;
// one read later from the chain is printed at once, and nothing moves for reduced motion.

import * as React from "react";

import { IconCheck, IconCross, IconQuestion } from "@/components/icons";
import type { Mark, ReceiptLine } from "@/lib/receipt";
import { receiptText } from "@/lib/receipt";
import { cx } from "@/lib/cx";

function MarkIcon({ mark }: { mark: Mark }) {
  if (mark === "yes") return <IconCheck size={15} title="yes" className="text-fresh-ink" />;
  if (mark === "no") return <IconCross size={15} title="no" className="text-red-ink" />;
  return <IconQuestion size={15} title="unclear" className="text-amber" />;
}

export function Receipt({
  head,
  lines,
  foot,
  print,
  className,
  children,
}: {
  /** the lines above the first rule: shop, ids, time */
  head: string[];
  lines: ReceiptLine[];
  /** the lines under the last rule */
  foot?: string[];
  /** print line by line (a claim that just came back) */
  print?: boolean;
  className?: string;
  /** a sticker or anything else laid over the paper */
  children?: React.ReactNode;
}) {
  let i = 0;
  const step = () => (print ? { className: "receipt-line", style: { "--i": i++ } as React.CSSProperties } : {});
  return (
    <div className={cx("receipt-wrap relative w-full max-w-[330px]", className)}>
      <div className="receipt" aria-label={[...head, receiptText(lines), ...(foot ?? [])].join("\n")} role="group">
        <div aria-hidden="true">
          {head.map((h, k) => {
            const s = step();
            return (
              <p key={k} style={s.style} className={cx(s.className, k === 0 ? "text-center text-[14px] font-bold tracking-[0.2em]" : "text-center text-[11.5px] text-ink-3")}>
                {h}
              </p>
            );
          })}
          <div className="receipt-rule" />
          {lines.map((l, k) => {
            const s = step();
            if (l.kind === "rule") return <div key={k} className={cx("receipt-rule", s.className)} style={s.style} />;
            if (l.kind === "note")
              return (
                <p key={k} className={cx("pl-1 text-[11.5px] break-all text-ink-3", s.className)} style={s.style}>
                  {l.text}
                </p>
              );
            return (
              <p key={k} className={cx("flex items-baseline justify-between gap-2", l.strong && "text-[15px] font-bold", s.className)} style={s.style}>
                <span className="flex items-center gap-1.5">
                  {l.label}
                  {l.mark && <MarkIcon mark={l.mark} />}
                </span>
                {l.value && <span className="text-right whitespace-nowrap">{l.value}</span>}
              </p>
            );
          })}
          {foot && foot.length > 0 && (
            <>
              <div className="receipt-rule" />
              {foot.map((f, k) => {
                const s = step();
                return (
                  <p key={k} className={cx("text-center text-[11.5px] text-ink-3", s.className)} style={s.style}>
                    {f}
                  </p>
                );
              })}
            </>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
