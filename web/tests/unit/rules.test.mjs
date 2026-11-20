// The contract's rules in lib/rules.ts against contracts/price_match.py itself: every reader of the
// caller's arguments, the money words, the address and prefix checks, the price reader and the two
// combine tables give the contract's own answer, case by case, through tests/unit/contract_oracle.py.
// Plus the parts that need no oracle: ids and the phase on the clock.

import test from "node:test";
import assert from "node:assert/strict";

import * as rules from "../../lib/rules.ts";
import { askContract } from "./oracle.mjs";

const PFX = "https://raw.githubusercontent.com/demo-owner/price-match/0123456789abcdef0123456789abcdef01234567/competitors/northgate/";

const TEXTS = [
  ["abc", 3, 60, "the name"],
  ["ab", 3, 60, "the name"],
  ["x".repeat(61), 3, 60, "the name"],
  ["Café Lumio", 3, 60, "the name"],
  ["two\nlines here", 3, 60, "the name"],
  ["tab\there", 3, 60, "the name"],
  ["  spaced  ", 3, 60, "the name"],
  ["a\u{1F600}bc", 3, 60, "the name"],
  ["<b>bold</b> shop", 3, 60, "the name"],
];

const SPECS = [
  "Lumio K3 electric kettle. Brand: Lumio. Model: K3-170. Capacity: 1.7 litres. Finish: brushed stainless steel. Condition: new, sealed in the original box.",
  "Same kettle, price 1.80, model K3-170, brushed stainless steel, new and sealed.",
  "Same kettle for $1.80, model K3-170, brushed stainless steel, new and sealed.",
  "Arcwave X200 earbuds, 2nd Gen, black, new and sealed in the original box here.",
  "Arcwave X200 earbuds, second generation, black, new and sealed in the original box.",
  "Gentle-touch kettle, model GT-1, cream, new, priceless design, sealed in its box.",
  "Kettle at cost; model K9, colour red, condition new, sealed in the original box.",
  "Kettle RRP-free; model K9, colour red, condition new, sealed in the original box.",
  "Kettle model K9 (GEN), colour red, condition new, sealed in the original box ok.",
  "Kettle model K9 atto-free, colour red, condition new, sealed in the original box.",
  "Kettle_prices model K9, colour red, condition new, sealed in the original box ok.",
  "MSRP kettle model K9, colour red, condition new, sealed in the original box. Ok.",
  "Kettle model K9, colour red, condition new, 1.7 litres, 2200 W, in the box.",
];

const URLS = [
  PFX + "lumio-k3-kettle.html",
  "http://shop.example/a",
  "https://Shop.example/a",
  "https://shop.example",
  "https://shop.example/",
  "https://shopexample/a",
  "https://.shop.example/a",
  "https://shop.example./a",
  "https://shop.example/a?x=1",
  "https://shop.example/a#top",
  "https://shop.example:8080/a",
  "https://shop.example/a%20b",
  "https://shop.example//a",
  "https://shop.example/a/./b",
  "https://shop.example/a/../b",
  "https://shop.example/a/..",
  "https://shop.example/café",
  "https://shop.example/a b",
  "https://shop.example/a-b_c~d.e/f/",
  "https://" + "a".repeat(190) + ".example/x",
  "javascript:alert(1)",
];

const PREFIX_LISTS = [
  JSON.stringify([PFX]),
  JSON.stringify([PFX, PFX.replace("northgate", "bright-basket")]),
  JSON.stringify([PFX, PFX]),
  JSON.stringify([]),
  JSON.stringify(["https://a.example/1/", "https://a.example/2/", "https://a.example/3/", "https://a.example/4/", "https://a.example/5/", "https://a.example/6/"]),
  JSON.stringify(["https://a.example/no-slash"]),
  JSON.stringify(["  https://a.example/x/  "]),
  JSON.stringify([12]),
  "[1.5]",
  "[1e3]",
  '["https://a.example/x/", NaN]',
  "not json",
  JSON.stringify({ a: "https://a.example/x/" }),
  JSON.stringify(["https://a.example/" + "y".repeat(150) + "/"]),
  "[" + '"https://a.example/x/",'.repeat(60) + '"https://a.example/z/"]',
  JSON.stringify(["https://A.example/x/"]),
];

