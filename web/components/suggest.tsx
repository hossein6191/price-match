"use client";

// A row of one-click suggestions under a field, hung like shelf talkers: press one and the field is
// filled with it.

import { cx } from "@/lib/cx";

export function Suggest<T>({
  label,
  chips,
  onPick,
  isOn,
  className,
}: {
  label: string;
  chips: { label: string; value: T }[];
  onPick: (value: T) => void;
  isOn?: (value: T) => boolean;
  className?: string;
}) {
  return (
    <div className={cx("mt-1.5 flex flex-wrap items-center gap-1.5", className)} role="group" aria-label={label}>
      {chips.map((c, i) => {
        const on = isOn?.(c.value) ?? false;
        return (
          <button key={i + ":" + c.label} type="button" aria-pressed={isOn ? on : undefined} onClick={() => onPick(c.value)} className="chip active:translate-y-px">
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
