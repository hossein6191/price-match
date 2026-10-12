"use client";

// Small pieces every page uses: a section heading with its aisle number, a time that reads in the
// visitor's own zone, the transactions this browser sent for an order or a shop, the bond meter, and
// the demo shop's state said plainly.

import * as React from "react";

import { Addr } from "@/components/addr";
import { IconExternal } from "@/components/icons";
import { useDemoStatus } from "@/components/use-demo";
import { useLocal } from "@/components/use-local";
import { useNow } from "@/components/use-now";
import { isMock, txUrl } from "@/lib/chain";
import { ago, gen, share, when } from "@/lib/format";
import { parseRemembered, rememberedRaw } from "@/lib/tx-memory";
import { cx } from "@/lib/cx";

/** A heading with a small aisle marker in front of it. */
export function Aisle({ n, title, sub, id, className }: { n: string; title: string; sub?: React.ReactNode; id?: string; className?: string }) {
  return (
    <div className={cx("mb-4", className)}>
      <h2 id={id} className="flex items-center gap-2.5 text-[28px] sm:text-[32px]">
        <span aria-hidden="true" className="display inline-grid h-8 min-w-8 place-items-center bg-ink px-1.5 text-[17px] text-tag">
          {n}
        </span>
        <span className="min-w-0">{title}</span>
      </h2>
      {sub && <p className="mt-1.5 max-w-[68ch] text-ink-2">{sub}</p>}
    </div>
  );
}

/** "3 min ago" with the full date in the title. */
export function Time({ at, className }: { at: number; className?: string }) {
  const now = useNow();
  if (!at) return null;
  return (
    <time dateTime={new Date(at * 1000).toISOString()} title={when(at)} className={cx("text-xs whitespace-nowrap text-ink-3", className)}>
      {now ? ago(at, now) : when(at)}
    </time>
  );
}

/** The transactions this browser sent for one order or one shop, each linked to the explorer. */
export function TxList({ thing, empty }: { thing: string; empty?: string }) {
  const raw = useLocal(() => rememberedRaw(thing), "");
  const list = parseRemembered(raw);
  if (!list.length) return <p className="text-sm text-ink-3">{empty ?? "Nothing sent from this browser yet. Each transaction you send here is listed with its explorer link."}</p>;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {list.map((r) => (
        <li key={r.hash} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-2 text-sm">
          <span className="min-w-0">{r.label}</span>
          <span className="flex items-center gap-3">
            <Time at={r.at} />
            <a href={txUrl(r.hash)} target="_blank" rel="noreferrer" className="mono link inline-flex items-center gap-1 text-xs text-ink-2">
              {isMock ? "demo tx " : ""}
              {r.hash.slice(0, 10)}…
              <IconExternal size={12} />
            </a>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A shop's bond as a shelf: the free part yellow, the reserved part hatched, with both amounts. */
export function BondMeter({ bondAtto, reservedAtto, className }: { bondAtto: string; reservedAtto: string; className?: string }) {
  const bond = BigInt(bondAtto || "0");
  const reserved = BigInt(reservedAtto || "0");
  const free = bond - reserved;
  const pct = share(reserved, bond);
  return (
    <div className={className}>
      <div className="flex h-5 border-2 border-ink bg-tag" role="img" aria-label={`Bond ${gen(bond)}: ${gen(free)} free, ${gen(reserved)} reserved for open orders`}>
        <div
          className="h-full border-r-2 border-ink"
          style={{
            width: `${pct}%`,
            display: pct > 0 ? "block" : "none",
            background: "repeating-linear-gradient(135deg, #111 0 3px, #f4f6f7 3px 8px)",
          }}
        />
      </div>
      <div className="mt-1 flex flex-wrap justify-between gap-x-4 text-xs text-ink-2">
        <span>
          <span className="mr-1 inline-block size-2.5 border border-ink bg-tag align-middle" aria-hidden="true" />
          Free <span className="mono font-bold text-ink">{gen(free)}</span>
        </span>
        <span>
          <span className="mr-1 inline-block size-2.5 border border-ink align-middle" style={{ background: "repeating-linear-gradient(135deg, #111 0 2px, #fff 2px 4px)" }} aria-hidden="true" />
          Reserved for open orders <span className="mono font-bold text-ink">{gen(reserved)}</span>
        </span>
      </div>
    </div>
  );
}

/** The demo shop's state, said plainly: online and topping up its bond by itself, or offline and exactly why. */
export function DemoNote({ className }: { className?: string }) {
  const s = useDemoStatus();
  if (!s) return <p className={cx("text-sm text-ink-3", className)}>Asking the site&apos;s server about the demo shop…</p>;
  if (s.online)
    return (
      <p className={cx("text-sm text-ink-2", className)}>
        <span aria-hidden="true" className="mr-1.5 inline-block size-2.5 bg-fresh align-middle" />
        The demo shop is open{s.owner && <> as <Addr address={s.owner} /></>}, and tops up its own bond when a product runs out of cover.
      </p>
    );
  return (
    <div role="status" className={cx("border-2 border-amber bg-amber-wash px-3 py-2 text-sm", className)}>
      <p>
        <strong className="font-semibold">The demo shop cannot top up its bond:</strong> {s.reason}.
      </p>
      <p className="mt-0.5 text-ink-2">
        {s.shop ? "Its products still sell while the bond covers them, and every claim is still read by the validators." : "Every other shop on the contract still works, and you can open your own on the merchant desk."}
      </p>
    </div>
  );
}

/** A field with its label, its counter and its error, and the suggestions under it. */
export function Field({ id, label, hint, count, error, children }: { id: string; label: string; hint?: React.ReactNode; count?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        {count && <span className="mono text-[11px] text-ink-3">{count}</span>}
      </div>
      {hint && <p className="mb-1 text-[13px] text-ink-3">{hint}</p>}
      <div className="mt-1">{children}</div>
      {error && (
        <p role="alert" className="mt-1 text-[13px] text-red-ink">
          {error}
        </p>
      )}
    </div>
  );
}
