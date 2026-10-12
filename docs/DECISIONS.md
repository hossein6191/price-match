# Decisions

Why each rule of `contracts/price_match.py` is the way it is, and what is
verified and what is not.

## 1. The evidence is a live page, fetched by every validator

**The buyer gives an address, never a screenshot and never a price.** A claim
built on something the buyer uploads is a claim built on what the buyer chose
to show. A claim built on a number the buyer types is a claim the shop has to
check by hand. Here each validator fetches the page itself, inside the
consensus block, and reads it with its own model. What the network agrees on
is what the page said to all of them at the time of the claim.

**The shop names the competitors, in advance and for good.** A claim may only
point at a page below one of the shop's one to five prefixes. Without that,
the buyer could publish a cheaper page anywhere and claim with it. The
prefixes are set at `open_shop` and never change, so the guarantee a buyer
reads before buying is the guarantee that applies. The rule that remains is
stated in the README: whoever can write under a prefix owns the evidence, so a
prefix should name a directory only that competitor controls.

**One spelling per page.** An address is https, a lowercase host with a dot,
then letters, digits and `- . _ ~ /` only: no query, fragment, port, percent
sign, empty segment, `.` or `..`. Without that a path could climb out of its
prefix (`/northgate/../elsewhere/`), and the same page could be judged again
at once under a second spelling, past the one-day wait between judgments.

**The prefix limit is 160 characters, not 120.** A prefix pinned to a commit
on `raw.githubusercontent.com` (`https://raw.githubusercontent.com/<owner>/
price-match/<40-character commit>/competitors/corner-hardware/`) is 121 to
127 characters, so a 120-character limit would have refused the demonstration
itself. A page address stays at 200.

## 2. Two questions, both orders, and the mirror

**The network is asked what the page says, never who should be paid.** Same
product, and what price: both are facts about the page. The contract alone
compares the agreed price with ours, and the model never sees our price, so
it cannot be anchored by it.

**The spec names the item, never a price.** The spec is the one shop text a
model reads, and it sits beside the page in the price askings too. A shop
that wrote "our price 2.40 GEN" into it would put a second amount next to the
page's own, and a model that anchored on it could turn a cheaper page into
`unclear`, which pays nothing. So `list_product` refuses a spec with a `$`
sign, or with any of `gen`, `atto`, `price`, `prices`, `priced`, `pricing`,
`cost`, `costs`, `rrp` and `msrp` standing as a word, in any case, after
splitting on every sign. A word that only contains one (`generation`,
`gentle`) is fine. A bare number is allowed, because it cannot be told from a
capacity or a size; that is the one gap, and the buyer reads the spec before
buying.

**One closed list of what makes a product the same.** Brand, model, capacity
or size, colour or finish, and condition new, in both product askings, the
README and `rules()`, and every other detail is to be ignored. A spec may say
more, but only those five count. Leaving colour out while the demo specs name
one would have left a matte black kettle against a brushed steel spec to each
model's own reading, and an open list ("anything the spec says") would do the
same for every extra line a shop writes.

**Both orders, inside one block.** Every node builds the prompt the same way,
so a position bias is invisible to consensus unless each node also asks the
other way round. Asking 1 puts the SPEC first and asking 2 the PAGE first;
the two price askings do the same.

**The second product asking is the mirror of the first.** Asking the
same-product question twice would let a model that says yes to everything
call a refurbished unit "the same" twice over. Asking 2 asks whether it is a
different product, so the honest answers are opposite: yes then no is `same`,
no then yes is `different`, and yes then yes is `unclear`.

**The price is asked only about the same product.** The stored price is
dropped beside any other word anyway, so asking it would only add a second
way for honest validators to disagree about a page whose price does not
matter.

**A price is an integer, agreed exactly.** Each answer is read as a plain
decimal with at most 18 places and turned into atto, so `1.80`, `1.8` and
`01.80` agree, and `1,80`, `$1.80` or `1.80 GEN` are not prices. Both orders
must give the same integer. The stored value is
`{"product": ..., "price": ...}`, and validators compare it by exact equality.
There is no tolerance: a validator that read 1.70 where the leader read 1.80
disagrees, and the claim does not settle.

