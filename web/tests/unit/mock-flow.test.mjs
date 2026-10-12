// Whole orders through the in-memory contract of mock mode, from node, with no browser:
//
//   node --test tests/unit/mock-flow.test.mjs
//
// A visitor buys from the demo shop and claims with each of the fifteen demo competitor pages: the
// same product for less is matched and the difference comes back from the bond in the same
// transaction; another model or a refurbished unit is a different product and the claim fee goes to
// the shop; a dearer page is not cheaper and nothing moves; a page with no price is unclear and
// nothing moves. Then every refusal a visitor can meet, each with its way out: a page that cannot be
// read stores nothing, a stranger cannot claim, a page outside the prefixes is refused, the same page
// cannot be re-rolled at once but can a day later, the window ends and anyone releases, a purchase
// the bond does not cover is sent back and the demo shop tops up. After every step no atto is created
// or lost and the contract holds exactly the bonds plus the credits.

import test from "node:test";
import assert from "node:assert/strict";

import * as mock from "../../lib/chain-mock.ts";
import { calls } from "../../lib/calls.ts";
import { DEMO_PAGES, DEMO_PRODUCTS } from "../../lib/demo-shop.ts";

const { VISITOR, DEMO_SHOP, PASSER_BY, EARLIER_BUYER, MY_SHOP } = mock;
const GEN = 10n ** 18n;
const FEE = GEN / 100n;

async function world() {
  let sum = mock.mockContractBalance();
  for (const a of mock.ACCOUNTS) sum += await mock.balanceOf(a);
  return sum;
}

const view = async (fn, args) => JSON.parse(await mock.view(fn, args));

/** Nothing created or lost; the contract holds exactly the bonds plus the credits; no shop over-reserved. */
async function conserved(total, step) {
  const { held, balance } = mock.mockHeld();
  assert.equal(held, balance, `${step}: the contract's balance is every bond plus every credit`);
  assert.equal(await world(), total, `${step}: no atto created or lost`);
  const stats = await view("stats", []);
  for (let k = 1; k <= stats.shops; k++) {
    const s = await view("shop", ["S" + k]);
    assert.ok(BigInt(s.reserved) <= BigInt(s.bond), `${step}: S${k} never reserves more than its bond`);
  }
}

async function finalOf(hash) {
  for (let i = 0; i < 40; i++) {
    const s = await mock.txStatus(hash);
    if (s.status === "FINALIZED" || s.status === "UNDETERMINED") return s;
  }
  throw new Error("never final: " + hash);
}

async function send(as, call) {
  mock.setMockPersona(as);
  return finalOf(await mock.write(call));
}

const refusal = (s) => (s.exec === "ERROR" ? s.message : s.result?.ok === false ? s.result.reason : "");
const productId = (key) => "P" + (DEMO_PRODUCTS.findIndex((p) => p.key === key) + 1);

