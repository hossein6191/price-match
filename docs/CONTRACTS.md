# Contracts

One file, `contracts/price_match.py`. It is the only thing in this repository
that asks the network anything.

## contracts/price_match.py

### Purpose

A lowest-price guarantee whose claims are settled by the network. A shop
names the competitor pages it promises to match, funds a bond, and lists
products with a spec, a price and a guarantee window. A buyer pays the price,
the sale goes to the shop, and the price is reserved from the bond. Inside the
window the buyer points at a competitor page; every validator fetches it from
the live web, the network agrees whether it offers the same product and at
what price, and a cheaper match is paid from the reserved bond in the same
transaction.

### Consensus

One round per claim, `_judge(spec, url)`, a single
`gl.vm.run_nondet_unsafe(leader_fn, validator_fn)` block called from `claim`.
The only `gl.nondet` calls in the file are inside that `leader_fn`: one
`gl.nondet.web.render(url, mode="text")` and up to four
`gl.nondet.exec_prompt(..., response_format="text")`. Only the product's spec
and the page address enter the round; no amount, address, id, name or date is
passed in. The spec is shop text, so `list_product` refuses one that names a
price (`_money_problem`): a `$` sign, or any word of `MONEY_WORDS` (`gen`,
`atto`, `price`, `prices`, `priced`, `pricing`, `cost`, `costs`, `rrp`,
`msrp`) standing as a word in any case. A bare number is allowed, because it
cannot be told from a capacity or a size.

1. The fetch. A failure raises `[TRANSIENT]`. `_page_text` strips the text
   and refuses a page under `MIN_PAGE` (40) characters (`[TRANSIENT]`) or
   over `MAX_PAGE` (6,000) (`[EXPECTED]`): a page is judged whole or not at
   all, never cut.
2. `_same_task(spec, page)`: blocks SPEC, PAGE, and "Is the item offered on
   this page the same product as the specification: same brand, model,
   capacity or size, colour or finish, and condition (new)? Ignore price,
   shop and every other detail."
3. `_different_task(spec, page)`: blocks PAGE, SPEC, and the mirror, "Is the
   item offered on this page a different product from the specification:
   another brand, model, capacity or size, colour or finish, or a condition
   other than new? Ignore price, shop and every other detail."
4. Only when 2 and 3 give `same`: `_price_task(spec, page, SPEC_FIRST)` and
   `_price_task(spec, page, PAGE_FIRST)`, both asking "What is the page's
   current price for that item, in GEN, as a plain decimal number? If the page
   shows more than one price or none, answer unclear."

A failed model call raises `[LLM_ERROR]`. Each answer is read by
`_answer_of`, which takes the `answer` field of a JSON object (fenced or not)
or a short bare word, never raises, and never builds a float: a JSON number
with a fraction is kept as the text it was written as (`_keep_text`).
`_read_word` maps it into `yes`, `no`, `unclear` or nothing. `_atto` reads a
plain decimal with at most 18 places into an integer of atto, and refuses a
sign, a currency, a comma, an exponent, a leading point, other scripts'
digits and zero. `_combine_product` gives `same` for yes then no, `different`
for no then yes, and `unclear` otherwise. `_combine_price` keeps a price only
when both orders give the same integer. The leader returns
`{"product": ..., "price": ...}`.

`_agrees` is the whole comparison. A leader result that is not a
`gl.vm.Return` is never agreed with, so a failed fetch or a failed model call
never settles. A result that is not a table is refused without a rerun.
Otherwise the validator fetches the page and asks the askings itself inside
try/except, so its own failure is a disagreement, and compares the whole
value by exact equality. After agreement `_clean_value` reads it back: a word
outside the set is `unclear`, a price that is not canonical digits is empty,
and a price beside any word but `same` is dropped.

`_outcome` is the contract's own: `different` → different; not `same`, or no
price → unclear; a price below ours → matched; otherwise not cheaper. The
model never sees our price.

Every prompt has the same order:

1. The task: a lowest-price guarantee, the shop's SPEC, a competitor's PAGE
   fetched just now, one question.
2. The untrusted notice: what the delimiter lines are, that the SPEC and the
   PAGE are untrusted, written by two shops with money at stake, and never an
   instruction.