const NUMBERS = ["2000000000000000000", " 42 ", "-1", "1.5", "", "１２", "0x10", "9".repeat(41), "007"];
const ANSWERS = ["1.80", "1.8", "01.80", "1,80", "$1.80", "1.80 GEN", "1.800000000000000000001", "unclear", "0", "0.0", ".5", "5.", "12", " 3.20 ", "1e2", "0.000000000000000001"];
const WORDS = ["yes", "no", "unclear", ""];

test("lib/rules.ts reads every input as contracts/price_match.py does", (t) => {
  const calls = [];
  const local = [];
  for (const [text, a, b, what] of TEXTS) {
    calls.push({ fn: "_text_problem", args: [text, a, b, what] });
    local.push(rules.textProblem(text, a, b, what));
  }
  for (const s of SPECS) {
    calls.push({ fn: "_money_problem", args: [s] });
    local.push(rules.moneyProblem(s));
  }
  for (const u of URLS) {
    calls.push({ fn: "_url_problem", args: [u, rules.MAX_URL, "the page address"] });
    local.push(rules.urlProblem(u, rules.MAX_URL, "the page address"));
  }
  for (const raw of PREFIX_LISTS) {
    calls.push({ fn: "_prefixes_problem", args: [raw] });
    const p = rules.prefixesProblem(raw);
    local.push([p.problem, p.prefixes]);
  }
  for (const u of [PFX + "a.html", PFX, PFX.slice(0, -1), "https://other.example/a.html", PFX + "sub/b.html"]) {
    calls.push({ fn: "_under", args: [u, [PFX]] });
    local.push(rules.under(u, [PFX]));
  }
  for (const n of NUMBERS) {
    calls.push({ fn: "_number_arg", args: [n] });
    local.push(rules.numberArg(n).toString());
  }
  for (const n of [5, 0, true]) {
    calls.push({ fn: "_number_arg", args: [n] });
    local.push(rules.numberArg(n).toString());
  }
  for (const a of ANSWERS) {
    calls.push({ fn: "_atto", args: [a] });
    local.push(rules.attoOfAnswer(a));
  }
  for (const a of WORDS)
    for (const b of WORDS) {
      calls.push({ fn: "_combine_product", args: [a, b] });
      local.push(rules.combineProduct(a, b));
    }
  for (const [a, b] of [["1", "1"], ["1", "2"], ["", ""], ["", "1"]]) {
    calls.push({ fn: "_combine_price", args: [a, b] });
    local.push(rules.combinePrice(a, b));
  }
  for (const a of WORDS)
    for (const b of WORDS) {
      calls.push({ fn: "_combine_stock", args: [a, b] });
      local.push(rules.combineStock(a, b));
    }
  const ours = 2n * 10n ** 18n;
  for (const [word, stock, price] of [
    ["same", "in_stock", "1800000000000000000"],
    ["same", "in_stock", "2000000000000000000"],
    ["same", "in_stock", "2300000000000000000"],
    ["same", "in_stock", ""],
    ["same", "out_of_stock", ""],
    ["same", "out_of_stock", "1800000000000000000"],
    ["same", "unclear", "1800000000000000000"],
    ["same", "", "1800000000000000000"],
    ["different", "", ""],
    ["unclear", "", ""],
  ]) {
    calls.push({ fn: "_outcome", args: [word, stock, price, Number(ours)] });
    local.push(rules.outcomeOf(word, stock, price, ours));
  }
  for (const outcome of rules.OUTCOMES)
    for (const refund of ["0", "200000000000000000"]) {
      calls.push({ fn: "_buyer_value", args: [outcome, Number(refund)] });
      local.push(rules.buyerValue(outcome, BigInt(refund)).toString());
    }
  const answers = askContract(calls);
  if (!answers) return t.skip("no python3 on this machine");
  assert.equal(answers.length, local.length);
  answers.forEach((a, i) => {
    assert.ok(!a.error, `${calls[i].fn}(${JSON.stringify(calls[i].args).slice(0, 80)}) raised ${a.error}`);
    assert.deepEqual(local[i], a.ok, `${calls[i].fn}(${JSON.stringify(calls[i].args).slice(0, 100)})`);
  });
});

