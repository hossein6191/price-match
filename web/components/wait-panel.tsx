"use client";

// The waiting panel: a notice card on the shelf. What is happening right now and who it waits for,
// then four short lines (how long, what is needed from you, whether you can leave, where the money
// is), a counter, and the next button when there is one. The words come from lib/guide.ts, the same
// for every in-between state of the site. A page shows one at a time, where its action happens; the
// panel scrolls itself into view when a busy state first appears (a calm state never moves the page).
// Five tones: busy (a transaction or the demo shop is at work: the conveyor strip runs), clock (the
// guarantee window runs: a countdown), late (it is taking longer than it should, with a way out),
// ready (the wait is over and the next button is here) and done (closed: where the money ended up).

import * as React from "react";

import { IconCheck, IconClock, IconExternal, IconHourglass, IconPin } from "@/components/icons";
import { useWallNow } from "@/components/use-now";
import { cx } from "@/lib/cx";
import type { Guide } from "@/lib/guide";

export type WaitTone = "busy" | "clock" | "late" | "ready" | "done";

/** The four lines under the title, from a guide. */
export type WaitLines = { time: string; need: string; leave: string; canLeave: boolean; money: string };

export type Wait = {
  /** a stable name for the state, e.g. "claim"; written on the panel for tests and tools */
  id: string;
  tone: WaitTone;
  kicker?: string;
  title: string;
  body?: React.ReactNode;
  lines?: WaitLines;
  /** browser-clock seconds when the wait began: an elapsed counter runs from it */
  since?: number;
  /** seconds left on the contract's clock: a countdown in place of the elapsed counter */
  left?: number;
  leftLabel?: string;
  link?: { href: string; label: string };
  action?: React.ReactNode;
  /** anything shown between the title and the lines: the validators at work */
  scene?: React.ReactNode;
};

const KICKER: Record<WaitTone, string> = {
  busy: "In progress",
  clock: "Guarantee running",
  late: "Taking longer than it should",
  ready: "Ready",
  done: "Closed",
};

/** A guide from lib/guide.ts as a panel, with what only the page has: the button, the link, the counter's start. */
export function waitOf(g: Guide, extra: Pick<Wait, "action" | "link" | "since" | "scene"> = {}): Wait {
  return {
    id: g.id,
    tone: g.tone,
    kicker: g.kicker,
    title: g.now,
    body: g.note || undefined,
    lines: { time: g.time, need: g.need, leave: g.leave, canLeave: g.canLeave, money: g.money },
    left: g.left !== undefined && g.left > 0 ? g.left : undefined,
    leftLabel: g.leftLabel,
    ...extra,
  };
}

/** "0:42", "12:05", "1:02:09"; longer than a day, "2 d 3 h". */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  if (d > 0) {
    const h = Math.floor((s % 86400) / 3600);
    return h ? `${d} d ${h} h` : `${d} d`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

const STRIP: Record<WaitTone, string> = {
  busy: "conveyor conveyor-run",
  clock: "h-2 bg-tag",
  late: "h-2 bg-amber",
  ready: "h-2 bg-fresh",
  done: "h-1.5 bg-rail-deep",
};

export function WaitPanel({ wait, className }: { wait: Wait; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const wall = useWallNow();

  const moving = wait.tone === "busy" || wait.tone === "late";
  React.useEffect(() => {
    const el = ref.current;
    if (!moving || !el || typeof el.scrollIntoView !== "function") return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [wait.id, moving]);

  const tone = wait.tone;
  const counter =
    wait.left !== undefined
      ? { text: clockText(wait.left), label: wait.leftLabel ?? "left" }
      : wait.since && wall
        ? { text: clockText(wall - wait.since), label: "elapsed" }
        : null;
  const Icon = tone === "ready" || tone === "done" ? IconCheck : tone === "clock" ? IconClock : IconHourglass;
  const lines = wait.lines;

  return (
    <div ref={ref} data-wait={wait.id} className={cx("card scroll-mt-4 scroll-mb-4 overflow-hidden", tone === "done" && "border-line-strong", className)}>
      <div aria-hidden="true" className={STRIP[tone]} />
      <div className="px-4 pt-3 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0" role="status" aria-live="polite" aria-atomic="true">
            <p className={cx("kicker flex items-center gap-1.5", tone === "late" ? "text-amber" : tone === "ready" ? "text-fresh-ink" : "text-ink-3")}>
              <Icon size={14} />
              {wait.kicker ?? KICKER[tone]}
            </p>
            <p className="mt-1 text-[17px] leading-snug font-semibold text-ink">{wait.title}</p>
          </div>
          {counter && (
            <div className="shrink-0 bg-ink px-2.5 py-1.5 text-right text-tag">
              <p className="display text-[26px] leading-none font-bold">{counter.text}</p>
              <p className="kicker mt-0.5 text-[10px] text-white/70">{counter.label}</p>
            </div>
          )}
        </div>
        {wait.scene && <div className="mt-3">{wait.scene}</div>}
        {wait.body && <div className="mt-2 text-[14px] leading-relaxed text-ink-2">{wait.body}</div>}
        {lines && (
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t-2 border-dashed border-line-strong pt-2.5 text-[14px] leading-snug">
            <dt className="field-label pt-px text-[12.5px]">How long</dt>
            <dd className="min-w-0 text-ink-2">{lines.time}</dd>
            <dt className="field-label pt-px text-[12.5px]">From you</dt>
            <dd className="min-w-0 font-semibold text-ink">{lines.need}</dd>
            <dt className="field-label pt-px text-[12.5px]">Leave?</dt>
            <dd className={cx("flex min-w-0 items-start gap-1.5", lines.canLeave ? "text-ink-2" : "font-semibold text-red-ink")}>
              <IconPin size={15} className={cx("mt-[2px] shrink-0", lines.canLeave ? "text-ink-3" : "text-red")} />
              <span>{lines.leave}</span>
            </dd>
            <dt className="field-label pt-px text-[12.5px]">Money</dt>
            <dd className="min-w-0 text-ink-2">{lines.money}</dd>
          </dl>
        )}
        {(wait.action || wait.link) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {wait.action}
            {wait.link && (
              <a href={wait.link.href} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 text-[13px] text-ink-2">
                {wait.link.label}
                <IconExternal size={12} />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
