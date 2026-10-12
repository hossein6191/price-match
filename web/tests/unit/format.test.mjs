// The display helpers: amounts as a till prints them, page addresses as a receipt prints them, spans.

import test from "node:test";
import assert from "node:assert/strict";

import { gen, genText, pagePath, short, span, tagPrice, toAtto, tryAtto, windowLabel } from "../../lib/format.ts";

const GEN = 10n ** 18n;

test("amounts print with two decimals at least, as a till prints them", () => {
  assert.equal(gen((GEN * 18n) / 10n), "1.80 GEN");
  assert.equal(gen(2n * GEN), "2.00 GEN");
  assert.equal(gen(GEN / 100n), "0.01 GEN");
  assert.equal(gen((GEN * 125n) / 10000n), "0.0125 GEN");
  assert.equal(gen("0"), "0.00 GEN");
  assert.equal(gen(1n), "<0.0001 GEN");
  assert.equal(gen("junk"), "? GEN");
  assert.equal(tagPrice((GEN * 95n) / 100n), "0.95");
  assert.equal(tagPrice(3n * GEN + GEN / 2n), "3.50");
  assert.equal(genText((GEN * 6n) / 5n), "1.2");
  assert.equal(toAtto("1.2"), (GEN * 6n) / 5n);
  assert.equal(tryAtto("1,2"), null);
  assert.equal(tryAtto("0.0000000000000000001"), null);
});

test("a receipt prints a page by its competitor and file", () => {
  assert.equal(pagePath("https://raw.githubusercontent.com/o/r/c0ffee/competitors/northgate/lumio-k3-kettle.html"), "northgate/lumio-k3-kettle.html");
  assert.equal(pagePath("https://shop.example/products/k3.html"), "products/k3.html");
  assert.equal(pagePath("not a url"), "");
});

test("spans, windows and short addresses", () => {
  assert.equal(span(1799), "29 min 59 s");
  assert.equal(span(-5), "0 s");
  assert.equal(windowLabel(1800), "30 minutes");
  assert.equal(windowLabel(86400), "1 day");
  assert.equal(windowLabel(7 * 86400), "7 days");
  assert.equal(short("0x5e1a3c9b07d24f68a1e3c5b7d9f0a2c4e6b8d0f1"), "0x5e1a…d0f1");
});
