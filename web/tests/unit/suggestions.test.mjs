// Every one-click suggestion is inside the contract's limits, so pressing a chip never fills a field
// with something the contract would refuse; and the demo's forty-five competitor pages are what the
// site says they are: the same files the validators read, each stating the model, condition and
// price its chip promises, at an address under the demo shop's prefixes that the contract accepts.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import * as rules from "../../lib/rules.ts";
import { DEMO_PAGES, DEMO_PRODUCTS, DEMO_SHOP_NAME, demoPrefixes, pageChips, repoOf } from "../../lib/demo-shop.ts";
import { REPO_URL } from "../../lib/config.ts";
import { BOND_CHIPS, CREDIT_CHIPS, NAME_CHIPS, PRICE_CHIPS, PRODUCT_CHIPS, WINDOW_CHIPS } from "../../lib/suggestions.ts";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";

test("every shop name chip opens a shop, and none is the demo shop's name", () => {
  assert.ok(NAME_CHIPS.length >= 6);
  assert.equal(new Set(NAME_CHIPS).size, NAME_CHIPS.length);
  for (const n of NAME_CHIPS) {
    assert.equal(rules.nameProblem(n), "", n);
    assert.notEqual(n, DEMO_SHOP_NAME);
  }
});

test("every product chip lists: title, spec with no price in it, price and window inside the limits", () => {
  assert.ok(PRODUCT_CHIPS.length >= 5);
  for (const c of [...PRODUCT_CHIPS, ...DEMO_PRODUCTS.map((p) => ({ ...p, priceAtto: BigInt(p.priceAtto) }))]) {
    assert.equal(rules.titleProblem(c.title), "", c.title);
    assert.equal(rules.specProblem(c.spec), "", c.spec);
    assert.equal(rules.priceProblem(c.priceAtto), "", c.title);
    assert.equal(rules.windowProblem(c.window), "", c.title);
    for (const what of ["brand", "model"]) assert.match(c.spec.toLowerCase(), new RegExp(what), `${c.title} names its ${what}`);
  }
});

test("every amount and window chip is one the contract takes", () => {
  for (const c of PRICE_CHIPS) assert.equal(rules.priceProblem(c.value), "", c.label);
  for (const c of WINDOW_CHIPS) assert.equal(rules.windowProblem(c.value), "", c.label);
  assert.equal(WINDOW_CHIPS[0].value, rules.MIN_WINDOW, "the shortest window is the contract's least");
  assert.equal(WINDOW_CHIPS[WINDOW_CHIPS.length - 1].value, rules.MAX_WINDOW, "the longest is its most");
  for (const c of BOND_CHIPS) assert.ok(c.value > 0n, c.label);
  for (const c of CREDIT_CHIPS) assert.ok(c.value >= rules.CLAIM_FEE, c.label);
  assert.equal(CREDIT_CHIPS[0].value, rules.CLAIM_FEE, "the first credit chip is one claim's fee");
});

test("the demo shop's prefixes are accepted, and every page chip is an address the contract takes under them", () => {
  const repo = repoOf(REPO_URL) || "demo-owner/price-match";
  assert.match(repo, /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/);
  const prefixes = demoPrefixes(repo, COMMIT);
  const parsed = rules.prefixesProblem(JSON.stringify(prefixes));
  assert.equal(parsed.problem, "");
  assert.deepEqual(parsed.prefixes, prefixes);
  for (const p of DEMO_PRODUCTS) {
    const chips = pageChips(p.spec, prefixes);
    assert.equal(chips.length, DEMO_PAGES.length, "every demo page is offered");
    const extra = p.key === "kettle" || p.key === "earbuds" ? ["not_in_stock", "not_in_stock"] : [];
    assert.equal(chips.filter((c) => c.own).length, 5 + extra.length, `${p.key}: five pages about it, one per outcome, and the kettle and the earbuds a sold-out and a pre-order page`);
    assert.deepEqual(chips.filter((c) => c.own).map((c) => c.page.expect).sort(), ["different", "different", "matched", "not_cheaper", ...extra, "unclear"].sort());
    for (const c of chips) assert.equal(rules.pageProblem(c.url, prefixes, "S1"), "", c.url);
  }
  assert.deepEqual(pageChips(DEMO_PRODUCTS[0].spec, ["https://other.example/pages/"]), [], "a shop with other prefixes gets no demo chips");
});

test("the forty-nine demo pages are the files the validators read, and state what their chips say", () => {
  assert.equal(DEMO_PRODUCTS.length, 9, "nine demo products");
  assert.equal(DEMO_PAGES.length, 49, "five pages for each of them, and four sold-out or pre-order pages");
  assert.equal(new Set(DEMO_PRODUCTS.map((p) => p.spec)).size, 9, "every spec is its own");
  // Both trees carry exactly the demo pages, no more and no fewer, and the index links every one.
  const index = readFileSync(new URL("../../../competitors/index.html", import.meta.url), "utf8");
  for (const c of ["northgate", "bright-basket", "corner-hardware"]) {
    const want = DEMO_PAGES.filter((p) => p.competitor === c).map((p) => p.file).sort();
    assert.equal(new Set(want).size, want.length, `${c}: no file twice`);
    for (const tree of ["../../../competitors/", "../../public/competitors/"])
      assert.deepEqual(readdirSync(new URL(tree + c + "/", import.meta.url)).filter((f) => f.endsWith(".html") && !f.startsWith("._")).sort(), want, `${tree}${c}`);
    for (const f of want) assert.ok(index.includes(`<a href="${c}/${f}">`), `index.html links ${c}/${f}`);
  }
  for (const p of DEMO_PAGES) {
    const repoCopy = readFileSync(new URL(`../../../competitors/${p.competitor}/${p.file}`, import.meta.url), "utf8");
    const siteCopy = readFileSync(new URL(`../../public/competitors/${p.competitor}/${p.file}`, import.meta.url), "utf8");
    assert.equal(siteCopy, repoCopy, `${p.file}: the site serves the same bytes`);
    assert.ok(repoCopy.includes(`<h1>${p.heading}</h1>`), `${p.file}: its heading`);
    assert.ok(repoCopy.includes(`<th>Model</th><td>${p.model}</td>`), `${p.file}: its model`);
    assert.equal(/<th>Condition<\/th><td>Refurbished/.test(repoCopy), p.refurbished, `${p.file}: its condition`);
    const priceLine = /<p class="price">([^<]*)<\/p>/.exec(repoCopy)?.[1] ?? "";
    const stated = /^Price: (\d+\.\d+) GEN$/.exec(priceLine)?.[1];
    if (p.priceAtto) assert.equal(rules.attoOfAnswer(stated ?? ""), p.priceAtto, `${p.file}: its price`);
    else assert.ok(!/\d/.test(priceLine), `${p.file}: shows no number beside its price`);
    const stock = { in_stock: /<p>In stock\b/, sold_out: /<p>Sold out\./, pre_order: /<p>Pre-order only\./ }[p.availability];
    assert.match(repoCopy, stock, `${p.file}: the page says ${p.availability.replace("_", " ")}`);
  }
  for (const f of ["index.html", "shop.css"])
    assert.equal(readFileSync(new URL(`../../public/competitors/${f}`, import.meta.url), "utf8"), readFileSync(new URL(`../../../competitors/${f}`, import.meta.url), "utf8"), f);
});
