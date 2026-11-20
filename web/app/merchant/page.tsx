"use client";

// The merchant desk. Open a shop (a name and the competitor pages it promises to match, fixed for
// good), then for each shop the connected address runs: its bond as a meter with Fund and Withdraw,
// List a product (title, spec, price, guarantee window, every field with one-click suggestions), and
// its orders, with Release on the ones whose window has ended. Every check a form makes before
// signing is the contract's own, word for word (lib/rules.ts).

import * as React from "react";
import Link from "next/link";

import { Aisle, BondMeter, Field } from "@/components/bits";
import { ShelfButton, ShelfLink } from "@/components/button";
import { IconCoins, IconPlus, IconStore, IconTag, IconUnlock } from "@/components/icons";
import { NotDeployed, Placeholder, ReadError } from "@/components/read-state";
import { Suggest } from "@/components/suggest";
import { TxStage } from "@/components/tx-stage";
import { useDemoStatus } from "@/components/use-demo";
import { useMe } from "@/components/use-me";
import { useNow } from "@/components/use-now";
import { useAfterTx, useRead } from "@/components/use-read";
import { useTx } from "@/components/use-tx";
import { WalletGate } from "@/components/wallet-gate";
import {
  calls,
  hasContract,
  isMock,
  listedProduct,
  openedShop,
  orderPath,
  orderPhaseNow,
  paidOutcome,
  readOrdersOfShop,
  readProductsOf,
  readShop,
  readShopsOf,
  shopPath,
} from "@/lib/chain";
import { COMPETITORS, competitorOfPrefix } from "@/lib/demo-shop";
import { gen, genText, tryAtto, windowLabel } from "@/lib/format";
import { orderLine, sendingGuide, signGuide } from "@/lib/guide";
import {
  MAX_PREFIXES,
  MAX_PRODUCTS,
  MAX_SPEC,
  MAX_TITLE,
  nameProblem,
  plain,
  prefixesProblem,
  priceProblem,
  pyStrip,
  specProblem,
  titleProblem,
  windowProblem,
} from "@/lib/rules";
import { BOND_CHIPS, NAME_CHIPS, PRICE_CHIPS, PRODUCT_CHIPS, WINDOW_CHIPS } from "@/lib/suggestions";
import { rememberTx } from "@/lib/tx-memory";
import type { Order, Shop } from "@/lib/types";

export default function MerchantPage() {
  const me = useMe();
  if (!hasContract()) return <NotDeployed />;
  return (
    <div className="flex flex-col gap-10">
      <div>
        <p className="kicker text-ink-3">Aisle 04</p>
        <h1 className="mt-1 text-[48px] sm:text-[60px]">Merchant desk</h1>
        <p className="mt-2 max-w-[70ch] text-ink-2">
          Promise to match a competitor&apos;s price, and back the promise with a bond. Buyers claim with the competitor&apos;s page; the network reads it, and a match pays
          the difference from your bond once its 15-minute appeal window closes, and you may appeal a match once with a reason. You never decide a claim, and neither does the
          buyer.
        </p>
      </div>
      {!me.address ? (
        <WalletGate what="to open or run a shop">
          <span />
        </WalletGate>
      ) : (
        <Desk address={me.address} />
      )}
    </div>
  );
}

