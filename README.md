# Price Match

A lowest-price guarantee that enforces itself. The validators open the
competitor's page on the live web, agree it is the same product, that it is in
stock and what it costs, and the difference comes back from the shop's bond.

## Milestone v1 — what changed

Contract version 2 answers the three ways a shop still gets out of a
lowest-price promise: "it's out of stock", "your reading was wrong", and
"we lowered our own price the day after you bought".

- **In stock, judged.** Inside the same consensus block, every validator now
  also asks one question, in both orders: does the page show the item
  available to buy now (in stock, not a pre-order, not sold out)? A match
  needs the same product and in stock, both agreed. A sold-out or pre-order
  page is its own outcome, `not_in_stock`, and moves nothing. Every claim
  stores the sha256 of the page text the validators judged.
- **One bonded appeal per judged claim.** Every judged claim is pending for 15
  minutes, and while it is pending no money moves. A matched refund waits in
  the order's reservation, and the claim fee is held. The side the finding
  went against (the shop on a match, the buyer on anything else) may appeal
  once, staking 0.05 GEN of credit with a short reason. The same questions run
  again in one block about the same text, with the reason fenced as one
  party's argument. If the second reading is better for the appellant, it
  replaces the first and the bond comes back. If not, the first reading stands
  and the bond goes to the other side. Both readings stay on the record. No
  appeal of an appeal is possible, and once the 15 minutes have passed, anyone
  may settle, so no one can hold a claim open.
- **Price protection, in code.** The shop may `reprice` a product, and every
  change goes into the product's price history, up to 16 changes. An open
  order may `claim_drop` the difference between what it paid and the lowest
  price recorded during its window, from its own reservation, in the same
  transaction. This holds even if the price has gone back up since. No model
  runs, because the evidence is the shop's own price.

Four new demo pages show the same kettle and the same earbuds for less, but
sold out or on pre-order only. Every other demo page now says "In stock" in
those words, so the stock question has a plain answer. Tests, mutations, the
on-chain script and the docs follow the new version (see "Running it"). The
site in `web/` still follows contract version 1 and is updated separately.

## The problem

"Found it cheaper? We'll match it." Shops print it on receipts and shelf
labels, and almost nobody collects. To claim, the buyer has to find the
cheaper offer, screenshot it, send it in, and then wait while somebody at the
shop decides. That person works for the shop that would pay. The answer is
usually that the other item is "a different model", "a bundle", "not in
stock" or "not a like-for-like listing". The buyer cannot check the decision
and cannot appeal it.

The question underneath is always the same two questions about a web page
somebody else wrote: is it the same product, and what does it cost?

## What it is

A shop **opens** with a name and the addresses of the competitor pages it
promises to match: one to five URL prefixes, such as
`https://northgate.example/products/`. They are fixed for good, so every buyer
sees them before buying. The shop **funds** a guarantee bond and **lists**
products. Each product has a price, a guarantee window, and a **spec**: the
exact identity a match must have. A match is judged on five things and nothing
else: brand, model, capacity or size, colour or finish, and condition new. A
spec names the item, never a price: one with a `$` sign, or with a money word
such as `gen`, `price` or `cost` standing as a word, is refused when the
product is listed.

A buyer **buys** with exactly the price. The sale goes to the shop in the same
transaction. The same amount of the shop's bond is **reserved** for the order,
because the most a match can ever give back is the whole price. A purchase is
taken only while the shop's free bond covers it.

During the window the buyer **claims** with the address of a page below one of
the shop's prefixes. In one transaction every validator fetches that page
itself, and the network agrees on three things about it: is it the same
product, is it available to buy now, and what does it cost. The finding is one
of five:

- **matched**: the page offers the same product, in stock, for less. The
  difference is due to the buyer from the reserved bond.
- **not in stock**: the same product, but sold out or on pre-order only.
  Nothing moves.
- **not cheaper**: the same product in stock, at our price or more. Nothing
  moves.
- **different**: another product, such as another model, another size or a
  refurbished unit. The buyer's 0.01 GEN claim fee goes to the shop.
- **unclear**: the network could not settle a question, for example a page
  that shows no price. Nothing moves.

A judged claim is **pending** for 15 minutes, and until it settles no money
moves. The side the finding went against may **appeal** once in that time (see
below). The claim then **settles**: when its appeal is judged, when the side
that could appeal settles it early (which waives the appeal), or when anyone
calls `settle` after the 15 minutes. A match pays the buyer from the order's
reservation and closes the order. On "different" the fee goes to the shop.
Anything else returns the fee to the buyer's credit. Each order has one
pending claim at a time.

A claim stakes a 0.01 GEN fee from the buyer's claim-fee credit, which the
buyer **deposits** beforehand and can **withdraw** at any time. The fee is a
spam cost: it comes back on every outcome except "different". An order takes
at most two judged claims. The same page can be judged again for an order only
a day after its last judgment, so a price that drops later in the window can
still be claimed, but a page cannot be re-rolled at once.

The shop may **reprice** a product up to 16 times. Every change is recorded
with its time in the product's price history. When a price recorded after an
order's purchase and before its window ended is below what the order paid,
its buyer may **claim_drop** the difference, even if the price has gone back up
since. It is paid from that order's own reservation, which then stands at that
lowest price, so a second `claim_drop` pays only a further drop. A later
competitor match is measured against the lower price. Any drop still owed is
paid automatically when a claim settles or the order is released. When the
window ends, anyone may **release** the order: a drop still owed goes to the
buyer, and the rest of the reservation goes back to the shop's free bond. The
shop can **withdraw** free bond at any time.

## How consensus is used

`claim` runs one consensus block. Inside it every node fetches the page with
`gl.nondet.web.render(url, mode="text")` and asks the model about the same
fetched text, up to six times. Every question has one condition, and the
contract combines the answers in code:

| asking | blocks, in order | question |
|---|---|---|
| 1 | SPEC, PAGE | Is the item offered on this page the same product as the specification: same brand, model, capacity or size, colour or finish, and condition (new)? Ignore price, shop and every other detail. |
| 2 | PAGE, SPEC | Is the item offered on this page a different product from the specification: another brand, model, capacity or size, colour or finish, or a condition other than new? Ignore price, shop and every other detail. |
| 3 | SPEC, PAGE | Does the page show the item available to buy now: in stock, and not a pre-order, not sold out and not out of stock? Ignore price, shop and every other detail. |
| 4 | PAGE, SPEC | the same stock question |
| 5 | SPEC, PAGE | What is the page's current price for that item, in GEN, as a plain decimal number? If the page shows more than one price or none, answer unclear. |
| 6 | PAGE, SPEC | the same price question |

The contract turns the answers into the value it stores:

| askings 1 and 2 | product |
|---|---|
| yes, then no | `same` |
| no, then yes | `different` |
| anything else, including an answer it cannot read | `unclear` |

| askings 3 and 4, asked only about the same product | stock |
|---|---|
| yes, and yes | `in_stock` |
| no, and no | `out_of_stock` |
| anything else | `unclear` |

The price is asked only about a page that both framings call the same product
and both stock askings call in stock. Each
price answer is read as a plain decimal with at most 18 places and turned into
an integer of atto: `1.80`, `1.8` and `01.80` all become
`1800000000000000000`, while `1,80`, `$1.80`, `1.80 GEN`,
`1.800000000000000000001` and `unclear` are not prices. The price is kept only
when both orders give the same integer; otherwise it is empty.

