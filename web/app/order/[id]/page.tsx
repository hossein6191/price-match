"use client";

// One order. Its price tag, its guarantee counting down, and for its buyer the claim: credit first if
// there is none, then a competitor page picked from one-click chips (the demo's forty-nine pages, each
// linked to the copy this site serves) or typed below one of the shop's prefixes, and the Claim button.
// While the validators open the page, one waiting panel says what each of them is doing, how long it
// takes, that nothing is needed and that the page can be closed, and where the money is. Each judged
// claim prints as a till receipt with its stock line, and waits 15 minutes for an appeal before money
// moves: the side it went against gets the Appeal panel (reason, bond, every refusal explained before
// signing), anyone may settle once the window closes, and an appeal's second reading prints beside the
// first. Price protection shows the shop's own price history since the purchase and a Claim drop
// button when a drop is owed; on the demo shop a visitor can ask the shop to drop the price, raise it
// back, or appeal a match. After the window anyone may release the order. Every transaction shows its
// explorer link from the first second.

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Addr } from "@/components/addr";
import { Aisle, Time, TxList } from "@/components/bits";
import { ShelfButton, ShelfLink } from "@/components/button";
import { CreditBox } from "@/components/credit-box";
import { IconArrowRight, IconCheck, IconExternal, IconRefresh, IconTag, IconUnlock } from "@/components/icons";
import { PriceTag } from "@/components/price-tag";
import { ReadingScene } from "@/components/reading-scene";
import { Receipt } from "@/components/receipt";
import { Placeholder, ReadError } from "@/components/read-state";
import { Sticker } from "@/components/sticker";
import { Suggest } from "@/components/suggest";
import { TxStage } from "@/components/tx-stage";
import { useMe } from "@/components/use-me";
import { useNow, useWallNow } from "@/components/use-now";
import { useDemoStatus } from "@/components/use-demo";
import { useAfterTx, useRead } from "@/components/use-read";
import { useTx } from "@/components/use-tx";
import { WaitPanel, waitOf } from "@/components/wait-panel";
import { WalletGate } from "@/components/wallet-gate";
import {
  appealOutcome,
  calls,
  claimOutcome,
  claimPhaseNow,
  failureOf,
  isMock,
  orderPhaseNow,
  paidOf,
  readAccount,
  readClaims,
  readOrder,
  readProduct,
  readShop,
  requestDemo,
  shopPath,
  succeeded,
  unreadPage,
  type DemoAsk,
} from "@/lib/chain";
import { COMPETITORS, DEMO_APPEAL_REASON, DEMO_DROP, competitorOfPrefix, demoProductOf, pageChips, type PageChip } from "@/lib/demo-shop";
import { clockTime, gen, pagePath, windowLabel, tagPrice } from "@/lib/format";
import { appealGuide, claimGuide, demoAskGuide, orderGuide, sendingGuide, signGuide, type Role } from "@/lib/guide";
import { claimLines, unreadLines } from "@/lib/receipt";
import {
  APPEAL_BOND,
  CLAIM_FEE,
  MATCH_ON,
  MAX_REASON,
  OUTCOME_WORDS,
  REJUDGE_GAP,
  lowestPrice,
  pageProblem,
  parseOrderId,
  plain,
  pyStrip,
  reasonProblem,
  type Side,
} from "@/lib/rules";
import { BOND_CREDIT_CHIPS, CREDIT_CHIPS, REASON_CHIPS } from "@/lib/suggestions";
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
  const demo = useDemoStatus();
  const order = useRead<Order | null>(() => readOrder(id), [id]);
  const o = order.data;
  const product = useRead<Product | null>(() => readProduct(o!.product), [o?.product ?? ""], { enabled: !!o });
  const shop = useRead<Shop | null>(() => readShop(o!.shop), [o?.shop ?? ""], { enabled: !!o });
  const claims = useRead<Claim[]>(() => readClaims(id), [id, o?.claims.length ?? 0, o?.pending ?? ""], { enabled: !!o });
  const isParty = !!me.address && !!o && (me.address === o.buyer || (!!shop.data && me.address === shop.data.owner));
  const account = useRead(() => readAccount(me.address), [me.address], { enabled: isParty });
  useAfterTx(() => {
    void order.refresh();
    void claims.refresh();
    void account.refresh();
    void shop.refresh();
    void product.refresh();
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
  const pending = o.pending ? (list.find((c) => c.id === o.pending) ?? null) : null;
  const matched = list.find((c) => c.final === "matched");
  const hasDesk = o.status === "open" && phase === "claim";
  const demoOrder = !!demo?.shop && demo.shop === o.shop;
  const claimPhase = pending ? claimPhaseNow(pending, clock) : "settled";
  const dropDue = BigInt(o.dropDueAtto || "0");

  const action =
    o.status !== "open" ? undefined : pending && claimPhase === "settle" ? (
      <SettleButton claim={pending} order={o} label={`Settle ${pending.id}`} />
    ) : !pending && phase === "release" ? (
      <ReleaseButton order={o} />
    ) : !pending && role === "buyer" && dropDue > 0n && phase === "claim" ? (
      <ClaimDropButton order={o} dueAtto={o.dropDueAtto} />
    ) : undefined;

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
          <h1 className="mt-1 text-[40px] break-words sm:text-[54px]">{o.title}</h1>
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
            struck={!!matched || o.droppedAtto !== "0"}
            small={
              matched ? (
                <>Matched: {gen(o.refundedAtto)} came back</>
              ) : o.status === "released" ? (
                <>Released{o.droppedAtto !== "0" ? `: ${gen(o.droppedAtto)} came back as a price drop` : ": no match, nothing came back"}</>
              ) : o.droppedAtto !== "0" ? (
                <>Stands at {gen(o.standsAtAtto)} after a price drop of {gen(o.droppedAtto)}</>
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
            priceAtto: o.standsAtAtto,
            reservedAtto: o.reservedAtto,
            refundedAtto: o.refundedAtto,
            claimsLeft: o.claimsLeft,
            creditAtto: credit,
            pending: pending ? { id: pending.id, outcome: pending.first.outcome, mayAppeal: pending.mayAppeal, appealEnd: pending.appealEnd, refundAtto: pending.first.refundAtto } : undefined,
            dropDueAtto: o.dropDueAtto,
            mock: isMock,
          }),
          { action },
        )}
      />

      {pending && claimPhase === "appeal" && (
        <PendingDesk order={o} claim={pending} role={role} creditAtto={credit} now={clock} demoOrder={demoOrder} onAppealed={setFresh} />
      )}

      <div className={cx("grid gap-8", hasDesk && "lg:grid-cols-[minmax(0,1fr)_340px]")}>
        {hasDesk && (
          <div className="flex min-w-0 flex-col gap-8">
            {role === "buyer" && o.claimsLeft > 0 && product.data && shop.data && (
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
            {role !== "buyer" && <p className="text-sm text-ink-2">Only the buyer of {o.id} may claim on it. Anyone can watch its receipts print here.</p>}
          </div>
        )}

        <aside aria-labelledby="receipts" className={cx("flex min-w-0 flex-col items-center gap-6", hasDesk ? "lg:items-stretch" : "sm:flex-row sm:flex-wrap sm:items-start")}>
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
            <p className="text-sm text-ink-3">
              No claim judged yet. Each judged claim prints its receipt here: the page read, same product or not, in stock or not, their price, ours, and the refund due.
            </p>
          ) : (
            [...list].reverse().map((c) => (
              <Receipt
                key={c.id}
                head={["PRICE MATCH", `CLAIM ${c.id} · ORDER ${o.id}`, clockTime(c.at, clock)]}
                lines={claimLines(c, clock)}
                print={fresh === c.id}
                foot={[c.appeal ? "READ TWICE BY THE VALIDATORS, NOT THE SHOP" : "READ BY THE VALIDATORS, NOT THE SHOP"]}
              >
                <Sticker outcome={c.outcome} land={fresh === c.id} size={78} className="absolute -top-5 -right-3" />
              </Receipt>
            ))
          )}
          {list.length > 0 && <p className={cx("text-[12.5px] text-ink-3", !hasDesk && "sm:w-full")}>{OUTCOME_WORDS[list[list.length - 1].outcome].meaning}</p>}
        </aside>
      </div>

      {product.data && <PriceProtection order={o} product={product.data} role={role} now={clock} demoOrder={demoOrder} pendingId={pending?.id ?? o.pending} />}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="judged" className="min-w-0">
          <Aisle n="?" id="judged" title="What a match must be" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card-soft p-4 text-sm">
              <p className="field-label">The spec, as the shop wrote it</p>
              <p className="mt-1 text-ink-2">{product.data?.spec ?? "…"}</p>
              <p className="mt-2 text-[13px] text-ink-3">
                Judged on {MATCH_ON.join(", ")}, then whether the page offers it to buy now. Nothing else in the spec counts, and our price is never shown to the model.
              </p>
            </div>
            <div className="card-soft min-w-0 p-4 text-sm">
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
        <section aria-labelledby="sent" className="min-w-0">
          <Aisle n="TX" id="sent" title="Sent from this browser" />
          <TxList thing={o.id} />
        </section>
      </div>
    </div>
  );
}

