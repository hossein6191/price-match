"use client";

// How it works: the six askings word for word (the stock question among them), how the answers
// combine into the one stored value, the appeal window and its second reading, price protection, why
// reading the live web makes this a job for GenLayer, where the money goes, who may do what, the
// limits stated plainly, and the contract's own rules() read live.

import { Aisle } from "@/components/bits";
import { ShelfButton, ShelfLink } from "@/components/button";
import { IconArrowRight } from "@/components/icons";
import { Placeholder, ReadError } from "@/components/read-state";
import { useRead } from "@/components/use-read";
import { hasContract, readRules } from "@/lib/chain";
import { DEMO_PAGE_COUNT } from "@/lib/demo-shop";
import {
  APPEAL_WINDOW,
  ARGUING,
  MATCH_ON,
  MAX_CLAIMS,
  MAX_REASON,
  MAX_REPRICES,
  MIN_REASON,
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
  QUESTION_STOCK,
  READING,
} from "@/lib/rules";

const ASKINGS = [
  { n: "1", order: "SPEC, then PAGE", q: QUESTION_SAME },
  { n: "2", order: "PAGE, then SPEC", q: QUESTION_DIFFERENT },
  { n: "3", order: "SPEC, then PAGE", q: QUESTION_STOCK, when: "asked only when 1 and 2 agree it is the same product" },
  { n: "4", order: "PAGE, then SPEC", q: QUESTION_STOCK, when: "the same stock question, the other way round" },
  { n: "5", order: "SPEC, then PAGE", q: QUESTION_PRICE, when: "asked only when 3 and 4 both say it is available now" },
  { n: "6", order: "PAGE, then SPEC", q: QUESTION_PRICE, when: "the same price question, the other way round" },
];

const MONEY = [
  ["fund", "The owner's GEN joins the shop's bond."],
  ["buy", "The buyer pays exactly the price; it goes to the shop in the same transaction, and the same amount of the shop's bond is reserved for the order."],
  ["claim", "0.01 GEN of the buyer's credit is staked and held. Nothing else moves: the finding is pending for 15 minutes."],
  ["appeal", "0.05 GEN of the appellant's credit is staked. Overturned: it stays with the appellant. Upheld: it goes to the other side's credit. The claim settles in the same call."],
  ["settle, matched", "Any price drop owed is paid first; then what the order stands at minus their price goes to the buyer from the reserved bond, and the order closes."],
  ["settle, not in stock, not cheaper or unclear", "The 0.01 GEN fee goes back to the buyer's credit. Nothing else moves."],
  ["settle, different", "The 0.01 GEN fee goes to the shop."],
  ["reprice", "Nothing moves; the new price is recorded in the product's history for good."],
  ["claim_drop", "What the order stands at minus the lowest price recorded in its window goes to the buyer from the order's reservation, even if the price has gone back up."],
  ["release", "Any price drop still owed goes to the buyer first; the rest of the reservation goes back to the shop's free bond."],
  ["withdraw_bond", "Free bond goes back to the owner; reserved bond never does."],
  ["deposit / withdraw", "Credit for claim fees and appeal bonds in and out, the sender's own only."],
  ["a refused payment", "Everything sent goes back to the sender, in the same transaction."],
];