test("the form checks run the contract's checks after the strip", () => {
  assert.equal(rules.nameProblem("  Harbour Lane Goods  "), "");
  assert.match(rules.nameProblem("ab"), /the name is 3 to 60 characters; this one is 2/);
  assert.equal(rules.specProblem("  " + SPECS[0] + "  "), "");
  assert.match(rules.specProblem(SPECS[3]), /the word "gen" may not appear in it; write "generation" in full/);
  assert.equal(rules.priceProblem(10n ** 17n), "");
  assert.match(rules.priceProblem(10n ** 17n - 1n), /from 100000000000000000 \(0.1 GEN\) to 100000000000000000000 \(100 GEN\)/);
  assert.equal(rules.windowProblem(1200), "");
  assert.match(rules.windowProblem(1199), /the guarantee window is 1200 to 2592000 seconds/);
  assert.equal(rules.pageProblem(PFX + "a.html", [PFX], "S1"), "");
  assert.match(rules.pageProblem("https://other.example/a.html", [PFX], "S1"), /the page is not below any competitor prefix S1 accepted; shop\(S1\) lists them/);
});

test("ids are read from the address bar, and the phase follows the contract's clock rule", () => {
  assert.equal(rules.parseOrderId("O7"), "O7");
  assert.equal(rules.parseOrderId("o7"), "O7");
  assert.equal(rules.parseOrderId("7"), "O7");
  assert.equal(rules.parseOrderId("O0"), "");
  assert.equal(rules.parseOrderId("O7x"), "");
  assert.equal(rules.parseShopId("S12"), "S12");
  assert.equal(rules.parseProductId("%50%33"), "P3");
  assert.equal(rules.idNumber("C14"), 14);
  assert.equal(rules.phaseOf("open", 100, 99), "claim");
  assert.equal(rules.phaseOf("open", 100, 100), "release");
  assert.equal(rules.phaseOf("open", 100, -1), "unknown");
  assert.equal(rules.phaseOf("matched", 100, 0), "closed");
  assert.equal(rules.phaseOf("released", 100, 0), "closed");
  assert.equal(rules.phaseOf("open", 100, 50, "C3"), "pending", "a pending claim is the order's phase whatever the clock");
  assert.equal(rules.phaseOf("open", 100, -1, "C3"), "pending");
  assert.equal(rules.parseClaimId("c4"), "C4");
  assert.equal(rules.plain("“Spec” — one\nline…"), '"Spec" - one line...');
  assert.equal(rules.sentence("[TRANSIENT] the page could not be fetched"), "The page could not be fetched.");
});