The stored value is `{"product": "same" | "different" | "unclear", "stock":
"in_stock" | "out_of_stock" | "unclear" | "", "price": "<atto>" or "", "page":
"<sha256 of the page text>"}`. Every validator fetches the page and asks every
asking itself, then compares that value with the leader's by **exact
equality**, the page's hash included. There is no tolerance for a disagreement
to hide in. Both presentation orders are inside the one block, so a position
bias shows up as a disagreement, and the second product asking is the mirror
of the first, so a model that says yes to everything lands as `unclear`.

| product | stock | price against ours | outcome |
|---|---|---|---|
| `different` | | | `different` |
| `unclear` | | | `unclear` |
| `same` | `out_of_stock` | | `not_in_stock` |
| `same` | `unclear` | | `unclear` |
| `same` | `in_stock` | none agreed | `unclear` |
| `same` | `in_stock` | below | `matched` |
| `same` | `in_stock` | equal or above | `not_cheaper` |

**The appeal** runs the same block again through `appeal(claim, reason)`. The
same six askings in the same two orders are compared by exact equality. Two
things differ. The prompt adds a notice before the blocks and an `ARGUMENT`
block after them, holding the appellant's reason. The notice says that one
party with money at stake wrote the reason, that it is untrusted and not
evidence, and that the PAGE alone is judged. And every node checks that the
page it fetched hashes to the value stored with the claim. A page that has
changed since is never judged on appeal: the leader raises, nothing is stored,
and the first reading stands when the window closes. The contract then compares
the two readings by one number, what each is worth to the buyer (the refund,
plus the claim fee unless it goes to the shop). The appeal overturns only when
the second reading moves that number toward the appellant.

The contract alone compares the agreed price with ours. **The model never sees
our price from the contract**, only the spec, the page and, on an appeal, the
appellant's reason. No amount is passed into the round,
and a spec that names a price is refused at the door: a `$` sign, or any of
`gen`, `atto`, `price`, `prices`, `priced`, `pricing`, `cost`, `costs`, `rrp`
and `msrp` as a word, in any case. A bare number is allowed, because it cannot
be told from a capacity or a size; the buyer reads the spec before buying. The
model is asked what the page says, never whether the buyer should be paid.

Failures store nothing. A page that cannot be fetched (`[TRANSIENT]`), reads
under 40 characters, or reads over 6,000 characters is never judged; a failed
model call is `[LLM_ERROR]`. The leader raises, no validator ever agrees with
a leader that raised, and the round does not settle. The buyer's credit is
untouched and the claim can be made again. Every rule about the buyer, the
order, the window, the address and the credit (`[EXPECTED]`) is checked before
the round starts, so an address outside the prefixes is refused before
anything is fetched.

The spec, the page and an appeal's reason are all untrusted: the selling shop
wrote the spec, a competitor wrote the page, and one of the two parties wrote
the reason, each with money at stake. Every prompt says so before the blocks.
Each is fenced (`<` and `>` replaced, never deleted) and sits between two
delimiter lines tagged with the start of its own sha256, so none can write the
line that closes it.

## Why the live web makes this a GenLayer job

The evidence is a page on somebody else's website, at the moment of the claim.
A deterministic contract cannot fetch it. An oracle run by the shop, or by the
buyer, would be one party reading the page for both. Here every validator
fetches the page from the web independently and reads it with its own model,
and the payout follows the value they agreed on, from money the contract
already holds. Nobody uploads a screenshot and nobody types a price: the
buyer gives an address, and the network reads it.

## Who may do what

| call | who | when |
|---|---|---|
| `open_shop(name, competitors_json)` | anyone; the sender is the owner | one shop per name per address; the prefixes are fixed for good |
| `fund(shop)`, payable | the owner | any time |
| `withdraw_bond(shop, amount_atto)` | the owner | up to the free bond |
| `list_product(shop, title, spec, price_atto, window_seconds)` | the owner | at most 20 products per shop |
| `buy(product)`, payable | anyone but the owner | with exactly the price, while the free bond covers it |
| `deposit()`, payable | anyone | credits the sender's own claim-fee credit |
| `withdraw()` | anyone | takes back the sender's own credit |
| `reprice(product, price_atto)` | the owner | at most 16 times per product, then a new product; 0.1 to 100 GEN |
| `claim(order, url)` | the buyer | inside the window, no claim pending; a page below an accepted prefix; at most 2 judged claims per order; the same page again only a day after its last judgment |
| `appeal(claim, reason)` | the side the finding went against: the owner on matched, the buyer on anything else | once, within 15 minutes of the judgment, staking 0.05 GEN of credit; a reason of 10 to 280 characters |
| `settle(claim)` | the side that may appeal, at any time, which waives the appeal; anyone after the 15 minutes | while the claim is pending |
| `claim_drop(order)` | the buyer | while the order is open and no claim is pending, when a price recorded during its window is below what the order stands at |
| `release(order)` | anyone | after the window, while the order is open and no claim is pending |

Nine writes refuse by who the sender is: `fund`, `withdraw_bond`,
`list_product` and `reprice` take only the shop's owner, `buy` refuses the
owner, `claim` and `claim_drop` take only the order's buyer, `appeal` takes
only the side the finding went against, and `settle` takes only that side
until the appeal window closes. The other four refuse nobody by sender,
and each is listed in the test suite with its reason: `open_shop` lets anyone
open a shop, makes the sender its owner and touches nothing outside it;
`deposit` only ever credits the sender; `withdraw` only ever pays the sender
its own credit; and `release` moves nothing out of the contract and returns
the reservation to the shop recorded on the order. The payable calls never raise after taking
value: a refusal returns everything sent in the same transaction and answers
`{"ok": false, "reason": ..., "returned": ...}`. They never ask the model. The
other writes take no value and refuse by raising.

Views take a short id, a small number or one address, never a text: `shop(id)`,
`product(id)`, `order(id)`, `claims_of(order)`, `products_of(shop, offset,
limit)`, `orders_of(address, offset, limit)`, `orders_of_shop(shop, offset,
limit)`, `shops_of(address, offset, limit)`, `shops(offset, limit)`,
`account(address)`, `stats()` and `rules()`. Lists come in pages of at most 20.

## The money

| moment | what moves |
|---|---|
| `fund` | the owner's value into the shop's bond |
| `buy` | the buyer pays exactly the price; it goes to the shop in the same transaction, and the same amount of bond is reserved |
| `claim` | 0.01 GEN of the buyer's credit is held; nothing else moves while the claim is pending |
| `settle` (or the judged `appeal`), matched | what the order stands at minus their price, from the reserved bond to the buyer, in the same transaction; the rest of the reservation is freed; the fee back to the buyer's credit |
| `settle`, not in stock, not cheaper or unclear | the fee back to the buyer's credit |
| `settle`, different | the 0.01 GEN fee to the shop |
| `appeal`, upheld | 0.05 GEN from the appellant's credit to the other side's credit |
| `appeal`, overturned | the bond stays with the appellant; the money follows the second reading |
| `reprice` | nothing; the change is recorded in the product's price history |
| `claim_drop` | what the order stands at minus the lowest price recorded during its window, from the order's reservation to the buyer |
| `release` | a drop still owed goes to the buyer; the rest of the reservation goes back to the shop's free bond |
| `withdraw_bond` | free bond to the owner |
| `deposit` / `withdraw` | claim-fee credit in and out |
| a refused payable call | everything sent goes back to the sender, in the same transaction |

