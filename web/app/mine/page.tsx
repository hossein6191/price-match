"use client";

// Everything the connected address has: its orders (each with its guarantee counting down and one
// line saying what happens next), its claim-fee credit with Withdraw, and the shops it runs.

import * as React from "react";
import Link from "next/link";

import { Aisle } from "@/components/bits";
import { ShelfButton, ShelfLink } from "@/components/button";
import { IconArrowRight, IconCoins, IconStore } from "@/components/icons";
import { PriceTag } from "@/components/price-tag";
import { Placeholder, ReadError, NotDeployed } from "@/components/read-state";
import { Sticker } from "@/components/sticker";
import { TxStage } from "@/components/tx-stage";
import { useMe } from "@/components/use-me";
import { useNow } from "@/components/use-now";
import { useAfterTx, useRead } from "@/components/use-read";
import { useTx } from "@/components/use-tx";
import { clockText } from "@/components/wait-panel";
import { WalletGate } from "@/components/wallet-gate";
import { calls, hasContract, isMock, orderPath, orderPhaseNow, readOrdersOf, readShopsOf, shopPath } from "@/lib/chain";
import { gen, tagPrice } from "@/lib/format";
import { orderLine, sendingGuide, signGuide } from "@/lib/guide";
import { PAGE } from "@/lib/rules";
import { rememberTx } from "@/lib/tx-memory";
import type { Order } from "@/lib/types";
import { cx } from "@/lib/cx";

export default function MinePage() {
  const me = useMe();
  if (!hasContract()) return <NotDeployed />;
  return (
    <div className="flex flex-col gap-10">
      <div>
        <p className="kicker text-ink-3">Aisle 02</p>
        <h1 className="mt-1 text-[48px] sm:text-[60px]">My orders</h1>
      </div>
      {!me.address ? (
        <WalletGate what="to see your orders">
          <span />
        </WalletGate>
      ) : (
        <Mine address={me.address} />
      )}
    </div>
  );
}