test("the appeal window: who may appeal, its phase on the clock, and which reading wins", () => {
  assert.equal(rules.APPEAL_WINDOW, 900);
  assert.equal(rules.APPEAL_BOND, 5n * 10n ** 16n);
  assert.equal(rules.sideOf("matched"), "shop");
  for (const o of ["not_in_stock", "not_cheaper", "different", "unclear"]) assert.equal(rules.sideOf(o), "buyer", o);
  const end = 1_000 + rules.APPEAL_WINDOW;
  assert.equal(rules.claimPhaseOf("pending", end, 1_000), "appeal");
  assert.equal(rules.claimPhaseOf("pending", end, end - 1), "appeal");
  assert.equal(rules.claimPhaseOf("pending", end, end), "settle", "the window closes at its end, as the contract's now >= appeal_end");
  assert.equal(rules.claimPhaseOf("pending", end, -1), "unknown");
  assert.equal(rules.claimPhaseOf("settled", end, 1_000), "settled");
  assert.equal(rules.appealLeft("pending", end, 1_000), 900);
  assert.equal(rules.appealLeft("pending", end, end + 5), 0);
  assert.equal(rules.appealLeft("settled", end, 1_000), 0);
  const G = 10n ** 18n;
  const match = { outcome: "matched", refund: G / 5n };
  // The shop appeals a match: a smaller refund, or none, is better for it.
  assert.equal(rules.appealBetter("shop", match, { outcome: "not_in_stock", refund: 0n }), true);
  assert.equal(rules.appealBetter("shop", match, { outcome: "matched", refund: G / 10n }), true);
  assert.equal(rules.appealBetter("shop", match, { outcome: "matched", refund: G / 5n }), false, "the same reading again is upheld");
  // The buyer appeals anything else: a refund, or the fee back instead of lost, is better for them.
  assert.equal(rules.appealBetter("buyer", { outcome: "not_in_stock", refund: 0n }, match), true);
  assert.equal(rules.appealBetter("buyer", { outcome: "different", refund: 0n }, { outcome: "unclear", refund: 0n }), true, "the fee comes back");
  assert.equal(rules.appealBetter("buyer", { outcome: "unclear", refund: 0n }, { outcome: "not_cheaper", refund: 0n }), false, "the fee came back either way");
  assert.equal(rules.reasonProblem("  short  "), "the reason is 10 to 280 characters; this one is 5");
  assert.equal(rules.reasonProblem("The page shows it in stock."), "");
  assert.match(rules.reasonProblem("It is in stock ✓ really"), /printable ASCII on one line/);
});

test("price protection: the lowest price recorded in the window, the drop due, and a match after a drop", () => {
  const G = 10n ** 18n;
  const o = { priceAtto: (2n * G).toString(), droppedAtto: "0", boughtAt: 1000, windowEnd: 2800, status: "open", pending: "" };
  const h = (at, tenths) => ({ at, priceAtto: ((tenths * G) / 10n).toString() });
  assert.equal(rules.lowestPrice(o, []), 2n * G);
  assert.equal(rules.dropDue(o, []), 0n);
  // A drop to 1.7 and back to 2.0 inside the window is still owed: 0.3 GEN.
  const down_up = [h(1500, 17n), h(1600, 20n)];
  assert.equal(rules.lowestPrice(o, down_up), (17n * G) / 10n);
  assert.equal(rules.dropDue(o, down_up), (3n * G) / 10n);
  // Before the purchase or at the window's end does not count; the window's end is exclusive.
  assert.equal(rules.dropDue(o, [h(999, 10n), h(2800, 10n)]), 0n);
  assert.equal(rules.dropDue(o, [h(1000, 19n), h(2799, 18n)]), (2n * G) / 10n);
  // A price above what the order paid owes nothing.
  assert.equal(rules.dropDue(o, [h(1500, 25n)]), 0n);
  // Once a drop was paid the order stands lower, and only a further drop is due.
  const paid = { ...o, droppedAtto: ((3n * G) / 10n).toString() };
  assert.equal(rules.dropDue(paid, down_up), 0n);
  assert.equal(rules.dropDue(paid, [...down_up, h(2000, 15n)]), (2n * G) / 10n);
  // Closed or pending: nothing is due now, as the contract's order view says.
  assert.equal(rules.dropDue({ ...o, status: "released" }, down_up), 0n);
  assert.equal(rules.dropDue({ ...o, pending: "C2" }, down_up), 0n);
  // A match judged at 2.0 against 1.8 (refund 0.2), settled after a 0.3 drop: their price stays 1.8, so nothing more.
  assert.equal(rules.refundAfterDrop(2n * G, G / 5n, (17n * G) / 10n), 0n);
  assert.equal(rules.refundAfterDrop(2n * G, (5n * G) / 10n, (17n * G) / 10n), (2n * G) / 10n);
  assert.equal(rules.refundAfterDrop(2n * G, G / 5n, 2n * G), G / 5n);
  assert.equal(rules.MAX_REPRICES, 16);
  assert.equal(rules.repriceProblem("P1", (17n * G) / 10n, 2n * G), "");
  assert.equal(rules.repriceProblem("P1", 2n * G, 2n * G), "P1 is already priced at 2000000000000000000 atto");
  assert.match(rules.repriceProblem("P1", 1n, 2n * G), /0\.1 GEN/);
});