test("each of the fifteen demo pages, claimed on its own product: the outcome the page states, and the money it moves", async () => {
  // Fifteen purchases need more than the visitor's starting GEN; the faucet's GEN joins the world before it is counted.
  for (let i = 0; i < 4; i++) await mock.faucet(VISITOR);
  const total = await world();
  await conserved(total, "seeded");
  const dep = await send(VISITOR, calls.deposit(GEN / 10n));
  assert.equal(dep.result.ok, true);
  for (const page of DEMO_PAGES) {
    const product = DEMO_PRODUCTS.find((p) => p.key === page.product);
    const price = BigInt(product.priceAtto);
    const pid = productId(page.product);
    const before = await mock.balanceOf(VISITOR);
    const shopBefore = await mock.balanceOf(DEMO_SHOP);
    const b = await send(VISITOR, calls.buy(pid, price));
    assert.equal(b.result.ok, true, `${page.file}: bought`);
    const order = b.result.order;
    assert.equal(await mock.balanceOf(VISITOR), before - price, "the price left the visitor");
    assert.equal(await mock.balanceOf(DEMO_SHOP), shopBefore + price, "and reached the shop in the same transaction");
    assert.equal((await view("order", [order])).reserved, product.priceAtto, "the same amount of bond is reserved");
    await conserved(total, `${page.file} bought`);

    const credit = BigInt((await view("account", [VISITOR])).credit);
    const bond = BigInt((await view("shop", ["S1"])).bond);
    const c = await send(VISITOR, calls.claim(order, mock.mockPage(page.competitor, page.file)));
    assert.equal(c.status, "FINALIZED", `${page.file}: the round settles`);
    assert.equal(c.result.outcome, page.expect, `${page.file}: ${page.expect}`);
    const o = await view("order", [order]);
    const claims = await view("claims_of", [order]);
    assert.equal(claims.rows.length, 1);
    assert.equal(claims.rows[0].outcome, page.expect);
    if (page.expect === "matched") {
      const refund = price - BigInt(page.priceAtto);
      assert.equal(c.result.refund, refund.toString());
      assert.equal(o.status, "matched");
      assert.equal(o.reserved, "0", "the reservation is released");
      assert.equal(await mock.balanceOf(VISITOR), before - price + refund, "the difference came back in the same transaction");
      assert.equal(BigInt((await view("shop", ["S1"])).bond), bond - refund, "from the bond");
      assert.equal(claims.rows[0].price, page.priceAtto, "the page's own price was agreed");
    } else if (page.expect === "different") {
      assert.equal(c.result.fee_to, "shop");
      assert.equal(BigInt((await view("account", [VISITOR])).credit), credit - FEE, "the claim fee left the credit");
      assert.equal(o.status, "open", "the order stays open with one claim left");
      assert.equal(o.claims_left, 1);
      assert.equal(claims.rows[0].price, "", "no price is kept beside another product");
    } else {
      assert.equal(c.result.fee_to, "buyer");
      assert.equal(c.result.refund, "0");
      assert.equal(BigInt((await view("account", [VISITOR])).credit), credit, "the fee stays with the buyer");
      assert.equal(o.status, "open");
      assert.equal(await mock.balanceOf(VISITOR), before - price, "nothing moved");
      if (page.expect === "not_cheaper") assert.equal(claims.rows[0].price, page.priceAtto);
      else assert.equal(claims.rows[0].price, "", "a page with no price has no agreed price");
    }
    await conserved(total, `${page.file} claimed`);
    if (o.status === "open") {
      // The window runs out with no match; a passer-by releases the reservation back to the free bond.
      mock.advanceClock(product.window);
      const r = await send(PASSER_BY, calls.release(order));
      assert.equal(r.result.status, "released");
      assert.equal((await view("order", [order])).ended_by, "window");
      await conserved(total, `${page.file} released`);
    }
  }
});

test("a page about another product is another product, whatever its price", async () => {
  const total = await world();
  const earbuds = DEMO_PRODUCTS[1];
  const b = await send(VISITOR, calls.buy("P2", BigInt(earbuds.priceAtto)));
  const order = b.result.order;
  const c = await send(VISITOR, calls.claim(order, mock.mockPage("northgate", "lumio-k3-kettle.html")));
  assert.equal(c.result.product, "different");
  assert.equal(c.result.outcome, "different");
  await conserved(total, "cross-product");
});

test("a page that cannot be read stores nothing, and the claim can be made again", async () => {
  const total = await world();
  const bag = DEMO_PRODUCTS[2];
  const b = await send(VISITOR, calls.buy("P3", BigInt(bag.priceAtto)));
  const order = b.result.order;
  const credit = (await view("account", [VISITOR])).credit;
  const s = await send(VISITOR, calls.claim(order, mock.mockPage("northgate", "not-a-page.html")));
  assert.equal(s.status, "UNDETERMINED");
  assert.equal(s.undetermined, true);
  assert.match(s.message, /\[TRANSIENT\] the page could not be fetched; nothing was stored, and the claim may be made again/);
  const o = await view("order", [order]);
  assert.equal(o.claims.length, 0, "no claim was stored");
  assert.equal(o.claims_left, 2);
  assert.equal((await view("account", [VISITOR])).credit, credit, "the credit is untouched");
  const again = await send(VISITOR, calls.claim(order, mock.mockPage("corner-hardware", "tidewell-dry-bag-20l.html")));
  assert.equal(again.result.outcome, "matched", "and the next claim is judged");
  await conserved(total, "unread page");
});

