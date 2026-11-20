// Seeded random journeys through the in-memory contract: anyone does anything, in any order, with
// right and wrong amounts, and the clock jumps: claims, appeals, settlements, price changes and price
// drops among them. After every step no atto is created or lost; the contract's balance is exactly
// every shop's bond, every address's credit and every held claim fee; no shop ever reserves more than
// its bond; every open order reserves exactly what it stands at and every closed one nothing; every
// pending claim holds one fee; and the totals stats() publishes add up.

import test from "node:test";
import assert from "node:assert/strict";

import * as mock from "../../lib/chain-mock.ts";
import { calls } from "../../lib/calls.ts";
import { DEMO_PAGES } from "../../lib/demo-shop.ts";
import { BOND_CHIPS, BOND_CREDIT_CHIPS, CREDIT_CHIPS, NAME_CHIPS, PRICE_CHIPS, PRODUCT_CHIPS, REASON_CHIPS } from "../../lib/suggestions.ts";

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const view = async (fn, args) => JSON.parse(await mock.view(fn, args));

async function finalOf(hash) {
  for (let i = 0; i < 40; i++) {
    const s = await mock.txStatus(hash);
    if (s.status === "FINALIZED" || s.status === "UNDETERMINED") return s;
  }
  throw new Error("never final");
}

async function check(total, step) {
  let sum = mock.mockContractBalance();
  for (const a of mock.ACCOUNTS) sum += await mock.balanceOf(a);
  assert.equal(sum, total, `${step}: no atto created or lost`);
  const stats = await view("stats", []);
  let bonds = 0n;
  let reserved = 0n;
  for (let k = 1; k <= stats.shops; k++) {
    const s = await view("shop", ["S" + k]);
    assert.ok(BigInt(s.reserved) <= BigInt(s.bond), `${step}: S${k} reserves no more than its bond`);
    assert.equal(BigInt(s.free), BigInt(s.bond) - BigInt(s.reserved), `${step}: S${k}'s free bond is its bond less its reservations`);
    bonds += BigInt(s.bond);
    reserved += BigInt(s.reserved);
  }
  let openReserved = 0n;
  for (let k = 1; k <= stats.orders; k++) {
    const o = await view("order", ["O" + k]);
    if (o.status === "open") {
      assert.equal(o.reserved, o.stands_at, `${step}: open O${k} reserves what it stands at`);
      assert.equal(BigInt(o.stands_at), BigInt(o.price) - BigInt(o.dropped), `${step}: O${k} stands at its price less its drops`);
      openReserved += BigInt(o.reserved);
    } else assert.equal(o.reserved, "0", `${step}: closed O${k} reserves nothing`);
    assert.ok(BigInt(o.drop_due) >= 0n, `${step}: O${k} owes no negative drop`);
    if (o.pending) assert.equal(o.phase, "pending", `${step}: O${k} with a pending claim is pending`);
  }
  let credits = 0n;
  for (const a of mock.ACCOUNTS) credits += BigInt((await view("account", [a])).credit);
  assert.equal(BigInt(stats.bonds), bonds, `${step}: stats().bonds is every shop's bond`);
  assert.equal(BigInt(stats.reserved), reserved, `${step}: stats().reserved is every shop's reservations`);
  assert.equal(reserved, openReserved, `${step}: the reservations are exactly the open orders' prices`);
  assert.equal(BigInt(stats.credits), credits, `${step}: stats().credits is every address's credit`);
  assert.equal(BigInt(stats.stakes), BigInt(stats.pending) * 10n ** 16n, `${step}: every pending claim holds one fee`);
  const { held, balance } = mock.mockHeld();
  assert.equal(held, bonds + credits + BigInt(stats.stakes), `${step}: held is bonds, credits and held fees`);
  assert.equal(balance, held, `${step}: the contract's balance is what it holds`);
  assert.equal(BigInt(stats.held), held);
  // Every atto that ever came in either went out or is still held.
  const into = BigInt(stats.funded) + BigInt(stats.deposited);
  const out = BigInt(stats.withdrawn) + BigInt(stats.refunded) + BigInt(stats.dropped) + BigInt(stats.fees_to_shops) + BigInt(stats.credit_withdrawn);
  assert.equal(into - out, held, `${step}: everything paid in is held or was paid out`);
}

