# Price Match

A lowest-price guarantee that enforces itself. The validators open the
competitor's page on the live web, agree it is the same product and read its
price, and the difference comes back from the shop's bond in the same
transaction.

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
itself, the network agrees on two things about it, and the money follows:

- **matched**: the page offers the same product for less. The difference goes
  to the buyer from the reserved bond, in the same transaction, and the order
  closes.
- **not cheaper**: the same product, at our price or more. Nothing moves.
- **different**: another product, such as another model, another size or a
  refurbished unit. The buyer's 0.01 GEN claim fee goes to the shop.
- **unclear**: the network could not settle either question, for example a
  page that shows no price. Nothing moves.

A claim stakes a 0.01 GEN fee from the buyer's claim-fee credit, which the
buyer **deposits** beforehand and can **withdraw** at any time. The fee is a
spam cost: it comes back on every outcome except "different". An order takes
at most two judged claims. The same page can be judged again for an order only
a day after its last judgment, so a price that drops later in the window can
still be claimed, but a page cannot be re-rolled at once. When the window ends,
anyone may **release** the order, and its reservation goes back to the shop's
free bond. The shop can **withdraw** free bond at any time.

## How consensus is used

`claim` runs one consensus block. Inside it every node fetches the page with
`gl.nondet.web.render(url, mode="text")` and asks the model about the same
fetched text, up to four times:

| asking | blocks, in order | question |
|---|---|---|
| 1 | SPEC, PAGE | Is the item offered on this page the same product as the specification: same brand, model, capacity or size, colour or finish, and condition (new)? Ignore price, shop and every other detail. |
| 2 | PAGE, SPEC | Is the item offered on this page a different product from the specification: another brand, model, capacity or size, colour or finish, or a condition other than new? Ignore price, shop and every other detail. |
| 3 | SPEC, PAGE | What is the page's current price for that item, in GEN, as a plain decimal number? If the page shows more than one price or none, answer unclear. |
| 4 | PAGE, SPEC | the same price question |

The contract turns the answers into the value it stores:

| askings 1 and 2 | product |
|---|---|
| yes, then no | `same` |
| no, then yes | `different` |
| anything else, including an answer it cannot read | `unclear` |

The price is asked only about a page both framings call the same product. Each
price answer is read as a plain decimal with at most 18 places and turned into
an integer of atto: `1.80`, `1.8` and `01.80` all become
`1800000000000000000`, while `1,80`, `$1.80`, `1.80 GEN`,
`1.800000000000000000001` and `unclear` are not prices. The price is kept only
when both orders give the same integer; otherwise it is empty.

The stored value is `{"product": "same" | "different" | "unclear", "price":
"<atto>" or ""}`. Every validator fetches the page and asks every asking
itself, then compares that value with the leader's by **exact equality**.
There is no tolerance for a disagreement to hide in. Both presentation orders
are inside the one block, so a position bias shows up as a disagreement, and
the second product asking is the mirror of the first, so a model that says yes
to everything lands as `unclear`.

The contract alone compares the agreed price with ours. **The model never sees
our price**, only the spec and the page. No amount is passed into the round,
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

The spec and the page are both untrusted: the selling shop wrote one and a
competitor wrote the other, with money at stake. Every prompt says so before
the blocks. Each is fenced (`<` and `>` replaced, never deleted) and sits
between two delimiter lines tagged with the start of its own sha256, so
neither can write the line that closes it.

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
| `claim(order, url)` | the buyer | inside the window; a page below an accepted prefix; at most 2 judged claims per order; the same page again only a day after its last judgment |
| `release(order)` | anyone | after the window, while the order is open |

