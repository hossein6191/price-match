// The till receipt of a claim says exactly what the contract stored, for every outcome: the stock line,
// the pending state with its appeal deadline, an appeal's second reading beside the first, and how the
// claim settled. A round that stored nothing says so and that the claim may be made again.

import test from "node:test";
import assert from "node:assert/strict";

import { claimLines, receiptText, unreadLines } from "../../lib/receipt.ts";

const GEN = 10n ** 18n;
const BASE = "https://raw.githubusercontent.com/o/price-match/0123456789abcdef0123456789abcdef01234567/competitors/";
const URL = BASE + "northgate/lumio-k3-kettle.html";
const NOW = 1_800_000_000;
const reading = (over = {}) => ({ product: "same", stock: "in_stock", priceAtto: ((GEN * 18n) / 10n).toString(), outcome: "matched", refundAtto: (GEN / 5n).toString(), ...over });
const claim = (over = {}) => {
  const first = reading(over.first);
  return {
    id: "C1",
    order: "O1",
    url: URL,
    page: "a".repeat(64),
    oursAtto: (2n * GEN).toString(),
    mayAppeal: first.outcome === "matched" ? "shop" : "buyer",
    appealEnd: NOW + 600,
    state: "settled",
    phase: "settled",
    appeal: null,
    outcome: first.outcome,
    final: first.outcome,
    paidAtto: first.outcome === "matched" ? first.refundAtto : "0",
    feeTo: first.outcome === "different" ? "shop" : "buyer",
    settledBy: "window",
    settledAt: NOW,
    at: NOW - 300,
    ...over,
    first,
  };
};
const text = (c) => receiptText(claimLines(c, NOW));

test("matched and settled: page read, same product, in stock, both prices, the refund due and paid", () => {
  assert.equal(
    text(claim()),
    [
      "COMPETITOR PAGE READ (yes)",
      "northgate/lumio-k3-kettle.html",
      "SAME PRODUCT (yes)",
      "STOCK IN STOCK (yes)",
      "THEIR PRICE 1.80 GEN",
      "OUR PRICE 2.00 GEN",
      "----",
      "FINDING PRICE MATCHED",
      "REFUND DUE 0.20 GEN",
      "----",
      "SETTLED WINDOW CLOSED",
      "REFUND PAID 0.20 GEN",
      "CLAIM FEE BACK TO BUYER",
    ].join("\n"),
  );
});

test("pending: nothing moved yet, who may appeal and until when, the fee held", () => {
  const t = text(claim({ state: "pending", phase: "appeal", final: "", paidAtto: "0", feeTo: "", settledBy: "", settledAt: 0 }));
  assert.match(t, /FINDING PRICE MATCHED\nREFUND DUE 0\.20 GEN\n----\nPENDING NOTHING MOVED YET \(unclear\)\nAPPEAL UNTIL \d\d:\d\d\nMAY APPEAL THE SHOP\nCLAIM FEE 0\.01 GEN HELD$/);
  assert.ok(!/REFUND PAID|SETTLED/.test(t), "a pending claim says nothing was paid");
});

