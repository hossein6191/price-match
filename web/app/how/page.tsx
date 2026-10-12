"use client";

// How it works: the four askings word for word, how the answers combine into the one stored value,
// why reading the live web makes this a job for GenLayer, where the money goes, who may do what, the
// limits stated plainly, and the contract's own rules() read live.

import { Aisle } from "@/components/bits";
import { ShelfButton, ShelfLink } from "@/components/button";
import { IconArrowRight } from "@/components/icons";
import { Placeholder, ReadError } from "@/components/read-state";
import { useRead } from "@/components/use-read";
import { hasContract, readRules } from "@/lib/chain";
import { DEMO_PAGE_COUNT } from "@/lib/demo-shop";
import {
  MATCH_ON,
  MAX_CLAIMS,
  MAX_PAGE,
  MAX_PREFIX,
  MAX_PREFIXES,
  MAX_SPEC,
  MAX_URL,
  MIN_PAGE,
  MIN_SPEC,
  MONEY_WORDS,
  QUESTION_DIFFERENT,
  QUESTION_PRICE,
  QUESTION_SAME,
  READING,
} from "@/lib/rules";

const ASKINGS = [
  { n: "1", order: "SPEC, then PAGE", q: QUESTION_SAME },
  { n: "2", order: "PAGE, then SPEC", q: QUESTION_DIFFERENT },
  { n: "3", order: "SPEC, then PAGE", q: QUESTION_PRICE },
  { n: "4", order: "PAGE, then SPEC", q: "The same price question, the other way round." },
];

const MONEY = [
  ["fund", "The owner's GEN joins the shop's bond."],
  ["buy", "The buyer pays exactly the price; it goes to the shop in the same transaction, and the same amount of the shop's bond is reserved for the order."],
  ["claim, matched", "Our price minus theirs goes to the buyer from the reserved bond, in the same transaction; the rest of the reservation is freed."],
  ["claim, not cheaper or unclear", "Nothing moves."],
  ["claim, different", "0.01 GEN of the buyer's claim-fee credit goes to the shop."],
  ["release", "Nothing leaves the contract: the reservation goes back to the shop's free bond."],
  ["withdraw_bond", "Free bond goes back to the owner; reserved bond never does."],
  ["deposit / withdraw", "Claim-fee credit in and out, the sender's own only."],
  ["a refused payment", "Everything sent goes back to the sender, in the same transaction."],
];

const WHO = [
  ["open_shop(name, competitors)", "anyone; the sender is the owner; the prefixes are fixed for good"],
  ["fund(shop), payable", "the owner"],
  ["withdraw_bond(shop, amount)", "the owner, up to the free bond"],
  ["list_product(shop, title, spec, price, window)", "the owner, at most 20 products per shop"],
  ["buy(product), payable", "anyone but the owner, with exactly the price, while the free bond covers it"],
  ["deposit(), payable · withdraw()", "anyone, for their own credit"],
  ["claim(order, url)", "the buyer, inside the window, a page below an accepted prefix, at most two judged claims, the same page again only a day later"],
  ["release(order)", "anyone, after the window, while the order is open"],
];

