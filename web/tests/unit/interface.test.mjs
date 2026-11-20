// The site against the contract it talks to, read from contracts/price_match.py in this repository:
// every write builder names a real write method with the right number of arguments and sends value
// only to the payable ones; every view the site reads exists and the site reads every view; the
// limits and the four questions are the contract's own; every refusal sentence the in-memory
// contract gives and every sentence the forms give is made of the contract's words; and the
// in-memory rules() is the contract's rules(), compared whole.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { calls } from "../../lib/calls.ts";
import * as rules from "../../lib/rules.ts";
import * as mock from "../../lib/chain-mock.ts";
import { askContract } from "./oracle.mjs";

// The contract's source with its escaped quotes read as quotes, and Python's adjacent string literals
// (a sentence split over two lines) joined back into one, so its sentences can be looked up whole.
const raw = readFileSync(new URL("../../../contracts/price_match.py", import.meta.url), "utf8");
const contract = raw
  .replace(/\\"/g, '"')
  .replace(/"\s*\n\s*"/g, "")
  .replace(/"\s*\n\s*\+\s*"/g, "")
  .replace(/"\s*\+\s*\n\s*"/g, "");
const chainSource = readFileSync(new URL("../../lib/chain.ts", import.meta.url), "utf8");
const mockSource = readFileSync(new URL("../../lib/chain-mock.ts", import.meta.url), "utf8");
const rulesSource = readFileSync(new URL("../../lib/rules.ts", import.meta.url), "utf8");

/** { name: { kind, payable, params } } for every public method of the contract. */
function methods() {
  const out = {};
  const re = /@gl\.public\.(write(?:\.payable)?|view)\s*\n\s*def (\w+)\(self(?:,\s*([^)]*))?\)/g;
  for (const m of raw.matchAll(re)) {
    const params = (m[3] ?? "").split(",").map((p) => p.trim()).filter(Boolean);
    out[m[2]] = { kind: m[1].startsWith("view") ? "view" : "write", payable: m[1].endsWith("payable"), params: params.length };
  }
  return out;
}

/** The value of a Python constant written as `NAME = <expr>` at the start of a line. */
const constant = (name) => {
  const m = new RegExp(`^${name}\\s*=\\s*([^#\\n]+)`, "m").exec(raw);
  assert.ok(m, `the contract defines ${name}`);
  return m[1].trim();
};

