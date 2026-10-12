// The waiting copy (lib/guide.ts) for every in-between state of the site, for every role: each says
// what is happening, how long, what is needed from the visitor, whether they can leave, and where the
// money is, with the amount. And it never promises what the contract does not do.

import test from "node:test";
import assert from "node:assert/strict";

import { claimGuide, orderGuide, restockGuide, sendingGuide, signGuide, updatingGuide, KICKERS } from "../../lib/guide.ts";

const GEN = 10n ** 18n;
const ROLES = ["buyer", "owner", "visitor"];
const FNS = ["open_shop", "fund", "withdraw_bond", "list_product", "buy", "deposit", "withdraw", "claim", "release"];
const NOW = 1_800_000_000;

/** The five lines are there, plain, and the money line names an amount or says no GEN moves. */
function fivelines(g, where) {
  for (const k of ["id", "kicker"]) assert.ok(typeof g[k] === "string" && g[k].trim().length > 0, `${where}: ${k}`);
  for (const k of ["now", "time", "need", "leave", "money"]) assert.ok(typeof g[k] === "string" && g[k].trim().length > 10, `${where}: ${k}`);
  assert.equal(typeof g.canLeave, "boolean", `${where}: canLeave`);
  assert.ok(/\d+\.\d+ GEN|no GEN|nothing goes to anyone|untouched|Nothing leaves your wallet|final/i.test(g.money), `${where}: the money line says where the money is: ${g.money}`);
  if (!g.canLeave) assert.match(g.leave, /stay/i, `${where}: a wait the visitor cannot leave says so`);
  else assert.match(g.leave, /can close this page|come back/i, `${where}: a wait the visitor can leave says so`);
  assert.ok(!/undefined|NaN|\[object/.test(JSON.stringify(g)), `${where}: no hole in the words`);
  assert.ok(["busy", "clock", "late", "ready", "done"].includes(g.tone));
}

const order = (over = {}) => ({
  role: "buyer",
  now: NOW,
  id: "O7",
  status: "open",
  endedBy: "",
  windowEnd: NOW + 1500,
  priceAtto: (2n * GEN).toString(),
  reservedAtto: (2n * GEN).toString(),
  refundedAtto: "0",
  claimsLeft: 2,
  creditAtto: (GEN / 100n).toString(),
  ...over,
});

test("the wallet prompt, for every call, live and in the demo build", () => {
  for (const fn of FNS)
    for (const mock of [false, true]) {
      const g = signGuide({ fn, label: `Sending ${fn} for O7`, amountAtto: GEN.toString(), mock });
      fivelines(g, `sign ${fn} ${mock}`);
      assert.equal(g.canLeave, false, "nobody walks away from an open wallet prompt");
      if (!mock) assert.match(g.need, /Confirm it in your wallet/);
    }
});

test("every plain call on its way", () => {
  for (const fn of FNS.filter((f) => f !== "claim"))
    for (const mock of [false, true]) {
      const g = sendingGuide({ fn, target: fn === "release" ? "O7" : "S2", title: "Lumio K3 kettle", amountAtto: (2n * GEN).toString(), window: 1800, mock });
      fivelines(g, `sending ${fn}`);
      assert.equal(g.waitsFor, "validators");
      assert.equal(g.canLeave, true, "a sent transaction lands whether or not the page is open");
    }
  const buy = sendingGuide({ fn: "buy", target: "P1", title: "Lumio K3 kettle", amountAtto: (2n * GEN).toString(), window: 1800 });
  assert.match(buy.money, /2\.00 GEN goes to the shop in this transaction, and the same amount of the shop's bond is reserved for you for 30 minutes/);
  assert.match(buy.money, /A refused purchase sends all of it back in the same transaction/);
  assert.match(sendingGuide({ fn: "release", target: "O7", amountAtto: (2n * GEN).toString() }).money, /nothing leaves the contract and nothing goes to anyone/);
  fivelines(updatingGuide("Bought: O7 is open"), "updating");
});

test("a claim while the validators read the page, busy and late, for every role", () => {
  for (const role of ROLES)
    for (const stage of ["busy", "late"]) {
      const g = claimGuide({ role, order: "O7", page: "northgate/lumio-k3-kettle.html", priceAtto: (2n * GEN).toString(), stage, mock: false });
      fivelines(g, `claim ${role} ${stage}`);
      assert.equal(g.waitsFor, "validators");
      assert.equal(g.tone, stage);
      assert.match(g.now, /northgate\/lumio-k3-kettle\.html/);
      assert.match(g.money, /0\.01 GEN/);
      assert.match(g.money, /Matched: the difference/);
      assert.match(g.money, /Different: the fee goes to the shop/);
      assert.match(g.money, /Not cheaper or unclear: nothing moves/);
    }
  assert.match(claimGuide({ role: "buyer", order: "O7", page: "p", priceAtto: "1", stage: "busy", mock: false }).time, /every validator fetches the page itself/);
  assert.match(claimGuide({ role: "buyer", order: "O7", page: "p", priceAtto: "1", stage: "late", mock: false }).time, /stores nothing, and the claim may be made again/);
});

test("every state of an order, for its buyer, its shop's owner and anyone else", () => {
  const states = {
    window: order(),
    "window-credit": order({ creditAtto: "0" }),
    "release-due": order({ now: NOW + 2000 }),
    release: order({ releasing: true }),
    matched: order({ status: "matched", endedBy: "match", reservedAtto: "0", refundedAtto: (GEN / 5n).toString(), claimsLeft: 0 }),
    "released-claims": order({ status: "released", endedBy: "claims", reservedAtto: "0", claimsLeft: 0 }),
    "released-window": order({ status: "released", endedBy: "window", reservedAtto: "0", claimsLeft: 0 }),
    "no-clock": order({ now: -1 }),
  };
  for (const [name, input] of Object.entries(states))
    for (const role of ROLES) {
      const g = orderGuide({ ...input, role });
      fivelines(g, `${name} as ${role}`);
      const expected = name === "window-credit" && role !== "buyer" ? "window" : name;
      assert.equal(g.id, expected, `${name} as ${role}`);
    }
  const w = orderGuide(order());
  assert.equal(w.left, 1500, "the window counts down");
  assert.equal(w.tone, "clock");
  assert.match(w.need, /Only if you found it cheaper/);
  assert.match(orderGuide(order({ creditAtto: "0" })).need, /add 0\.01 GEN of claim-fee credit/);
  assert.match(orderGuide(order({ role: "owner", now: NOW + 2000 })).need, /Press Release to free your bond/);
  const m = orderGuide(order({ status: "matched", endedBy: "match", refundedAtto: (GEN / 5n).toString() }));
  assert.match(m.now, /0\.20 GEN came back to you from the shop's bond/);
  assert.equal(m.waitsFor, "done");
  assert.equal(m.kicker, "Price matched · closed");
  assert.match(orderGuide(order({ status: "released", endedBy: "claims" })).now, /Both judged claims were used without a match/);
  assert.match(orderGuide(order({ claimsLeft: 1 })).now, /one judged claim left/);
});

test("the demo shop topping up its bond: asking, sending and failing", () => {
  for (const state of ["asking", "sending", "failed"]) {
    const g = restockGuide({ state, product: "P1", reason: "the demo shop was asked about P1 a moment ago; try again in 80 s" });
    fivelines(g, `restock ${state}`);
    assert.equal(g.waitsFor, "demo");
    assert.match(g.money, /Your wallet is untouched/);
  }
  assert.equal(restockGuide({ state: "asking", product: "P1" }).canLeave, false);
  assert.equal(restockGuide({ state: "failed", product: "P1", reason: "x" }).note, "x");
  assert.equal(Object.keys(KICKERS).length, 7);
});
