// The till receipt of a claim says exactly what the contract stored, for every outcome, and a round
// that stored nothing says so and that the claim may be made again.

import test from "node:test";
import assert from "node:assert/strict";

import { claimLines, receiptText, unreadLines } from "../../lib/receipt.ts";

const GEN = 10n ** 18n;
const URL = "https://raw.githubusercontent.com/o/price-match/0123456789abcdef0123456789abcdef01234567/competitors/northgate/lumio-k3-kettle.html";
const claim = (over) => ({ id: "C1", order: "O1", url: URL, product: "same", priceAtto: ((GEN * 18n) / 10n).toString(), outcome: "matched", refundAtto: (GEN / 5n).toString(), feeTo: "buyer", at: 1, ...over });
const ours = (2n * GEN).toString();

test("matched: page read, same product, both prices and the refund", () => {
  const text = receiptText(claimLines(claim({}), ours));
  assert.equal(
    text,
    [
      "COMPETITOR PAGE READ (yes)",
      "northgate/lumio-k3-kettle.html",
      "SAME PRODUCT (yes)",
      "THEIR PRICE 1.80 GEN",
      "OUR PRICE 2.00 GEN",
      "----",
      "REFUND 0.20 GEN",
      "CLAIM FEE KEPT BY BUYER",
    ].join("\n"),
  );
});

test("not cheaper, different and unclear say what was stored and that nothing else moved", () => {
  const dear = receiptText(claimLines(claim({ priceAtto: ((GEN * 23n) / 10n).toString(), outcome: "not_cheaper", refundAtto: "0" }), ours));
  assert.match(dear, /THEIR PRICE 2\.30 GEN\nOUR PRICE 2\.00 GEN\n----\nNOT CHEAPER REFUND 0\.00 GEN\nCLAIM FEE KEPT BY BUYER/);
  const other = receiptText(claimLines(claim({ product: "different", priceAtto: "", outcome: "different", refundAtto: "0", feeTo: "shop" }), ours));
  assert.match(other, /DIFFERENT PRODUCT \(no\)\nTHEIR PRICE NOT ASKED/);
  assert.match(other, /CLAIM FEE 0\.01 GEN TO SHOP/);
  const noPrice = receiptText(claimLines(claim({ priceAtto: "", outcome: "unclear", refundAtto: "0" }), ours));
  assert.match(noPrice, /SAME PRODUCT \(yes\)\nTHEIR PRICE NOT AGREED \(unclear\)/);
  assert.match(noPrice, /REFUND 0\.00 GEN/);
  const split = receiptText(claimLines(claim({ product: "unclear", priceAtto: "", outcome: "unclear", refundAtto: "0" }), ours));
  assert.match(split, /SAME PRODUCT\? UNCLEAR \(unclear\)\nTHEIR PRICE NOT ASKED/);
  for (const t of [dear, other, noPrice, split]) assert.match(t, /^COMPETITOR PAGE READ \(yes\)/);
});

test("a round that stored nothing prints that the page was not read, and that it does not count", () => {
  const text = receiptText(unreadLines(URL, "The page could not be fetched; nothing was stored, and the claim may be made again."));
  assert.match(text, /^COMPETITOR PAGE NOT READ \(no\)\nnorthgate\/lumio-k3-kettle\.html\nThe page could not be fetched/);
  assert.match(text, /NOTHING STORED NOTHING MOVED/);
  assert.match(text, /This round does not count: the claim may be made again\./);
});