/** A parenthesised Python string constant, joined. */
const pyString = (name) => {
  const start = raw.indexOf(`\n${name} = (`);
  assert.ok(start >= 0, `the contract defines ${name}`);
  const body = raw.slice(start, raw.indexOf("\n)", start));
  return [...body.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"')).join("");
};

test("every write builder names a write method of the contract, with its arguments and its value", () => {
  const all = methods();
  const built = [
    calls.openShop("Harbour Lane Goods", ["https://a.example/x/"]),
    calls.fund("S1", 10n ** 18n),
    calls.withdrawBond("S1", 10n ** 18n),
    calls.listProduct("S1", "Kettle", "x".repeat(40), 2n * 10n ** 18n, 1800),
    calls.buy("P1", 2n * 10n ** 18n),
    calls.deposit(10n ** 16n),
    calls.withdraw(),
    calls.claim("O1", "https://a.example/x/a.html"),
    calls.appeal("C1", "The page shows it in stock."),
    calls.settle("C1"),
    calls.reprice("P1", 17n * 10n ** 17n),
    calls.claimDrop("O1"),
    calls.release("O1"),
  ];
  const writes = Object.entries(all).filter(([, m]) => m.kind === "write").map(([n]) => n).sort();
  assert.equal(writes.length, 13);
  assert.deepEqual([...new Set(built.map((c) => c.fn))].sort(), writes, "the site can send every write and nothing else");
  for (const c of built) {
    const m = all[c.fn];
    assert.equal(c.args.length, m.params, `${c.fn} takes ${m.params} arguments`);
    assert.equal(c.value !== undefined, m.payable, `${c.fn} sends value only when payable`);
  }
  const list = calls.listProduct("S1", "Kettle", "x".repeat(40), 15n * 10n ** 17n, 1800.9);
  assert.equal(list.args[3], "1500000000000000000", "the price travels as a string of digits");
  assert.equal(list.args[4], 1800, "the window travels as an integer");
  assert.equal(calls.openShop("A shop", ["https://a.example/x/"]).args[1], '["https://a.example/x/"]', "the prefixes travel as a JSON list");
  assert.equal(calls.withdrawBond("S1", 5n).args[1], "5");
  assert.equal(calls.reprice("P1", 17n * 10n ** 17n).args[1], "1700000000000000000", "a new price travels as a string of digits");
});

test("every view the site reads is a view of the contract, and the site reads every view", () => {
  const all = methods();
  const read = [...chainSource.matchAll(/view\("(\w+)"/g)].map((m) => m[1]);
  const views = Object.entries(all).filter(([, m]) => m.kind === "view").map(([n]) => n);
  assert.equal(views.length, 12);
  for (const name of read) assert.equal(all[name]?.kind, "view", `${name} is a view`);
  for (const name of views) assert.ok(read.includes(name), `the site reads ${name}`);
  for (const name of views) assert.ok(mockSource.includes(`case "${name}":`), `the in-memory contract answers ${name}`);
});

test("the limits and the questions are the contract's own", () => {
  const nums = {
    APPEAL_WINDOW: 900, MIN_REASON: 10, MAX_REASON: 280, MAX_REPRICES: 16,
    MIN_WINDOW: 1200, MIN_NAME: 3, MAX_NAME: 60, MIN_TITLE: 3, MAX_TITLE: 80, MIN_SPEC: 40, MAX_SPEC: 400, MAX_PREFIXES: 5, MAX_PREFIX: 160,
    MAX_PREFIXES_JSON: 1000, MAX_URL: 200, MAX_PRODUCTS: 20, MAX_CLAIMS: 2, REJUDGE_GAP: 86400, MIN_PAGE: 40, MAX_PAGE: 6000, PAGE: 20, ID_CHARS: 12, ADDRESS_CHARS: 42,
  };
  for (const [name, value] of Object.entries(nums)) {
    assert.equal(Number(constant(name)), value, `${name} in the contract`);
    assert.equal(rules[name], value, `${name} in lib/rules.ts`);
  }
  assert.equal(constant("MAX_WINDOW"), "30 * 86400");
  assert.equal(rules.MAX_WINDOW, 30 * 86400);
  assert.equal(constant("CLAIM_FEE"), "ATTO // 100");
  assert.equal(rules.CLAIM_FEE, 10n ** 16n);
  assert.equal(constant("MIN_PRICE"), "ATTO // 10");
  assert.equal(rules.MIN_PRICE, 10n ** 17n);
  assert.equal(constant("MAX_PRICE"), "100 * ATTO");
  assert.equal(rules.MAX_PRICE, 100n * 10n ** 18n);
  assert.equal(rules.QUESTION_SAME, pyString("QUESTION_SAME"));
  assert.equal(rules.QUESTION_DIFFERENT, pyString("QUESTION_DIFFERENT"));
  assert.equal(rules.QUESTION_PRICE, pyString("QUESTION_PRICE"));
  assert.equal(rules.QUESTION_STOCK, pyString("QUESTION_STOCK"));
  assert.equal(rules.ARGUING, pyString("ARGUING"));
  assert.equal(constant("APPEAL_BOND"), "ATTO // 20");
  assert.equal(rules.APPEAL_BOND, 5n * 10n ** 16n);
  assert.equal(rules.READING, pyString("READING"));
  assert.match(raw, /^MONEY_WORDS = \("gen", "atto", "price", "prices", "priced", "pricing", "cost", "costs", "rrp", "msrp"\)$/m);
  assert.deepEqual(rules.MONEY_WORDS, ["gen", "atto", "price", "prices", "priced", "pricing", "cost", "costs", "rrp", "msrp"]);
});

/** The text of every call `name(...)` in a source, with its parentheses balanced (strings respected). */
function argsOf(source, name) {
  const out = [];
  let at = 0;
  for (;;) {
    const i = source.indexOf(name + "(", at);
    if (i < 0) return out;
    let depth = 0;
    let j = i + name.length;
    let quote = "";
    for (; j < source.length; j++) {
      const ch = source[j];
      if (quote) {
        if (ch === "\\") j++;
        else if (ch === quote) quote = "";
        continue;
      }
      if (ch === '"' || ch === "`" || ch === "'") quote = ch;
      else if (ch === "(") depth++;
      else if (ch === ")" && --depth === 0) break;
    }
    out.push(source.slice(i + name.length + 1, j));
    at = j;
  }
}

/** Every string literal in an expression, cut at its ${...} holes: the pieces of a sentence the code writes itself. */
function pieces(expr) {
  const out = [];
  for (const m of expr.matchAll(/"((?:[^"\\]|\\.)*)"|`([^`]*)`/g)) {
    const text = (m[1] ?? m[2]).replace(/\\"/g, '"');
    for (const part of text.split(/\$\{[^}]*\}/)) {
      const p = part.trim().replace(/^[;:,.]\s*/, "");
      if (p.length >= 8) out.push(p);
    }
  }
  return out;
}

test("every refusal the in-memory contract gives is in the contract's own words", () => {
  const raised = argsOf(mockSource, "fail").filter((a) => /["`]/.test(a));
  assert.ok(raised.length >= 24, `found ${raised.length} refusals`);
  for (const r of raised) for (const p of pieces(r)) assert.ok(contract.includes(p), `the contract says "${p}"`);
  const refused = [...mockSource.matchAll(/problem =\s*([\s\S]*?);\n/g)].map((m) => m[1]).filter((a) => /["`]/.test(a));
  assert.ok(refused.length >= 9, `found ${refused.length} payable refusals`);
  for (const r of refused) for (const p of pieces(r)) assert.ok(contract.includes(p), `the contract says "${p}"`);
});

test("every sentence the forms give in lib/rules.ts is in the contract's own words", () => {
  const start = rulesSource.indexOf("// ---- reading the caller");
  const end = rulesSource.indexOf("// ---- what the site sends");
  const said = [...rulesSource.slice(start, end).matchAll(/`([^`]*)`|return "([^"]{8,})"/g)].map((m) => m[1] ?? m[2]);
  assert.ok(said.length >= 12, `found ${said.length} sentences`);
  for (const r of said) for (const p of pieces(r)) assert.ok(contract.includes(p.replace(/\\"/g, '"')), `the contract says "${p}"`);
});

test("the in-memory rules() is the contract's rules(), whole", async (t) => {
  const mine = JSON.parse(await mock.view("rules", []));
  const answers = askContract([{ fn: "rules" }]);
  if (!answers) return t.skip("no python3 on this machine");
  assert.deepEqual(mine, answers[0].ok);
});