test("every refusal a buyer can meet, each with its way out", async () => {
  const total = await world();
  const kettle = DEMO_PRODUCTS[0];
  const price = BigInt(kettle.priceAtto);

  const short = await send(VISITOR, calls.buy("P1", price - 1n));
  assert.equal(short.result.ok, false);
  assert.match(short.result.reason, /send exactly the price of 2000000000000000000 atto to buy P1; this one sent 1999999999999999999/);
  assert.equal(short.result.returned, (price - 1n).toString(), "a refused purchase sends everything back");

  const own = await send(DEMO_SHOP, calls.buy("P1", price));
  assert.match(own.result.reason, /the shop that lists P1 may not buy it/);

  const b = await send(VISITOR, calls.buy("P1", price));
  const order = b.result.order;
  assert.match(refusal(await send(PASSER_BY, calls.claim(order, mock.MOCK_PAGES[0]))), new RegExp(`only the buyer of ${order} may claim on it`));
  assert.match(refusal(await send(VISITOR, calls.claim(order, "https://elsewhere.example/competitors/northgate/lumio-k3-kettle.html"))), /the page is not below any competitor prefix S1 accepted; shop\(S1\) lists them/);
  assert.match(refusal(await send(VISITOR, calls.claim(order, "http://x.example/a"))), /the page address starts with https:\/\//);
  assert.match(refusal(await send(VISITOR, calls.release(order))), new RegExp(`the guarantee window of ${order} runs for another \\d+ seconds; its price stays reserved until then`));

  // A dearer page, then the same page again at once: refused, it may come again a day later; another page now is fine.
  const dearer = mock.mockPage("bright-basket", "lumio-k3-kettle.html");
  assert.equal((await send(VISITOR, calls.claim(order, dearer))).result.outcome, "not_cheaper");
  assert.match(refusal(await send(VISITOR, calls.claim(order, dearer))), new RegExp(`this page was judged for ${order} \\d+ seconds ago; the same page may be judged again 86400 seconds after its last judgment`));
  assert.equal((await send(VISITOR, calls.claim(order, mock.mockPage("corner-hardware", "lumio-k3-kettle.html")))).result.outcome, "unclear");
  const o = await view("order", [order]);
  assert.equal(o.status, "released", "two judged claims without a match release the reservation");
  assert.equal(o.ended_by, "claims");
  assert.match(refusal(await send(VISITOR, calls.claim(order, mock.MOCK_PAGES[0]))), new RegExp(`${order} is released; a claim is taken while the order is open`));

  // The window ends: no claim, but anyone may release.
  const b2 = await send(VISITOR, calls.buy("P1", price));
  const late = b2.result.order;
  mock.advanceClock(kettle.window);
  assert.match(refusal(await send(VISITOR, calls.claim(late, mock.MOCK_PAGES[0]))), new RegExp(`the guarantee window of ${late} has closed; release\\(${late}\\) frees the reserved bond`));
  const free = BigInt((await view("shop", ["S1"])).free);
  const r = await send(PASSER_BY, calls.release(late));
  assert.equal(r.result.status, "released");
  assert.equal(BigInt((await view("shop", ["S1"])).free), free + price, "the reservation is back in the free bond");
  assert.match(refusal(await send(PASSER_BY, calls.release(late))), new RegExp(`${late} is released; its reservation was already released`));

  // No credit: a claim is refused before anything is read; the credit route is deposit, and withdraw takes it all back.
  const b3 = await send(EARLIER_BUYER, calls.buy("P2", BigInt(DEMO_PRODUCTS[1].priceAtto)));
  const w = await send(EARLIER_BUYER, calls.withdraw());
  assert.equal(w.result.ok, true);
  assert.match(refusal(await send(EARLIER_BUYER, calls.withdraw())), /this address holds no claim-fee credit/);
  assert.match(refusal(await send(EARLIER_BUYER, calls.claim(b3.result.order, mock.MOCK_PAGES[5]))), /a claim stakes 10000000000000000 atto \(0.01 GEN\) of claim-fee credit and this address holds 0; deposit\(\) first/);
  await conserved(total, "refusals");
});

test("a purchase the bond does not cover is sent back, and the demo shop tops up", async () => {
  const total0 = await world();
  // Drain the demo shop's free bond down to under one kettle.
  const s = await view("shop", ["S1"]);
  const free = BigInt(s.free);
  const take = free - GEN;
  const w = await send(DEMO_SHOP, calls.withdrawBond("S1", take));
  assert.equal(w.result.ok, true);
  assert.match(refusal(await send(DEMO_SHOP, calls.withdrawBond("S1", GEN + 1n))), /only 1000000000000000000 atto of the bond of S1 is free; \d+ is reserved for open orders/);
  assert.match(refusal(await send(VISITOR, calls.withdrawBond("S1", 1n))), /only the owner of S1 may withdraw its bond/);
  const price = BigInt(DEMO_PRODUCTS[0].priceAtto);
  const before = await mock.balanceOf(VISITOR);
  const refused = await send(VISITOR, calls.buy("P1", price));
  assert.equal(refused.result.ok, false);
  assert.match(refused.result.reason, /the free bond of S1 is 1000000000000000000 atto and does not cover the price; a sale is taken only while the bond covers the most a match can give back/);
  assert.equal(await mock.balanceOf(VISITOR), before, "and the price came back in the same transaction");
  assert.equal((await view("product", ["P1"])).covered, false);
  const asked = await mock.demoRestock("P1");
  assert.equal(asked.ok, true);
  const f = await finalOf(asked.hash);
  assert.equal(f.result.ok, true);
  assert.equal((await view("product", ["P1"])).covered, true, "covered again");
  assert.equal((await send(VISITOR, calls.buy("P1", price))).result.ok, true);
  assert.deepEqual(await mock.demoRestock("P1"), { ok: true, hash: "", already: true }, "a covered product needs no top-up");
  const other = await mock.demoRestock("P4");
  assert.equal(other.ok, false, "the demo shop tops up only its own shop");
  // The demo restock may draw on the faucet, which joins the world's total.
  assert.ok((await world()) >= total0);
});

test("a shop owner's whole round: open, fund, list, sell, and take the free bond back", async () => {
  const total = await world();
  const prefixes = mock.MOCK_PREFIXES;
  const o = await send(MY_SHOP, calls.openShop("Millbrook Outdoor", prefixes));
  assert.equal(o.result.ok, true);
  const shop = o.result.shop;
  assert.match(refusal(await send(MY_SHOP, calls.openShop("millbrook outdoor", prefixes))), new RegExp(`this address already opened a shop named millbrook outdoor, ${shop}`));
  assert.match(refusal(await send(MY_SHOP, calls.listProduct(shop, "Dry bag", "Tidewell DB-20 dry bag, orange, 20 litres, new, at cost price today.", GEN, 1800))), /the word "price" may not appear in it/);
  const l = await send(MY_SHOP, calls.listProduct(shop, DEMO_PRODUCTS[2].title, DEMO_PRODUCTS[2].spec, GEN, 1800));
  const pid = l.result.product;
  const uncovered = await send(VISITOR, calls.buy(pid, GEN));
  assert.equal(uncovered.result.ok, false, "no bond, no sale");
  assert.equal((await send(MY_SHOP, calls.fund(shop, 3n * GEN))).result.ok, true);
  const strangerFund = await send(VISITOR, calls.fund(shop, GEN));
  assert.equal(strangerFund.result.ok, false);
  assert.equal(strangerFund.result.returned, GEN.toString(), "a refused fund sends everything back");
  const b = await send(VISITOR, calls.buy(pid, GEN));
  assert.equal(b.result.ok, true);
  const c = await send(VISITOR, calls.claim(b.result.order, mock.mockPage("corner-hardware", "tidewell-dry-bag-20l.html")));
  assert.equal(c.result.outcome, "matched", "0.95 GEN is below the 1 GEN this shop asks");
  assert.equal(c.result.refund, ((GEN * 5n) / 100n).toString());
  const s = await view("shop", [shop]);
  const w = await send(MY_SHOP, calls.withdrawBond(shop, BigInt(s.free)));
  assert.equal(w.result.ok, true);
  assert.equal((await view("shop", [shop])).bond, "0");
  await conserved(total, "a shop's round");
});
