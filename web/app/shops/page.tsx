"use client";

// Every shop on the contract, newest first: its name, its bond (free and reserved), the competitors
// it matches, and how it has done.

import Link from "next/link";

import { BondMeter } from "@/components/bits";
import { ShelfButton, ShelfLink } from "@/components/button";
import { IconArrowRight, IconStore } from "@/components/icons";
import { NotDeployed, Placeholder, ReadError } from "@/components/read-state";
import { useDemoStatus } from "@/components/use-demo";
import { useAfterTx, useRead } from "@/components/use-read";
import { hasContract, readShopsWindow, shopPath } from "@/lib/chain";
import { COMPETITORS, competitorOfPrefix, isDemoShop } from "@/lib/demo-shop";
import { gen } from "@/lib/format";

export default function ShopsPage() {
  const demo = useDemoStatus();
  const shops = useRead(() => readShopsWindow(3), [], { enabled: hasContract() });
  useAfterTx(() => void shops.refresh());
  if (!hasContract()) return <NotDeployed />;
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker text-ink-3">Aisle 03</p>
          <h1 className="mt-1 text-[48px] sm:text-[60px]">All shops</h1>
          <p className="mt-2 max-w-[66ch] text-ink-2">Each shop promises to match the prices on a fixed set of competitor pages, and holds a bond that pays when it must.</p>
        </div>
        <ShelfLink href="/merchant" icon={<IconStore />}>
          Open your own
        </ShelfLink>
      </div>
      {shops.error ? (
        <ReadError detail={shops.error} onRetry={shops.retry} />
      ) : !shops.data ? (
        <Placeholder lines={6} />
      ) : shops.data.rows.length === 0 ? (
        <p className="text-ink-2">No shop is open on this contract yet.</p>
      ) : (
        <>
          <ul className="grid gap-5 md:grid-cols-2">
            {shops.data.rows.map((s) => {
              const isDemo = !!demo && isDemoShop(s, demo.owner);
              return (
                <li key={s.id} className="card flex flex-col">
                  <div className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="kicker text-ink-3">
                        {s.id}
                        {isDemo ? " · the demo shop" : ""}
                      </p>
                      <h2 className="mt-0.5 text-[28px]">{s.name}</h2>
                      <p className="mt-1 text-[13px] text-ink-2">
                        Matches{" "}
                        {s.competitors
                          .map((p) => COMPETITORS.find((c) => c.key === competitorOfPrefix(p))?.short ?? p.replace(/^https:\/\//, "").split("/")[0])
                          .join(", ")}
                      </p>
                    </div>
                    <p className="display shrink-0 text-right text-[28px] leading-none font-extrabold">{gen(s.bondAtto)}</p>
                  </div>
                  <div className="px-4 pb-3">
                    <BondMeter bondAtto={s.bondAtto} reservedAtto={s.reservedAtto} />
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t-2 border-ink bg-shelf px-4 py-2.5 text-[13px] text-ink-2">
                    <span>
                      {s.products} products · {s.orders} orders · {gen(s.refundedAtto)} paid back
                    </span>
                    <Link href={shopPath(s.id)} className="link inline-flex items-center gap-1 font-semibold text-ink">
                      Shelf <IconArrowRight size={14} />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
          {shops.data.partial && <p className="text-sm text-ink-3">The newest shops are shown; older ones are at /shop/S1, /shop/S2 and so on.</p>}
          <ShelfButton size="sm" onClick={() => void shops.refresh()} className="self-start">
            Read again
          </ShelfButton>
        </>
      )}
    </div>
  );
}