test("six hundred random steps keep every atto accounted for", async () => {
  const r = rng(20261013);
  const pick = (xs) => xs[Math.floor(r() * xs.length)];
  let total = mock.mockContractBalance();
  for (const a of mock.ACCOUNTS) total += await mock.balanceOf(a);
  await check(total, "start");
  const kinds = new Map();
  for (let step = 0; step < 600; step++) {
    const who = pick(mock.ACCOUNTS);
    mock.setMockPersona(who);
    const stats = await view("stats", []);
    const shop = "S" + (1 + Math.floor(r() * stats.shops));
    const product = "P" + (1 + Math.floor(r() * stats.products));
    // Mostly one of the three newest orders, whose windows may still run; else any order.
    const order = r() < 0.7 ? "O" + Math.max(1, stats.orders - Math.floor(r() * 3)) : "O" + (1 + Math.floor(r() * Math.max(1, stats.orders)));
    const roll = r();
    let kind = "";
    let call = null;
    if (roll < 0.06) {
      mock.advanceClock(pick([60, 600, 1800, 3600, 86400, 3 * 86400]));
      continue;
    } else if (roll < 0.1) {
      kind = "open_shop";
      call = calls.openShop(pick(NAME_CHIPS) + " " + step, r() < 0.8 ? mock.MOCK_PREFIXES.slice(0, 1 + Math.floor(r() * 3)) : ["https://not a prefix"]);
    } else if (roll < 0.16) {
      kind = "fund";
      const s = await view("shop", [shop]);
      if (r() < 0.7) mock.setMockPersona(s.owner);
      call = calls.fund(shop, r() < 0.1 ? 0n : pick(BOND_CHIPS).value);
    } else if (roll < 0.21) {
      kind = "withdraw_bond";
      const s = await view("shop", [shop]);
      if (r() < 0.7) mock.setMockPersona(s.owner);
      const free = BigInt(s.free);
      call = calls.withdrawBond(shop, r() < 0.3 ? free + 1n : free / 2n);
    } else if (roll < 0.27) {
      kind = "list_product";
      const s = await view("shop", [shop]);
      if (r() < 0.8) mock.setMockPersona(s.owner);
      const c = pick(PRODUCT_CHIPS);
      call = calls.listProduct(shop, c.title, r() < 0.1 ? c.spec + " Price on request." : c.spec, c.priceAtto, c.window);
    } else if (roll < 0.47) {
      kind = "buy";
      const p = await view("product", [product]);
      const price = BigInt(p.price);
      if ((await mock.balanceOf(mock.mockAddress())) < price + 10n ** 18n) {
        await mock.faucet(mock.mockAddress());
        total += 10n ** 19n;
      }
      call = calls.buy(product, r() < 0.15 ? price + 1n : price);
    } else if (roll < 0.55) {
      kind = "deposit";
      if ((await mock.balanceOf(who)) < 10n ** 17n) {
        await mock.faucet(who);
        total += 10n ** 19n;
      }
      call = calls.deposit(r() < 0.1 ? 0n : pick(CREDIT_CHIPS).value);
    } else if (roll < 0.59) {
      kind = "withdraw";
      call = calls.withdraw();
    } else if (roll < 0.72) {
      kind = "claim";
      const o = await view("order", [order]);
      if (!o.error && r() < 0.85) mock.setMockPersona(o.buyer);
      const page = r() < 0.9 ? mock.mockPage(pick(DEMO_PAGES).competitor, pick(DEMO_PAGES).file) : "https://elsewhere.example/a.html";
      call = calls.claim(order, page);
    } else if (roll < 0.78) {
      kind = "appeal";
      // Mostly an order whose claim is still inside its appeal window, else any order.
      const open = [];
      for (let k = 1; k <= stats.orders; k++) {
        const x = await view("order", ["O" + k]);
        if (x.pending) open.push(x.order);
      }
      const target = open.length && r() < 0.8 ? pick(open) : order;
      const o = await view("order", [target]);
      const rows = o.error ? [] : (await view("claims_of", [target])).rows;
      const c = rows.length ? (o.pending && r() < 0.9 ? rows.find((x) => x.claim === o.pending) : pick(rows)) : { claim: "C1", may_appeal: "buyer" };
      if (!o.error && r() < 0.8) mock.setMockPersona(c.may_appeal === "shop" ? (await view("shop", [o.shop])).owner : o.buyer);
      if (BigInt((await view("account", [mock.mockAddress()])).credit) < 5n * 10n ** 16n && r() < 0.7) {
        if ((await mock.balanceOf(mock.mockAddress())) < 10n ** 17n) {
          await mock.faucet(mock.mockAddress());
          total += 10n ** 19n;
        }
        await finalOf(await mock.write(calls.deposit(pick(BOND_CREDIT_CHIPS).value)));
        await check(total, `step ${step} (appeal credit)`);
      }
      call = calls.appeal(c.claim, r() < 0.1 ? "short" : pick(REASON_CHIPS).value);
    } else if (roll < 0.84) {
      kind = "settle";
      const o = await view("order", [order]);
      if (!o.error && r() < 0.4) mock.setMockPersona(o.buyer);
      call = calls.settle(!o.error && o.pending && r() < 0.9 ? o.pending : "C" + (1 + Math.floor(r() * Math.max(1, stats.claims))));
    } else if (roll < 0.88) {
      kind = "reprice";
      // Mostly the product of a recent order, so a drop can fall inside its window.
      const recent = await view("order", [order]);
      const target = !recent.error && r() < 0.7 ? recent.product : product;
      const p = await view("product", [target]);
      if (r() < 0.85) mock.setMockPersona(p.owner);
      call = calls.reprice(target, r() < 0.1 ? BigInt(p.price) : pick(PRICE_CHIPS).value);
    } else if (roll < 0.92) {
      kind = "claim_drop";
      // Mostly an order that is owed a drop, else any order.
      const owed = [];
      for (let k = 1; k <= stats.orders; k++) {
        const x = await view("order", ["O" + k]);
        if (x.drop_due !== "0") owed.push(x.order);
      }
      const o = await view("order", [owed.length && r() < 0.8 ? pick(owed) : order]);
      if (!o.error && r() < 0.85) mock.setMockPersona(o.buyer);
      call = calls.claimDrop(o.error ? order : o.order);
    } else {
      kind = "release";
      call = calls.release(order);
    }
    // A drained account asks the faucet first; the faucet's 10 GEN joins the world's total.
    while ((call.value ?? 0n) > (await mock.balanceOf(mock.mockAddress()))) {
      await mock.faucet(mock.mockAddress());
      total += 10n ** 19n;
    }
    const s = await finalOf(await mock.write(call));
    const done = s.exec === "SUCCESS" && s.result?.ok === true;
    const name = kind + (done ? "" : s.undetermined ? " unread" : " refused");
    kinds.set(name, (kinds.get(name) ?? 0) + 1);
    await check(total, `step ${step} (${name})`);
  }
  for (const k of [
    "open_shop", "fund", "fund refused", "withdraw_bond", "withdraw_bond refused", "list_product", "buy", "buy refused", "deposit", "withdraw", "claim", "claim refused",
    "appeal", "appeal refused", "settle", "settle refused", "reprice", "reprice refused", "claim_drop", "claim_drop refused", "release", "release refused",
  ])
    assert.ok((kinds.get(k) ?? 0) > 0, `the walk did ${k}`);
});