**A page with two prices, or none, is unclear by the question itself.** The
question tells the model not to choose between a shelf price and a card,
trade or till price. That is a rule a model may still apply differently, since
one model can read the shelf price as the current one and the other as a
members' offer, so the demonstration does not rest on it: its three `unclear`
pages show no number beside the price at all, which every reader reads the
same way.

## 3. A failure is never a verdict

**The leader raises; no validator agrees.** A page that cannot be fetched, a
model call that fails, a page too short to be a product page, and a page too
long to judge whole all raise inside the leader, each with its class
(`[TRANSIENT]`, `[LLM_ERROR]`, `[EXPECTED]`). `_agrees` never agrees with a
leader that raised, so the round does not settle and nothing is written. The
buyer's credit is untouched and the claim can be made again.

**Judged whole or not at all.** A page over 6,000 characters is refused, not
cut. Cutting would judge the first part of a page and pay on it, while a
second price or the word "refurbished" might sit in the part nobody read.

**Nothing is written before the round.** Every check in `claim` comes first,
and the first write follows the agreed value. A static test holds that order.

## 4. The money is already there

**The bond is reserved per order, at the whole price.** A refund is our price
minus theirs, so it can never exceed our price. Reserving exactly that much
per order, and taking a purchase only while the free bond covers it, means a
shop can never owe more than it holds. The reservation is released when a
match pays, when the second judged claim settles without one, or when anyone
calls `release` after the window. `withdraw_bond` reaches only the free part.

**The sale goes to the shop at once.** Holding the sale price would make the
shop wait for every window to end and would add a second pot of money to
track. The bond already stands behind the guarantee, so the sale need not.

**The claim fee is staked from credit.** A payable call must never run the
model and must never raise after taking value, but a claim must cost
something, or a buyer could send page after page to the network for
nothing. So the buyer deposits credit beforehand, and a claim stakes 0.01 GEN
of it. It comes back on matched, not cheaper and unclear, and goes to the
shop on different: pointing at another product is the one outcome the buyer
could have avoided by reading the page.

**Two judged claims per order, and the same page again only after a day.** A
buyer who pointed at the wrong page has a second chance. A page judged for an
order can be judged again for it `REJUDGE_GAP` (86,400) seconds after its last
judgment, read from the claim's own `at`. A competitor that lowers its price
on that same page later in the window can still be claimed, which a
lowest-price guarantee owes the buyer; an instant re-roll of a page that just
came back `unclear` cannot. A claim that does not settle is not counted.

## 5. Every party has a way out

| refused | the way out |
|---|---|
| a purchase the bond does not cover | the shop funds, or a window ends and is released |
| a purchase with the wrong amount | the same purchase with the price; the amount came back |
| a claim with no credit | `deposit()` and claim |
| an address outside the prefixes | a page below one of them |
| a page that could not be read | claim again; nothing was stored |
| a claim on a page judged less than a day ago | another page now, or the same page a day after its last judgment |
| a withdrawal of reserved bond | the free part now, the rest once the windows end |
| a twenty-first product | another shop |
| a second shop with the same name | another name |

Each is walked as a journey in `TestRoutesOut`.

## What is verified, and what is not

Verified offline: every rule and refusal above; each of the four outcomes and
its money; reservation accounting after every step of forty seeded random
journeys (the contract holds every bond plus every credit, reservations never
exceed a bond, each order in exactly one state); a failed fetch, a failed
model call, a short page and a long page each storing nothing; validators
whose pages differ disagreeing; the two orders disagreeing landing as
`unclear`; every one of the fifteen demo pages coming to its outcome with a
scripted reader; the price normalisation table; static rules over the parsed
source (sender gates, payables, loops, the prompt boundary, the closure, the
comparison, no float, transfers); and 222 mutants, none surviving.

Not verified offline: how real models on Studio read the demo pages. The
scripted reader in the tests is a stand-in. The on-chain run is the evidence
for that, and its record goes in the README once it has run.