/** Settle a pending claim: the side that may appeal waives it; anyone once the window has closed. */
function SettleButton({ claim, order, label, waive }: { claim: Claim; order: Order; label: string; waive?: boolean }) {
  const tx = useTx();
  const settle = async () => {
    const h = await tx.start(calls.settle(claim.id));
    if (h) rememberTx(order.id, h, waive ? `Settled ${claim.id}, waiving the appeal` : `Settled ${claim.id}`);
  };
  const due = claim.first.outcome === "matched" ? claim.first.refundAtto : "0";
  return (
    <div className="flex w-full flex-col gap-2.5">
      <WalletGate what="to settle it">
        <ShelfButton variant={waive ? "plain" : "tag"} icon={<IconCheck />} disabled={tx.sending || (!!tx.hash && !tx.final)} onClick={() => void settle()}>
          {label}
        </ShelfButton>
      </WalletGate>
      <TxStage
        tx={tx}
        sign={signGuide({ fn: "settle", label: `Settling ${claim.id}${waive ? " and waiving your appeal" : ""}`, mock: isMock })}
        sending={sendingGuide({ fn: "settle", target: claim.id, amountAtto: due, mock: isMock })}
        label={`Settling ${claim.id}`}
      />
      {tx.final && !succeeded(tx.final) && (
        <p role="alert" className="text-[13px] text-red-ink">
          {failureOf(tx.final)}
        </p>
      )}
    </div>
  );
}

