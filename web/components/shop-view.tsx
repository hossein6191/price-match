"use client";

// One shop as a shelf: its name and owner, the competitor pages it promised to match, its bond as a
// meter (free and reserved), and every product as a yellow tag with its guarantee window, its spec and
// a Buy button. A purchase shows its waiting panel under the product, then opens the order. On the
// demo shop a product the bond no longer covers can be topped up by the demo shop itself.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Addr } from "@/components/addr";
import { BondMeter, DemoNote, Time } from "@/components/bits";
import { ShelfButton, ShelfLink } from "@/components/button";
import { IconArrowRight, IconBasket, IconExternal, IconRefresh } from "@/components/icons";
import { PriceTag } from "@/components/price-tag";
import { Placeholder, ReadError } from "@/components/read-state";
import { TxStage } from "@/components/tx-stage";
import { useDemoStatus } from "@/components/use-demo";
import { useMe } from "@/components/use-me";
import { useAfterTx, useRead } from "@/components/use-read";
import { useTx } from "@/components/use-tx";
import { WaitPanel, waitOf } from "@/components/wait-panel";
import { WalletGate } from "@/components/wallet-gate";
import { boughtOrder, calls, isMock, orderPath, paidOutcome, readProductsOf, readShop, requestRestock } from "@/lib/chain";
import { COMPETITORS, competitorOfPrefix, isDemoShop } from "@/lib/demo-shop";
import { gen, tagPrice, windowLabel } from "@/lib/format";
import { restockGuide, sendingGuide, signGuide, updatingGuide } from "@/lib/guide";
import { MATCH_ON } from "@/lib/rules";
import { rememberTx } from "@/lib/tx-memory";
import type { Product, Shop } from "@/lib/types";

/** The competitor a prefix names, in words: the demo's three by name, any other by its address. */
function PrefixLine({ prefix }: { prefix: string }) {
  const key = competitorOfPrefix(prefix);
  const c = COMPETITORS.find((x) => x.key === key);
  return (
    <li className="flex flex-col gap-0.5 border-l-4 border-tag py-0.5 pl-2.5">
      <span className="font-semibold">{c ? c.name : "A competitor's pages"}</span>
      <span className="mono text-[11px] break-all text-ink-3">{prefix}</span>
    </li>
  );
}

