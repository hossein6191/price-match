"use client";

// The front of the store: the promise in one minute, a receipt printing the demo's kettle match, how
// the money moves, the four outcomes, and where to start.

import * as React from "react";

import { Aisle } from "@/components/bits";
import { ShelfLink } from "@/components/button";
import { IconArrowRight, IconBasket, IconGlobe, IconReceipt, IconStore, IconTag } from "@/components/icons";
import { PriceTag } from "@/components/price-tag";
import { Receipt } from "@/components/receipt";
import { Sticker } from "@/components/sticker";
import { DEMO_PAGES, DEMO_PRODUCTS } from "@/lib/demo-shop";
import { tagPrice } from "@/lib/format";
import { claimLines } from "@/lib/receipt";
import { OUTCOMES, OUTCOME_WORDS } from "@/lib/rules";
import type { Claim } from "@/lib/types";

const kettle = DEMO_PRODUCTS[0];
const page = DEMO_PAGES[0];
const refund = (BigInt(kettle.priceAtto) - BigInt(page.priceAtto)).toString();
const EXAMPLE: Claim = {
  id: "C1",
  order: "O1",
  url: `https://raw.githubusercontent.com/…/competitors/${page.competitor}/${page.file}`,
  product: "same",
  priceAtto: page.priceAtto,
  outcome: "matched",
  refundAtto: refund,
  feeTo: "buyer",
  at: 0,
};

const STEPS = [
  { icon: <IconStore />, title: "The shop promises", text: "It names the competitor pages it will match, fixed for good, and backs the promise with a bond the contract holds." },
  { icon: <IconBasket />, title: "You buy", text: "You pay exactly the price. It goes to the shop at once, and the same amount of its bond is reserved for you while the guarantee runs." },
  { icon: <IconGlobe />, title: "Found it cheaper?", text: "Point at the competitor's page. Every validator opens it on the live web and asks: the same product? at what price?" },
  { icon: <IconReceipt />, title: "The difference comes back", text: "If they agree it is the same product for less, the difference is paid to you from the bond in the same transaction." },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-16">
      <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div>
          <p className="kicker inline-block bg-ink px-2 py-1 text-tag">A lowest-price guarantee that enforces itself</p>
          <h1 className="mt-4 text-[54px] leading-[0.95] sm:text-[78px]">
            Found it cheaper? <span className="bg-tag px-1.5">The network checks.</span>
          </h1>
          <p className="mt-5 max-w-[56ch] text-[17px] text-ink-2">
            &ldquo;We match any lower price&rdquo; usually ends with someone at the shop deciding the other item is &ldquo;a different model&rdquo;. Here the validators open
            the competitor&apos;s page themselves, agree whether it is the same product and read its price, and the difference comes back from the shop&apos;s bond in the same
            transaction. Nobody at the shop decides, and nobody uploads a screenshot.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ShelfLink href="/shop" variant="tag" icon={<IconArrowRight />}>
              Try the demo shop
            </ShelfLink>
            <ShelfLink href="/merchant" icon={<IconStore />}>
              Open a shop
            </ShelfLink>
            <ShelfLink href="/how">How it decides</ShelfLink>
          </div>
        </div>
        <div className="relative flex flex-col items-center gap-8 xl:flex-row xl:items-start xl:justify-center">
          <div className="relative pt-12 pr-24">
            <PriceTag atto={kettle.priceAtto} size="xl" title="Lumio K3 kettle" struck small={<>Northgate has it for {tagPrice(page.priceAtto)} GEN</>} />
            <Sticker outcome="matched" line={`-${tagPrice(refund)} GEN`} land size={108} className="absolute top-0 right-0" />
          </div>
          <Receipt head={["PRICE MATCH", "EXAMPLE · CLAIM C1 · ORDER O1"]} lines={claimLines(EXAMPLE, kettle.priceAtto)} print foot={["READ BY THE VALIDATORS, NOT THE SHOP"]} />
        </div>
      </section>

      <div className="shelf-edge" aria-hidden="true" />

      <section aria-labelledby="promise">
        <Aisle n="01" id="promise" title="The promise in one minute" />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card flex flex-col">
              <div className="flex items-center justify-between bg-tag px-3 py-2">
                <span className="display text-[30px] leading-none font-extrabold">{String(i + 1).padStart(2, "0")}</span>
                <span aria-hidden="true">{s.icon}</span>
              </div>
              <div className="p-3.5">
                <h3 className="text-[22px]">{s.title}</h3>
                <p className="mt-1.5 text-[14px] text-ink-2">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="money">
        <Aisle n="02" id="money" title="How the money moves" sub="The contract only ever holds two things: each shop's bond, and each buyer's small claim-fee credit." />
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
          <MoneyBox who="Buyer" lines={["pays exactly the price", "deposits 0.01 GEN of claim-fee credit"]} />
          <Arrow text="the price, at once" />
          <MoneyBox who="Shop" lines={["receives the sale in the same transaction", "keeps a bond: each sale reserves its full price until the window ends"]} />
          <Arrow text="a match: the difference" back />
          <MoneyBox who="Buyer again" lines={["gets our price minus theirs from the reserved bond", "keeps the claim fee unless the page was another product"]} tag />
        </div>
        <p className="mt-3 max-w-[80ch] text-[14px] text-ink-3">
          When the window ends, anyone may release the order and its reservation goes back to the shop&apos;s free bond. A refused purchase sends everything back in the same
          transaction.
        </p>
      </section>

      <section aria-labelledby="outcomes">
        <Aisle n="03" id="outcomes" title="Four ways a claim can end" />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {OUTCOMES.map((o) => (
            <li key={o} className="card-soft flex flex-col items-center gap-3 p-5 text-center">
              <Sticker outcome={o} size={104} />
              <p className="text-[14px] text-ink-2">{OUTCOME_WORDS[o].meaning}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="start" className="border-2 border-ink bg-tag px-5 py-7 sm:px-8">
        <h2 id="start" className="text-[38px] sm:text-[48px]">
          Start in the demo shop
        </h2>
        <p className="mt-2 max-w-[66ch] text-[16px]">
          Harbour Lane Goods sells nine things, from a kettle to a wool throw. Buy one, pick a competitor page from the chips (the same product for less, another model, a refurbished
          unit, a dearer page, a page with no price), and watch the validators read it.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <ShelfLink href="/shop" variant="ink" icon={<IconTag />}>
            Go to the shelf
          </ShelfLink>
          <ShelfLink href="/competitors/index.html" external>
            See all {DEMO_PAGES.length} competitor pages
          </ShelfLink>
        </div>
      </section>
    </div>
  );
}

function MoneyBox({ who, lines, tag }: { who: string; lines: string[]; tag?: boolean }) {
  return (
    <div className={tag ? "border-2 border-ink bg-tag p-4" : "card p-4"}>
      <p className="display text-[24px] font-extrabold uppercase">{who}</p>
      <ul className="mt-1.5 grid gap-1 text-[14px] text-ink-2">
        {lines.map((l) => (
          <li key={l} className="flex gap-2">
            <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 bg-ink" />
            <span className={tag ? "text-ink" : undefined}>{l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Arrow({ text, back }: { text: string; back?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-2 py-1 lg:flex-col lg:px-1">
      <IconArrowRight className={back ? "rotate-90 lg:rotate-0" : "rotate-90 lg:rotate-0"} />
      <span className="display text-center text-[13px] font-bold tracking-[0.06em] text-ink-3 uppercase lg:max-w-[8rem]">{text}</span>
    </div>
  );
}