function ClaimDropButton({ order, dueAtto }: { order: Order; dueAtto: string }) {
  const tx = useTx();
  const go = async () => {
    const h = await tx.start(calls.claimDrop(order.id));
    if (h) rememberTx(order.id, h, `Claimed the price drop on ${order.id}`);
  };
  return (
    <div className="flex w-full flex-col gap-2.5">
      <WalletGate what="to claim the drop">
        <ShelfButton variant="tag" icon={<IconTag />} disabled={tx.sending || (!!tx.hash && !tx.final)} onClick={() => void go()}>
          Claim drop of {gen(dueAtto)}
        </ShelfButton>
      </WalletGate>
      <TxStage
        tx={tx}
        sign={signGuide({ fn: "claim_drop", label: `Claiming the ${gen(dueAtto)} price drop on ${order.id}`, amountAtto: dueAtto, mock: isMock })}
        sending={sendingGuide({ fn: "claim_drop", target: order.id, amountAtto: dueAtto, mock: isMock })}
        label={`Claiming the price drop on ${order.id}`}
      />
      {tx.final && succeeded(tx.final) && <p className="text-sm text-fresh-ink">{gen(paidOf(tx.final))} came back to your wallet from the shop&apos;s bond.</p>}
      {tx.final && !succeeded(tx.final) && (
        <p role="alert" className="text-[13px] text-red-ink">
          {failureOf(tx.final)}
        </p>
      )}
    </div>
  );
}

/** Why an appeal would be refused, checked before anything is signed; "" when it would be taken. */
function appealRefusal(c: Claim, reason: string, creditAtto: string, now: number): string {
  if (c.state !== "pending") return `${c.id} is settled; a claim is appealed once, before it settles, and an appeal is never appealed.`;
  if (now >= c.appealEnd) return `The appeal window of ${c.id} has closed; anyone may settle it now.`;
  const why = reasonProblem(reason);
  if (why) return why.charAt(0).toUpperCase() + why.slice(1) + ".";
  if (BigInt(creditAtto || "0") < APPEAL_BOND) return "An appeal stakes 0.05 GEN of credit and this address holds less; add credit first (above).";
  return "";
}