Five writes refuse by who the sender is: `fund`, `withdraw_bond` and
`list_product` take only the shop's owner, `buy` refuses the owner, and
`claim` takes only the order's buyer. The other four refuse nobody by sender,
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
| `claim`, matched | our price minus theirs, from the reserved bond to the buyer, in the same transaction; the rest of the reservation is freed |
| `claim`, not cheaper or unclear | nothing |
| `claim`, different | 0.01 GEN from the buyer's credit to the shop |
| `release` | nothing leaves; the reservation goes back to the shop's free bond |
| `withdraw_bond` | free bond to the owner |
| `deposit` / `withdraw` | claim-fee credit in and out |
| a refused payable call | everything sent goes back to the sender, in the same transaction |

The contract always holds exactly every shop's bond plus every address's
credit, and no shop's reservations ever exceed its bond. The offline suite
checks both after every step of forty seeded random journeys.

## The demonstration

One shop, Harbour Lane Goods, sells three products. Every shop and brand here
is fictional.

| product | spec | our price |
|---|---|---|
| Lumio K3 kettle | Brand: Lumio. Model: K3-170. Capacity: 1.7 litres. Finish: brushed stainless steel. Condition: new, sealed in the original box. | 2.00 GEN |
| Arcwave X200 earbuds | Brand: Arcwave. Model: X200-BK. Colour: black. Includes the charging case. Condition: new, sealed in the original box. | 3.50 GEN |
| Tidewell 20 L dry bag | Brand: Tidewell. Model: DB-20. Capacity: 20 litres. Colour: orange. Condition: new, with the original tags. | 1.20 GEN |

`competitors/` holds fifteen static pages from three fictional competitors
(Northgate Electronics, Bright Basket and Corner Hardware): for each product,
one page per outcome. Each page names the product in full, its model, colour
or finish and condition, says `Price: N GEN` in plain text, and carries some
ordinary shop text. The three `unclear` pages show the same product with no
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

The offline suite claims with every one of the fifteen pages and checks the
outcome and the money.

## The limits, stated plainly

- **The page must read the same for every validator at the time of the
  claim.** Each node fetches it separately. A page that changes between
  fetches, shows a different price per visitor, or hides its price behind a
  script or a login will not settle, and nothing is stored. Static pages, and
  pages pinned to a commit, settle.
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
- **Two judged claims per order; the same page again only after a day.** A
  page judged for an order can be judged again for it 86,400 seconds after its
  last judgment, while the window is open, so a later price drop can still be
  claimed. In a window shorter than a day, that means another page. A claim
  that does not settle (a failed fetch or a split vote) does not count. A
  judged claim is final, `unclear` included.
- **Someone has to call `release`.** Anyone may, and it moves the reservation
  only back to the shop's free bond, but the contract does not run by itself.
- **The spec is the shop's own description.** It is the only shop text a
  model sees, and the buyer reads it before buying. A match must be the same
  brand, model, capacity or size, colour or finish, and new; nothing else in
  the spec counts. A spec may not name a price with a `$` sign or a money word,
  so "2nd Gen" is written "second generation".
- **Texts are printable ASCII on one line.** Names 3 to 60 characters, titles
  3 to 80, specs 40 to 400. Addresses use letters, digits and `- . _ ~ /`
  only, with a lowercase host and no query, fragment, port, empty segment, `.`
  or `..`; a prefix is at most 160 characters and ends with `/`, a page
  address at most 200. Prices are 0.1 to 100 GEN; a window is 20 minutes to
  30 days.

## What is in this repository

