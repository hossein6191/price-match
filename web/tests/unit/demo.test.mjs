// The demo shop's server-side guards, from node: the key read forgivingly and its problems named
// exactly (never echoing it), the rate limit, the rule for a top-up, which shop counts as the demo
// shop, how the demo shop is reopened at a new commit, and the scripted reading of the demo build,
// which must give each demo page the outcome its chip promises.

import test from "node:test";
import assert from "node:assert/strict";

import { BAD_KEY, NO_KEY, cleanKey, keyProblem } from "../../lib/demo-key.ts";
import { DEMO_LIMITS, createLimiter } from "../../lib/demo-limit.ts";
import {
  DEMO_BOND,
  DEMO_PAGES,
  DEMO_PRODUCTS,
  DEMO_SHOP_NAME,
  FETCH_FAILED,
  demoPageOf,
  demoPrefixes,
  demoShopPlan,
  isDemoShop,
  isDemoShopName,
  nextDemoShopName,
  pickDemoShop,
  restockProblem,
  samePrefixes,
  scriptedReading,
} from "../../lib/demo-shop.ts";
import { outcomeOf } from "../../lib/rules.ts";

const HEX = "ab".repeat(32);

test("the key is read forgivingly: spaces, quotes and a missing 0x are all fine", () => {
  for (const raw of [`0x${HEX}`, ` 0x${HEX} `, `"0x${HEX}"`, `'${HEX}'`, HEX, `0X${HEX}`, `\`0x${HEX}\`\n`]) {
    assert.equal(keyProblem(raw), "", JSON.stringify(raw));
    assert.equal(cleanKey(raw), `0x${HEX}`);
  }
});

test("a missing key and a bad key are told apart, in exactly the status route's words", () => {
  assert.equal(NO_KEY, "no key set");
  assert.equal(BAD_KEY, "the key set is not a 0x private key of 64 hex characters");
  for (const raw of [undefined, "", "   ", '""']) assert.equal(keyProblem(raw), NO_KEY, JSON.stringify(raw));
  for (const raw of ["0x1234", HEX + "0", "0x" + "zz".repeat(32), "my secret"]) {
    assert.equal(keyProblem(raw), BAD_KEY, JSON.stringify(raw));
    assert.ok(!BAD_KEY.includes(raw), "the problem never repeats the key");
  }
});

test("one top-up attempt per product every two minutes, a hold after one was sent, and a ceiling in all", () => {
  const l = createLimiter(DEMO_LIMITS);
  assert.deepEqual(l.attempt("P1", 0), { ok: true });
  const again = l.attempt("P1", 1000);
  assert.equal(again.ok, false);
  assert.equal(again.retryAfter, 119);
  assert.deepEqual(l.attempt("P1", DEMO_LIMITS.perKeyMs), { ok: true });
  l.hold("P1", DEMO_LIMITS.sentHoldMs, DEMO_LIMITS.perKeyMs);
  assert.equal(l.attempt("P1", DEMO_LIMITS.perKeyMs * 2).ok, false);
  const g = createLimiter(DEMO_LIMITS);
  for (let k = 0; k < DEMO_LIMITS.globalMax; k++) assert.equal(g.attempt("P" + k, k).ok, true);
  assert.equal(g.attempt("P99", 100).ok, false, "the ceiling holds across products");
  assert.equal(g.attempt("P99", DEMO_LIMITS.globalWindowMs + 1).ok, true, "and lifts once the minute has passed");
});