The contract always holds exactly every shop's bond, every address's credit
and every claim fee held for a pending claim, and no shop's reservations ever
exceed its bond. The offline suite checks both after every step of 120 seeded
random journeys that claim, appeal, settle, reprice and claim drops.

## The demonstration

One shop, Harbour Lane Goods, sells nine products. Every shop and brand here
is fictional.

| product | spec | our price |
|---|---|---|
| Lumio K3 kettle | Brand: Lumio. Model: K3-170. Capacity: 1.7 litres. Finish: brushed stainless steel. Condition: new, sealed in the original box. | 2.00 GEN |
| Arcwave X200 earbuds | Brand: Arcwave. Model: X200-BK. Colour: black. Includes the charging case. Condition: new, sealed in the original box. | 3.50 GEN |
| Tidewell 20 L dry bag | Brand: Tidewell. Model: DB-20. Capacity: 20 litres. Colour: orange. Condition: new, with the original tags. | 1.20 GEN |
| Brightloom L2 desk lamp | Brand: Brightloom. Model: L2-WH. Size: 40 cm arm. Colour: white. Condition: new, sealed in the original box. | 1.50 GEN |
| Kestrel 28 L daypack | Brand: Kestrel. Model: KD-28. Capacity: 28 litres. Colour: grey. Condition: new, with the original tags. | 2.40 GEN |
| Millhaven C1 burr coffee grinder | Brand: Millhaven. Model: C1-BK. Capacity: 250 g bean hopper. Colour: black. Condition: new, sealed in the original box. | 2.80 GEN |
| Pinecrest 1 L insulated bottle | Brand: Pinecrest. Model: IB-1000. Capacity: 1 litre. Colour: green. Condition: new, with the original tags. | 0.90 GEN |
| Voltleaf P10 power bank | Brand: Voltleaf. Model: P10-WH. Capacity: 10,000 mAh. Colour: white. Includes a USB-C cable. Condition: new, sealed in the original box. | 1.60 GEN |
| Larkfield wool throw | Brand: Larkfield. Model: WT-130. Size: 130 x 170 cm. Colour: navy. Condition: new, with the original tags. | 2.20 GEN |

