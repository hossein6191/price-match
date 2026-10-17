"use client";

// One order. Its price tag, its guarantee counting down, and for its buyer the claim: claim-fee
// credit first if there is none, then a competitor page picked from one-click chips (the demo's
// forty-five pages, each linked to the copy this site serves) or typed below one of the shop's prefixes,
// and the Claim button. While the validators open the page, one waiting panel says what each of them
// is doing, how long it takes, that nothing is needed and that the page can be closed, and where the
// money is. Each judged claim prints as a till receipt, and a match gets its red sticker. After the
// window anyone may release the order. Every transaction shows its explorer link from the first second.

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Addr } from "@/components/addr";
import { Aisle, Time, TxList } from "@/components/bits";
import { ShelfButton, ShelfLink } from "@/components/button";
import { IconArrowRight, IconCoins, IconExternal, IconUnlock } from "@/components/icons";
import { PriceTag } from "@/components/price-tag";
import { ReadingScene } from "@/components/reading-scene";
import { Receipt } from "@/components/receipt";
import { Placeholder, ReadError } from "@/components/read-state";
import { Sticker } from "@/components/sticker";
import { Suggest } from "@/components/suggest";
import { TxStage } from "@/components/tx-stage";
import { useMe } from "@/components/use-me";
import { useNow, useWallNow } from "@/components/use-now";
import { useAfterTx, useRead } from "@/components/use-read";
import { useTx } from "@/components/use-tx";
import { WaitPanel, waitOf } from "@/components/wait-panel";
import { WalletGate } from "@/components/wallet-gate";
import {
  calls,
  claimOutcome,
  isMock,
  orderPhaseNow,
  readAccount,
  readClaims,
  readOrder,
  readProduct,
  readShop,
  shopPath,
  succeeded,
  unreadPage,
} from "@/lib/chain";
import { COMPETITORS, competitorOfPrefix, pageChips, type PageChip } from "@/lib/demo-shop";
import { clockTime, gen, pagePath, windowLabel, tagPrice } from "@/lib/format";
import { claimGuide, orderGuide, sendingGuide, signGuide, type Role } from "@/lib/guide";
import { claimLines, unreadLines } from "@/lib/receipt";
import { CLAIM_FEE, MATCH_ON, OUTCOME_WORDS, REJUDGE_GAP, pageProblem, parseOrderId, pyStrip } from "@/lib/rules";
import { CREDIT_CHIPS } from "@/lib/suggestions";
import { claimLabel, rememberTx } from "@/lib/tx-memory";
import type { Claim, Order, Product, Shop, TxStatus } from "@/lib/types";
import { cx } from "@/lib/cx";

const LATE_AFTER = 360;

export default function OrderPage() {
  const params = useParams<{ id: string }>();
  const id = parseOrderId(String(params?.id ?? ""));
  if (!id)
    return (
      <div className="card-soft p-5">
        <h1 className="text-3xl">That is not an order id</h1>
        <p className="mt-2 text-ink-2">Orders are O1, O2 and so on. Yours are under My orders.</p>
        <ShelfLink href="/mine" className="mt-4">
          My orders
        </ShelfLink>
      </div>
    );
  return <OrderView id={id} />;
}

