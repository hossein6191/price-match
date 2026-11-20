// Whole orders through the in-memory contract of mock mode, from node, with no browser:
//
//   node --test tests/unit/mock-flow.test.mjs
//
// A visitor buys from the demo shop and claims with each of the forty-nine demo competitor pages. A
// claim moves nothing: it is pending for its 15-minute appeal window. Once it settles, the same
// product in stock for less is matched and the difference comes back from the bond; a page that shows
// it sold out or on pre-order is not in stock and the fee comes back; another model or a refurbished
// unit is a different product and the claim fee goes to the shop; a dearer page is not cheaper; a page
// with no price is unclear. Then every refusal a visitor can meet, each with its way out; an appeal by
// either side, and its refusals; price protection (a drop and a rise, claimed, paid at release and at
// settlement); and the demo shop's own reprice and appeal. After every step no atto is created or lost
// and the contract holds exactly the bonds, the credits and the held fees.

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

/** Nothing created or lost; the contract holds exactly the bonds, the credits and the held fees; no shop over-reserved. */
async function conserved(total, step) {
  const { held, balance } = mock.mockHeld();
  assert.equal(held, balance, `${step}: the contract's balance is every bond, every credit and every held fee`);
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

test("each of the forty-nine demo pages, claimed on its own product: pending first, then the outcome the page states, and the money it moves", async () => {
  assert.equal(DEMO_PRODUCTS.length, 9, "nine demo products");
  assert.equal(DEMO_PAGES.length, 49, "five pages for each, and four sold-out or pre-order pages");
  // Forty-nine purchases need more than the visitor's starting GEN; the faucet's GEN joins the world before it is counted.
  for (let i = 0; i < 10; i++) await mock.faucet(VISITOR);
  const total = await world();
  await conserved(total, "seeded");
  const dep = await send(VISITOR, calls.deposit(GEN / 4n));
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
    assert.equal(c.result.state, "pending");
    assert.equal(c.result.may_appeal, page.expect === "matched" ? "shop" : "buyer", "the side the finding went against may appeal");
    assert.match(c.result.page, /^[0-9a-f]{64}$/, "the hash of the text judged");
    // Pending: nothing has moved but the staked fee.
    assert.equal(await mock.balanceOf(VISITOR), before - price, `${page.file}: nothing moved while pending`);
    assert.equal(BigInt((await view("account", [VISITOR])).credit), credit - FEE, "the fee is staked");
    assert.equal(BigInt((await view("shop", ["S1"])).bond), bond, "the bond is untouched while pending");
    let o = await view("order", [order]);
    assert.equal(o.phase, "pending");
    assert.equal(o.pending, c.result.claim);
    assert.equal(o.drop_due, "0", "no drop is claimable while a claim is pending");
    let claims = await view("claims_of", [order]);
    assert.equal(claims.rows[0].phase, "appeal");
    assert.equal(claims.rows[0].stock, page.availability === "in_stock" && !page.refurbished && page.expect !== "different" ? "in_stock" : page.expect === "not_in_stock" ? "out_of_stock" : "");
    await conserved(total, `${page.file} claimed`);

    // Settle: a match after its window (anyone may), anything else at once by the buyer, which waives the appeal.
    if (page.expect === "matched") {
      mock.advanceClock(900);
      const st = await send(PASSER_BY, calls.settle(c.result.claim));
      assert.equal(st.result.settled_by, "window");
    } else {
      const st = await send(VISITOR, calls.settle(c.result.claim));
      assert.equal(st.result.settled_by, "waived");
    }
    o = await view("order", [order]);
    claims = await view("claims_of", [order]);
    assert.equal(claims.rows[0].state, "settled");
    assert.equal(claims.rows[0].final, page.expect);
    if (page.expect === "matched") {
      const refund = price - BigInt(page.priceAtto);
      assert.equal(claims.rows[0].paid, refund.toString());
      assert.equal(o.status, "matched");
      assert.equal(o.reserved, "0", "the reservation is released");
      assert.equal(await mock.balanceOf(VISITOR), before - price + refund, "the difference came back when it settled");
      assert.equal(BigInt((await view("shop", ["S1"])).bond), bond - refund, "from the bond");
      assert.equal(claims.rows[0].price, page.priceAtto, "the page's own price was agreed");
      assert.equal(BigInt((await view("account", [VISITOR])).credit), credit, "the fee came back");
    } else if (page.expect === "different") {
      assert.equal(claims.rows[0].fee_to, "shop");
      assert.equal(BigInt((await view("account", [VISITOR])).credit), credit - FEE, "the claim fee went to the shop");
      assert.equal(o.status, "open", "the order stays open with one claim left");
      assert.equal(o.claims_left, 1);
      assert.equal(claims.rows[0].price, "", "no price is kept beside another product");
    } else {
      assert.equal(claims.rows[0].fee_to, "buyer");
      assert.equal(claims.rows[0].paid, "0");
      assert.equal(BigInt((await view("account", [VISITOR])).credit), credit, "the fee came back to the buyer");
      assert.equal(o.status, "open");
      assert.equal(await mock.balanceOf(VISITOR), before - price, "nothing moved");
      if (page.expect === "not_cheaper") assert.equal(claims.rows[0].price, page.priceAtto);
      else assert.equal(claims.rows[0].price, "", "a page with no price, or not in stock, has no agreed price");
    }
    await conserved(total, `${page.file} settled`);
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
  assert.equal((await send(DEMO_SHOP, calls.settle(again.result.claim))).result.settled_by, "waived", "the shop may waive its appeal");
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

  // A dearer page; while it is pending no other claim and no release; settled, the same page again at once is
  // refused (it may come again a day later), and another page now is fine.
  const dearer = mock.mockPage("bright-basket", "lumio-k3-kettle.html");
  const first = await send(VISITOR, calls.claim(order, dearer));
  assert.equal(first.result.outcome, "not_cheaper");
  const cid = first.result.claim;
  assert.match(refusal(await send(VISITOR, calls.claim(order, mock.MOCK_PAGES[0]))), new RegExp(`claim ${cid} on ${order} is pending; one claim settles before the next: the buyer may waive its appeal with settle\\(${cid}\\) now`));
  assert.match(refusal(await send(VISITOR, calls.claimDrop(order))), new RegExp(`claim ${cid} on ${order} is pending; a price drop waits until it settles`));
  assert.match(refusal(await send(PASSER_BY, calls.settle(cid))), new RegExp(`${cid} may be appealed by the buyer for another \\d+ seconds; until then only that side may settle it, which waives its appeal`));
  assert.equal((await send(VISITOR, calls.settle(cid))).result.ok, true);
  assert.match(refusal(await send(VISITOR, calls.settle(cid))), new RegExp(`${cid} is already settled \\(waived\\)`));
  assert.match(refusal(await send(VISITOR, calls.claim(order, dearer))), new RegExp(`this page was judged for ${order} \\d+ seconds ago; the same page may be judged again 86400 seconds after its last judgment`));
  const second = await send(VISITOR, calls.claim(order, mock.mockPage("corner-hardware", "lumio-k3-kettle.html")));
  assert.equal(second.result.outcome, "unclear");
  assert.equal((await send(VISITOR, calls.settle(second.result.claim))).result.ok, true);
  const o = await view("order", [order]);
  assert.equal(o.status, "released", "two judged claims without a match release the reservation");
  assert.equal(o.ended_by, "claims");
  assert.match(refusal(await send(VISITOR, calls.claim(order, mock.MOCK_PAGES[0]))), new RegExp(`${order} is released; a claim is taken while the order is open`));

  // The window ends: no claim, but anyone may release.
  const b2 = await send(VISITOR, calls.buy("P1", price));
  const late = b2.result.order;
  const pend = await send(VISITOR, calls.claim(late, mock.mockPage("northgate", "lumio-k3-kettle-sold-out.html")));
  assert.equal(pend.result.outcome, "not_in_stock");
  mock.advanceClock(kettle.window);
  assert.match(refusal(await send(PASSER_BY, calls.release(late))), new RegExp(`claim ${pend.result.claim} on ${late} is pending; settle\\(${pend.result.claim}\\) first, which anyone may once its appeal window has closed`));
  assert.equal((await send(PASSER_BY, calls.settle(pend.result.claim))).result.settled_by, "window", "anyone settles once the window closed");
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
  const other = await mock.demoRestock("P" + (DEMO_PRODUCTS.length + 1));
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
  const settled = await send(MY_SHOP, calls.settle(c.result.claim));
  assert.equal(settled.result.paid, ((GEN * 5n) / 100n).toString(), "the shop waives its appeal and the refund is paid");
  const s = await view("shop", [shop]);
  const w = await send(MY_SHOP, calls.withdrawBond(shop, BigInt(s.free)));
  assert.equal(w.result.ok, true);
  assert.equal((await view("shop", [shop])).bond, "0");
  await conserved(total, "a shop's round");
});

test("an appeal by the shop on a match, and by the buyer on anything else: the second reading, the bond, the refusals", async () => {
  const total = await world();
  const kettle = DEMO_PRODUCTS[0];
  const price = BigInt(kettle.priceAtto);
  await send(VISITOR, calls.deposit(GEN / 10n));
  const b = await send(VISITOR, calls.buy("P1", price));
  const order = b.result.order;
  const c = await send(VISITOR, calls.claim(order, mock.mockPage("northgate", "lumio-k3-kettle.html")));
  const cid = c.result.claim;
  assert.equal(c.result.may_appeal, "shop");
  const reason = "The shop asks for a second reading of the price line.";
  assert.match(refusal(await send(VISITOR, calls.appeal(cid, reason))), new RegExp(`only the shop of ${order} may appeal ${cid}: the finding, matched, went against that side`));
  assert.match(refusal(await send(PASSER_BY, calls.appeal(cid, reason))), /only the shop of/);
  assert.match(refusal(await send(DEMO_SHOP, calls.appeal(cid, "short"))), /the reason is 10 to 280 characters; this one is 5/);
  // The demo shop holds no credit yet: refused before anything is read.
  const shopCredit = BigInt((await view("account", [DEMO_SHOP])).credit);
  if (shopCredit >= GEN / 20n) await send(DEMO_SHOP, calls.withdraw());
  assert.match(refusal(await send(DEMO_SHOP, calls.appeal(cid, reason))), /an appeal stakes 50000000000000000 atto \(0.05 GEN\) of credit and this address holds 0; deposit\(\) first/);
  await send(DEMO_SHOP, calls.deposit(GEN / 20n));
  const buyerCredit = BigInt((await view("account", [VISITOR])).credit);
  const before = await mock.balanceOf(VISITOR);
  const a = await send(DEMO_SHOP, calls.appeal(cid, reason));
  assert.equal(a.result.ok, true);
  assert.equal(a.result.result, "upheld", "the same page reads the same, so the first reading stands");
  assert.equal(a.result.bond_to, "buyer");
  assert.equal(a.result.final, "matched");
  assert.equal(await mock.balanceOf(VISITOR), before + (price - BigInt(DEMO_PAGES[0].priceAtto)), "the refund is paid in the appeal's call");
  assert.equal(BigInt((await view("account", [VISITOR])).credit), buyerCredit + GEN / 20n + FEE, "the bond and the fee went to the buyer's credit");
  assert.equal((await view("account", [DEMO_SHOP])).credit, "0", "the shop's bond is gone");
  const row = (await view("claims_of", [order])).rows[0];
  assert.equal(row.settled_by, "appeal");
  assert.equal(row.appeal.by, "shop");
  assert.equal(row.appeal.reason, reason);
  assert.equal(row.appeal.outcome, "matched", "both readings are kept");
  assert.match(refusal(await send(DEMO_SHOP, calls.appeal(cid, reason))), new RegExp(`${cid} is settled \\(appeal\\); a claim is appealed once, before it settles, and an appeal is never appealed`));
  // The buyer appeals a sold-out finding; upheld, so the bond goes to the shop. After the window, refused.
  const b2 = await send(VISITOR, calls.buy("P1", price));
  const c2 = await send(VISITOR, calls.claim(b2.result.order, mock.mockPage("northgate", "lumio-k3-kettle-pre-order.html")));
  assert.equal(c2.result.outcome, "not_in_stock");
  const a2 = await send(VISITOR, calls.appeal(c2.result.claim, "The page shows the kettle available to order today."));
  assert.equal(a2.result.result, "upheld");
  assert.equal(a2.result.bond_to, "shop");
  assert.equal(a2.result.fee_to, "buyer", "not in stock returns the fee");
  const b3 = await send(VISITOR, calls.buy("P1", price));
  const c3 = await send(VISITOR, calls.claim(b3.result.order, mock.mockPage("bright-basket", "lumio-k3-kettle.html")));
  mock.advanceClock(901);
  assert.match(refusal(await send(VISITOR, calls.appeal(c3.result.claim, reason))), new RegExp(`the appeal window of ${c3.result.claim} closed \\d+ seconds ago; anyone may settle\\(${c3.result.claim}\\) now`));
  await send(PASSER_BY, calls.settle(c3.result.claim));
  await conserved(total, "appeals");
});

test("price protection: a drop and a rise are still owed, claimed once, paid at release and at settlement", async () => {
  const total = await world();
  const kettle = DEMO_PRODUCTS[0];
  const price = BigInt(kettle.priceAtto);
  const down = price - (3n * GEN) / 10n;
  const b = await send(VISITOR, calls.buy("P1", price));
  const order = b.result.order;
  assert.match(refusal(await send(VISITOR, calls.claimDrop(order))), new RegExp(`P1 was priced at no less than ${price} atto during the window of ${order}, not below the ${price} it stands at; there is no drop to claim`));
  assert.match(refusal(await send(VISITOR, calls.reprice("P1", down))), /only the owner of S1 may reprice P1/);
  assert.match(refusal(await send(DEMO_SHOP, calls.reprice("P1", price))), new RegExp(`P1 is already priced at ${price} atto`));
  const r1 = await send(DEMO_SHOP, calls.reprice("P1", down));
  assert.equal(r1.result.was, price.toString());
  await send(DEMO_SHOP, calls.reprice("P1", price));
  const p = await view("product", ["P1"]);
  assert.equal(p.history.length >= 2, true, "both changes are recorded");
  assert.equal(p.reprices_left, 16 - p.reprices);
  let o = await view("order", [order]);
  assert.equal(o.drop_due, ((3n * GEN) / 10n).toString(), "the drop is owed even after the price went back up");
  const before = await mock.balanceOf(VISITOR);
  const d = await send(VISITOR, calls.claimDrop(order));
  assert.equal(d.result.paid, ((3n * GEN) / 10n).toString());
  assert.equal(await mock.balanceOf(VISITOR), before + (3n * GEN) / 10n);
  o = await view("order", [order]);
  assert.equal(o.stands_at, down.toString());
  assert.equal(o.reserved, down.toString(), "the drop came out of the order's own reservation");
  assert.equal(o.drop_due, "0");
  assert.match(refusal(await send(VISITOR, calls.claimDrop(order))), /there is no drop to claim/);
  // Now Northgate's 1.80 page is not cheaper than the 1.70 the order stands at.
  const c = await send(VISITOR, calls.claim(order, mock.mockPage("northgate", "lumio-k3-kettle.html")));
  assert.equal(c.result.outcome, "not_cheaper");
  await send(VISITOR, calls.settle(c.result.claim));
  await conserved(total, "a drop claimed");

  // A drop never claimed is paid by the release after the window.
  const b2 = await send(VISITOR, calls.buy("P1", price));
  await send(DEMO_SHOP, calls.reprice("P1", down));
  await send(DEMO_SHOP, calls.reprice("P1", price));
  mock.advanceClock(kettle.window);
  const mid = await mock.balanceOf(VISITOR);
  const rel = await send(PASSER_BY, calls.release(b2.result.order));
  assert.equal(rel.result.drop_paid, ((3n * GEN) / 10n).toString());
  assert.equal(await mock.balanceOf(VISITOR), mid + (3n * GEN) / 10n, "to the buyer, whoever releases");
  await conserved(total, "a drop paid at release");

  // A drop while a match is pending is paid first at settlement, and the refund follows the page's price.
  const b3 = await send(VISITOR, calls.buy("P1", price));
  const c3 = await send(VISITOR, calls.claim(b3.result.order, mock.mockPage("northgate", "lumio-k3-kettle.html")));
  assert.equal(c3.result.refund, (GEN / 5n).toString());
  await send(DEMO_SHOP, calls.reprice("P1", (15n * GEN) / 10n));
  const pre = await mock.balanceOf(VISITOR);
  const st = await send(DEMO_SHOP, calls.settle(c3.result.claim));
  assert.equal(st.result.paid, "0", "the page's 1.80 is not below the 1.50 the order now stands at");
  assert.equal(await mock.balanceOf(VISITOR), pre + GEN / 2n, "the 0.50 drop was paid first");
  await send(DEMO_SHOP, calls.reprice("P1", price));
  await conserved(total, "a drop paid at settlement");
});

test("the demo shop reprices a demo product down and back, and appeals a match, when a visitor asks", async () => {
  const kettle = DEMO_PRODUCTS[0];
  const price = BigInt(kettle.priceAtto);
  await mock.faucet(VISITOR);
  await send(VISITOR, calls.deposit(GEN / 10n));
  assert.match((await mock.demoAsk({ kind: "reprice", product: "P1", direction: "up" })).reason, /P1 is already at its list price/);
  const down = await mock.demoAsk({ kind: "reprice", product: "P1", direction: "down" });
  assert.equal(down.ok, true);
  assert.equal((await finalOf(down.hash)).result.price, (price - (3n * GEN) / 10n).toString());
  assert.match((await mock.demoAsk({ kind: "reprice", product: "P1", direction: "down" })).reason, /P1 is already below its list price/);
  const up = await mock.demoAsk({ kind: "reprice", product: "P1", direction: "up" });
  assert.equal((await finalOf(up.hash)).result.price, price.toString());
  assert.match((await mock.demoAsk({ kind: "reprice", product: "P" + (DEMO_PRODUCTS.length + 1), direction: "down" })).reason, /is not in the demo shop/);
  // Earlier tests left orders open; the demo shop tops up so the kettle sells.
  for (let i = 0; i < 3 && !(await view("product", ["P1"])).covered; i++) await finalOf((await mock.demoRestock("P1")).hash);
  const b = await send(VISITOR, calls.buy("P1", price));
  const c = await send(VISITOR, calls.claim(b.result.order, mock.mockPage("northgate", "lumio-k3-kettle.html")));
  const asked = await mock.demoAsk({ kind: "appeal", order: b.result.order, claim: c.result.claim });
  assert.equal(asked.ok, true);
  assert.equal((await finalOf(asked.hash)).result.result, "upheld");
  assert.match((await mock.demoAsk({ kind: "appeal", order: b.result.order, claim: c.result.claim })).reason, /is settled; a claim is appealed once/);
  for (let i = 0; i < 3 && !(await view("product", ["P1"])).covered; i++) await finalOf((await mock.demoRestock("P1")).hash);
  const b2 = await send(VISITOR, calls.buy("P1", price));
  const c2 = await send(VISITOR, calls.claim(b2.result.order, mock.mockPage("bright-basket", "lumio-k3-kettle.html")));
  assert.match((await mock.demoAsk({ kind: "appeal", order: b2.result.order, claim: c2.result.claim })).reason, /found not cheaper; only the buyer may appeal that/);
  await send(VISITOR, calls.settle(c2.result.claim));
});