`competitors/` holds forty-nine static pages from three fictional competitors
(Northgate Electronics, Bright Basket and Corner Hardware): for each product,
one page per outcome, and four more for the stock. Each page names the product
in full, its model, colour or finish and condition, says `Price: N GEN` in
plain text, says whether the item is in stock in plain words ("In stock",
"Sold out", "Pre-order only"), and carries some ordinary shop text. The four
stock pages are copies of a matched page with only that one line changed. The
nine `unclear` pages show the same product with no
number beside the price at all ("ask at the counter", "shown once the item is
in your basket", "on request"), so every reader finds no price. The on-chain run reads them from `raw.githubusercontent.com` pinned to
one commit, so every validator fetches the same bytes.

| page | product | the page shows | outcome |
|---|---|---|---|
| `northgate/lumio-k3-kettle.html` | kettle | the same kettle, 1.80 GEN | matched, 0.20 GEN back |
| `bright-basket/lumio-k2-kettle.html` | kettle | a Lumio K2, 1.5 L | different |
| `corner-hardware/lumio-k3-kettle-refurbished.html` | kettle | the same kettle, refurbished | different |
| `bright-basket/lumio-k3-kettle.html` | kettle | the same kettle, 2.30 GEN | not cheaper |
| `corner-hardware/lumio-k3-kettle.html` | kettle | the same kettle, no price shown | unclear |
| `bright-basket/arcwave-x200-earbuds.html` | earbuds | the same earbuds, 3.20 GEN | matched, 0.30 GEN back |
| `northgate/arcwave-x100-earbuds.html` | earbuds | an Arcwave X100, white | different |
| `northgate/arcwave-x200-earbuds-refurbished.html` | earbuds | the same earbuds, refurbished | different |
| `corner-hardware/arcwave-x200-earbuds.html` | earbuds | the same earbuds, 3.80 GEN | not cheaper |
| `northgate/arcwave-x200-earbuds.html` | earbuds | the same earbuds, no price shown | unclear |
| `corner-hardware/tidewell-dry-bag-20l.html` | dry bag | the same bag, 0.95 GEN | matched, 0.25 GEN back |
| `bright-basket/tidewell-dry-bag-10l.html` | dry bag | a Tidewell DB-10, 10 L | different |
| `corner-hardware/tidewell-dry-bag-20l-refurbished.html` | dry bag | the same bag, refurbished | different |
| `northgate/tidewell-dry-bag-20l.html` | dry bag | the same bag, 1.45 GEN | not cheaper |
| `bright-basket/tidewell-dry-bag-20l.html` | dry bag | the same bag, no price shown | unclear |
| `northgate/brightloom-l2-desk-lamp.html` | desk lamp | the same lamp, 1.35 GEN | matched, 0.15 GEN back |
| `bright-basket/brightloom-l1-desk-lamp.html` | desk lamp | a Brightloom L1, 30 cm arm | different |
| `northgate/brightloom-l2-desk-lamp-refurbished.html` | desk lamp | the same lamp, refurbished | different |
| `corner-hardware/brightloom-l2-desk-lamp.html` | desk lamp | the same lamp, 1.75 GEN | not cheaper |
| `bright-basket/brightloom-l2-desk-lamp.html` | desk lamp | the same lamp, no price shown | unclear |
| `bright-basket/kestrel-daypack-28l.html` | daypack | the same daypack, 2.15 GEN | matched, 0.25 GEN back |
| `corner-hardware/kestrel-daypack-18l.html` | daypack | a Kestrel KD-18, 18 L | different |
| `bright-basket/kestrel-daypack-28l-refurbished.html` | daypack | the same daypack, refurbished | different |
| `northgate/kestrel-daypack-28l.html` | daypack | the same daypack, 2.90 GEN | not cheaper |
| `corner-hardware/kestrel-daypack-28l.html` | daypack | the same daypack, no price shown | unclear |
| `corner-hardware/millhaven-c1-grinder.html` | coffee grinder | the same grinder, 2.45 GEN | matched, 0.35 GEN back |
| `northgate/millhaven-c2-grinder.html` | coffee grinder | a Millhaven C2, 350 g hopper | different |
| `corner-hardware/millhaven-c1-grinder-refurbished.html` | coffee grinder | the same grinder, refurbished | different |
| `bright-basket/millhaven-c1-grinder.html` | coffee grinder | the same grinder, 3.20 GEN | not cheaper |
| `northgate/millhaven-c1-grinder.html` | coffee grinder | the same grinder, no price shown | unclear |
| `bright-basket/pinecrest-bottle-1l.html` | bottle | the same bottle, 0.80 GEN | matched, 0.10 GEN back |
| `northgate/pinecrest-bottle-500ml.html` | bottle | a Pinecrest IB-500, 500 ml | different |
| `corner-hardware/pinecrest-bottle-1l-refurbished.html` | bottle | the same bottle, refurbished | different |
| `corner-hardware/pinecrest-bottle-1l.html` | bottle | the same bottle, 1.15 GEN | not cheaper |
| `northgate/pinecrest-bottle-1l.html` | bottle | the same bottle, no price shown | unclear |
| `northgate/voltleaf-p10-power-bank.html` | power bank | the same power bank, 1.45 GEN | matched, 0.15 GEN back |
| `bright-basket/voltleaf-p20-power-bank.html` | power bank | a Voltleaf P20, 20,000 mAh | different |
| `northgate/voltleaf-p10-power-bank-refurbished.html` | power bank | the same power bank, refurbished | different |
| `bright-basket/voltleaf-p10-power-bank.html` | power bank | the same power bank, 1.90 GEN | not cheaper |
| `corner-hardware/voltleaf-p10-power-bank.html` | power bank | the same power bank, no price shown | unclear |
| `corner-hardware/larkfield-wool-throw-130.html` | wool throw | the same throw, 1.95 GEN | matched, 0.25 GEN back |
| `corner-hardware/larkfield-wool-throw-150.html` | wool throw | a Larkfield WT-150, 150 x 200 cm | different |
| `bright-basket/larkfield-wool-throw-130-refurbished.html` | wool throw | the same throw, refurbished | different |
| `northgate/larkfield-wool-throw-130.html` | wool throw | the same throw, 2.60 GEN | not cheaper |
| `bright-basket/larkfield-wool-throw-130.html` | wool throw | the same throw, no price shown | unclear |
| `northgate/lumio-k3-kettle-sold-out.html` | kettle | the same kettle, 1.80 GEN, sold out | not in stock |
| `northgate/lumio-k3-kettle-pre-order.html` | kettle | the same kettle, 1.80 GEN, pre-order only | not in stock |
| `bright-basket/arcwave-x200-earbuds-sold-out.html` | earbuds | the same earbuds, 3.20 GEN, sold out | not in stock |
| `bright-basket/arcwave-x200-earbuds-pre-order.html` | earbuds | the same earbuds, 3.20 GEN, pre-order only | not in stock |

The offline suite claims with every one of the 49 pages and checks the
outcome and the money.

## The limits, stated plainly

- **The page must read the same, byte for byte, for every validator at the
  time of the claim.** Each node fetches it separately, and the stored value
  includes the sha256 of the text. A page that changes between fetches,
  carries a per-visitor token or a timestamp, shows a different price per
  visitor, or hides its price behind a script or a login will not settle, and
  nothing is stored. Static pages, and pages pinned to a commit, settle.
- **"In stock" is what the page says.** The stock question asks whether the
  page shows the item available to buy now. A page that does not say so in
  words a reader can see (only a greyed-out button, a stock count behind a
  script) comes back `unclear`. A page that is in stock at one moment and sold
  out at the next is judged as it read for every validator at the time of the
  claim.
- **An appeal reads the same text or nothing.** An appeal judges the page
  only if it still hashes as it did when the claim was judged. A competitor
  that edits its page inside the 15 minutes makes the appeal impossible to
  judge, and the first reading then stands when the window closes. That
  favours whoever the first reading favoured, and a shop that also controls a
  competitor page could use it to block a buyer's appeal. The first rule about
  prefixes below covers it: a prefix should name pages the shop cannot write.
- **The appellant's reason reaches the model.** It is fenced, sits in its own
  block after the spec and the page, and is introduced as one party's
  argument that is untrusted and not evidence. It may still say anything,
  including a number. Both presentation orders and exact equality make a
  reason that sways one reading but not the other land as a different value
  or no agreement at all, but they cannot make a model immune to it. Only the
  appellant writes; the other side cannot answer. An appeal can only move the
  money toward the appellant or cost it the bond. A second reading that is
  worse for the appellant is recorded and does not replace the first.
- **A pending claim holds its money for 15 minutes.** A match is paid when it
  settles, not at once, and the next claim on the order waits until it does.
  The side that may appeal can settle at once, which waives the appeal. After
  15 minutes anyone may settle, so a claim never waits on one account.
- **Whoever owns the pages under a prefix owns the evidence.** The shop
  chooses the competitors it promises to match, and the buyer sees them before
  buying. A prefix should name a directory that only that competitor can
  write to. A prefix on a host where anyone can publish would let anyone write
  a cheaper page.
- **Prices are in GEN.** The page must state its price as a plain number of
  GEN. The question tells the model to answer unclear when the page shows more
  than one price or none. A page with a shelf price beside a conditional one
  (a card, trade or till price) is still a page two models may read
  differently, so the demonstration's `unclear` pages show no number at all.
- **A page is judged whole or not at all.** Pages over 6,000 characters of
  text, or under 40, are never judged; the claim stores nothing and can be
  made with another page.
- **A refund is our price minus theirs, at most the whole price,** and only
  from the bond reserved for that order. The shop can never owe more than it
  reserved.
- **Price protection follows the lowest recorded price, and a product
  records at most 16 price changes.** `claim_drop` pays what the order stands
  at minus the lowest price recorded at or after its purchase and before its
  window ended. A shop that lowers a price for a minute and raises it again
  still owes the drop. After 16 changes, `reprice` on that product is refused
  for good: the shop lists a new product for a new price, and orders of the
  old product keep their history. A price set before the purchase, or at or
  after the end of the window, does not count. No model is asked: it is the
  shop's own price, stored on chain. A drop waits while a claim on the order is
  pending, and it is paid when that claim settles. A competitor match that
  settles after a drop pays down to the lower of the two prices, never both.
- **Two judged claims per order; the same page again only after a day.** A
  page judged for an order can be judged again for it 86,400 seconds after its
  last judgment, while the window is open, so a later price drop can still be
  claimed. In a window shorter than a day, that means another page. A claim
  that does not settle (a failed fetch or a split vote) does not count. A
  judged claim is final, `unclear` included.
- **Someone has to call `settle` and `release`.** Anyone may, once the appeal
  window or the guarantee window is over. `release` moves the reservation
  only back to the shop's free bond, but the contract does not run by itself.
- **The spec is the shop's own description.** It is the only shop text a
  model sees, and the buyer reads it before buying. A match must be the same
  brand, model, capacity or size, colour or finish, and new; nothing else in
  the spec counts. A spec may not name a price with a `$` sign or a money word,
  so "2nd Gen" is written "second generation".
- **Texts are printable ASCII on one line.** Names 3 to 60 characters, titles
  3 to 80, specs 40 to 400, appeal reasons 10 to 280. Addresses use letters, digits and `- . _ ~ /`
  only, with a lowercase host and no query, fragment, port, empty segment, `.`
  or `..`; a prefix is at most 160 characters and ends with `/`, a page
  address at most 200. Prices are 0.1 to 100 GEN; a window is 20 minutes to
  30 days.

## What is in this repository

```
contracts/price_match.py     the contract
web/                         the site (Next.js), its tests and tools/open-demo-shop.mjs
competitors/                 the 49 demo competitor pages, their index and their stylesheet
tests/test_pure.py           the offline suite, including the consensus round with a world per node
tests/MUTATIONS.md           every defence removed in turn, and the test that caught it
tests/on_chain/smoke.mjs     a throwaway-account run against Studio
tools/mutate.py              the generator that writes MUTATIONS.md and refuses to if anything survives
docs/CONTRACTS.md            purpose, consensus, state, methods and limits
docs/DECISIONS.md            why each rule is the way it is, and what is verified and what is not
```

## Running it

```
pip install -r requirements-dev.txt
pytest tests/ -q                          # no network, no Studio
genvm-lint check contracts/price_match.py
python tools/mutate.py                    # rewrites tests/MUTATIONS.md; exits 1 if a mutant survives
```

On this repository as it stands, `pytest tests/ -q` gives **178 passed** in
a few seconds. `genvm-lint check` (genvm-linter 0.11.0) prints
`Lint passed (3 checks)` and reports 25 methods, 12 view and 13 write.
`python tools/mutate.py` removes or inverts **330 defences** one at a time,
and **none survives**.

The on-chain run uses three throwaway keys it generates itself (SHOP, BUYER,
STRANGER) and funds them from the Studio faucet. It never touches anybody's
own wallet. The validators read the competitor pages from GitHub at one
commit, so push the repository first and pass that commit:

```
npm ci
COMMIT=<40-character sha> node tests/on_chain/smoke.mjs        # about forty minutes: the window is thirty
COMMIT=<sha> RESUME=1 node tests/on_chain/smoke.mjs            # continue from the saved state
```

`REPO=<owner>/<name>` names the GitHub repository when the git remote does
not. The script fetches the demo pages itself before it deploys anything and
stops if they are not at that commit. It tells the story of contract version
2: a purchase refused for lack of bond and refunded; two purchases, each sale
forwarded and reserved; a cheaper page for the same kettle that is sold out,
judged `not_in_stock`, with nothing moved and the shop's appeal of it refused;
the buyer waiving its appeal; the in-stock page matched, its 0.20 GEN held
pending; the buyer's appeal and a stranger's early settlement refused; the
shop's appeal with a false reason, upheld, so the refund reaches the buyer in
that transaction and the shop's 0.05 GEN bond goes to the buyer's credit; a
second appeal refused; the earbuds repriced from 3.50 to 3.00 GEN and straight
back to 3.50 GEN, and the 0.50 GEN drop still claimed from the order's
reservation afterwards, with a stranger's reprice
and drop and a second drop refused; a release; the bond and the credit
withdrawn. It must run straight through from the match to the shop's appeal,
which has to land inside the 15-minute appeal window. It prints a PASS or FAIL
line for each of its 43 checks, the balances before and after every step that
moves money, `N passed, M failed`, and the contract address.

## The site

`web/` is the site, a Next.js 16 app deployed on Vercel with the Root Directory
set to `web`. It looks like a supermarket shelf and a till receipt: products
hang as yellow price tags, buttons are cut like shelf labels, and every judged
claim prints as a thermal receipt (page read, same product or not, their price,
our price, the refund) with a red sticker on a match.

| page | what it does |
|---|---|
| `/` | the promise in one minute, a receipt printing the demo's kettle match, how the money moves |
| `/shop` | the demo shop's shelf: nine products with their prices and guarantee windows, and Buy |
| `/order/[id]` | the order, its guarantee counting down, the claim (claim-fee credit, a competitor page picked from one-click chips, Claim), the waiting panel while the validators read the page, and the receipts |
| `/shops`, `/shop/[id]` | every shop, and any shop's products and bond |
| `/merchant` | open a shop with suggested names and the demo competitors' prefixes, fund and withdraw the bond, list products, release ended orders |
| `/mine` | your orders, your claim-fee credit, the shops you run |
| `/ledger` | `stats()` printed like a till's end-of-day report |
| `/how` | the four askings, why the live web makes this a GenLayer job, the money table, the limits, and `rules()` read live |

**The demo shop.** One visitor wallet can try everything. A throwaway Studio
key opens Harbour Lane Goods with a 40 GEN bond and the nine demonstration
products, accepting the three competitor prefixes on
`raw.githubusercontent.com` pinned to the pushed commit:

```
cd web
REGISTER=<contract> DEMO_SHOP_KEY=<throwaway key> COMMIT=<40-character sha> node tools/open-demo-shop.mjs
DRY=1 REGISTER=<contract> COMMIT=<sha> node tools/open-demo-shop.mjs      # print the calls, send nothing
DRY=1 OWNER=<the key's address> REGISTER=<contract> COMMIT=<sha> node tools/open-demo-shop.mjs   # and read its shops
```

A shop's prefixes are fixed for good, so the script keeps the key's newest
demo shop only when its prefixes are exactly the ones built from `COMMIT`, and
then adds only the bond and the products it lacks. Otherwise it opens a new
shop with the new prefixes under the next name of the family (Harbour Lane
Goods 2, then 3: the contract refuses a second shop of the same name from one
address), and the earlier shop stays open for the orders already in it. The
site's server shows the key's newest demo shop that lists products. The first
demo shop, S2, carried the three products of the on-chain run; the demo shop
was reopened at a new commit with all nine.

The visitor buys with their own wallet, adds 0.01 GEN of claim-fee credit,
picks one of the 45 competitor pages from chips such as "Northgate: same
kettle, 1.80 GEN" or "Corner Hardware: refurbished", and claims. The chips build
each address from the prefixes the shop accepted on chain, and every chip links
to the copy of that page the site serves under `/competitors/`, so a visitor
can read exactly what the validators will read. The site's server holds the
same key in `DEMO_SHOP_KEY` and signs one kind of call with it:
`POST /api/demo/restock` funds the demo shop's bond when a product is no longer
covered. `GET /api/demo/status` says whether it can, and exactly why not ("no
key set", "the key set is not a 0x private key of 64 hex characters", "the
contract is not deployed yet", or that the demo shop is not open yet). The key
is never logged or returned.

**Waiting.** Every in-between state (a wallet prompt, a transaction on its
way, the validators reading a page, the guarantee window running, an order
waiting for release, the demo shop topping up) shows one panel that says what
is happening, how long it takes, what is needed from you, whether you can
leave, and where the money is right now. The words come from
`web/lib/guide.ts` and are tested for every state and role.

**Reads.** Studio allows 30 contract reads a minute per browser, so every view
answer is cached for 30 seconds and shared, a rate-limited read waits for the
cooldown instead of retrying, and a read that fails says "could not reach the
network", never "no data".

| variable | where | what |
|---|---|---|
| `NEXT_PUBLIC_CONTRACT` | build | the contract; `DEMO_CONTRACT` in `web/lib/config.ts` when unset |
| `DEMO_SHOP_KEY` | server | the demo shop's throwaway key |
| `NEXT_PUBLIC_DEMO_SHOP` | build | the demo shop's id, only for a deploy without the key |
| `NEXT_PUBLIC_MOCK` | build | `1` runs the whole site on an in-memory copy of the contract |
| `NEXT_PUBLIC_REPO_URL` | build | the Source link; on Vercel the repository the site was built from when unset |

**Mock mode.** `npm run dev:mock` in `web/` runs the site on
`web/lib/chain-mock.ts`, an in-memory copy of the contract that follows it on
everything deterministic: the same checks in the same order, the same refusal
sentences, the same JSON views. It cannot fetch a page or ask a model, so its
readings follow what the 45 demo pages state, and any other address
cannot be read and stores nothing. A bar on every page says so, switches
between demo accounts, gives test GEN and moves the clock on.

```
cd web
npm ci
npm run typecheck && npm run lint && npm run test:site && npm run build
```

`npm run test:site` runs 45 node tests with no browser and no network.
They check every call the site can send and every view it reads against
`contracts/price_match.py`; compare the site's copies of the contract's rules
(addresses, prefixes, money words, the price reader, the combine tables) and
the in-memory `rules()` with the contract itself, through a stub of the
runtime, case by case; buy and claim with each of the 45 demo pages and
check the outcome and the money; keep every atto accounted for over four
hundred seeded random steps; keep every suggestion inside the contract's
limits; cover the waiting copy for every state and role; and scan every file
for anything personal or internal.

## Network

GenLayer Studio, chain 61999, RPC `https://studio.genlayer.com/api`, explorer
`https://explorer-studio.genlayer.com`. The contract pins the runner
`py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` in its first
line.

## Evidence: contract version 2 (milestone v1)

Run on 20 November 2026 on GenLayer Studio (chain 61999) by `tests/on_chain/smoke.mjs`, from generated accounts funded from the
Studio faucet, none of them anybody's wallet: SHOP opens the shop and funds the bond, BUYER buys, claims and appeals, STRANGER tries every action it may not take. **42 passed, 1 failed**; transactions: 32 in 32 steps; sent a second time: none.
The whole log is `tests/on_chain/smoke-run.log`. One run covers the stock verdict, the bonded appeal, price protection and release. The single failed check is a balance read taken before the refund of a refused purchase had landed: the 2.00 GEN did come back, which the closing checks show (the contract holds nothing, and every account ends where the money table says).

- `price_match.py` deployed at [`0xf8f4117b92899233597AB299ad8079bfe8E098c0`](https://explorer-studio.genlayer.com/address/0xf8f4117b92899233597AB299ad8079bfe8E098c0)

- the code deployed at 0xf8f4117b92899233597AB299ad8079bfe8E098c0 is byte for byte contracts/price_match.py: 98611 bytes, sha256 363afa97913213e3054c1b071203d0a079d975f2c06b56da2e10c293adbc1acb

| step | by | transactions | votes |
|---|---|---|---|
| SHOP opens S1, Harbour Lane Goods, accepting pages below three competitor prefixes | SHOP | [0x835cfc07…](https://explorer-studio.genlayer.com/tx/0x835cfc075a435c3d244aec74d39989aa4f9c791372ec7425a5f1db17377c60d4), [0x180a030c…](https://explorer-studio.genlayer.com/tx/0x180a030c17f4120a8e69853c9c3a1d8cafd11ebdd6ec221cd085314a7a38d86e) | 3 agree, 0 disagree, 2 idle |
| SHOP lists Lumio K3 kettle, 1.7 L, brushed steel at 2 GEN with a 30-minute guarantee window | SHOP | [0xf615d74f…](https://explorer-studio.genlayer.com/tx/0xf615d74f638f4be63fc9a271b2d69c5a68bfc17425c8b1fc8eae8f73b34eae0e) | 4 agree, 0 disagree, 1 idle |
| SHOP lists Arcwave X200 wireless earbuds, black at 3.5 GEN with a 30-minute guarantee window | SHOP | [0xc7c750e2…](https://explorer-studio.genlayer.com/tx/0xc7c750e2a95a2ac192aa586fa216d3785ddd534bcc65aafde965ded80952dcca) | 4 agree, 0 disagree, 1 idle |
| STRANGER may not list a product in S1 | STRANGER | [0x58382073…](https://explorer-studio.genlayer.com/tx/0x583820733a450dc76cc633b6b401eb23f32c59826b8f1cee8a2ebf36f768575c) | 5 agree, 0 disagree, 0 idle |
| SHOP funds a 7 GEN guarantee bond | BUYER SHOP | [0x5cb6f355…](https://explorer-studio.genlayer.com/tx/0x5cb6f355ac269ab6bc0d488e8a0d8ec2ace01c10d43fba0a98d7c015ee3bf779), [0x1b0e2529…](https://explorer-studio.genlayer.com/tx/0x1b0e252967061bc8b884546bcd2972ce26d5dda46d708be033fe21449d59296c) | 3 agree, 0 disagree, 2 idle |
| SHOP deposits 0.05 GEN of credit, enough for one appeal bond | SHOP | [0x0d3e32d3…](https://explorer-studio.genlayer.com/tx/0x0d3e32d3e71b8210dcecdf7700cda64305ac8b1dfc666ad78dbb446fea58cc80) | 3 agree, 0 disagree, 2 idle |
| BUYER deposits 0.05 GEN of claim-fee credit | BUYER | [0x19cd4373…](https://explorer-studio.genlayer.com/tx/0x19cd437338df97299f81c7002181996f5b2f1a4ad23a0bb988fd3cfee05794ed) | 3 agree, 0 disagree, 2 idle |
| BUYER buys Lumio K3 kettle, 1.7 L, brushed steel: the 2 GEN reaches SHOP in the same transaction, and the same amount of bond is reserved | BUYER | [0x8e2c666e…](https://explorer-studio.genlayer.com/tx/0x8e2c666e7db3be03d038d9fb4d21f8ed037ccfbcf4e62abd3578148f3f92bc8e) | 3 agree, 0 disagree, 2 idle |
| BUYER buys Arcwave X200 wireless earbuds, black: the 3.5 GEN reaches SHOP in the same transaction, and the same amount of bond is reserved | BUYER | [0xdf7fa28f…](https://explorer-studio.genlayer.com/tx/0xdf7fa28fef918185ed575c83dacf9d98fde5f2f02446086aa85c76ba97c2cfbd) | 3 agree, 0 disagree, 2 idle |
| SHOP may not withdraw bond reserved for open orders: only 1.50 GEN of the 7 is free | SHOP | [0xe7f0d6a7…](https://explorer-studio.genlayer.com/tx/0xe7f0d6a73cafa7e8379df4fbd015f3fecc0f916243e3d607485d0e007a95ae5c) | 3 agree, 0 disagree, 2 idle |
| STRANGER may not claim on BUYER's order O1 | STRANGER | [0xc28cb3a0…](https://explorer-studio.genlayer.com/tx/0xc28cb3a040ae7a1b651b92c2327744eaf97c2be09355ad32c7658d7e9a66a04b) | 3 agree, 0 disagree, 2 idle |
| a page below no accepted prefix is refused before anything is fetched | BUYER | [0xd539c259…](https://explorer-studio.genlayer.com/tx/0xd539c2598a021a66ca7573dd8c93aaca9800e5049b819036541e57807f85b503) | 3 agree, 0 disagree, 2 idle |
| the validators carry one value for the sold-out page in one consensus round | BUYER | [0x74af3fc3…](https://explorer-studio.genlayer.com/tx/0x74af3fc3b1eba8e6686e278695330a45ebd97090dc3edd1b05c162f3854c6f08) | 3 agree, 0 disagree, 2 idle |
| SHOP may not appeal C1: the finding went against the buyer | SHOP | [0xe58f44f9…](https://explorer-studio.genlayer.com/tx/0xe58f44f9097309caaf6b5587c199de927137c929d11cfc9bde23ece83d3af55d) | 3 agree, 0 disagree, 2 idle |
| BUYER waives its appeal: C1 settles as not_in_stock and the 0.01 GEN fee goes back to its credit | BUYER | [0x05832ec5…](https://explorer-studio.genlayer.com/tx/0x05832ec51d0eb97d04fbc52ecde28f69b9412f1ef0bccba012ff618a896c50e0) | 5 agree, 0 disagree, 0 idle |
| the validators carry one value for the kettle page in one consensus round | BUYER | [0xdbe268d5…](https://explorer-studio.genlayer.com/tx/0xdbe268d5987b4c5c1d60dd111ed12fda48b85f0adf3500dee19bb1d4f0e87b23) | 3 agree, 0 disagree, 2 idle |
| BUYER may not appeal C2: the finding went against the shop | BUYER | [0x3064c8d8…](https://explorer-studio.genlayer.com/tx/0x3064c8d8d9068b1d607951b56ef3a7140b9fcd3dd6438f18fd6d01de9bb5d661) | 4 agree, 0 disagree, 1 idle |
| STRANGER may not settle C2 while the shop may still appeal | STRANGER | [0x4f02582f…](https://explorer-studio.genlayer.com/tx/0x4f02582ff2a655f39fe02eee6a98b75a419651ae035abf55fb0ab18d0a68902b) | 4 agree, 0 disagree, 1 idle |
| the validators carry one second reading of the same page, with the shop's reason fenced as its argument | SHOP | [0xd6a25f07…](https://explorer-studio.genlayer.com/tx/0xd6a25f07e09df3e3651167f2227b4db05391eb2da4d75b8085b28941fec54064) | 3 agree, 0 disagree, 2 idle |
| SHOP may not appeal C2 again: an appeal is never appealed | SHOP | [0x03ac0cb8…](https://explorer-studio.genlayer.com/tx/0x03ac0cb81fe7a57a24f3f013a0a078d72f350f51da4d60364b47bec1a2d25f89) | 3 agree, 0 disagree, 2 idle |
| STRANGER may not reprice P2 | STRANGER | [0xee032992…](https://explorer-studio.genlayer.com/tx/0xee0329925cc8f3c3dc6cebc7231d43d1fa75d7ddc5886351fa14fe6c70404069) | 3 agree, 0 disagree, 2 idle |
| SHOP reprices P2 from 3.50 to 3.00 GEN | SHOP | [0xaa6c9411…](https://explorer-studio.genlayer.com/tx/0xaa6c941163a485a2e1183468697ffbe68c948f2c4dfabc9bdd050d7fd33462c7) | 5 agree, 0 disagree, 0 idle |
| SHOP raises P2 straight back to 3.50 GEN: the 3.00 GEN stays in its price history | SHOP | [0x795988df…](https://explorer-studio.genlayer.com/tx/0x795988df45f2b81c447b776d2ba0049db03a2246731d24efe3ddf53f4671b4d9) | 3 agree, 0 disagree, 2 idle |
| STRANGER may not claim the drop on BUYER's order O2 | STRANGER | [0xd7c38bcf…](https://explorer-studio.genlayer.com/tx/0xd7c38bcff872c485e6483e0ed89fc7964b49b6705b5fa9bdb318b79c701fed36) | 3 agree, 0 disagree, 2 idle |
| BUYER claims the drop after the price went back up: the lowest recorded price, 3.00 GEN, is owed, so 0.50 GEN comes from O2's own reservation in the same transaction, no model asked | BUYER | [0xc87c1f0d…](https://explorer-studio.genlayer.com/tx/0xc87c1f0d1c3cc776f23bcc5fa95120ed0bc7436e48bae8a51d6543e19aed43d6) | 5 agree, 0 disagree, 0 idle |
| a second drop claim at the same price is refused: nothing left to claim | BUYER | [0x8ca0a47e…](https://explorer-studio.genlayer.com/tx/0x8ca0a47e756bd48c62197802e49e84cdd6ab5a40e14931462e3c4674336fd0d8) | 4 agree, 0 disagree, 1 idle |
| STRANGER releases O2 after its window: its 3.00 GEN reservation goes back to the free bond, nothing leaves the contract | STRANGER | [0xa5c27d71…](https://explorer-studio.genlayer.com/tx/0xa5c27d711047b321157422e871488d5cadf8a89f0877bd43344866362381e079) | 4 agree, 0 disagree, 1 idle |
| SHOP withdraws the whole remaining bond, 6.30 GEN | SHOP | [0x17f38ae9…](https://explorer-studio.genlayer.com/tx/0x17f38ae9b4f42bff35e66f68d0e49a3de52b20ef37e2a0cb73f2692115818d81) | 4 agree, 0 disagree, 1 idle |
| BUYER withdraws its 0.10 GEN of credit: its own 0.05 GEN and the shop's forfeited bond | BUYER | [0xbc9939a6…](https://explorer-studio.genlayer.com/tx/0xbc9939a6cde819d8d239bf98ad1e529706b18f7663572b7c40e4333d677a4d60) | 3 agree, 0 disagree, 2 idle |
| SHOP holds no credit any more: its appeal bond went to the buyer | SHOP | [0x2db73a74…](https://explorer-studio.genlayer.com/tx/0x2db73a74cbb432af245c3487a68b4fd786f092fb205115494db6a2df9ad0f371) | 4 agree, 0 disagree, 1 idle |

## Evidence

Contract version 1, before milestone v1. Run on 12 and 13 October 2026 on GenLayer Studio (chain 61999) by `tests/on_chain/smoke.mjs`, from three generated
accounts, one per role: **SHOP**, **BUYER** and **STRANGER**. The competitor pages were the files in `competitors/`
read from `raw.githubusercontent.com` pinned to commit `2f4e6ab683aa1cc1e3b97c9785de461de07b3f92`. **34 checks passed,
0 failed**; the whole log is `tests/on_chain/smoke-run.log`. The run paused overnight during the 30-minute windows and
resumed from its state file: 24 transactions in 24 steps, none sent twice.

Register [`0x8F861A0e6c1A18936df901828aAD5C9b50c9C073`](https://explorer-studio.genlayer.com/address/0x8F861A0e6c1A18936df901828aAD5C9b50c9C073).
`gen_getContractCode` on it returns `contracts/price_match.py` byte for byte (68,303 bytes, sha256
`d15209b78ab1f76afce01e2a0227590719be38694d81612c1f62c9e3707bcb06`).

| call | by | transaction | result |
|---|---|---|---|
| deploy `contracts/price_match.py` | SHOP | [0xf45391b0…](https://explorer-studio.genlayer.com/tx/0xf45391b060fe8dab4ec9b67082beda537cecc88337affbe8e3976fae77a28d3a) | register `0x8F861A0e…C073`; `gen_getContractCode` returns the repository file byte for byte (sha256 `d15209b7…`) |
| open S1, Harbour Lane Goods, accepting pages below the three competitor prefixes | SHOP | [0x001c3898…](https://explorer-studio.genlayer.com/tx/0x001c3898f088ecf3f0ea6d375f932e6b260eac24b2eb8e9c4042c2c0b3066408) | S1 open |
| list the Lumio K3 kettle (2 GEN), the Arcwave X200 earbuds (3.5 GEN) and the Tidewell 20 L dry bag (1.2 GEN), each with a 30-minute guarantee window | SHOP | see result | P1, P2, P3: [0xbbfd606f…](https://explorer-studio.genlayer.com/tx/0xbbfd606f7aa7828a696c43471b0fe0d457c5757ab1ffe149347b0cbcdad041e3), [0x0f806d9a…](https://explorer-studio.genlayer.com/tx/0x0f806d9a78de2834ddacfe62bcfee6664740651acfd79b261b2ed3b09ea0e9b6), [0x2e3c2bb3…](https://explorer-studio.genlayer.com/tx/0x2e3c2bb3ab9d6e0a8ccd9847cb49e97ce343ac81ded4f997f0da9e9bf54dff60) |
| a stranger lists a product in S1 | STRANGER | [0x64e748f3…](https://explorer-studio.genlayer.com/tx/0x64e748f365e59d133e38062dc571c44ef289d75ef093df7cb48664d7b3fb49a4) | refused: only the owner of S1 may |
| a purchase before the shop has any bond | BUYER | [0xe8f9b54f…](https://explorer-studio.genlayer.com/tx/0xe8f9b54fc3cb0bca6be154a30f567321cb4fd25590564016087476984f08f286) | refused, `ok: false`; **the 2 GEN came back in the same transaction** |
| fund a 7 GEN guarantee bond | SHOP | [0xeeb375c5…](https://explorer-studio.genlayer.com/tx/0xeeb375c5911ccd553821ef9c8368a6c90daf0d7a0e69798e390e4b2680fa59a0) | bond 7 GEN, all free |
| deposit 0.05 GEN of claim-fee credit | BUYER | [0x6b6025d6…](https://explorer-studio.genlayer.com/tx/0x6b6025d6371024ad002d06dcce2c8fa14cd110ccc27f4eb70a0e3e4b565fc206) | credit 0.05 GEN |
| buy the kettle, the earbuds and the dry bag | BUYER | see result | O1, O2, O3: [0x368c57d6…](https://explorer-studio.genlayer.com/tx/0x368c57d610920b2393449487f6e5e232f2857ae92572563f1f7e49bd1a9f3f14), [0x75fe92b6…](https://explorer-studio.genlayer.com/tx/0x75fe92b6b9a2313181e35cb56bbcfba9348ece757fbb75e7c186fc857d9e12ea), [0x35fab3c5…](https://explorer-studio.genlayer.com/tx/0x35fab3c584e14339932567f8ec29c876c22fec9b23cab3115d69ae1ae9e4f817); each price reached SHOP in the same transaction and the same amount of bond was reserved |
| withdraw the whole 7 GEN bond while three orders are open | SHOP | [0xf30832a8…](https://explorer-studio.genlayer.com/tx/0xf30832a8ac249f787f045f600068109aa3bd592ff002fc8ba660d9f1340636bf) | refused: only 0.30 GEN is free, 6.70 GEN is reserved for the open orders |
| a stranger claims on the buyer's order | STRANGER | [0xcd3728ae…](https://explorer-studio.genlayer.com/tx/0xcd3728ae943946ffd85fdd9340e062003d961cb0e14bdd76f4e7b0afcfd48c30) | refused: only the buyer of O1 may |
| claim with a page below no accepted prefix | BUYER | [0xab8a24a7…](https://explorer-studio.genlayer.com/tx/0xab8a24a746571b0a8f717ee5595665c160928e3bdb213e8fdba334255814421c) | refused before anything is fetched |
| claim O1 with Northgate's kettle page | BUYER | [0x2f8560bf…](https://explorer-studio.genlayer.com/tx/0x2f8560bf10fa0504be9fcbaf06f01904969f83e82497ba84cef765bf059140fe) | validators read the page: `{"product": "same", "price": "1800000000000000000"}`, 3 agree and 2 idle; **matched, and the 0.20 GEN difference reached the buyer from the reserved bond in the same transaction** |
| claim O2 with a page for the refurbished earbuds | BUYER | [0x3f1d4b2e…](https://explorer-studio.genlayer.com/tx/0x3f1d4b2e8130a27af326db6cc1699dace6b8d6b755632a080ad7522eaf45a7bc) | **different**, 3 agree and 2 idle; the 0.01 GEN claim fee went to the shop |
| claim O3 with a page selling the same dry bag for 1.45 GEN | BUYER | [0xc08755ae…](https://explorer-studio.genlayer.com/tx/0xc08755aeb3f851a6f601bac6ec0c52698085971bebaff66e1a476ccf80c977fe) | **not cheaper** (`1450000000000000000` atto read from the page); nothing moved, the fee came back |
| claim O3 again after its window closed, with a page that would have matched | BUYER | [0xad816831…](https://explorer-studio.genlayer.com/tx/0xad816831580920fc700908e12db3084fb7b31a3b19281240f846017514f32ee1) | refused: the guarantee window has closed |
| release O2 and O3 after their windows | STRANGER | see result | [0xb5dc8fdc…](https://explorer-studio.genlayer.com/tx/0xb5dc8fdc333249af4600366b7478b769207a2d1940e118440924975c5a9817df), [0x44f6e38c…](https://explorer-studio.genlayer.com/tx/0x44f6e38cc0ab1988734f470ba537e37337e37574b2761a3cf827c1c9b23ff1f8); their 3.50 and 1.20 GEN reservations went back to the free bond, nothing left the contract |
| release O3 a second time | STRANGER | [0xe9cf438c…](https://explorer-studio.genlayer.com/tx/0xe9cf438cbd1abd16a965d1c549706ed2ff90c52fca8ba863250bea290c3fb1b4) | refused: already released |
| withdraw the remaining 6.80 GEN bond | SHOP | [0x6884411b…](https://explorer-studio.genlayer.com/tx/0x6884411b020ab37a76199d1aee865ab8f6bf1696d01d83f74461c63cf0efbe5c) | paid out |
| withdraw the 0.04 GEN of credit left | BUYER | [0x3275be17…](https://explorer-studio.genlayer.com/tx/0x3275be1708edb94d3c0671b1fc25c67cca4941ec560e7c0c2e2e2f78c3681059) | paid out |

At the end `stats()` read one shop, three products, three orders and three judged claims: one matched, one
different, one not cheaper, two released, nothing reserved and no credit held. The contract's own balance was zero, and
every account ended where the money table says: SHOP up 6.51 GEN (6.70 GEN of sales and the 0.01 GEN fee, less the
0.20 GEN refund), BUYER down 6.51 GEN, STRANGER whole.

The pages that show the product with no price (for example `competitors/corner-hardware/lumio-k3-kettle.html`), which
should come back unclear, are covered by the tests and offered on the site, but were not part of this run.

After the run the site's demo shop, a separate throwaway key, opened S2 Harbour Lane Goods on the same register with a
30 GEN bond and the three demo products (P4 kettle, P5 earbuds, P6 dry bag), accepting the same pinned competitor pages.

## Licence

MIT. See `LICENSE`.