```
contracts/price_match.py     the contract
web/                         the site (Next.js), its tests and tools/open-demo-shop.mjs
competitors/                 the fifteen demo competitor pages, their index and their stylesheet
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

On this repository as it stands, `pytest tests/ -q` gives **137 passed** in
under a second. `genvm-lint check` (genvm-linter 0.11.0) prints
`Lint passed (3 checks)` and reports 21 methods, 12 view and 9 write.
`python tools/mutate.py` removes or inverts **222 defences** one at a time,
and **none survives**.

The on-chain run uses three throwaway keys it generates itself (SHOP, BUYER,
STRANGER) and funds them from the Studio faucet. It never touches anybody's
own wallet. The validators read the competitor pages from GitHub at one
commit, so push the repository first and pass that commit:

```
npm ci
COMMIT=<40-character sha> node tests/on_chain/smoke.mjs        # about forty minutes: the windows are thirty
COMMIT=<sha> RESUME=1 node tests/on_chain/smoke.mjs            # continue from the saved state
```

`REPO=<owner>/<name>` names the GitHub repository when the git remote does
not. The script fetches the demo pages itself before it deploys anything and
stops if they are not at that commit. It tells the story of the demonstration:
a purchase refused for lack of bond and refunded; three purchases, each sale
forwarded and reserved; a matched claim paid 0.20 GEN from the bond in the
same transaction; a refurbished page judged another product, the fee to the
shop; a dearer page not cheaper; a stranger's claim, an address outside the
prefixes and a claim after the window, all refused; two releases; the bond and
the credit withdrawn. It prints a PASS or FAIL line for every check, the
balances before and after every step that moves money, `N passed, M failed`,
and the contract address.

## The site

`web/` is the site, a Next.js 16 app deployed on Vercel with the Root Directory
set to `web`. It looks like a supermarket shelf and a till receipt: products
hang as yellow price tags, buttons are cut like shelf labels, and every judged
claim prints as a thermal receipt (page read, same product or not, their price,
our price, the refund) with a red sticker on a match.

| page | what it does |
|---|---|
| `/` | the promise in one minute, a receipt printing the demo's kettle match, how the money moves |
| `/shop` | the demo shop's shelf: three products with their prices and guarantee windows, and Buy |
| `/order/[id]` | the order, its guarantee counting down, the claim (claim-fee credit, a competitor page picked from one-click chips, Claim), the waiting panel while the validators read the page, and the receipts |
| `/shops`, `/shop/[id]` | every shop, and any shop's products and bond |
| `/merchant` | open a shop with suggested names and the demo competitors' prefixes, fund and withdraw the bond, list products, release ended orders |
| `/mine` | your orders, your claim-fee credit, the shops you run |
| `/ledger` | `stats()` printed like a till's end-of-day report |
| `/how` | the four askings, why the live web makes this a GenLayer job, the money table, the limits, and `rules()` read live |

**The demo shop.** One visitor wallet can try everything. A throwaway Studio
key opens Harbour Lane Goods once, with a bond and the three demonstration
products, accepting the three competitor prefixes on
`raw.githubusercontent.com` pinned to the pushed commit:

```
cd web
REGISTER=<contract> DEMO_SHOP_KEY=<throwaway key> COMMIT=<40-character sha> node tools/open-demo-shop.mjs
DRY=1 REGISTER=<contract> COMMIT=<sha> node tools/open-demo-shop.mjs      # print the calls, send nothing
```

The visitor buys with their own wallet, adds 0.01 GEN of claim-fee credit,
picks one of the fifteen competitor pages from chips such as "Northgate: same
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
readings follow what the fifteen demo pages state, and any other address
cannot be read and stores nothing. A bar on every page says so, switches
between demo accounts, gives test GEN and moves the clock on.

```
cd web
npm ci
npm run typecheck && npm run lint && npm run test:site && npm run build
```

`npm run test:site` runs 44 node tests with no browser and no network.
They check every call the site can send and every view it reads against
`contracts/price_match.py`; compare the site's copies of the contract's rules
(addresses, prefixes, money words, the price reader, the combine tables) and
the in-memory `rules()` with the contract itself, through a stub of the
runtime, case by case; buy and claim with each of the fifteen demo pages and
check the outcome and the money; keep every atto accounted for over four
hundred seeded random steps; keep every suggestion inside the contract's
limits; cover the waiting copy for every state and role; and scan every file
for anything personal or internal.

## Network

GenLayer Studio, chain 61999, RPC `https://studio.genlayer.com/api`, explorer
`https://explorer-studio.genlayer.com`. The contract pins the runner
`py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` in its first
line.

## Evidence

The on-chain run is recorded here once it has run.

## Licence

MIT. See `LICENSE`.
