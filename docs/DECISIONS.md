# Decisions

Why each rule of `contracts/price_match.py` (contract version 2) is the way it
is, and what is verified and what is not.

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
members' offer, so the demonstration does not rest on it: its nine `unclear`
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

**Nothing is written before the round.** Every check in `claim` and in
`appeal` comes first, and the first write follows the agreed value. A static
test holds that order for both.

## 4. The money is already there

**The bond is reserved per order, at the whole price.** A refund is our price
minus theirs, so it can never exceed our price. Reserving exactly that much
per order, and taking a purchase only while the free bond covers it, means a
shop can never owe more than it holds. The reservation is released when a
match settles and pays, when the second judged claim settles without one, or
when anyone calls `release` after the window. A price drop takes its part of
it. `withdraw_bond` reaches only the free part.

**The sale goes to the shop at once.** Holding the sale price would make the
shop wait for every window to end and would add a second pot of money to
track. The bond already stands behind the guarantee, so the sale need not.

**The claim fee is staked from credit.** A payable call must never run the
model and must never raise after taking value, but a claim must cost
something, or a buyer could send page after page to the network for
nothing. So the buyer deposits credit beforehand, and a claim stakes 0.01 GEN
of it, held until the claim settles. It comes back on matched, not in stock,
not cheaper and unclear, and goes to the shop on different: pointing at
another product is the one outcome the buyer could have avoided by reading the
page.

**Two judged claims per order, and the same page again only after a day.** A
buyer who pointed at the wrong page has a second chance. A page judged for an
order can be judged again for it `REJUDGE_GAP` (86,400) seconds after its last
judgment, read from the claim's own `at`. A competitor that lowers its price
on that same page later in the window can still be claimed, which a
lowest-price guarantee owes the buyer; an instant re-roll of a page that just
came back `unclear` cannot. A claim that does not settle is not counted.

## 5. Milestone v1: in stock, the appeal, price protection

**"Out of stock" is judged, not claimed.** It is the shop's favourite excuse,
so it becomes a question the network answers about the page, not a reason the
shop gives. It is one condition ("available to buy now: in stock, and not a
pre-order, not sold out and not out of stock"), asked in both orders, and the
contract combines it: yes twice is `in_stock`, no twice is `out_of_stock`, and
anything else is `unclear`. No asking carries two conditions. Same product and
in stock are two separate agreements, and the contract alone requires both
before it asks the price. The stock question is asked only about the same
product, and the price only about one in stock, so a page whose stock or
product does not matter adds no second way for honest validators to disagree.
A sold-out page is `not_in_stock`, a separate outcome, so the record says why
nothing was paid. Its fee comes back, because stock can change between the
moment the buyer looked and the moment of the claim. "Different" is the one
outcome the buyer could have avoided by reading.

**The page's hash is part of the agreed value.** Every claim stores the sha256
of the text that was judged, and validators compare it like every other field.
That makes "the page must read the same for every validator" exact: one byte of
difference is a disagreement, and the round does not settle. It is what makes
an appeal fair. A second reading of a page that has changed since is a reading
of another page, so an appeal judges the same text or nothing.

**Pending, so that nothing is clawed back.** An appeal that can reverse a
refund already sent would need the buyer to pay it back, and nothing can make
them. So no judged claim moves money until it settles. A matched refund stays
in the order's reservation, which is already held for exactly this. The claim
fee is held by the contract. The order takes no new claim and no price drop
while a claim is pending. Settlement has three doors: the appeal is judged; the
side that may appeal settles early, which waives the appeal; or anyone settles
after `APPEAL_WINDOW` (900 seconds). None of them waits on one account longer
than the window, and `release` asks for the pending claim to be settled first,
which anyone can do by then.

**Who may appeal is the side the finding went against.** That is the shop on
a match and the buyer on everything else, fixed on the claim when it is judged
(`side`). The other side has nothing to appeal. Without a bond an appeal would
be a free second roll, so it stakes `APPEAL_BOND` (0.05 GEN, five claim fees)
from credit, a payable-free path like the claim fee.

**What "overturned" means is one integer.** Every reading is worth a number to
the buyer: the refund, plus the claim fee unless it goes to the shop. The
appeal overturns when the second reading moves that number toward the
appellant: up for a buyer, down for a shop. A smaller refund on a shop's
appeal of a match is an overturn too, and the smaller refund is paid. A second
reading that is equal or worse for the appellant is recorded and does not
replace the first, and the bond goes to the other side. So an appeal can only
move money toward the appellant, at the price of the bond, and the appellant
cannot be punished beyond the bond for asking. The comparison is computed by
the contract from two agreed values. No tolerance sits in a consensus
comparison.

**Once, and settled in the same call.** The appeal is judged and settled in
one transaction, so its claim is never pending again and cannot be appealed
again. Both readings stay on the claim row (`product`, `stock`, `price`,
`outcome` and `appeal_*`), with the reason as written, where the bond went and
how it settled.

**The reason is fenced as one party's argument.** The reason is the only text
the appellant writes that a model reads. It sits in its own `ARGUMENT` block,
fenced and tagged like the others, after the spec and the page, and a notice
before the blocks says what it is: one party's argument, untrusted, not
evidence, and the page alone is judged. It is not filtered for money words the
way a spec is. A buyer has to be able to say "the price line reads 1.80", and
the reason goes to every node, so it sways all of them alike or none.
Both orders and exact equality still apply.

**Price protection is not a model question.** A shop's own price is on chain,
so `claim_drop` is arithmetic: what the order stands at (`price - dropped`)
minus the product's current price, paid from the order's own reservation, in
O(1). The reservation then equals what the order stands at, so a competitor
match afterwards is measured against the lower price, and a shop can never
owe more than it reserved. A drop waits while a claim is pending, because the
pending refund was measured against the price before the drop.

## 6. Every party has a way out

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
| a claim while another is pending | the buyer waives its appeal with `settle`, then claims |
| an appeal with too little credit | `deposit()`, then appeal inside the window |
| an early settlement by the wrong side | anyone settles once the appeal window has closed |
| a price drop while a claim is pending | settle the claim, then `claim_drop` |
| a release while a claim is pending | `settle`, which anyone may once its window has closed, then `release` |

Each is walked as a journey in `TestRoutesOut`.

## What is verified, and what is not

Verified offline: every rule and refusal above; each of the five outcomes and
its money; the appeal both ways for each side (upheld, overturned, a smaller
match, a worse second reading that does not replace the first), its window,
its bond, its single use and a changed page that is never judged; the three
doors of settlement; price protection with repeated drops and a competitor
match after a drop; reservation accounting after every step of 120 seeded
random journeys (the contract holds every bond, every credit and every held
fee, reservations never exceed a bond, each order and claim in exactly one
state); a failed fetch, a failed model call, a short page and a long page each
storing nothing; validators whose pages differ, by a price or by one byte,
disagreeing; the two orders disagreeing landing as `unclear`, for the product,
the stock and the price; every one of the forty-nine demo pages coming to its
outcome with a scripted reader; the price normalisation table; static rules
over the parsed source (sender gates on all nine gated writes, payables, loops,
the prompt boundary including the argument block, the closure, the
comparison, no float, transfers, one exit per order and one settlement per
claim); and 312 mutants, none surviving.

Not verified offline: how real models on Studio read the demo pages, the
stock lines included, and how they take an appellant's reason. The scripted
reader in the tests is a stand-in, and the "persuaded" network in the appeal
tests is one written to turn its answers around. The on-chain run of contract
version 2 is the evidence for that, and its record goes in the README once it
has run.