export default function HowPage() {
  const rules = useRead(() => readRules(), [], { enabled: hasContract() });
  return (
    <div className="flex flex-col gap-12">
      <div>
        <p className="kicker text-ink-3">Aisle 06</p>
        <h1 className="mt-1 text-[48px] sm:text-[60px]">How it works</h1>
        <p className="mt-2 max-w-[70ch] text-[17px] text-ink-2">
          A shop promises to match a competitor&apos;s price and backs the promise with a bond. A buyer who finds it cheaper points at the competitor&apos;s page. Every
          validator opens that page on the live web and asks the same four questions about it; the contract stores the one value they agree on exactly, compares it with
          our price, and pays the difference from the bond in the same transaction.
        </p>
      </div>

      <section aria-labelledby="askings">
        <Aisle n="01" id="askings" title="The four askings" sub="Asked by every validator about the same fetched page, inside one consensus block. The model sees the spec and the page; never our price, an address, a name or a date." />
        <ol className="grid gap-3 md:grid-cols-2">
          {ASKINGS.map((a) => (
            <li key={a.n} className="card-soft flex gap-3 p-4">
              <span className="display grid size-10 shrink-0 place-items-center bg-tag text-[24px] font-extrabold">{a.n}</span>
              <div className="min-w-0">
                <p className="kicker text-ink-3">Blocks: {a.order}</p>
                <p className="mt-1 text-[14.5px]">{a.q}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 max-w-[78ch] text-[13.5px] text-ink-3">Before every question: {READING}</p>
      </section>

      <section aria-labelledby="combine">
        <Aisle n="02" id="combine" title="One stored value" />
        <div className="grid gap-5 md:grid-cols-2">
          <table className="w-full border-2 border-ink text-left text-sm">
            <caption className="sr-only">How the two product askings combine</caption>
            <thead className="bg-ink text-white">
              <tr>
                <th className="display px-3 py-2 text-[15px] uppercase">Askings 1 and 2</th>
                <th className="display px-3 py-2 text-[15px] uppercase">Product</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["yes, then no", "same"],
                ["no, then yes", "different"],
                ["anything else, an unreadable answer included", "unclear"],
              ].map(([a, b]) => (
                <tr key={a} className="border-t border-line">
                  <td className="px-3 py-2">{a}</td>
                  <td className="mono px-3 py-2 font-bold">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[14.5px] text-ink-2">
            <p>
              The price is asked only about a page both framings call the same product. Each answer is read as a plain decimal with at most 18 places and turned into an
              integer of atto: <span className="mono">1.80</span>, <span className="mono">1.8</span> and <span className="mono">01.80</span> are the same price, while{" "}
              <span className="mono">1,80</span>, <span className="mono">$1.80</span> and <span className="mono">unclear</span> are none. It is kept only when both orders give
              the same integer.
            </p>
            <p className="mt-2">
              The stored value is <span className="mono text-ink">{'{"product": same | different | unclear, "price": "<atto>" or ""}'}</span>. Every validator re-derives it
              and compares it by exact equality. There is no tolerance for a disagreement to hide in: a model that says yes to everything lands as unclear, and a position
              bias shows up as a disagreement.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="live-web" className="bg-ink px-5 py-7 text-white sm:px-8">
        <h2 id="live-web" className="text-[34px] text-tag sm:text-[42px]">
          Why the live web makes this a GenLayer job
        </h2>
        <div className="mt-4 grid gap-5 text-[15px] text-white/85 md:grid-cols-3">
          <p>The evidence is a page on somebody else&apos;s website, at the moment of the claim. An ordinary contract cannot fetch a web page at all.</p>
          <p>An oracle run by the shop, or by the buyer, would be one party reading the page for both. Here every validator fetches it independently and reads it with its own model.</p>
          <p>The payout follows the value they agreed on, from money the contract already holds. Nobody uploads a screenshot and nobody types a price: the buyer gives an address, and the network reads it.</p>
        </div>
      </section>

      <section aria-labelledby="money">
        <Aisle n="03" id="money" title="Where the money goes" sub="The contract always holds exactly every shop's bond plus every address's claim-fee credit." />
        <table className="w-full border-2 border-ink text-left text-sm">
          <caption className="sr-only">What moves at each call</caption>
          <tbody>
            {MONEY.map(([k, v]) => (
              <tr key={k} className="border-t border-line first:border-t-0">
                <th scope="row" className="mono w-[36%] bg-shelf px-3 py-2 align-top text-[12.5px] font-bold">
                  {k}
                </th>
                <td className="px-3 py-2">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="who">
        <Aisle n="04" id="who" title="Who may do what" />
        <ul className="grid gap-2 md:grid-cols-2">
          {WHO.map(([k, v]) => (
            <li key={k} className="card-soft p-3 text-sm">
              <p className="mono text-[12.5px] font-bold break-words">{k}</p>
              <p className="mt-0.5 text-ink-2">{v}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="limits">
        <Aisle n="05" id="limits" title="The limits, stated plainly" />
        <ul className="grid max-w-[80ch] list-disc gap-2 pl-5 text-[14.5px] text-ink-2">
          <li>The page must read the same for every validator at the time of the claim. A page that changes between fetches, shows a different price per visitor, or hides its price behind a script or a login will not settle, and nothing is stored.</li>
          <li>Whoever owns the pages under a prefix owns the evidence. A prefix should name a directory only that competitor can write to; the demo&apos;s {DEMO_PAGE_COUNT} pages are pinned to one commit.</li>
          <li>Prices are in GEN, as a plain number on the page. A page with more than one price, or none, is unclear.</li>
          <li>A page is judged whole or not at all: under {MIN_PAGE} or over {MAX_PAGE} characters of text, it stores nothing and the claim may be made again.</li>
          <li>A refund is our price minus theirs, at most the whole price, and only from the bond reserved for that order.</li>
          <li>{MAX_CLAIMS} judged claims per order; the same page again only a day after its last judgment, so a later price drop can still be claimed.</li>
          <li>Someone has to call release after the window; anyone may.</li>
          <li>
            A match is judged on {MATCH_ON.join(", ")}. The spec names the item, never a price: no $ sign, and none of {MONEY_WORDS.join(", ")} as a word. Specs are {MIN_SPEC} to {MAX_SPEC}{" "}
            characters; up to {MAX_PREFIXES} prefixes of at most {MAX_PREFIX} characters; a page address at most {MAX_URL}.
          </li>
        </ul>
      </section>

      <section aria-labelledby="rules">
        <Aisle n="06" id="rules" title="rules(), read live" sub="The contract's own words, as it publishes them. Nothing on this page is allowed to say more." />
        {!hasContract() ? (
          <p className="text-ink-3">The contract is not deployed yet, so there is nothing to read.</p>
        ) : rules.error ? (
          <ReadError detail={rules.error} onRetry={rules.retry} />
        ) : !rules.data ? (
          <Placeholder lines={6} />
        ) : (
          <pre className="mono max-h-[520px] overflow-auto border-2 border-ink bg-receipt p-4 text-[12px] leading-relaxed break-words whitespace-pre-wrap">{JSON.stringify(rules.data, null, 2)}</pre>
        )}
        {rules.data && (
          <ShelfButton size="sm" className="mt-3" onClick={() => rules.retry()}>
            Read again
          </ShelfButton>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <ShelfLink href="/shop" variant="tag" icon={<IconArrowRight />}>
          Try it on the demo shop
        </ShelfLink>
        <ShelfLink href="/merchant">Open a shop</ShelfLink>
      </div>
    </div>
  );
}