function Desk({ address }: { address: string }) {
  const shops = useRead(() => readShopsOf(address, 0, 20), [address]);
  useAfterTx(() => void shops.refresh());
  return (
    <>
      <OpenShop />
      <section aria-labelledby="my-shops">
        <Aisle n="02" id="my-shops" title="Your shops" />
        {shops.error ? (
          <ReadError detail={shops.error} onRetry={shops.retry} />
        ) : !shops.data ? (
          <Placeholder lines={4} />
        ) : shops.data.rows.length === 0 ? (
          <p className="text-ink-2">You run no shop yet. Open one above.</p>
        ) : (
          <div className="flex flex-col gap-10">
            {[...shops.data.rows].reverse().map((s) => (
              <ShopDesk key={s.id} shop={s} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/** The demo shop's own prefixes: the only competitor pages a validator can fetch in this demonstration. */
function useDemoPrefixes(): string[] {
  const status = useDemoStatus();
  const demo = useRead<Shop | null>(() => readShop(status!.shop), [status?.shop ?? ""], { enabled: !!status?.shop });
  return demo.data?.competitors ?? [];
}

function OpenShop() {
  const tx = useTx();
  const demoPrefixes = useDemoPrefixes();
  const [name, setName] = React.useState("");
  const [prefixes, setPrefixes] = React.useState<string[]>([]);
  const [typed, setTyped] = React.useState("");
  const cleanName = pyStrip(plain(name));
  const nameErr = name ? nameProblem(cleanName) : "";
  const listErr = prefixes.length ? prefixesProblem(JSON.stringify(prefixes)).problem : "";
  const opened = openedShop(tx.final);
  const busy = tx.sending || (!!tx.hash && !tx.final);

  const add = (p: string) => {
    const v = pyStrip(p);
    if (!v || prefixes.includes(v) || prefixes.length >= MAX_PREFIXES) return;
    setPrefixes([...prefixes, v]);
    setTyped("");
  };
  const open = async () => {
    if (!cleanName || nameErr || !prefixes.length || listErr) return;
    const h = await tx.start(calls.openShop(cleanName, prefixes));
    if (h) rememberTx("shops", h, `Opened ${cleanName}`);
  };

  return (
    <section aria-labelledby="open-shop" className="card p-4 sm:p-5">
      <Aisle n="01" id="open-shop" title="Open a shop" sub="Its name, and the competitor pages it promises to match: one to five address prefixes, fixed for good, which every buyer sees before buying." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Field id="shop-name" label="Shop name" count={`${cleanName.length}/60`} error={nameErr}>
          <input id="shop-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Quayside Kitchen Supply" autoComplete="off" />
          <Suggest label="Shop names" chips={NAME_CHIPS.map((n) => ({ label: n, value: n }))} onPick={setName} isOn={(v) => v === name} />
        </Field>
        <Field
          id="prefix"
          label="Competitor pages we match"
          count={`${prefixes.length}/${MAX_PREFIXES}`}
          hint="Each prefix names a directory of pages that only that competitor can write to. The demo's three are pinned to one commit, so every validator reads the same bytes."
          error={listErr}
        >
          <ul className="mb-2 grid gap-1.5">
            {prefixes.map((p) => {
              const c = COMPETITORS.find((x) => x.key === competitorOfPrefix(p));
              return (
                <li key={p} className="flex items-start justify-between gap-2 border-l-4 border-tag pl-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-semibold">{c?.name ?? "Your competitor"}</span>
                    <span className="mono block text-[11px] break-all text-ink-3">{p}</span>
                  </span>
                  <button type="button" className="link shrink-0 text-[12.5px]" onClick={() => setPrefixes(prefixes.filter((x) => x !== p))}>
                    remove
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2">
            <input id="prefix" className="field mono min-w-0 text-[12.5px]" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="https://…/" spellCheck={false} autoComplete="off" />
            <ShelfButton size="sm" icon={<IconPlus />} onClick={() => add(typed)} disabled={!pyStrip(typed)} className="shrink-0 self-center">
              Add
            </ShelfButton>
          </div>
          {demoPrefixes.length > 0 && (
            <Suggest
              label="The demo competitors"
              chips={demoPrefixes.map((p) => ({ label: COMPETITORS.find((x) => x.key === competitorOfPrefix(p))?.name ?? p, value: p }))}
              onPick={add}
              isOn={(v) => prefixes.includes(v)}
            />
          )}
        </Field>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        {opened ? (
          <ShelfLink href={shopPath(opened)} variant="tag" icon={<IconStore />}>
            Open {opened}: fund it below, then list
          </ShelfLink>
        ) : (
          <WalletGate what="to open a shop">
            <ShelfButton variant="tag" icon={<IconStore />} disabled={busy || !cleanName || !!nameErr || !prefixes.length || !!listErr} onClick={() => void open()} className="self-start">
              Open the shop
            </ShelfButton>
          </WalletGate>
        )}
        <TxStage
          tx={tx}
          sign={signGuide({ fn: "open_shop", label: `Opening ${cleanName || "your shop"}`, mock: isMock })}
          sending={sendingGuide({ fn: "open_shop", target: "", title: cleanName, amountAtto: "0", mock: isMock })}
          label={`Opening ${cleanName || "a shop"}`}
        />
      </div>
    </section>
  );
}

function ShopDesk({ shop }: { shop: Shop }) {
  const fund = useTx();
  const take = useTx();
  const [amount, setAmount] = React.useState<bigint>(BOND_CHIPS[1].value);
  const free = BigInt(shop.freeAtto || "0");
  const [takeText, setTakeText] = React.useState("");
  const takeAtto = tryAtto(takeText) ?? 0n;
  const takeErr = takeText && (takeAtto <= 0n || takeAtto > free) ? `Only ${gen(free)} of the bond is free; ${gen(shop.reservedAtto)} is reserved for open orders.` : "";
  const funded = paidOutcome(fund.final);

  const doFund = async () => {
    const h = await fund.start(calls.fund(shop.id, amount));
    if (h) rememberTx(shop.id, h, `Added ${gen(amount)} to the bond`);
  };
  const doTake = async () => {
    if (!takeAtto || takeErr) return;
    const h = await take.start(calls.withdrawBond(shop.id, takeAtto));
    if (h) rememberTx(shop.id, h, `Took ${gen(takeAtto)} of free bond back`);
  };

  return (
    <article className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker text-ink-3">Shop {shop.id}</p>
          <h3 className="text-[34px]">{shop.name}</h3>
        </div>
        <ShelfLink href={shopPath(shop.id)} size="sm" icon={<IconStore />}>
          See its shelf
        </ShelfLink>
      </div>
      <div className="shelf-edge-thin" aria-hidden="true" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-soft p-4">
          <p className="field-label">Bond</p>
          <p className="display mt-1 text-[36px] leading-none font-extrabold">{gen(shop.bondAtto)}</p>
          <BondMeter bondAtto={shop.bondAtto} reservedAtto={shop.reservedAtto} className="mt-3" />
          <div className="mt-4">
            <p className="field-label">Add to the bond</p>
            <Suggest label="Amounts to add" chips={BOND_CHIPS} onPick={setAmount} isOn={(v) => v === amount} />
            <WalletGate need={amount} what="to fund the bond">
              <ShelfButton variant="tag" size="sm" icon={<IconCoins />} className="mt-2" disabled={fund.sending || (!!fund.hash && !fund.final)} onClick={() => void doFund()}>
                Add {gen(amount)}
              </ShelfButton>
            </WalletGate>
            <TxStage
              tx={fund}
              className="mt-2"
              sign={signGuide({ fn: "fund", label: `Adding ${gen(amount)} to the bond of ${shop.id}`, amountAtto: amount.toString(), mock: isMock })}
              sending={sendingGuide({ fn: "fund", target: shop.id, amountAtto: amount.toString(), mock: isMock })}
              label={`Funding ${shop.id}`}
            />
            {fund.final && funded.kind === "refused" && <p className="mt-1 text-[13px] text-red-ink">Refused, and the {gen(funded.returnedAtto)} came back: {funded.reason}</p>}
          </div>
          <div className="mt-4">
            <Field id={`take-${shop.id}`} label="Take free bond back" error={takeErr}>
              <input id={`take-${shop.id}`} className="field mono" value={takeText} onChange={(e) => setTakeText(e.target.value)} placeholder="GEN" inputMode="decimal" autoComplete="off" />
              {free > 0n && (
                <Suggest
                  label="Amounts to take back"
                  chips={[
                    { label: `All free, ${gen(free)}`, value: genText(free) },
                    { label: `Half, ${gen(free / 2n)}`, value: genText(free / 2n) },
                  ]}
                  onPick={setTakeText}
                />
              )}
            </Field>
            <ShelfButton size="sm" icon={<IconCoins />} className="mt-2" disabled={!takeAtto || !!takeErr || take.sending || (!!take.hash && !take.final)} onClick={() => void doTake()}>
              Take back {takeAtto ? gen(takeAtto) : ""}
            </ShelfButton>
            <TxStage
              tx={take}
              className="mt-2"
              sign={signGuide({ fn: "withdraw_bond", label: `Taking ${gen(takeAtto)} of free bond back`, amountAtto: takeAtto.toString(), mock: isMock })}
              sending={sendingGuide({ fn: "withdraw_bond", target: shop.id, amountAtto: takeAtto.toString(), mock: isMock })}
              label={`Withdrawing from the bond of ${shop.id}`}
            />
          </div>
        </div>
        <ListProduct shop={shop} />
      </div>
      <ShopOrders shop={shop} />
    </article>
  );
}

function ListProduct({ shop }: { shop: Shop }) {
  const tx = useTx();
  const products = useRead(() => readProductsOf(shop.id, 0, 20), [shop.id]);
  useAfterTx(() => void products.refresh());
  const [title, setTitle] = React.useState("");
  const [spec, setSpec] = React.useState("");
  const [priceText, setPriceText] = React.useState("");
  const [windowSec, setWindowSec] = React.useState(0);
  const t = pyStrip(plain(title));
  const s = pyStrip(plain(spec));
  const price = tryAtto(priceText);
  const tErr = title ? titleProblem(t) : "";
  const sErr = spec ? specProblem(s) : "";
  const pErr = priceText ? (price === null ? "Enter an amount like 1.2 or 3.5" : priceProblem(price)) : "";
  const wErr = windowSec ? windowProblem(windowSec) : "";
  const full = (products.data?.total ?? 0) >= MAX_PRODUCTS;
  const ready = !!t && !!s && price !== null && !!windowSec && !tErr && !sErr && !pErr && !wErr && !full;
  const listed = listedProduct(tx.final);

  const fill = (i: number) => {
    const c = PRODUCT_CHIPS[i];
    setTitle(c.title);
    setSpec(c.spec);
    setPriceText(genText(c.priceAtto));
    setWindowSec(c.window);
  };
  const list = async () => {
    if (!ready || price === null) return;
    const h = await tx.start(calls.listProduct(shop.id, t, s, price, windowSec));
    if (h) rememberTx(shop.id, h, `Listed ${t}`);
  };

  return (
    <div className="card-soft p-4">
      <p className="field-label">List a product</p>
      <Suggest label="Products" chips={PRODUCT_CHIPS.map((c, i) => ({ label: c.label, value: i }))} onPick={fill} />
      <div className="mt-3 grid gap-3">
        <Field id={`title-${shop.id}`} label="Title" count={`${t.length}/${MAX_TITLE}`} error={tErr}>
          <input id={`title-${shop.id}`} className="field" value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" />
        </Field>
        <Field id={`spec-${shop.id}`} label="Spec: what a match must be" count={`${s.length}/${MAX_SPEC}`} hint="Brand, model, capacity or size, colour or finish, condition new. Name the item, never a price." error={sErr}>
          <textarea id={`spec-${shop.id}`} className="field min-h-24" value={spec} onChange={(e) => setSpec(e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={`price-${shop.id}`} label="Price, GEN" error={pErr}>
            <input id={`price-${shop.id}`} className="field mono" value={priceText} onChange={(e) => setPriceText(e.target.value)} inputMode="decimal" autoComplete="off" />
            <Suggest label="Prices" chips={PRICE_CHIPS.map((c) => ({ label: c.label, value: genText(c.value) }))} onPick={setPriceText} isOn={(v) => v === priceText} />
          </Field>
          <Field id={`window-${shop.id}`} label="Guarantee window" error={wErr}>
            <p className="field mono flex items-center text-[14px]">{windowSec ? windowLabel(windowSec) : "pick one"}</p>
            <Suggest label="Windows" chips={WINDOW_CHIPS} onPick={setWindowSec} isOn={(v) => v === windowSec} />
          </Field>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        {full && <p className="text-[13px] text-red-ink">{shop.id} already lists {MAX_PRODUCTS} products, the most one shop may; open another shop for more.</p>}
        {listed && <p className="text-sm text-fresh-ink">Listed {listed}. Make sure the bond covers its price, or a sale is refused and sent back.</p>}
        <WalletGate what="to list a product">
          <ShelfButton variant="tag" icon={<IconTag />} disabled={!ready || tx.sending || (!!tx.hash && !tx.final)} onClick={() => void list()} className="self-start">
            List it
          </ShelfButton>
        </WalletGate>
        <TxStage
          tx={tx}
          sign={signGuide({ fn: "list_product", label: `Listing ${t || "a product"} in ${shop.id}`, mock: isMock })}
          sending={sendingGuide({ fn: "list_product", target: shop.id, title: t, amountAtto: "0", mock: isMock })}
          label={`Listing in ${shop.id}`}
        />
      </div>
      {products.data && products.data.rows.length > 0 && (
        <ul className="mt-4 grid gap-1 border-t border-line pt-3 text-sm">
          {products.data.rows.map((p) => (
            <li key={p.id} className="flex flex-wrap justify-between gap-x-3">
              <span>
                <span className="mono text-xs text-ink-3">{p.id}</span> {p.title}
              </span>
              <span className="mono">
                {gen(p.priceAtto)} · {windowLabel(p.window)} {p.covered ? "" : "· not covered"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ShopOrders({ shop }: { shop: Shop }) {
  const orders = useRead(() => readOrdersOfShop(shop.id, 0, 20), [shop.id]);
  useAfterTx(() => void orders.refresh());
  const total = orders.data?.total ?? 0;
  return (
    <div>
      <p className="field-label">Orders {total > 20 ? `(the first 20 of ${total})` : ""}</p>
      {orders.error ? (
        <ReadError detail={orders.error} onRetry={orders.retry} />
      ) : !orders.data ? (
        <Placeholder lines={2} />
      ) : orders.data.rows.length === 0 ? (
        <p className="mt-1 text-sm text-ink-3">No orders yet.</p>
      ) : (
        <ul className="mt-2 grid gap-2">
          {[...orders.data.rows].reverse().map((o) => (
            <ShopOrderRow key={o.id} o={o} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ShopOrderRow({ o }: { o: Order }) {
  const now = useNow();
  const tx = useTx();
  const clock = now || o.now;
  const phase = orderPhaseNow(o, clock);
  const line = orderLine({ role: "owner", now: clock, id: o.id, status: o.status, endedBy: o.endedBy, windowEnd: o.windowEnd, priceAtto: o.priceAtto, reservedAtto: o.reservedAtto, refundedAtto: o.refundedAtto, claimsLeft: o.claimsLeft, mock: isMock });
  const release = async () => {
    const h = await tx.start(calls.release(o.id));
    if (h) rememberTx(o.id, h, `Released ${o.id}`);
  };
  return (
    <li className="border-2 border-line-strong p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={orderPath(o.id)} className="min-w-0">
          <span className="mono text-xs text-ink-3">{o.id}</span> <span className="font-semibold">{o.title}</span>
          <span className="block text-sm text-ink-2">{line}</span>
        </Link>
        {phase === "release" && o.status === "open" && (
          <ShelfButton size="sm" variant="tag" icon={<IconUnlock />} disabled={tx.sending || (!!tx.hash && !tx.final)} onClick={() => void release()}>
            Release
          </ShelfButton>
        )}
      </div>
      <TxStage
        tx={tx}
        className="mt-2"
        sign={signGuide({ fn: "release", label: `Releasing ${o.id}`, mock: isMock })}
        sending={sendingGuide({ fn: "release", target: o.id, amountAtto: o.reservedAtto !== "0" ? o.reservedAtto : o.priceAtto, mock: isMock })}
        label={`Releasing ${o.id}`}
      />
    </li>
  );
}