/** A pending finding inside its appeal window: the Appeal panel for the side it went against, and what everyone else can do. */
function PendingDesk({
  order,
  claim,
  role,
  creditAtto,
  now,
  demoOrder,
  onAppealed,
}: {
  order: Order;
  claim: Claim;
  role: Role;
  creditAtto: string;
  now: number;
  demoOrder: boolean;
  onAppealed: (claimId: string) => void;
}) {
  const wall = useWallNow();
  const side: Side = claim.mayAppeal;
  const mine = (side === "buyer" && role === "buyer") || (side === "shop" && role === "owner");
  const sideWord = side === "shop" ? "the shop" : "the buyer";
  const finding = OUTCOME_WORDS[claim.first.outcome].sticker.toLowerCase();
  const [reason, setReason] = React.useState("");
  const [asking, setAsking] = React.useState<"" | "asking" | "failed">("");
  const [why, setWhy] = React.useState("");
  const tx = useTx((s) => {
    const out = appealOutcome(s);
    if (out) onAppealed(out.claim);
  });
  const demoTx = useTx((s) => {
    const out = appealOutcome(s);
    if (out) onAppealed(out.claim);
  });
  const sent = plain(reason);
  const refusal = appealRefusal(claim, sent, creditAtto, now);
  const busy = tx.sending || (!!tx.hash && !tx.final);
  const late = (t: typeof tx) => !!t.hash && !t.final && t.at > 0 && wall - t.at > LATE_AFTER;
  const page = pagePath(claim.url) || claim.url;
  const gain =
    side === "shop"
      ? "Better for the shop means a smaller refund (or none): then the second reading replaces the first and the bond comes back."
      : "Better for the buyer means a refund, or the claim fee back instead of lost: then the second reading replaces the first and the bond comes back.";

  const doAppeal = async () => {
    if (refusal) return;
    const h = await tx.start(calls.appeal(claim.id, sent));
    if (h) rememberTx(order.id, h, `Appealed ${claim.id}`);
  };
  const askDemo = async () => {
    setAsking("asking");
    setWhy("");
    const ask: DemoAsk = { kind: "appeal", order: order.id, claim: claim.id };
    const answer = await requestDemo(ask);
    if (!answer.ok) {
      setAsking("failed");
      setWhy(answer.reason);
      return;
    }
    setAsking("");
    if (answer.hash) demoTx.track(answer.hash, calls.appeal(claim.id, DEMO_APPEAL_REASON));
  };

  return (
    <section aria-labelledby="appeal" className="flex flex-col gap-4">
      <Aisle
        n="AP"
        id="appeal"
        title={mine ? `Appeal ${claim.id}?` : `${claim.id} may be appealed by ${sideWord}`}
        sub={
          <>
            {claim.id} found <strong>{finding}</strong>. Nothing moves until it settles: {sideWord}, whom the finding went against, may appeal it once until{" "}
            {clockTime(claim.appealEnd, now)}; after that anyone may settle it.
          </>
        }
      />
      {mine ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card flex min-w-0 flex-col gap-3 p-4">
            <p className="field-label">1 · Credit for the bond</p>
            <CreditBox thing={order.id} creditAtto={creditAtto} needAtto={APPEAL_BOND} needWhat="an appeal" chips={BOND_CREDIT_CHIPS} withdraw={false} />
          </div>
          <div className="card flex min-w-0 flex-col gap-3 p-4">
            <label htmlFor="reason" className="field-label">
              2 · Your reason
            </label>
            <textarea
              id="reason"
              className="field min-h-[88px] text-[14px]"
              maxLength={MAX_REASON + 40}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What the first reading missed on the page"
            />
            <Suggest label="Reasons" chips={REASON_CHIPS} onPick={setReason} />
            <p className="text-[12px] text-ink-3">
              {[...sent].length} of 10 to {MAX_REASON} characters, printable ASCII on one line. It goes to the validators as your argument, fenced as untrusted: they read{" "}
              {page} again themselves, and it must still read as it did when {claim.id} was judged.
            </p>
          </div>
          <div className="card-soft flex min-w-0 flex-col gap-2 p-4 text-[13.5px] text-ink-2 lg:col-span-2">
            <p className="field-label">Before you sign</p>
            <ul className="grid list-disc gap-1 pl-5">
              <li>The appeal stakes 0.05 GEN of your credit. {gain} Otherwise the first reading stands and the bond goes to the other side&apos;s credit.</li>
              <li>The claim settles in the same call, and an appeal is never appealed: this is your one appeal of {claim.id}.</li>
              <li>If the competitor changed the page since {claim.id} was judged, the validators store nothing, your bond stays yours, and the first finding still stands.</li>
              <li>The window closes at {clockTime(claim.appealEnd, now)}; after that the appeal is refused and anyone may settle.</li>
            </ul>
            {refusal && sent && (
              <p role="alert" className="mt-1 text-red-ink">
                Would be refused now: {refusal}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-3">
              <WalletGate what="to appeal">
                <ShelfButton variant="ink" icon={<IconArrowRight />} disabled={!!refusal || busy} onClick={() => void doAppeal()}>
                  {busy ? "The validators are reading again" : `Appeal ${claim.id} with 0.05 GEN`}
                </ShelfButton>
              </WalletGate>
            </div>
            <TxStage
              tx={tx}
              judged
              sign={signGuide({ fn: "appeal", label: `Appealing ${claim.id} with a 0.05 GEN bond`, mock: isMock })}
              sending={appealGuide({ role, claim: claim.id, order: order.id, page, by: side, stage: late(tx) ? "late" : "busy", mock: isMock })}
              label={`Appeal of ${claim.id}: the validators read ${page} again`}
            />
            {tx.final && !succeeded(tx.final) && (
              <p role="alert" className="text-[13px] text-red-ink">
                {failureOf(tx.final)}
              </p>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-2 lg:col-span-2">
            <p className="text-[13px] text-ink-3">Happy with the finding? Settle it now and waive your appeal: the money moves at once instead of at {clockTime(claim.appealEnd, now)}.</p>
            <SettleButton claim={claim} order={order} label={`Settle ${claim.id} now, waiving my appeal`} waive />
          </div>
        </div>
      ) : (
        <div className="card-soft flex flex-col gap-3 p-4 text-sm text-ink-2">
          <p>
            Only {sideWord} may appeal {claim.id}. {role === "visitor" ? "Anyone" : "You"} may settle it once its window closes at {clockTime(claim.appealEnd, now)}.
          </p>
          {demoOrder && side === "shop" && (
            <>
              <p>
                This order is from the demo shop. To see an appeal, ask the demo shop to appeal this match: it stakes its own 0.05 GEN with the reason &ldquo;{DEMO_APPEAL_REASON}
                &rdquo;, and the validators read the same page again.
              </p>
              <ShelfButton
                icon={<IconRefresh />}
                disabled={asking === "asking" || (!!demoTx.hash && !demoTx.final)}
                onClick={() => void askDemo()}
                className="self-start"
              >
                Ask the demo shop to appeal {claim.id}
              </ShelfButton>
              {asking === "asking" && <WaitPanel wait={waitOf(demoAskGuide({ state: "asking", kind: "appeal", target: claim.id, mock: isMock }))} />}
              {asking === "failed" && <WaitPanel wait={waitOf(demoAskGuide({ state: "failed", kind: "appeal", target: claim.id, reason: why, mock: isMock }))} />}
              <TxStage
                tx={demoTx}
                judged
                sign={signGuide({ fn: "appeal", label: `The demo shop appeals ${claim.id}`, mock: isMock })}
                sending={appealGuide({ role, claim: claim.id, order: order.id, page, by: "shop", stage: late(demoTx) ? "late" : "busy", mock: isMock })}
                label={`The demo shop's appeal of ${claim.id}`}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}

/** Price protection: the shop's own price history since the purchase, the drop owed, and the demo shop's reprice buttons. */
function PriceProtection({
  order,
  product,
  role,
  now,
  demoOrder,
  pendingId,
}: {
  order: Order;
  product: Product;
  role: Role;
  now: number;
  demoOrder: boolean;
  pendingId: string;
}) {
  const demoProduct = demoProductOf(product.spec);
  const list = BigInt(demoProduct?.priceAtto ?? product.priceAtto);
  const current = BigInt(product.priceAtto);
  const inWindow = product.history.filter((h) => order.boughtAt <= h.at && h.at < order.windowEnd);
  const low = lowestPrice({ priceAtto: order.priceAtto, droppedAtto: order.droppedAtto, boughtAt: order.boughtAt, windowEnd: order.windowEnd }, product.history);
  const due = BigInt(order.dropDueAtto || "0");
  const open = order.status === "open";
  const [asking, setAsking] = React.useState<"" | "asking" | "failed">("");
  const [kind, setKind] = React.useState<"drop" | "raise">("drop");
  const [why, setWhy] = React.useState("");
  const tx = useTx();
  const ask = async (direction: "down" | "up") => {
    setKind(direction === "down" ? "drop" : "raise");
    setAsking("asking");
    setWhy("");
    const answer = await requestDemo({ kind: "reprice", product: product.id, direction });
    if (!answer.ok) {
      setAsking("failed");
      setWhy(answer.reason);
      return;
    }
    setAsking("");
    if (answer.hash) tx.track(answer.hash, calls.reprice(product.id, direction === "down" ? list - DEMO_DROP : list));
  };
  const busy = asking === "asking" || (!!tx.hash && !tx.final);
  const noun = demoProduct?.noun ?? "product";

  return (
    <section aria-labelledby="protection" className="min-w-0">
      <Aisle
        n="PP"
        id="protection"
        title="Price protection"
        sub="If the shop itself lowers the price while your guarantee runs, the drop is yours too, even if the price goes back up. No page is read: it is the shop's own price history, recorded on chain."
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="card-soft min-w-0 p-4 text-sm">
          <ul className="grid gap-1.5">
            <li className="flex flex-wrap justify-between gap-2">
              <span>Paid</span>
              <span className="mono">{gen(order.priceAtto)}</span>
            </li>
            {order.droppedAtto !== "0" && (
              <li className="flex flex-wrap justify-between gap-2">
                <span>Price drops paid back</span>
                <span className="mono">-{gen(order.droppedAtto)}</span>
              </li>
            )}
            <li className="flex flex-wrap justify-between gap-2">
              <span>The shop&apos;s price now</span>
              <span className="mono">{gen(product.priceAtto)}</span>
            </li>
            <li className="flex flex-wrap justify-between gap-2">
              <span>Lowest price it recorded in this order&apos;s window</span>
              <span className="mono">{gen(low)}</span>
            </li>
            <li className="flex flex-wrap justify-between gap-2 border-t border-line pt-1.5 font-semibold">
              <span>Price drop owed now</span>
              <span className="mono">{open ? gen(due) : "order closed"}</span>
            </li>
          </ul>
          {inWindow.length > 0 ? (
            <details className="mt-3">
              <summary className="link cursor-pointer text-[13px] font-semibold">Price changes in this window ({inWindow.length})</summary>
              <ul className="mt-1.5 grid gap-1 text-[13px]">
                {inWindow.map((h, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-2">
                    <span>{clockTime(h.at, now)}</span>
                    <span className="mono">{gen(h.priceAtto)}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <p className="mt-3 text-[13px] text-ink-3">The shop has not changed this price since {order.id} was bought.</p>
          )}
          <p className="mt-2 text-[12px] text-ink-3">
            {product.repricesLeft} of 16 recorded price changes left on {product.id}; then the shop lists a new product for a new price.
          </p>
          {open && pendingId && due === 0n && (
            <p className="mt-2 text-[13px] text-ink-2">While {pendingId} is pending a drop cannot be claimed; settling it pays any drop owed first.</p>
          )}
          {open && role === "buyer" && due > 0n && !pendingId && now < order.windowEnd && (
            <div className="mt-3">
              <ClaimDropButton order={order} dueAtto={order.dropDueAtto} />
            </div>
          )}
          {open && due > 0n && now >= order.windowEnd && <p className="mt-2 text-[13px] text-ink-2">The window is over: Release pays this drop to the buyer first.</p>}
        </div>
        {demoOrder && demoProduct && open && (
          <div className="card min-w-0 p-4 text-sm">
            <p className="field-label">Test it on the demo shop</p>
            <p className="mt-1 text-ink-2">
              Ask the demo shop to lower the {noun} price by 0.30 GEN, then to raise it back. The lower price is recorded, so every open {noun} order bought before it is owed
              0.30 GEN, even after the price is back up. It costs you nothing.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ShelfButton size="sm" variant="tag" disabled={busy || current < list || now >= order.windowEnd} onClick={() => void ask("down")}>
                Shop drops the {noun} price
              </ShelfButton>
              <ShelfButton size="sm" disabled={busy || current >= list} onClick={() => void ask("up")}>
                Shop raises it back
              </ShelfButton>
            </div>
            {now >= order.windowEnd && <p className="mt-2 text-[12px] text-ink-3">This order&apos;s window is over, so a new drop would not count for it.</p>}
            {asking === "asking" && <WaitPanel wait={waitOf(demoAskGuide({ state: "asking", kind, target: product.id, mock: isMock }))} />}
            {asking === "failed" && <WaitPanel wait={waitOf(demoAskGuide({ state: "failed", kind, target: product.id, reason: why, mock: isMock }))} />}
            <TxStage
              tx={tx}
              sign={signGuide({ fn: "reprice", label: `The demo shop reprices ${product.id}`, mock: isMock })}
              sending={sendingGuide({ fn: "reprice", target: product.id, amountAtto: (kind === "drop" ? list - DEMO_DROP : list).toString(), mock: isMock })}
              label={`The demo shop reprices ${product.id}`}
            />
          </div>
        )}
      </div>
    </section>
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
  const claim = useTx((s, _hash, call) => {
    const out = claimOutcome(s);
    if (out) onClaimed(out.claim);
    else if (s.undetermined) onUnread({ url: String(call.args[1] ?? ""), why: unreadPage(s) });
  });
  const [url, setUrl] = React.useState("");
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
            Point at the competitor&apos;s page. Every validator opens it on the live web, agrees whether it is the same product, whether it is in stock now and reads its
            price; if it is cheaper, the difference is due to you from the shop&apos;s bond and paid once the 15-minute appeal window closes.{" "}
            {order.claimsLeft === 1 ? "One judged claim left." : `${order.claimsLeft} judged claims left.`}
          </>
        }
      />

      <div className={cx("card p-4", hasCredit && "border-line-strong")}>
        <p className="field-label flex items-center gap-2">
          <span className="display inline-grid size-6 place-items-center bg-ink text-[14px] text-tag">1</span> Credit
        </p>
        <div className="mt-2">
          <CreditBox thing={order.id} creditAtto={creditAtto} needAtto={CLAIM_FEE} needWhat="a claim" chips={CREDIT_CHIPS} />
        </div>
      </div>

      <div className="card p-4">
        <p className="field-label flex items-center gap-2">
          <span className="display inline-grid size-6 place-items-center bg-ink text-[14px] text-tag">2</span> The competitor&apos;s page
        </p>
        {chips.length > 0 ? (
          <>
            <p className="mt-2 text-sm text-ink-2">
            The demo&apos;s competitor pages for this product, one per outcome, each with what the network should agree. Open any of them first: the validators read exactly that
            page.
          </p>
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
        {!hasCredit && <p className="text-[13px] text-ink-3">Add the credit first (step 1).</p>}
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
          <p className="text-sm text-fresh-ink">
            The receipt is printed beside this order. Nothing moves for 15 minutes while the finding may be appealed
            {claimOutcome(claim.final)?.reading.outcome === "matched" ? "; then the refund comes to your wallet when anyone settles it." : "."}
          </p>
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
        {chip.own && <span className="block text-[12px] text-ink-2">The network should agree: {OUTCOME_WORDS[chip.page.expect].sticker.toLowerCase()}</span>}
        <span className="mono block truncate text-[11px] text-ink-3">{chip.page.competitor + "/" + chip.page.file}</span>
        {soon && <span className="block text-[12px] text-red-ink">Judged for this order at {clockTime(at, now)}; again a day after that.</span>}
      </button>
      <a href={chip.local} target="_blank" rel="noreferrer" className="link inline-flex shrink-0 items-center gap-1 text-[12.5px] text-ink-2">
        Open the page <IconExternal size={12} />
      </a>
    </li>
  );
}