test("the demo shop tops up only its own shop, and only once it is open", () => {
  assert.equal(restockProblem({ id: "P1", shop: "S2" }, "S2"), "");
  assert.match(restockProblem({ id: "P4", shop: "S3" }, "S2"), /P4 is not in the demo shop; only its own owner can add to that shop's bond/);
  assert.match(restockProblem(null, "S2"), /there is no such product/);
  assert.match(restockProblem({ id: "P1", shop: "S2" }, ""), /the demo shop is not open on this contract yet/);
  const owner = "0x" + "d3".repeat(20);
  assert.equal(isDemoShop({ owner, name: DEMO_SHOP_NAME }, owner.toUpperCase().replace("0X", "0x")), true);
  assert.equal(isDemoShop({ owner, name: "Harbour Lane" }, owner), false, "the name must match");
  assert.equal(isDemoShop({ owner, name: DEMO_SHOP_NAME + " 2" }, owner), true, "a reopened demo shop is the demo shop");
  assert.equal(isDemoShop({ owner: "0x" + "11".repeat(20), name: DEMO_SHOP_NAME }, owner), false, "a copy by someone else is not the demo shop");
  assert.equal(isDemoShop({ owner, name: DEMO_SHOP_NAME }, ""), false);
});

test("the demo build's scripted reading gives every demo page the outcome its chip promises", () => {
  for (const page of DEMO_PAGES) {
    const product = DEMO_PRODUCTS.find((p) => p.key === page.product);
    const url = `https://raw.githubusercontent.com/o/price-match/c/competitors/${page.competitor}/${page.file}`;
    assert.equal(demoPageOf(url), page);
    const r = scriptedReading(url, product.spec);
    assert.ok(!("error" in r));
    assert.equal(outcomeOf(r.product, r.price, BigInt(product.priceAtto)), page.expect, page.file);
    for (const other of DEMO_PRODUCTS.filter((p) => p.key !== page.product)) {
      const x = scriptedReading(url, other.spec);
      assert.equal(x.product, "different", `${page.file} is another product for the ${other.key}`);
    }
  }
  assert.deepEqual(scriptedReading("https://shop.example/a.html", DEMO_PRODUCTS[0].spec), { error: FETCH_FAILED });
  assert.match(FETCH_FAILED, /^\[TRANSIENT\] the page could not be fetched; nothing was stored, and the claim may be made again$/);
});

test("the demo shop is reopened, not reused, when the pages moved to a new commit", () => {
  for (const n of [DEMO_SHOP_NAME, DEMO_SHOP_NAME + " 2", DEMO_SHOP_NAME + " 9", DEMO_SHOP_NAME + " 99"]) assert.equal(isDemoShopName(n), true, n);
  for (const n of ["Harbour Lane", DEMO_SHOP_NAME + " 1", DEMO_SHOP_NAME + " 02", DEMO_SHOP_NAME + " 100", DEMO_SHOP_NAME + "2", DEMO_SHOP_NAME + " Two", "harbour lane goods"])
    assert.equal(isDemoShopName(n), false, n);
  assert.equal(nextDemoShopName([]), DEMO_SHOP_NAME);
  assert.equal(nextDemoShopName(["Quayside Kitchen Supply", DEMO_SHOP_NAME]), DEMO_SHOP_NAME + " 2");
  assert.equal(nextDemoShopName(["HARBOUR LANE GOODS", "harbour lane goods 2"]), DEMO_SHOP_NAME + " 3", "the contract compares names case aside");

  const old = demoPrefixes("o/price-match", "a".repeat(40));
  const now = demoPrefixes("o/price-match", "b".repeat(40));
  assert.equal(samePrefixes(now, [...now].reverse()), true);
  assert.equal(samePrefixes(now, old), false);
  assert.equal(samePrefixes(now, now.slice(0, 2)), false);
  assert.deepEqual(demoShopPlan([], now), { open: DEMO_SHOP_NAME, after: "" }, "a key with no shop opens the demo name");
  const s2 = { id: "S2", name: DEMO_SHOP_NAME, competitors: old };
  assert.deepEqual(demoShopPlan([s2], old), { keep: "S2" }, "the same commit keeps the shop");
  assert.deepEqual(demoShopPlan([s2], now), { open: DEMO_SHOP_NAME + " 2", after: "S2" }, "a new commit opens the next name");
  const s9 = { id: "S9", name: DEMO_SHOP_NAME + " 2", competitors: now };
  assert.deepEqual(demoShopPlan([s2, s9], now), { keep: "S9" }, "run again, it keeps the shop it opened");
  assert.deepEqual(demoShopPlan([s9, s2], old), { open: DEMO_SHOP_NAME + " 3", after: "S9" }, "only the newest demo shop is kept, the one the site shows");
  assert.deepEqual(demoShopPlan([{ id: "S4", name: "Quayside Kitchen Supply", competitors: now }], now), { open: DEMO_SHOP_NAME, after: "" }, "another name is not the demo shop");

  assert.equal(pickDemoShop([]), "");
  assert.equal(pickDemoShop([{ id: "S2", name: DEMO_SHOP_NAME, products: 3 }, { id: "S10", name: DEMO_SHOP_NAME + " 2", products: 9 }]), "S10", "the newest demo shop");
  assert.equal(pickDemoShop([{ id: "S2", name: DEMO_SHOP_NAME, products: 3 }, { id: "S10", name: DEMO_SHOP_NAME + " 2", products: 0 }]), "S2", "not while it is still empty");
  assert.equal(pickDemoShop([{ id: "S10", name: DEMO_SHOP_NAME + " 2", products: 0 }]), "S10");
  assert.equal(pickDemoShop([{ id: "S3", name: "Quayside Kitchen Supply", products: 2 }]), "");

  const total = DEMO_PRODUCTS.reduce((sum, p) => sum + BigInt(p.priceAtto), 0n);
  assert.ok(DEMO_BOND >= 2n * total, "the opening bond covers two open sales of every product at once");
});
