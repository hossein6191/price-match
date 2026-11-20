// The waiting copy (lib/guide.ts) for every in-between state of the site, for every role: each says
// what is happening, how long, what is needed from the visitor, whether they can leave, and where the
// money is, with the amount. And it never promises what the contract does not do.

import test from "node:test";
import assert from "node:assert/strict";

import { appealGuide, claimGuide, demoAskGuide, orderGuide, restockGuide, sendingGuide, signGuide, updatingGuide, KICKERS } from "../../lib/guide.ts";

const GEN = 10n ** 18n;
const ROLES = ["buyer", "owner", "visitor"];
const FNS = ["open_shop", "fund", "withdraw_bond", "list_product", "buy", "deposit", "withdraw", "claim", "appeal", "settle", "reprice", "claim_drop", "release"];
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
  for (const fn of FNS.filter((f) => f !== "claim" && f !== "appeal"))
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
      assert.match(g.money, /Nothing moves in this call: the finding waits 15 minutes for an appeal/);
      assert.match(g.money, /matched pays .* the difference, different sends the fee to the shop, and anything else returns the fee/);
    }
  assert.match(claimGuide({ role: "buyer", order: "O7", page: "p", priceAtto: "1", stage: "busy", mock: false }).time, /every validator fetches the page itself/);
  assert.match(claimGuide({ role: "buyer", order: "O7", page: "p", priceAtto: "1", stage: "late", mock: false }).time, /stores nothing, and the claim may be made again/);
});

test("an appeal while the validators read the page again, for every role and both sides", () => {
  for (const role of ROLES)
    for (const by of ["buyer", "shop"])
      for (const stage of ["busy", "late"]) {
        const g = appealGuide({ role, claim: "C4", order: "O7", page: "northgate/lumio-k3-kettle.html", by, stage, mock: false });
        fivelines(g, `appeal ${role} ${by} ${stage}`);
        assert.equal(g.waitsFor, "validators");
        assert.match(g.money, /0\.05 GEN/);
        assert.match(g.money, /the claim settles in this call/);
        assert.match(g.now, /a second time for C4/);
      }
  assert.match(appealGuide({ role: "buyer", claim: "C4", order: "O7", page: "p", by: "buyer", stage: "busy" }).money, /of your credit/);
  assert.match(appealGuide({ role: "buyer", claim: "C4", order: "O7", page: "p", by: "shop", stage: "busy" }).money, /of the shop's credit/);
  assert.match(appealGuide({ role: "buyer", claim: "C4", order: "O7", page: "p", by: "buyer", stage: "late" }).time, /the first finding still stands/);
});

test("a pending finding: the appeal window counting down, settle when it closed, and a price drop owed", () => {
  const pend = (over = {}) => ({ id: "C4", outcome: "matched", mayAppeal: "shop", appealEnd: NOW + 600, refundAtto: (GEN / 5n).toString(), ...over });
  for (const role of ROLES)
    for (const outcome of ["matched", "not_in_stock", "not_cheaper", "different", "unclear"]) {
      const p = pend({ outcome, mayAppeal: outcome === "matched" ? "shop" : "buyer" });
      const g = orderGuide(order({ role, pending: p }));
      fivelines(g, `pending ${outcome} as ${role}`);
      const mine = (p.mayAppeal === "shop" && role === "owner") || (p.mayAppeal === "buyer" && role === "buyer");
      assert.equal(g.id, mine ? "pending-appeal" : "pending", `${outcome} as ${role}`);
      assert.equal(g.left, 600, "the appeal window counts down");
      assert.equal(g.leftLabel, "appeal window left");
      assert.match(g.money, /^Nothing has moved yet\./);
      if (mine) assert.match(g.need, /appeal below with a reason \(0\.05 GEN of credit\)/);
      const due = orderGuide(order({ role, now: NOW + 601, pending: p }));
      fivelines(due, `settle-due ${outcome} as ${role}`);
      assert.equal(due.id, "settle-due");
      assert.equal(due.waitsFor, "anyone");
    }
  assert.match(orderGuide(order({ pending: pend() })).money, /0\.20 GEN is due to the buyer and waits in the 2\.00 GEN reserved/);
  assert.match(orderGuide(order({ pending: pend({ outcome: "different", mayAppeal: "buyer" }) })).money, /will go to the shop/);
  for (const role of ROLES) {
    const g = orderGuide(order({ role, dropDueAtto: ((3n * GEN) / 10n).toString() }));
    fivelines(g, `drop owed as ${role}`);
    assert.equal(g.id, role === "buyer" ? "drop-owed" : "drop-owed-other");
    assert.match(g.now, /0\.30 GEN is owed/);
  }
  assert.match(orderGuide(order({ dropDueAtto: ((3n * GEN) / 10n).toString() })).need, /Press Claim drop/);
  assert.equal(orderGuide(order({ dropDueAtto: "0" })).id, "window", "no drop owed: the window as before");
});

test("the demo shop asked to drop a price, raise it back, or appeal: asking, sending and failing", () => {
  for (const kind of ["drop", "raise", "appeal"])
    for (const state of ["asking", "sending", "failed"]) {
      const g = demoAskGuide({ state, kind, target: kind === "appeal" ? "C4" : "P1", reason: "try again in 80 s" });
      fivelines(g, `demo ${kind} ${state}`);
      assert.match(g.money, /Your wallet is untouched/);
    }
  assert.equal(demoAskGuide({ state: "asking", kind: "drop", target: "P1" }).canLeave, false);
  assert.match(demoAskGuide({ state: "sending", kind: "drop", target: "P1" }).now, /lower the price of P1 by 0\.30 GEN/);
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