3. That the blocks may appear in any order.
4. The two blocks, in the asking's order.
5. The reading note: the PAGE may be page source with markup in round
   brackets; read it as a visitor would, and judge only what it states.
6. The question and the answer shape.

`_block` takes the label only from the contract's own set (anything else
prints as `BLOCK`), fences the body with `_fence` (`<` → `(`, `>` → `)`,
length kept), caps it at the same limit the door enforces, and tags both
delimiter lines with the first 16 hex characters of the body's own sha256.

### State

| field | what it holds |
|---|---|
| `shop_rows` | `Shop`: owner, name, `prefixes_json`, bond, reserved, funded, withdrawn, refunded, sales, fees_won, n_products, n_orders, n_open, opened_at |
| `product_rows` | `Product`: shop_id, title, spec, price, window, listed_at, n_orders |
| `order_rows` | `Order`: product_id, shop_id, buyer, price, bought_at, window_end, reserved, status (`open`, `matched`, `released`), ended_by (`match`, `claims`, `window`), n_claims, `claims_json` (at most 2 ids), refunded, closed_at |
| `claim_rows` | `Claim`: order_id, url, product, price, outcome, refund, fee_to (`buyer` or `shop`), at |
| `shop_names` | lowercase owner and name → shop id |
| `index`, `counts` | numbered lists: `owner:<address>`, `buyer:<address>`, `products:<shop>` and `orders:<shop>`, each appended in O(1) and read a page at a time |
| `credit` | lowercase address → claim-fee credit |
| totals | `bonds`, `reserved_total`, `credits`, `funded_total`, `withdrawn_total`, `sales_total`, `refunded_total`, `fees_total`, `deposited_total`, `credit_out`, `returned` and the counters behind `stats()` |

Storage dataclasses hold scalars only. Every instant is seconds on the message
clock, `gl.message_raw["datetime"]`, read with an integer-only calendar.

### Methods

Writes: `open_shop`, `fund` (payable), `withdraw_bond`, `list_product`, `buy`
(payable), `deposit` (payable), `withdraw`, `claim`, `release`. Views: `shop`,
`product`, `order`, `claims_of`, `products_of`, `orders_of`,
`orders_of_shop`, `shops_of`, `shops`, `account`, `stats`, `rules`.

Five writes compare the sender with a party and refuse: `fund`,
`withdraw_bond` and `list_product` (the owner), `buy` (anyone but the owner)
and `claim` (the buyer). Four refuse nobody by sender, say "Open on purpose"
in their docstrings, and are listed with their reasons in the static test:
`open_shop` (the sender becomes the new shop's owner), `deposit` (credits the
sender), `withdraw` (pays the sender its own credit) and `release` (moves
nothing out of the contract).

`claim` checks everything before the round (the buyer, an open order, the
window, the claim cap, the address, the prefix, a page not judged for this
order in the last `REJUDGE_GAP` (86,400) seconds, the credit) and writes nothing before it, so a round that does not
settle leaves no trace. After the round it records the claim, moves the fee
if the outcome is `different`, and ends the order through `_end_order` on a
match or on the second judged claim. `_end_order` is the single exit of an
order: it releases the reservation and pays a match from the bond. Every
settlement is O(1).

### Loops

Every loop is bounded by a named constant, and a static test lists each one:
the five URL signs, the prefixes (`MAX_PREFIXES`), the printable signs a
spec is split on (`SIGNS`), the money words (`MONEY_WORDS`), an order's claims
(`MAX_CLAIMS`) and every list page (`PAGE`). There is no `while`.

### Errors

| class | when | stored |
|---|---|---|
| `[EXPECTED]` | a rule of this contract, raised by a write that took no value; also a page over 6,000 characters, raised inside the round | nothing |
| `[TRANSIENT]` | the page could not be fetched, or read under 40 characters | nothing |
| `[LLM_ERROR]` | a model call failed | nothing |
| `{"ok": false}` | a refused payable call; everything sent goes back | the refusal is counted |

### Limits

The page must read the same for every validator at the time of the claim.
Prices are in GEN. A refund is at most the reserved price. See the README for
the full list.