function OrderView({ id }: { id: string }) {
  const me = useMe();
  const now = useNow();
  const order = useRead<Order | null>(() => readOrder(id), [id]);
  const o = order.data;
  const product = useRead<Product | null>(() => readProduct(o!.product), [o?.product ?? ""], { enabled: !!o });
  const shop = useRead<Shop | null>(() => readShop(o!.shop), [o?.shop ?? ""], { enabled: !!o });
  const claims = useRead<Claim[]>(() => readClaims(id), [id, o?.claims.length ?? 0], { enabled: !!o });
  const account = useRead(() => readAccount(me.address), [me.address], { enabled: !!me.address && !!o && me.address === o.buyer });
  useAfterTx(() => {
    void order.refresh();
    void claims.refresh();
    void account.refresh();
    void shop.refresh();
  });

  const [fresh, setFresh] = React.useState("");
  const [unread, setUnread] = React.useState<{ url: string; why: string } | null>(null);

  if (order.error) return <ReadError detail={order.error} onRetry={order.retry} />;
  if (!o)
    return order.loading ? (
      <Placeholder lines={8} />
    ) : (
      <div className="card-soft p-5">
        <h1 className="text-3xl">No order {id}</h1>
        <p className="mt-2 text-ink-2">The contract holds no order by that id.</p>
        <ShelfLink href="/mine" className="mt-4">
          My orders
        </ShelfLink>
      </div>
    );

  const role: Role = me.address && me.address === o.buyer ? "buyer" : me.address && shop.data && me.address === shop.data.owner ? "owner" : "visitor";
  const clock = now || o.now;
  const phase = orderPhaseNow(o, clock);
  const credit = account.data?.creditAtto ?? "0";
  const list = claims.data ?? [];
  const matched = list.find((c) => c.outcome === "matched");
  const hasDesk = o.status === "open" && phase === "claim";

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="kicker text-ink-3">
            Order {o.id} · {o.product} ·{" "}
            <Link className="link" href={shopPath(o.shop)}>
              {shop.data?.name ?? o.shop}
            </Link>
          </p>
          <h1 className="mt-1 text-[40px] sm:text-[54px]">{o.title}</h1>
          <p className="mt-2 text-sm text-ink-2">
            Bought by <Addr address={o.buyer} me={me.address} /> <Time at={o.boughtAt} />. Guaranteed until {clockTime(o.windowEnd, clock)}
            {product.data ? ` (${windowLabel(product.data.window)} from the purchase)` : ""}.
          </p>
        </div>
        <div className={cx("relative self-start", matched && "pt-10 pr-20")}>
          <PriceTag
            atto={o.priceAtto}
            size="lg"
            title={role === "buyer" ? "You paid" : "The buyer paid"}
            struck={!!matched}
            small={
              matched ? (
                <>Matched: {gen(o.refundedAtto)} came back</>
              ) : o.status === "released" ? (
                <>Released: no match, nothing came back</>
              ) : (
                <>Reserved from the bond until {clockTime(o.windowEnd, clock)}</>
              )
            }
          />
          {matched && <Sticker outcome="matched" line={`-${tagPrice(o.refundedAtto)} GEN`} land={fresh === matched.id} size={96} className="absolute top-0 right-0" />}
        </div>
      </div>

      <WaitPanel
        wait={waitOf(
          orderGuide({
            role,
            now: clock,
            id: o.id,
            status: o.status,
            endedBy: o.endedBy,
            windowEnd: o.windowEnd,
            priceAtto: o.priceAtto,
            reservedAtto: o.reservedAtto,
            refundedAtto: o.refundedAtto,
            claimsLeft: o.claimsLeft,
            creditAtto: credit,
            mock: isMock,
          }),
          { action: phase === "release" && o.status === "open" ? <ReleaseButton order={o} /> : undefined },
        )}
      />

      <div className={cx("grid gap-8", hasDesk && "lg:grid-cols-[minmax(0,1fr)_340px]")}>
        {hasDesk && (
        <div className="flex min-w-0 flex-col gap-8">
          {role === "buyer" && o.status === "open" && phase === "claim" && o.claimsLeft > 0 && product.data && shop.data && (
            <ClaimDesk
              order={o}
              product={product.data}
              shop={shop.data}
              claims={list}
              creditAtto={credit}
              now={clock}
              onClaimed={(c) => {
                setFresh(c);
                setUnread(null);
              }}
              onUnread={setUnread}
            />
          )}
          {role !== "buyer" && o.status === "open" && phase === "claim" && (
            <p className="text-sm text-ink-2">Only the buyer of {o.id} may claim on it. Anyone can watch its receipts print here.</p>
          )}
        </div>
        )}

        <aside aria-labelledby="receipts" className={cx("flex flex-col items-center gap-6", hasDesk ? "lg:items-stretch" : "sm:flex-row sm:flex-wrap sm:items-start")}>
          <h2 id="receipts" className={cx("self-start text-[28px]", !hasDesk && "sm:w-full")}>
            Receipts
          </h2>
          {unread && (
            <Receipt head={["PRICE MATCH", `ORDER ${o.id} · NOT STORED`]} lines={unreadLines(unread.url, unread.why)} print foot={["THE ROUND DID NOT SETTLE"]} />
          )}
          {claims.error ? (
            <ReadError detail={claims.error} onRetry={claims.retry} />
          ) : !claims.data ? (
            <Placeholder lines={4} />
          ) : list.length === 0 && !unread ? (
            <p className="text-sm text-ink-3">No claim judged yet. Each judged claim prints its receipt here: the page read, same product or not, their price, ours, and the refund.</p>
          ) : (
            [...list].reverse().map((c) => (
              <Receipt
                key={c.id}
                head={["PRICE MATCH", `CLAIM ${c.id} · ORDER ${o.id}`, clockTime(c.at, clock)]}
                lines={claimLines(c, o.priceAtto)}
                print={fresh === c.id}
                foot={["READ BY THE VALIDATORS, NOT THE SHOP"]}
              >
                <Sticker outcome={c.outcome} land={fresh === c.id} size={78} className="absolute -top-5 -right-3" />
              </Receipt>
            ))
          )}
          {list.length > 0 && <p className={cx("text-[12.5px] text-ink-3", !hasDesk && "sm:w-full")}>{OUTCOME_WORDS[list[list.length - 1].outcome].meaning}</p>}
        </aside>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="judged">
          <Aisle n="?" id="judged" title="What a match must be" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card-soft p-4 text-sm">
              <p className="field-label">The spec, as the shop wrote it</p>
              <p className="mt-1 text-ink-2">{product.data?.spec ?? "…"}</p>
              <p className="mt-2 text-[13px] text-ink-3">Judged on {MATCH_ON.join(", ")}. Nothing else in the spec counts, and our price is never shown to the model.</p>
            </div>
            <div className="card-soft p-4 text-sm">
              <p className="field-label">Pages the shop promised to match</p>
              <ul className="mt-1.5 grid gap-1.5">
                {(shop.data?.competitors ?? []).map((p) => {
                  const c = COMPETITORS.find((x) => x.key === competitorOfPrefix(p));
                  return (
                    <li key={p} className="border-l-4 border-tag pl-2">
                      <span className="font-semibold">{c?.name ?? "A competitor"}</span>
                      <span className="mono block text-[11px] break-all text-ink-3">{p}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
        <section aria-labelledby="sent">
          <Aisle n="TX" id="sent" title="Sent from this browser" />
          <TxList thing={o.id} />
        </section>
      </div>
    </div>
  );
}

function ReleaseButton({ order }: { order: Order }) {
  const tx = useTx();
  const release = async () => {
    const h = await tx.start(calls.release(order.id));
    if (h) rememberTx(order.id, h, `Released ${order.id}`);
  };
  return (
    <div className="flex w-full flex-col gap-2.5">
      <WalletGate what="to release it">
        <ShelfButton variant="tag" icon={<IconUnlock />} disabled={tx.sending || (!!tx.hash && !tx.final)} onClick={() => void release()}>
          Release {order.id}
        </ShelfButton>
      </WalletGate>
      <TxStage
        tx={tx}
        sign={signGuide({ fn: "release", label: `Releasing ${order.id}`, mock: isMock })}
        sending={sendingGuide({ fn: "release", target: order.id, amountAtto: order.reservedAtto !== "0" ? order.reservedAtto : order.priceAtto, mock: isMock })}
        label={`Releasing ${order.id}`}
      />
    </div>
  );
}

function ClaimDesk({
  order,
  product,
  shop,
  claims,
  creditAtto,
  now,
  onClaimed,
  onUnread,
}: {
  order: Order;
  product: Product;
  shop: Shop;
  claims: Claim[];
  creditAtto: string;
  now: number;
  onClaimed: (claimId: string) => void;
  onUnread: (u: { url: string; why: string }) => void;
}) {
  const wall = useWallNow();
  const deposit = useTx();
  const claim = useTx((s, _hash, call) => {
    const out = claimOutcome(s);
    if (out) onClaimed(out.claim);
    else if (s.undetermined) onUnread({ url: String(call.args[1] ?? ""), why: unreadPage(s) });
  });
  const [url, setUrl] = React.useState("");
  const [creditPick, setCreditPick] = React.useState<bigint>(CREDIT_CHIPS[0].value);
  const [status, setStatus] = React.useState<TxStatus | null>(null);
  const chips = pageChips(product.spec, shop.competitors);
  const credit = BigInt(creditAtto || "0");
  const hasCredit = credit >= CLAIM_FEE;
  const typed = pyStrip(url);
  const problem = typed ? pageProblem(typed, shop.competitors, shop.id) : "";
  const lastAt = (u: string) => Math.max(-1, ...claims.filter((c) => c.url === u).map((c) => c.at));
  const tooSoon = (u: string) => {
    const at = lastAt(u);
    return at >= 0 && now - at < REJUDGE_GAP;
  };
  const busy = claim.sending || (!!claim.hash && !claim.final);
  const late = busy && claim.at > 0 && wall - claim.at > LATE_AFTER;
  const page = pagePath(typed) || typed;

  const doDeposit = async () => {
    const h = await deposit.start(calls.deposit(creditPick));
    if (h) rememberTx(order.id, h, `Added ${gen(creditPick)} of claim-fee credit`);
  };
  const doClaim = async () => {
    if (!typed || problem || tooSoon(typed)) return;
    setStatus(null);
    const h = await claim.start(calls.claim(order.id, typed));
    if (h) rememberTx(order.id, h, claimLabel(page));
  };

  const pick = (c: PageChip) => setUrl(c.url);

  return (
    <section aria-labelledby="claim" className="flex flex-col gap-5">
      <Aisle
        n="!"
        id="claim"
        title="Found it cheaper?"
        sub={
          <>
            Point at the competitor&apos;s page. Every validator opens it on the live web, agrees whether it is the same product and reads its price; if it is cheaper,
            the difference comes back to you from the shop&apos;s bond in the same transaction. {order.claimsLeft === 1 ? "One judged claim left." : `${order.claimsLeft} judged claims left.`}
          </>
        }
      />

      <div className={cx("card p-4", hasCredit && "border-line-strong")}>
        <p className="field-label flex items-center gap-2">
          <span className="display inline-grid size-6 place-items-center bg-ink text-[14px] text-tag">1</span> Claim-fee credit
        </p>
        {hasCredit ? (
          <p className="mt-2 text-sm text-ink-2">
            You hold <span className="mono font-bold text-ink">{gen(credit)}</span> of credit. A claim stakes 0.01 GEN of it: it stays yours unless the page turns out to be
            another product, when it goes to the shop.
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-2.5">
            <p className="text-sm text-ink-2">
              A claim stakes 0.01 GEN of credit, a small cost against spam. It stays yours on every outcome but one (another product), and you can withdraw it at any time.
            </p>
            <Suggest label="Credit to add" chips={CREDIT_CHIPS} onPick={setCreditPick} isOn={(v) => v === creditPick} />
            <WalletGate need={creditPick} what="to add credit">
              <ShelfButton variant="tag" icon={<IconCoins />} disabled={deposit.sending || (!!deposit.hash && !deposit.final)} onClick={() => void doDeposit()}>
                Add {gen(creditPick)} of credit
              </ShelfButton>
            </WalletGate>
            <TxStage
              tx={deposit}
              sign={signGuide({ fn: "deposit", label: `Adding ${gen(creditPick)} of claim-fee credit`, amountAtto: creditPick.toString(), mock: isMock })}
              sending={sendingGuide({ fn: "deposit", target: order.id, amountAtto: creditPick.toString(), mock: isMock })}
              label="Adding claim-fee credit"
            />
          </div>
        )}
      </div>

      <div className="card p-4">
        <p className="field-label flex items-center gap-2">
          <span className="display inline-grid size-6 place-items-center bg-ink text-[14px] text-tag">2</span> The competitor&apos;s page
        </p>
        {chips.length > 0 ? (
          <>
            <p className="mt-2 text-sm text-ink-2">The demo&apos;s competitor pages for this product, one per outcome. Open any of them first: the validators read exactly that page.</p>
            <ul className="mt-3 grid gap-2">
              {chips
                .filter((c) => c.own)
                .map((c) => (
                  <PageChipRow key={c.url} chip={c} on={url === c.url} soon={tooSoon(c.url)} at={lastAt(c.url)} now={now} onPick={pick} />
                ))}
            </ul>
            {chips.some((c) => !c.own) && (
              <details className="mt-3">
                <summary className="link cursor-pointer text-sm font-semibold">Every other demo page ({chips.filter((c) => !c.own).length})</summary>
                <ul className="mt-2 grid gap-2">
                  {chips
                    .filter((c) => !c.own)
                    .map((c) => (
                      <PageChipRow key={c.url} chip={c} on={url === c.url} soon={tooSoon(c.url)} at={lastAt(c.url)} now={now} onPick={pick} />
                    ))}
                </ul>
              </details>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-2">This shop matches its own competitors&apos; pages. Paste the address of a page below one of its prefixes.</p>
        )}
        <div className="mt-4">
          <label htmlFor="page-url" className="field-label">
            Page address
          </label>
          <input
            id="page-url"
            className="field mono mt-1 text-[13px]"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={shop.competitors[0] ? shop.competitors[0] + "…" : "https://…"}
            spellCheck={false}
            autoComplete="off"
            inputMode="url"
          />
          <Suggest label="Start from a prefix" chips={shop.competitors.map((p) => ({ label: prefixLabel(p), value: p }))} onPick={setUrl} />
          {problem && (
            <p role="alert" className="mt-1.5 text-[13px] text-red-ink">
              {problem}
            </p>
          )}
          {!problem && typed && tooSoon(typed) && (
            <p role="alert" className="mt-1.5 text-[13px] text-red-ink">
              This page was judged for {order.id} at {clockTime(lastAt(typed), now)}; the same page may be judged again a day after that. Point at another page now.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <WalletGate what="to claim">
          <ShelfButton
            variant="ink"
            icon={<IconArrowRight />}
            disabled={!hasCredit || !typed || !!problem || tooSoon(typed) || busy}
            onClick={() => void doClaim()}
            className="self-start"
          >
            {busy ? "The validators are reading" : "Claim with this page"}
          </ShelfButton>
        </WalletGate>
        {!hasCredit && <p className="text-[13px] text-ink-3">Add the claim-fee credit first (step 1).</p>}
        <TxStage
          tx={claim}
          judged
          sign={signGuide({ fn: "claim", label: `Claiming on ${order.id} with ${page}`, mock: isMock })}
          sending={claimGuide({ role: "buyer", order: order.id, page, priceAtto: order.priceAtto, stage: late ? "late" : "busy", mock: isMock })}
          scene={<ReadingScene page={page} status={status} />}
          onStatus={setStatus}
          label={`Claim on ${order.id}: the validators read ${page}`}
        />
        {claim.final && succeeded(claim.final) && (
          <p className="text-sm text-fresh-ink">The receipt is printed beside this order. {claimOutcome(claim.final)?.outcome === "matched" ? "The refund is in your wallet." : ""}</p>
        )}
      </div>
    </section>
  );
}

/** A prefix in a few words: the demo competitor's name, or its host and last directory. */
function prefixLabel(p: string): string {
  const c = COMPETITORS.find((x) => x.key === competitorOfPrefix(p));
  if (c) return `${c.short}/…`;
  const parts = p.replace(/^https:\/\//, "").split("/").filter(Boolean);
  return parts.length > 1 ? `${parts[0]}/…/${parts[parts.length - 1]}/` : `${parts[0] ?? p}/`;
}

function PageChipRow({ chip, on, soon, at, now, onPick }: { chip: PageChip; on: boolean; soon: boolean; at: number; now: number; onPick: (c: PageChip) => void }) {
  return (
    <li className={cx("flex flex-wrap items-center justify-between gap-2 border-2 px-3 py-2", on ? "border-ink bg-tag" : "border-line-strong bg-paper")}>
      <button type="button" aria-pressed={on} disabled={soon} onClick={() => onPick(chip)} className="min-w-0 flex-1 text-left disabled:opacity-50">
        <span className="block font-semibold">{chip.label}</span>
        <span className="mono block truncate text-[11px] text-ink-3">{chip.page.competitor + "/" + chip.page.file}</span>
        {soon && <span className="block text-[12px] text-red-ink">Judged for this order at {clockTime(at, now)}; again a day after that.</span>}
      </button>
      <a href={chip.local} target="_blank" rel="noreferrer" className="link inline-flex shrink-0 items-center gap-1 text-[12.5px] text-ink-2">
        Open the page <IconExternal size={12} />
      </a>
    </li>
  );
}