function Mine({ address }: { address: string }) {
  const [offset, setOffset] = React.useState(0);
  const orders = useRead(() => readOrdersOf(address, offset, PAGE), [address, offset]);
  const shops = useRead(() => readShopsOf(address, 0, PAGE), [address]);
  useAfterTx(() => {
    void orders.refresh();
    void shops.refresh();
  });
  const total = orders.data?.total ?? 0;
  return (
    <>
      <section aria-labelledby="orders">
        <Aisle n="01" id="orders" title="Orders" sub="Newest first on each page. Every order keeps its price reserved from the shop's bond until its guarantee ends." />
        {orders.error ? (
          <ReadError detail={orders.error} onRetry={orders.retry} />
        ) : !orders.data ? (
          <Placeholder lines={5} />
        ) : orders.data.rows.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-ink-2">No orders yet. The demo shop sells nine things, each with a lowest-price guarantee.</p>
            <ShelfLink href="/shop" variant="tag" icon={<IconArrowRight />}>
              Go to the demo shop
            </ShelfLink>
          </div>
        ) : (
          <>
            <ul className="grid gap-3">
              {[...orders.data.rows].reverse().map((o) => (
                <OrderRow key={o.id} o={o} />
              ))}
            </ul>
            {total > PAGE && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <ShelfButton size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                  Earlier page
                </ShelfButton>
                <ShelfButton size="sm" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>
                  Later page
                </ShelfButton>
                <span className="text-ink-3">
                  Orders {offset + 1} to {Math.min(total, offset + PAGE)} of {total}
                </span>
              </div>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="credit">
        <Aisle
          n="02"
          id="credit"
          title="Credit"
          sub="A claim stakes 0.01 GEN of it and an appeal 0.05 GEN. A claim fee comes back on every outcome but one (the page offers another product); an appeal bond comes back when the appeal wins. Withdraw returns all of it."
        />
        {orders.data && <Credit creditAtto={orders.data.creditAtto} />}
      </section>

      <section aria-labelledby="shops">
        <Aisle n="03" id="shops" title="Shops I run" />
        {shops.error ? (
          <ReadError detail={shops.error} onRetry={shops.retry} />
        ) : !shops.data ? (
          <Placeholder lines={2} />
        ) : shops.data.rows.length === 0 ? (
          <p className="text-ink-2">
            None. <Link className="link" href="/merchant">Open one on the merchant desk</Link>: it takes a name and the competitor pages you promise to match.
          </p>
        ) : (
          <ul className="grid gap-2">
            {shops.data.rows.map((s) => (
              <li key={s.id} className="card-soft flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <Link href={shopPath(s.id)} className="flex items-center gap-2 font-semibold">
                  <IconStore /> {s.name} <span className="mono text-xs text-ink-3">{s.id}</span>
                </Link>
                <span className="text-sm text-ink-2">
                  Bond <span className="mono">{gen(s.bondAtto)}</span>, free <span className="mono">{gen(s.freeAtto)}</span> ·{" "}
                  <Link className="link" href="/merchant">
                    manage
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function OrderRow({ o }: { o: Order }) {
  const now = useNow();
  const clock = now || o.now;
  const phase = orderPhaseNow(o, clock);
  const line = orderLine({
    role: "buyer",
    now: clock,
    id: o.id,
    status: o.status,
    endedBy: o.endedBy,
    windowEnd: o.windowEnd,
    priceAtto: o.priceAtto,
    reservedAtto: o.reservedAtto,
    refundedAtto: o.refundedAtto,
    claimsLeft: o.claimsLeft,
    creditAtto: "1",
    dropDueAtto: o.dropDueAtto,
    mock: isMock,
  });
  const text = o.pending ? `Claim ${o.pending} is pending its 15-minute appeal window; nothing has moved yet. Open the order to appeal or settle it.` : line;
  return (
    <li>
      <Link href={orderPath(o.id)} className={cx("relative flex flex-wrap items-center gap-4 border-2 bg-paper p-3 hover:bg-tag-wash", o.status === "open" ? "border-ink" : "border-line-strong")}>
        <PriceTag atto={o.priceAtto} size="sm" struck={o.status === "matched"} />
        <div className="min-w-0 flex-1">
          <p className="kicker text-ink-3">
            {o.id} · {o.shop}
          </p>
          <p className="font-semibold">{o.title}</p>
          <p className="text-sm text-ink-2">{text}</p>
        </div>
        {phase === "claim" && !o.pending && (
          <div className="bg-ink px-2.5 py-1.5 text-right text-tag">
            <p className="display text-[22px] leading-none font-bold">{clockText(o.windowEnd - clock)}</p>
            <p className="kicker text-[10px] text-white/70">guarantee left</p>
          </div>
        )}
        {o.status === "matched" && <Sticker outcome="matched" line={`-${tagPrice(o.refundedAtto)} GEN`} size={74} />}
      </Link>
    </li>
  );
}

function Credit({ creditAtto }: { creditAtto: string }) {
  const tx = useTx();
  const credit = BigInt(creditAtto || "0");
  const withdraw = async () => {
    const h = await tx.start(calls.withdraw());
    if (h) rememberTx("credit", h, `Withdrew ${gen(credit)} of claim-fee credit`);
  };
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="display text-[40px] leading-none font-extrabold">{gen(credit)}</p>
      {credit > 0n ? (
        <ShelfButton icon={<IconCoins />} disabled={tx.sending || (!!tx.hash && !tx.final)} onClick={() => void withdraw()}>
          Withdraw all of it
        </ShelfButton>
      ) : (
        <p className="text-sm text-ink-3">Nothing to withdraw. An order&apos;s page adds credit when you claim or appeal.</p>
      )}
      <TxStage
        tx={tx}
        sign={signGuide({ fn: "withdraw", label: `Withdrawing ${gen(credit)} of claim-fee credit`, amountAtto: creditAtto, mock: isMock })}
        sending={sendingGuide({ fn: "withdraw", target: "credit", amountAtto: creditAtto, mock: isMock })}
        label="Withdrawing claim-fee credit"
        className="w-full"
      />
    </div>
  );
}
