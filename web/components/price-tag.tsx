// A supermarket shelf tag: yellow, punched for its string, the price in black condensed numerals with
// the whole part large and the decimals small and raised, "GEN" under them, and a line of small print.
// A struck tag shows the old price crossed through, as a tag does after a price match.

import * as React from "react";

import { tagPrice } from "@/lib/format";
import { cx } from "@/lib/cx";

export function PriceTag({
  atto,
  size = "md",
  title,
  small,
  struck,
  className,
  children,
}: {
  atto: string | bigint;
  size?: "sm" | "md" | "lg" | "xl";
  /** the item, in small capitals above the price */
  title?: string;
  /** the small print under the price */
  small?: React.ReactNode;
  struck?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const text = tagPrice(atto);
  const [whole, cents = "00"] = text.split(".");
  const big = { sm: "text-[34px]", md: "text-[50px]", lg: "text-[72px]", xl: "text-[96px]" }[size];
  const sub = { sm: "text-[15px]", md: "text-[21px]", lg: "text-[30px]", xl: "text-[38px]" }[size];
  const pad = { sm: "pl-7 pr-3 py-1.5", md: "pl-8 pr-4 py-2.5", lg: "pl-10 pr-5 py-3", xl: "pl-11 pr-6 py-4" }[size];
  return (
    <div className={cx("tag tag-hole", pad, className)}>
      {title && <p className="kicker truncate text-[11.5px] leading-tight text-ink/80">{title}</p>}
      <p className="display flex items-start leading-[0.82] font-extrabold" aria-label={`${text} GEN`}>
        <span className={cx(big, "tracking-[-0.02em]", struck && "line-through decoration-red decoration-[5px]")}>{whole}</span>
        <span className="ml-0.5 flex flex-col items-start">
          <span className={cx(sub, "leading-[0.95]", struck && "line-through decoration-red decoration-[3px]")}>.{cents}</span>
          <span className="kicker mt-0.5 text-[11px] leading-none tracking-[0.18em]">GEN</span>
        </span>
      </p>
      {small && <div className="mt-1.5 border-t border-ink/25 pt-1 text-[11.5px] leading-snug text-ink/80">{small}</div>}
      {children}
    </div>
  );
}