const WHO = [
  ["open_shop(name, competitors)", "anyone; the sender is the owner; the prefixes are fixed for good"],
  ["fund(shop), payable", "the owner"],
  ["withdraw_bond(shop, amount)", "the owner, up to the free bond"],
  ["list_product(shop, title, spec, price, window)", "the owner, at most 20 products per shop"],
  ["reprice(product, price)", `the owner, at most ${MAX_REPRICES} times per product; then a new product`],
  ["buy(product), payable", "anyone but the owner, with exactly the price, while the free bond covers it"],
  ["deposit(), payable · withdraw()", "anyone, for their own credit"],
  ["claim(order, url)", "the buyer, inside the window, no claim pending, a page below an accepted prefix, at most two judged claims, the same page again only a day later"],
  ["appeal(claim, reason)", "the side the finding went against (the shop on matched, the buyer on anything else), once, inside the 15-minute appeal window"],
  ["settle(claim)", "the side that may appeal at any time, which waives the appeal; anyone once the appeal window has closed"],
  ["claim_drop(order)", "the buyer, while the order is open and no claim is pending, when the shop recorded a lower price during its window"],
  ["release(order)", "anyone, after the window, while the order is open and no claim is pending"],
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
          validator opens that page on the live web and asks the same questions about it: the same product? available to buy now? at what price? The contract stores the one
          value they agree on exactly and compares it with our price. The finding waits {APPEAL_WINDOW / 60} minutes, so the side it went against can ask once for a second
          reading; then the difference is paid from the bond. And if the shop itself lowers its price during your window, that drop is yours too.
        </p>
      </div>

      <section aria-labelledby="askings">
        <Aisle
          n="01"
          id="askings"
          title="The six askings"
          sub="Asked by every validator about the same fetched page, inside one consensus block, in the contract's own words. The model sees the spec and the page; never our price, an address, a name or a date."
        />
        <ol className="grid gap-3 md:grid-cols-2">
          {ASKINGS.map((a) => (
            <li key={a.n} className="card-soft flex gap-3 p-4">
              <span className="display grid size-10 shrink-0 place-items-center bg-tag text-[24px] font-extrabold">{a.n}</span>
              <div className="min-w-0">
                <p className="kicker text-ink-3">
                  Blocks: {a.order}
                  {a.when ? ` · ${a.when}` : ""}
                </p>
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
              The stock question is asked only about a page both framings call the same product, once each way round: yes twice is <span className="mono">in_stock</span>,
              no twice is <span className="mono">out_of_stock</span>, and anything else is <span className="mono">unclear</span>. A page that shows the item sold out or on
              pre-order only is the same product, but <strong>not in stock</strong>: a lower price you cannot buy now matches nothing, and the claim fee comes back.
            </p>
            <p className="mt-2">
              The price is asked only about a page that is the same product and in stock. Each answer is read as a plain decimal with at most 18 places and turned into an
              integer of atto: <span className="mono">1.80</span>, <span className="mono">1.8</span> and <span className="mono">01.80</span> are the same price, while{" "}
              <span className="mono">1,80</span>, <span className="mono">$1.80</span> and <span className="mono">unclear</span> are none. It is kept only when both orders give
              the same integer.
            </p>
            <p className="mt-2">
              The stored value is{" "}
              <span className="mono text-ink break-words">{'{"product": same | different | unclear, "stock": in_stock | out_of_stock | unclear | "", "price": "<atto>" or "", "page": "<sha256>"}'}</span>
              . Every validator re-derives it and compares it by exact equality, the hash of the page text included. There is no tolerance for a disagreement to hide in: a model that says yes to everything lands as unclear, and a position
              bias shows up as a disagreement.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="appeal">
        <Aisle n="03" id="appeal" title="The appeal: one second reading" />
        <div className="grid gap-5 md:grid-cols-2 text-[14.5px] text-ink-2">
          <div>
            <p>
              A finding moves no money at first. For {APPEAL_WINDOW / 60} minutes it is <strong>pending</strong>: a matched refund waits in the order&apos;s reservation and the
              claim fee is held. The side the finding went against may appeal it once: the shop on a match, the buyer on anything else.
            </p>
            <p className="mt-2">
              The appellant writes a reason ({MIN_REASON} to {MAX_REASON} characters) and stakes 0.05 GEN of credit. Every validator reads the same page again, and the page must
              hash exactly as it did when it was judged; if it changed, nothing is stored and the first finding stands. The reason goes in as one party&apos;s argument, fenced
              as untrusted.
            </p>
          </div>
          <div>
            <p>
              If the second reading is better for the appellant it replaces the first, the money follows it and the bond comes back (<strong>overturned</strong>). Otherwise the
              first reading stands and the bond goes to the other side&apos;s credit (<strong>upheld</strong>). Either way the claim settles in that call, both readings stay on
              the receipt, and an appeal is never appealed.
            </p>
            <p className="mt-2">
              Nobody appeals? Once the window closes anyone may settle the claim, so a finding never waits on one account. The side that may appeal can also settle at once,
              which waives its appeal.
            </p>
          </div>
        </div>
        <p className="mt-3 max-w-[78ch] text-[13.5px] text-ink-3">Before the blocks of a second reading: {ARGUING}</p>
      </section>

      <section aria-labelledby="protection">
        <Aisle n="04" id="protection" title="Price protection" />
        <div className="grid max-w-[80ch] gap-2 text-[14.5px] text-ink-2">
          <p>
            Every price change the shop makes is recorded on the product, up to {MAX_REPRICES} of them; then the shop lists a new product. An open order is owed the lowest price
            the shop recorded after its purchase and before its window ended, even if the price went back up since.
          </p>
          <p>
            The buyer takes it with claim_drop: no page is read and no model runs, it is the shop&apos;s own history. It is paid from the order&apos;s own reservation, and the
            order then stands at that price, so a later claim compares a competitor&apos;s page with the lower price. A settlement or a release pays a drop still owed first,
            so it can never be cut off.
          </p>
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
        <Aisle n="05" id="money" title="Where the money goes" sub="The contract always holds exactly every shop's bond, every address's credit and every held claim fee." />
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
        <Aisle n="06" id="who" title="Who may do what" />
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
        <Aisle n="07" id="limits" title="The limits, stated plainly" />
        <ul className="grid max-w-[80ch] list-disc gap-2 pl-5 text-[14.5px] text-ink-2">
          <li>The page must read the same for every validator at the time of the claim. A page that changes between fetches, shows a different price per visitor, or hides its price behind a script or a login will not settle, and nothing is stored.</li>
          <li>
            Whoever owns the pages under a prefix owns the evidence. A prefix should name a directory only that competitor can write to; the demo&apos;s {DEMO_PAGE_COUNT} pages
            are pinned to one commit.
          </li>
          <li>Prices are in GEN, as a plain number on the page. A page with more than one price, or none, is unclear.</li>
          <li>Stock is read from what the page says. A page that says nothing clear about buying it now is unclear, and nothing moves.</li>
          <li>A page is judged whole or not at all: under {MIN_PAGE} or over {MAX_PAGE} characters of text, it stores nothing and the claim may be made again.</li>
          <li>A refund is what the order stands at minus their price, at most the whole price, and only from the bond reserved for that order.</li>
          <li>{MAX_CLAIMS} judged claims per order, one pending at a time; the same page again only a day after its last judgment, so a later price drop can still be claimed.</li>
          <li>An appeal re-reads the same text: if the competitor edits the page within the {APPEAL_WINDOW / 60} minutes, the appeal stores nothing and the first finding stands.</li>
          <li>Someone has to settle a claim nobody appealed, and release an order after its window; anyone may.</li>
          <li>
            A match is judged on {MATCH_ON.join(", ")}. The spec names the item, never a price: no $ sign, and none of {MONEY_WORDS.join(", ")} as a word. Specs are {MIN_SPEC} to {MAX_SPEC}{" "}
            characters; up to {MAX_PREFIXES} prefixes of at most {MAX_PREFIX} characters; a page address at most {MAX_URL}.
          </li>
        </ul>
      </section>

      <section aria-labelledby="rules">
        <Aisle n="08" id="rules" title="rules(), read live" sub="The contract's own words, as it publishes them. Nothing on this page is allowed to say more." />
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