export function ShopHeader({ shop, demo }: { shop: Shop; demo: boolean }) {
  const me = useMe();
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div>
        <p className="kicker text-ink-3">
          {demo ? "The demo shop · " : ""}Shop {shop.id}
        </p>
        <h1 className="mt-1 text-[44px] sm:text-[58px]">{shop.name}</h1>
        <p className="mt-2 text-sm text-ink-2">
          Run by <Addr address={shop.owner} me={me.address} />, open since <Time at={shop.openedAt} />. {shop.products} products, {shop.orders} orders, {shop.openOrders} still
          inside their guarantee.
        </p>
        <div className="mt-4">
          <p className="field-label">We match these competitors&apos; pages</p>
          <ul className="mt-1.5 grid gap-1.5 text-sm">
            {shop.competitors.map((p) => (
              <PrefixLine key={p} prefix={p} />
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-ink-3">Fixed when the shop opened: a claim may only point at a page below one of these.</p>
        </div>
      </div>
      <div className="card-soft self-start p-4">
        <p className="field-label">The guarantee bond</p>
        <p className="display mt-1 text-[40px] leading-none font-extrabold">{gen(shop.bondAtto)}</p>
        <BondMeter bondAtto={shop.bondAtto} reservedAtto={shop.reservedAtto} className="mt-3" />
        <p className="mt-3 text-[13px] text-ink-2">
          Every sale reserves its full price from this bond until its window ends, because that is the most a match can ever give back. A match pays the difference from it in the
          same transaction.
        </p>
        {shop.refundedAtto !== "0" && (
          <p className="mt-2 text-[13px] text-ink-2">
            Paid back to buyers so far: <span className="mono font-bold text-ink">{gen(shop.refundedAtto)}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function ProductCard({ p, shop, demo, onBought }: { p: Product; shop: Shop; demo: boolean; onBought: (order: string) => void }) {
  const me = useMe();
  const tx = useTx();
  const restock = useTx();
  const [asking, setAsking] = React.useState<"" | "asking" | "failed">("");
  const [why, setWhy] = React.useState("");
  const mine = !!me.address && me.address === p.owner;
  const price = BigInt(p.priceAtto);
  const outcome = paidOutcome(tx.final);
  const order = boughtOrder(tx.final);

  React.useEffect(() => {
    if (order) onBought(order);
  }, [order, onBought]);

  const buy = async () => {
    const h = await tx.start(calls.buy(p.id, price));
    if (h) rememberTx(p.id, h, `Bought ${p.id} for ${gen(price)}`);
  };
  const askRestock = async () => {
    setAsking("asking");
    setWhy("");
    const answer = await requestRestock(p.id);
    if (!answer.ok) {
      setAsking("failed");
      setWhy(answer.reason);
      return;
    }
    setAsking("");
    if (answer.hash) restock.track(answer.hash, calls.fund(shop.id, 0n));
  };

  return (
    <article className="flex flex-col">
      <div className="relative flex flex-1 flex-col border-2 border-ink bg-paper">
        <div className="flex items-start justify-between gap-3 p-4 pb-3">
          <div className="min-w-0">
            <p className="kicker text-ink-3">{p.id}</p>
            <h3 className="mt-0.5 text-[24px] leading-[1.02]">{p.title}</h3>
          </div>
        </div>
        <details className="group mx-4 mb-3 border-t border-line pt-2 text-[13px]">
          <summary className="cursor-pointer list-none font-semibold text-ink-2 marker:hidden">
            <span className="link">What a match must be</span>
          </summary>
          <p className="mt-1.5 text-ink-2">{p.spec}</p>
          <p className="mt-1.5 text-ink-3">Judged on {MATCH_ON.join(", ")}, and nothing else. The validators&apos; models read this spec and the page; never our price.</p>
        </details>
        <div className="mt-auto flex items-end justify-between gap-3 bg-shelf px-4 pt-3 pb-4">
          <PriceTag atto={p.priceAtto} size="md" small={<>Lowest price guaranteed for {windowLabel(p.window)}</>} />
          <div className="flex flex-col items-end gap-1 text-right text-[12px] text-ink-3">
            <span>{p.orders} sold</span>
            {p.covered ? <span className="text-fresh-ink">Bond covers a sale</span> : <span className="font-semibold text-red-ink">Bond does not cover a sale now</span>}
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex flex-col gap-2.5">
        {mine ? (
          <p className="text-[13px] text-ink-3">This is your shop: a shop may not buy its own product.</p>
        ) : order ? (
          <ShelfLink href={orderPath(order)} variant="tag" block icon={<IconArrowRight />}>
            Open order {order}
          </ShelfLink>
        ) : p.covered || !demo ? (
          <WalletGate need={price} what="to buy">
            <ShelfButton variant="tag" block icon={<IconBasket />} disabled={tx.sending || (!!tx.hash && !tx.final) || !p.covered} onClick={() => void buy()}>
              Buy for {tagPrice(price)} GEN
            </ShelfButton>
          </WalletGate>
        ) : (
          <ShelfButton block icon={<IconRefresh />} disabled={asking === "asking" || (!!restock.hash && !restock.final)} onClick={() => void askRestock()}>
            Ask the demo shop to top up
          </ShelfButton>
        )}
        <TxStage
          tx={tx}
          sign={signGuide({ fn: "buy", label: `Buying ${p.title} for ${gen(price)}`, amountAtto: p.priceAtto, mock: isMock })}
          sending={sendingGuide({ fn: "buy", target: p.id, title: p.title, amountAtto: p.priceAtto, window: p.window, mock: isMock })}
          label={`Buying ${p.id}`}
        />
        {!mine && !order && !p.covered && !demo && (
          <p className="text-[13px] text-ink-3">The shop&apos;s free bond does not cover this price now, so a sale would be refused and sent back; it sells again once the owner adds to the bond or an open order is released.</p>
        )}
        {tx.final && outcome.kind === "refused" && (
          <p role="alert" className="border-2 border-red bg-red-wash px-3 py-2 text-[13px] text-red-ink">
            Refused, and the {gen(outcome.returnedAtto)} came back in the same transaction: {outcome.reason}
          </p>
        )}
        {tx.final && order && <WaitPanel wait={waitOf(updatingGuide(`Bought: ${order} is open, and its guarantee is running`))} />}
        {asking === "asking" && <WaitPanel wait={waitOf(restockGuide({ state: "asking", product: p.id, mock: isMock }))} />}
        {asking === "failed" && <WaitPanel wait={waitOf(restockGuide({ state: "failed", product: p.id, reason: why, mock: isMock }))} />}
        <TxStage
          tx={restock}
          sign={signGuide({ fn: "fund", label: "The demo shop's top-up", mock: isMock })}
          sending={restockGuide({ state: "sending", product: p.id, mock: isMock })}
          label="The demo shop tops up its bond"
        />
      </div>
    </article>
  );
}

/** A whole shop: header, shelf of products, and the demo shop's note when it is the demo shop. */
export function ShopView({ id, demoHint }: { id: string; demoHint?: boolean }) {
  const router = useRouter();
  const demoStatus = useDemoStatus();
  const shop = useRead<Shop | null>(() => readShop(id), [id], { enabled: !!id });
  const products = useRead(() => readProductsOf(id, 0, 20), [id], { enabled: !!id });
  useAfterTx(() => {
    void shop.refresh();
    void products.refresh();
  });
  const onBought = React.useCallback((order: string) => router.push(orderPath(order)), [router]);

  if (shop.error) return <ReadError detail={shop.error} onRetry={shop.retry} />;
  if (!shop.data)
    return shop.loading ? (
      <Placeholder lines={6} />
    ) : (
      <div className="card-soft p-5">
        <h1 className="text-3xl">No shop {id}</h1>
        <p className="mt-2 text-ink-2">The contract holds no shop by that id.</p>
        <ShelfLink href="/shops" className="mt-4">
          All shops
        </ShelfLink>
      </div>
    );
  const s = shop.data;
  const demo = !!demoHint || (!!demoStatus && isDemoShop(s, demoStatus.owner));
  return (
    <div className="flex flex-col gap-8">
      <ShopHeader shop={s} demo={demo} />
      {demo && <DemoNote />}
      <section aria-labelledby="shelf">
        <h2 id="shelf" className="sr-only">
          Products
        </h2>
        <div className="shelf-edge mb-5" aria-hidden="true" />
        {products.error ? (
          <ReadError detail={products.error} onRetry={products.retry} />
        ) : !products.data ? (
          <Placeholder lines={5} />
        ) : products.data.rows.length === 0 ? (
          <p className="text-ink-2">This shop has not listed a product yet.</p>
        ) : (
          <div className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.data.rows.map((p) => (
              <ProductCard key={p.id} p={p} shop={s} demo={demo} onBought={onBought} />
            ))}
          </div>
        )}
        <div className="shelf-edge mt-6" aria-hidden="true" />
      </section>
      <p className="text-[13px] text-ink-3">
        Bought something? It is under <Link className="link" href="/mine">My orders</Link>, where its guarantee counts down and the claim waits.{" "}
        <a className="link inline-flex items-center gap-1" href="/competitors/index.html">
          The demo competitor pages <IconExternal size={12} />
        </a>
      </p>
    </div>
  );
}