test("the stock line: in stock, sold out or pre-order (with the page's own words), unclear, or not asked", () => {
  const sold = text(claim({ url: BASE + "northgate/lumio-k3-kettle-sold-out.html", first: { stock: "out_of_stock", priceAtto: "", outcome: "not_in_stock", refundAtto: "0" } }));
  assert.match(sold, /SAME PRODUCT \(yes\)\nSTOCK SOLD OUT \/ PRE-ORDER \(no\)\nthe page says: sold out\nTHEIR PRICE NOT ASKED\nOUR PRICE 2\.00 GEN\n----\nFINDING NOT IN STOCK\n----\nSETTLED WINDOW CLOSED\nREFUND 0\.00 GEN\nCLAIM FEE BACK TO BUYER/);
  const pre = text(claim({ url: BASE + "northgate/lumio-k3-kettle-pre-order.html", first: { stock: "out_of_stock", priceAtto: "", outcome: "not_in_stock", refundAtto: "0" } }));
  assert.match(pre, /the page says: pre-order only/);
  const unclear = text(claim({ first: { stock: "unclear", priceAtto: "", outcome: "unclear", refundAtto: "0" } }));
  assert.match(unclear, /STOCK UNCLEAR \(unclear\)\nTHEIR PRICE NOT ASKED/);
  const other = text(claim({ first: { product: "different", stock: "", priceAtto: "", outcome: "different", refundAtto: "0" } }));
  assert.match(other, /DIFFERENT PRODUCT \(no\)\nSTOCK NOT ASKED\nTHEIR PRICE NOT ASKED/);
  assert.match(other, /CLAIM FEE 0\.01 GEN TO SHOP/);
  const split = text(claim({ first: { product: "unclear", stock: "", priceAtto: "", outcome: "unclear", refundAtto: "0" } }));
  assert.match(split, /SAME PRODUCT\? UNCLEAR \(unclear\)\nSTOCK NOT ASKED/);
  const dear = text(claim({ first: { priceAtto: ((GEN * 23n) / 10n).toString(), outcome: "not_cheaper", refundAtto: "0" } }));
  assert.match(dear, /THEIR PRICE 2\.30 GEN\nOUR PRICE 2\.00 GEN\n----\nFINDING NOT CHEAPER\n----/);
  const noPrice = text(claim({ first: { priceAtto: "", outcome: "unclear", refundAtto: "0" } }));
  assert.match(noPrice, /STOCK IN STOCK \(yes\)\nTHEIR PRICE NOT AGREED \(unclear\)/);
});

test("an appeal: both readings, the reason, the result and where the bond went", () => {
  const upheld = text(
    claim({
      settledBy: "appeal",
      appeal: { ...reading(), by: "shop", reason: "Please read the price line again.", result: "upheld", at: NOW - 100, bondTo: "buyer" },
    }),
  );
  assert.match(upheld, /REFUND DUE 0\.20 GEN\n----\nAPPEAL BY THE SHOP\n"Please read the price line again\."\nSECOND READING SAME PAGE TEXT\nSAME PRODUCT \(yes\)\nSTOCK IN STOCK \(yes\)\nTHEIR PRICE 1\.80 GEN\nFINDING PRICE MATCHED\nAPPEAL UPHELD\nthe first reading stands\nBOND 0\.05 GEN TO BUYER\n----\nSETTLED BY THE APPEAL\nREFUND PAID 0\.20 GEN/);
  const overturned = text(
    claim({
      first: { stock: "out_of_stock", priceAtto: "", outcome: "not_in_stock", refundAtto: "0" },
      final: "matched",
      outcome: "matched",
      paidAtto: (GEN / 5n).toString(),
      settledBy: "appeal",
      appeal: { ...reading(), by: "buyer", reason: "The page says in stock.", result: "overturned", at: NOW - 100, bondTo: "buyer" },
    }),
  );
  assert.match(overturned, /FINDING NOT IN STOCK\n----\nAPPEAL BY THE BUYER/);
  assert.match(overturned, /APPEAL OVERTURNED\nthe second reading replaces the first\nBOND 0\.05 GEN BACK/);
  assert.match(overturned, /REFUND PAID 0\.20 GEN/);
});

test("a round that stored nothing prints that the page was not read, and that it does not count", () => {
  const t = receiptText(unreadLines(URL, "The page could not be fetched; nothing was stored, and the claim may be made again."));
  assert.match(t, /^COMPETITOR PAGE NOT READ \(no\)\nnorthgate\/lumio-k3-kettle\.html\nThe page could not be fetched/);
  assert.match(t, /NOTHING STORED NOTHING MOVED/);
  assert.match(t, /This round does not count: the claim may be made again\./);
});
