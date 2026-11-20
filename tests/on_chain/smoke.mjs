/* Price Match, contract version 2, against GenLayer Studio (chain 61999), with throwaway accounts. Deploys its own copy.
 *
 *   npm ci                                                   # genlayer-js 1.1.8 and viem 2.56.8, pinned by package-lock.json
 *   COMMIT=<sha> node tests/on_chain/smoke.mjs               # the whole run, about forty minutes
 *   COMMIT=<sha> RESUME=1 node tests/on_chain/smoke.mjs      # continue a run that was cut off, from the saved state
 *   STATE=/some/dir/run.json ...                             # the state file: keys, contract address, every step made
 *   FRESH=1 ...                                              # start over even though a saved run exists
 *
 * The validators read the competitor pages from raw.githubusercontent.com, pinned to one commit, so the pages
 * every node fetches are the same bytes. Push the repository first and pass that commit as COMMIT (40 hex
 * characters). REPO is "<owner>/<name>" on GitHub; when it is not set it is read from `git remote get-url origin`.
 * The script fetches every demo page it uses itself before it deploys anything, and stops if one is not there.
 *
 * Three accounts the script generates and funds itself play the whole story: SHOP owns the shop, BUYER buys
 * and claims, STRANGER tries what only the others may do and settles and releases what anyone may. Every shop
 * and brand is fictional. Each product's guarantee window is WINDOW_SECONDS (30 minutes); a judged claim's appeal
 * window is the contract's 15 minutes, and the appeal below must land inside it, so do not pause the run between
 * the match and the appeal.
 *
 * Phases:
 *   A  deploy; SHOP opens S1, "Harbour Lane Goods", accepting pages below three competitor prefixes, and lists P1
 *      the Lumio K3 kettle at 2.00 GEN and P2 the Arcwave X200 earbuds at 3.50 GEN. STRANGER tries to list a
 *      product and is refused. BUYER tries to buy P1 before the shop has a bond: refused, and the 2.00 GEN comes
 *      back in the same transaction. SHOP funds a 7 GEN bond and deposits 0.05 GEN of credit for an appeal bond.
 *      BUYER deposits 0.05 GEN of claim-fee credit and buys both: each sale reaches SHOP in the same transaction
 *      and its price is reserved from the bond. SHOP tries to withdraw the whole 7 GEN: refused, 1.50 GEN is free.
 *   B  in stock, judged. STRANGER tries to claim on BUYER's order: refused. BUYER claims with a page outside the
 *      prefixes: refused before anything is fetched. BUYER claims O1 with northgate/lumio-k3-kettle-sold-out.html,
 *      the same kettle at 1.80 GEN but sold out: not_in_stock, pending, nothing moves. SHOP tries to appeal it:
 *      refused, the finding went against the buyer. BUYER waives its appeal with settle: the fee comes back.
 *   C  the bonded appeal. BUYER claims O1 with northgate/lumio-k3-kettle.html, the same kettle at 1.80 GEN in
 *      stock: matched, and the 0.20 GEN refund is held, pending, in the reservation: nothing reaches BUYER yet.
 *      BUYER tries to appeal it: refused. STRANGER tries to settle it inside the window: refused. SHOP appeals with
 *      a false reason, staking 0.05 GEN: the validators read the same page again, both orders, the reason fenced as
 *      one party's argument; upheld, so the 0.20 GEN reaches BUYER in that transaction and the bond goes to BUYER's
 *      credit. SHOP tries to appeal again: refused, no appeal of an appeal.
 *   D  price protection. STRANGER tries to reprice P2: refused. SHOP reprices P2 to 3.00 GEN. STRANGER tries to
 *      claim the drop on O2: refused. BUYER claims it: 0.50 GEN from O2's own reservation in the same transaction,
 *      no model asked. BUYER tries again: refused, nothing left to claim.
 *   E  once O2's window has closed, STRANGER releases it (3.00 GEN back to the free bond); SHOP withdraws the whole
 *      remaining bond, 6.30 GEN; BUYER withdraws its 0.10 GEN of credit; SHOP tries to withdraw credit it no longer
 *      holds: refused.
 *   F  the deployed code is read back and compared with contracts/price_match.py byte for byte; the views are
 *      checked against what the run did; the contract holds nothing; every account ends where the money table
 *      says: SHOP up 4.75 GEN, BUYER down 4.75 GEN, STRANGER whole.
 *
 * Every refusal is a signed transaction. Balances are read before and after every step that moves money.
 * Transactions are polled with eth_getTransactionByHash, never with views (gen_call is limited to 30 a minute
 * per client, shared with sim_fundAccount). A round the validators do not carry stores nothing; it is sent again
 * and both transactions are kept. Every step is saved as it is made, so a run cut off by a closed laptop
 * continues with RESUME=1 without sending anything twice.
 */
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { generatePrivateKey } from "viem/accounts";
import { getAddress } from "viem";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RPC = "https://studio.genlayer.com/api";
const EXPLORER = "https://explorer-studio.genlayer.com";
const STATE = process.env.STATE || join(tmpdir(), "price-match-smoke-state.json");
const RECORD = process.env.RECORD || STATE.replace(/\.json$/, "") + "-record.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 19);
const rpc = async (m, p) => {
  let last;
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }) });
      const j = await r.json();
      if (j.error && (j.error.code === -32029 || r.status === 429)) { await sleep(((j.error.data?.retry_after_seconds) || 20) * 1000); continue; }
      if (j.error) { last = new Error(m + ": " + JSON.stringify(j.error).slice(0, 200)); await sleep(6000); continue; }
      return j.result;
    } catch (e) { last = e; await sleep(4000); }   // the connection itself failed, or the answer was not JSON
  }
  throw last;
};
let pass = 0, fail = 0;
const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  - " + d : ""}`); return !!c; };
const note = (s) => console.log(`      .. ${s}`);
const GEN = 10n ** 18n;
const tally = (v) => `${v.agree} agree, ${v.disagree} disagree, ${v.idle} idle`;
const sha = (text) => createHash("sha256").update(text).digest("hex");

// ---------- where the validators will read the competitor pages ----------
const COMMIT = String(process.env.COMMIT || "").trim();
if (!/^[0-9a-f]{40}$/.test(COMMIT)) {
  console.log("COMMIT must be the 40-character commit the competitor pages were pushed in: COMMIT=<sha> node tests/on_chain/smoke.mjs");
  process.exit(2);
}
let REPO = String(process.env.REPO || "").trim();
if (!REPO) {
  try {
    const origin = execSync("git remote get-url origin", { cwd: new URL("../..", import.meta.url), encoding: "utf8" }).trim();
    REPO = (origin.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/) || [])[1] || "";
  } catch (e) { REPO = ""; }
}
if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(REPO)) {
  console.log("REPO must be <owner>/<name> on GitHub (or set the git remote origin): REPO=<owner>/price-match COMMIT=<sha> ...");
  process.exit(2);
}
const RAW = `https://raw.githubusercontent.com/${REPO}/${COMMIT}/competitors/`;
const PREFIXES = [RAW + "northgate/", RAW + "bright-basket/", RAW + "corner-hardware/"];
const PAGE = {
  kettleSoldOut: RAW + "northgate/lumio-k3-kettle-sold-out.html",           // 1.80 GEN, the same kettle, sold out
  kettleCheaper: RAW + "northgate/lumio-k3-kettle.html",                    // 1.80 GEN, the same kettle, in stock
  outside: RAW + "unlisted/lumio-k3-kettle.html",                           // below no accepted prefix
};
for (const [name, address] of Object.entries(PAGE)) {
  if (name === "outside") continue;
  const here = readFileSync(new URL("../../competitors/" + address.slice(RAW.length), import.meta.url), "utf8");
  let there = "";
  try { const r = await fetch(address); there = r.ok ? await r.text() : ""; } catch (e) { there = ""; }
  if (there !== here) {
    console.log(`${address}\ndoes not serve competitors/${address.slice(RAW.length)} as it is in this checkout. Push the repository and pass that commit as COMMIT.`);
    process.exit(2);
  }
}

// ---------- state: keys, the contract address and every step already made survive a cut-off run ----------
if (existsSync(STATE) && !process.env.RESUME && !process.env.FRESH) {
  console.log(`A saved run exists at ${STATE}.\nRESUME=1 continues it; FRESH=1 starts over; STATE=<path> keeps another.`);
  process.exit(2);
}
const st = existsSync(STATE) && process.env.RESUME && !process.env.FRESH ? JSON.parse(readFileSync(STATE, "utf8")) : {};
st.keys = st.keys || {}; st.steps = st.steps || {}; st.views = st.views || {}; st.order = st.order || [];
st.commit = st.commit || COMMIT; st.repo = st.repo || REPO;
if (st.commit !== COMMIT) { console.log(`This saved run used commit ${st.commit}; continue it with that COMMIT, or start over with FRESH=1.`); process.exit(2); }
const save = () => {
  writeFileSync(STATE, JSON.stringify(st, null, 1));
  const { keys, ...shown } = st;       // the record carries no key
  writeFileSync(RECORD, JSON.stringify(shown, null, 1));
};
const ROLES = { shop: "SHOP, the owner of Harbour Lane Goods", buyer: "BUYER", stranger: "STRANGER" };
for (const k of Object.keys(ROLES)) st.keys[k] = st.keys[k] || generatePrivateKey();
const acct = {}, client = {};
for (const k of Object.keys(ROLES)) { acct[k] = createAccount(st.keys[k]); client[k] = createClient({ chain: studionet, account: acct[k] }); }
const rd = createClient({ chain: studionet });
st.accounts = Object.fromEntries(Object.keys(ROLES).map((k) => [k, getAddress(acct[k].address)]));
save();

const balance = async (a) => BigInt(await rpc("eth_getBalance", [a, "latest"]) || "0x0");
const nonceOf = async (a) => Number(BigInt(await rpc("eth_getTransactionCount", [a, "latest"]) || "0x0"));
const fundOnce = async (k, whole) => {
  st.funded = st.funded || {};
  if (st.funded[k]) return;
  await rpc("sim_fundAccount", { account_address: getAddress(acct[k].address), amount: whole * 1e18 });   // checksummed
  for (let i = 0; i < 20 && (await balance(acct[k].address)) === 0n; i++) await sleep(3000);
  st.funded[k] = String(await balance(acct[k].address)); save();
};

// ---------- transactions ----------
const errText = (e) => String(e?.details || e?.shortMessage || e?.cause?.message || e?.message || e);
// A request the network refused or never received is made again. When the failure is ambiguous the
// sender's nonce says whether the transaction landed after all, and its hash is read back, so nothing
// is ever sent twice.
const sendRaw = async (who, what, make) => {
  const addr = acct[who].address;
  for (let i = 0; ; i++) {
    const n0 = await nonceOf(addr);
    try { return await make(); } catch (e) {
      const text = errText(e);
      if (i >= 8) throw e;
      console.log(`      ${what} was not taken (${text.slice(0, 70)}); looking again in 20s`);
      await sleep(20000);
      if ((await nonceOf(addr)) > n0) {
        const list = await rpc("sim_getTransactionsForAddress", [addr]);
        const hit = (list || []).find((t) => String(t.from_address).toLowerCase() === addr.toLowerCase() && Number(t.nonce) === n0);
        if (hit?.hash) return hit.hash;
        throw new Error(what + " landed but its hash could not be read back");
      }
    }
  }
};
const countVotes = (t) => { let a = 0, d = 0, idl = 0; for (const k in (t.consensus_data?.votes || {})) { const v = t.consensus_data.votes[k]; if (v === "agree") a++; else if (v === "disagree") d++; else idl++; } return { agree: a, disagree: d, idle: idl }; };
const wait = async (tx) => {
  let stuck = 0;
  for (let i = 0; i < 900; i++) {
    await sleep(4000);
    const t = await rpc("eth_getTransactionByHash", [tx]);
    if (t?.status === "FINALIZED") {
      const lr = t.consensus_data?.leader_receipt, one = Array.isArray(lr) ? lr[0] : lr;
      let msg = "";
      try { msg = Buffer.from(one.result, "base64").toString("utf8").replace(/[^\x20-\x7e]/g, " ").trim(); } catch (e) {}
      const v = countVotes(t);
      return { tx, msg, exec: one?.execution_result || "", votes: v, applied: v.agree * 2 > v.agree + v.disagree + v.idle, address: t.data?.contract_address || t.to_address || "" };
    }
    // a round no majority carried is final as it stands once it has been left alone for ten minutes
    if (t?.status === "UNDETERMINED" && (stuck = stuck + 1) > 150) return { tx, msg: "UNDETERMINED", exec: "", votes: countVotes(t), applied: false, address: "" };
    if (t?.status === "CANCELED") return { tx, msg: "CANCELED", exec: "", votes: { agree: 0, disagree: 0, idle: 0 }, applied: false, address: "" };
    if (i > 0 && i % 75 === 0) console.log(`      [${stamp()}] still ${t?.status || "unknown"} after ${Math.round(i * 4 / 60)} minutes: ${tx}`);
  }
  return { tx, msg: "TIMEOUT", exec: "", votes: { agree: 0, disagree: 0, idle: 0 }, applied: false, address: "" };
};
const jsonOf = (msg) => { const b = String(msg).indexOf("{"); if (b === -1) return null; try { return JSON.parse(String(msg).slice(b)); } catch (e) { return null; } };
const settleBalance = async (a, before, want) => { for (let i = 0; i < 45; i++) { const b = await balance(a); if (b - before === want) return b; await sleep(4000); } return await balance(a); };

// One step of the run: a signed transaction, its tally, what it returned, and the balances it moved.
// opt.value is what is sent with it; opt.watch names the accounts whose balances are read before and
// after; opt.expect is the change each should show once every transfer has landed, a table or a
// function of what the call returned. A step already in the saved state is not sent again.
const call = async (id, who, fn, args = [], opt = {}) => {
  if (!st.steps[id]) { st.steps[id] = { id, who, fn, args: args.map(String), value: String(opt.value || 0n), tries: [] }; st.order.push(id); }
  const rec = st.steps[id];
  if (!rec.done) {
    const watch = opt.watch || [];
    if (!rec.before) { rec.before = {}; for (const k of watch) rec.before[k] = String(await balance(acct[k].address)); save(); }
    let r;
    for (;;) {
      if (!rec.pending) {
        rec.pending = await sendRaw(who, fn, () => client[who].writeContract({ address: st.contract, functionName: fn, args, ...(opt.value ? { value: opt.value } : {}) }));
        save();
      }
      r = await wait(rec.pending);
      rec.tries.push({ tx: r.tx, votes: r.votes, exec: r.exec, applied: r.applied, msg: r.msg, at: stamp() });
      rec.pending = null; save();
      console.log(`      [${stamp()}] ${who.toUpperCase()} ${fn}(${args.map((x) => String(x).slice(-30)).join(", ")})${opt.value ? " +" + Number(opt.value) / 1e18 + " GEN" : ""}  ${r.tx}  ${tally(r.votes)}  ${r.exec}`);
      if (r.msg === "TIMEOUT" || rec.tries.length >= 4) break;
      if (!r.applied) { console.log("      the validators did not carry that round (" + tally(r.votes) + "), so nothing was stored; sending it again"); continue; }
      break;
    }
    const expect = typeof opt.expect === "function" ? opt.expect(jsonOf(r.msg)) : opt.expect;
    rec.after = {}; rec.delta = {};
    for (const k of watch) {
      const before = BigInt(rec.before[k]);
      const want = expect && expect[k] !== undefined ? BigInt(expect[k]) : null;
      const now = want === null ? await balance(acct[k].address) : await settleBalance(acct[k].address, before, want);
      rec.after[k] = String(now); rec.delta[k] = String(now - before);
    }
    rec.done = true; save();
  }
  const last = rec.tries[rec.tries.length - 1];
  return { ...last, j: jsonOf(last.msg), tries: rec.tries, delta: rec.delta || {} };
};
const refused = (r, words) => r.exec === "ERROR" && r.msg.includes(words);
const moved = (r, k, want) => r.delta[k] === String(want);
const votes = (r) => r.tries.map((t) => tally(t.votes)).join(", then ");

const deploy = async (id, who, path) => {
  if (!st.steps[id]) { st.steps[id] = { id, who, fn: "deploy " + path.split("/").pop(), args: [], value: "0", tries: [] }; st.order.push(id); }
  const rec = st.steps[id];
  if (!rec.done) {
    const code = readFileSync(new URL(path, import.meta.url));
    for (;;) {
      if (!rec.pending) { rec.pending = await sendRaw(who, "deploy", () => client[who].deployContract({ code, args: [], leaderOnly: false })); save(); }
      const r = await wait(rec.pending);
      rec.tries.push({ tx: r.tx, votes: r.votes, exec: r.exec, applied: r.applied, msg: r.msg.slice(0, 300), at: stamp() });
      rec.address = r.address; rec.pending = null; save();
      console.log(`      [${stamp()}] ${who.toUpperCase()} deploy ${path.split("/").pop()}  ${r.tx}  ${tally(r.votes)}  ${r.exec}  ${r.address}`);
      if (r.applied || r.msg === "TIMEOUT" || rec.tries.length >= 3) break;
    }
    rec.done = true; save();
  }
  return rec.address;
};

// ---------- reads: paced, and made again on a 429 or on "Contract not found" instead of failing ----------
let lastRead = 0;
const read = async (fn, args = []) => {
  for (let i = 0; i < 30; i++) {
    const gap = 3500 - (Date.now() - lastRead);
    if (gap > 0) await sleep(gap);
    lastRead = Date.now();
    try { return JSON.parse(String(await rd.readContract({ address: st.contract, functionName: fn, args }))); } catch (e) {
      if (i === 29) return { error: "VIEW ERROR " + fn + ": " + errText(e).slice(0, 100) };
      await sleep(/rate|429|limit/i.test(errText(e)) ? 25000 : 10000);
    }
  }
};
// a view read once for a check is kept with the run, so a continued run checks what was seen then
const seen = async (id, fn, args = []) => { if (!st.views[id]) { st.views[id] = { fn, args, at: stamp(), out: await read(fn, args) }; save(); } return st.views[id].out; };

// wait on the chain's own clock until a view's instant has passed: an order's window_end
const until = async (fn, id, field) => {
  for (;;) {
    const r = await read(fn, [id]);
    if (!(Number(r[field]) > 0)) { note(`${fn} ${id} could not be read (${r.error || "no " + field}); reading again`); await sleep(15000); continue; }
    const now = Number(r.now) > 0 ? Number(r.now) : Math.floor(Date.now() / 1000);
    const left = Number(r[field]) - now;
    if (left <= -10) return r;
    console.log(`      [${stamp()}] waiting ${left + 10}s for the ${field} of ${id}`);
    await sleep(Math.min(left + 10, 120) * 1000);
  }
};

// ---------- the demonstration: one shop, two products, one thing changed per step ----------
const WINDOW = Number(process.env.WINDOW_SECONDS || 1800);
const SHOP_NAME = "Harbour Lane Goods";
const PRODUCTS = [
  { key: "kettle", title: "Lumio K3 kettle, 1.7 L, brushed steel", price: 2n * GEN,
    spec: "Lumio K3 electric kettle. Brand: Lumio. Model: K3-170. Capacity: 1.7 litres. Finish: brushed stainless steel. Condition: new, sealed in the original box." },
  { key: "earbuds", title: "Arcwave X200 wireless earbuds, black", price: 35n * GEN / 10n,
    spec: "Arcwave X200 wireless earbuds. Brand: Arcwave. Model: X200-BK. Colour: black. Includes the charging case. Condition: new, sealed in the original box." },
];
const BOND = 7n * GEN, CREDIT = 5n * GEN / 100n, FEE = GEN / 100n, APPEAL_BOND = 5n * GEN / 100n;
const SALES = PRODUCTS.reduce((n, p) => n + p.price, 0n);           // 5.50 GEN
const REFUND = 2n * GEN - 18n * GEN / 10n;                           // 0.20 GEN
const NEW_PRICE = 3n * GEN, DROP = PRODUCTS[1].price - NEW_PRICE;    // 0.50 GEN
const LEFT = BOND - REFUND - DROP;                                   // 6.30 GEN
const REASON = "The page says the kettle is refurbished, so it is another product.";
const QUESTION_STOCK = "Does the page show the item available to buy now: in stock, and not a pre-order, not sold out and not out of stock? Ignore price, shop and every other detail.";
const QUESTION_PRICE = "What is the page's current price for that item, in GEN, as a plain decimal number? If the page shows more than one price or none, answer unclear.";

await fundOnce("shop", 20); await fundOnce("buyer", 20); await fundOnce("stranger", 5);
if (!st.start) { st.start = {}; for (const k of Object.keys(ROLES)) st.start[k] = String(await balance(acct[k].address)); st.started = new Date().toISOString(); save(); }
console.log(`[${stamp()}] ${Object.keys(ROLES).map((k) => k.toUpperCase().padEnd(8) + " " + st.accounts[k]).join("\n           ")}\n           pages ${RAW}\n           state ${STATE}`);

// ================================================================ phase A
console.log(`\n[${stamp()}] ---- phase A: deploy, the shop, its products, its bond, two purchases`);
st.contract = st.contract || await deploy("deploy", "shop", "../../contracts/price_match.py");
save();
console.log(`      Price Match at ${st.contract}`);
const open = await call("openShop", "shop", "open_shop", [SHOP_NAME, JSON.stringify(PREFIXES)]);
ok("SHOP opens S1, Harbour Lane Goods, accepting pages below three competitor prefixes", open.j?.ok === true && open.j?.shop === "S1" && JSON.stringify(open.j?.competitors) === JSON.stringify(PREFIXES), `${votes(open)}  ${open.msg.slice(0, 120)}`);
const shopId = open.j?.shop || "S1";
const pids = {};
for (const p of PRODUCTS) {
  const r = await call("list_" + p.key, "shop", "list_product", [shopId, p.title, p.spec, String(p.price), WINDOW]);
  ok(`SHOP lists ${p.title} at ${Number(p.price) / 1e18} GEN with a ${WINDOW / 60}-minute guarantee window`, r.j?.ok === true && r.j?.price === String(p.price) && r.j?.window === WINDOW, `${votes(r)}  ${r.j?.product}`);
  pids[p.key] = r.j?.product || "";
}
const sl = await call("listStranger", "stranger", "list_product", [shopId, PRODUCTS[0].title, PRODUCTS[0].spec, String(PRODUCTS[0].price), WINDOW]);
ok("STRANGER may not list a product in S1", refused(sl, "only the owner of " + shopId + " may list a product in it"), `${votes(sl)}  ${sl.msg.slice(0, 110)}`);
const early = await call("buyUncovered", "buyer", "buy", [pids.kettle], { value: PRODUCTS[0].price, watch: ["buyer", "shop"], expect: { buyer: 0n, shop: 0n } });
ok("a purchase before the shop has a bond is refused, and the 2.00 GEN comes back in the same transaction", early.exec !== "ERROR" && early.j?.ok === false && String(early.j?.reason).includes("does not cover the price") && early.j?.returned === String(PRODUCTS[0].price) && moved(early, "buyer", 0n) && moved(early, "shop", 0n), `${votes(early)}  ${early.j?.reason}`);
const fb = await call("fundBond", "shop", "fund", [shopId], { value: BOND, watch: ["shop"], expect: { shop: -BOND } });
ok("SHOP funds a 7 GEN guarantee bond", fb.j?.ok === true && fb.j?.bond === String(BOND) && moved(fb, "shop", -BOND), `${votes(fb)}  ${fb.msg.slice(0, 110)}`);
const sd = await call("depositShop", "shop", "deposit", [], { value: APPEAL_BOND, watch: ["shop"], expect: { shop: -APPEAL_BOND } });
ok("SHOP deposits 0.05 GEN of credit, enough for one appeal bond", sd.j?.ok === true && sd.j?.credit === String(APPEAL_BOND) && moved(sd, "shop", -APPEAL_BOND), `${votes(sd)}  ${sd.msg.slice(0, 100)}`);
const dp = await call("deposit", "buyer", "deposit", [], { value: CREDIT, watch: ["buyer"], expect: { buyer: -CREDIT } });
ok("BUYER deposits 0.05 GEN of claim-fee credit", dp.j?.ok === true && dp.j?.credit === String(CREDIT) && moved(dp, "buyer", -CREDIT), `${votes(dp)}  ${dp.msg.slice(0, 100)}`);
const oids = {};
for (const p of PRODUCTS) {
  const r = await call("buy_" + p.key, "buyer", "buy", [pids[p.key]], { value: p.price, watch: ["buyer", "shop"], expect: { buyer: -p.price, shop: p.price } });
  ok(`BUYER buys ${p.title}: the ${Number(p.price) / 1e18} GEN reaches SHOP in the same transaction, and the same amount of bond is reserved`, r.j?.ok === true && r.j?.forwarded === String(p.price) && r.j?.reserved === String(p.price) && moved(r, "buyer", -p.price) && moved(r, "shop", p.price), `${votes(r)}  ${r.j?.order}`);
  oids[p.key] = r.j?.order || "";
}
const wb = await call("withdrawReserved", "shop", "withdraw_bond", [shopId, String(BOND)], { watch: ["shop"], expect: { shop: 0n } });
ok("SHOP may not withdraw bond reserved for open orders: only 1.50 GEN of the 7 is free", refused(wb, "only " + String(BOND - SALES) + " atto of the bond of " + shopId + " is free") && moved(wb, "shop", 0n), `${votes(wb)}  ${wb.msg.slice(0, 120)}`);

// ================================================================ phase B
console.log(`\n[${stamp()}] ---- phase B: in stock, judged`);
let soldOutClaim = "";
{
  const sc = await call("claimStranger", "stranger", "claim", [oids.kettle, PAGE.kettleCheaper]);
  ok(`STRANGER may not claim on BUYER's order ${oids.kettle}`, refused(sc, "only the buyer of " + oids.kettle + " may claim on it"), `${votes(sc)}  ${sc.msg.slice(0, 110)}`);
  const out = await call("claimOutside", "buyer", "claim", [oids.kettle, PAGE.outside], { watch: ["buyer"], expect: { buyer: 0n } });
  ok("a page below no accepted prefix is refused before anything is fetched", refused(out, "the page is not below any competitor prefix " + shopId + " accepted") && moved(out, "buyer", 0n), `${votes(out)}  ${out.msg.slice(0, 120)}`);
  const n = await call("claimSoldOut", "buyer", "claim", [oids.kettle, PAGE.kettleSoldOut], { watch: ["buyer", "shop"], expect: { buyer: 0n, shop: 0n } });
  ok("the validators carry one value for the sold-out page in one consensus round", n.applied && ["same", "different", "unclear"].includes(String(n.j?.product)), `${votes(n)}  -> ${JSON.stringify({ product: n.j?.product, stock: n.j?.stock, price: n.j?.price })}`);
  ok("the same kettle for 1.80 GEN, but sold out: not_in_stock, pending, nothing moves", n.j?.product === "same" && n.j?.stock === "out_of_stock" && n.j?.price === "" && n.j?.outcome === "not_in_stock" && n.j?.state === "pending" && n.j?.may_appeal === "buyer" && /^[0-9a-f]{64}$/.test(String(n.j?.page)) && moved(n, "buyer", 0n) && moved(n, "shop", 0n), `${n.j?.outcome}  page ${n.j?.page}`);
  soldOutClaim = n.j?.claim || "C1";
  const sa = await call("appealWrongSide", "shop", "appeal", [soldOutClaim, REASON]);
  ok(`SHOP may not appeal ${soldOutClaim}: the finding went against the buyer`, refused(sa, "only the buyer of " + oids.kettle + " may appeal " + soldOutClaim), `${votes(sa)}  ${sa.msg.slice(0, 120)}`);
  const w = await call("waiveSoldOut", "buyer", "settle", [soldOutClaim]);
  ok(`BUYER waives its appeal: ${soldOutClaim} settles as not_in_stock and the 0.01 GEN fee goes back to its credit`, w.j?.ok === true && w.j?.final === "not_in_stock" && w.j?.settled_by === "waived" && w.j?.fee_to === "buyer" && w.j?.status === "open", `${votes(w)}  ${w.msg.slice(0, 120)}`);
}

// ================================================================ phase C
console.log(`\n[${stamp()}] ---- phase C: a match held for its appeal window, the shop's bonded appeal`);
let matchClaim = "";
{
  const m = await call("claimKettle", "buyer", "claim", [oids.kettle, PAGE.kettleCheaper], { watch: ["buyer", "shop"], expect: { buyer: 0n, shop: 0n } });
  ok("the validators carry one value for the kettle page in one consensus round", m.applied && ["same", "different", "unclear"].includes(String(m.j?.product)), `${votes(m)}  -> ${JSON.stringify({ product: m.j?.product, stock: m.j?.stock, price: m.j?.price })}`);
  ok("Northgate's page offers the same kettle in stock at 1.80 GEN: matched, the 0.20 GEN refund held pending, nothing reaches BUYER yet", m.j?.product === "same" && m.j?.stock === "in_stock" && m.j?.price === String(18n * GEN / 10n) && m.j?.outcome === "matched" && m.j?.refund === String(REFUND) && m.j?.state === "pending" && m.j?.may_appeal === "shop" && moved(m, "buyer", 0n), `${m.j?.outcome}  ${JSON.stringify(m.delta)}`);
  matchClaim = m.j?.claim || "C2";
  const ba = await call("appealBuyer", "buyer", "appeal", [matchClaim, REASON]);
  ok(`BUYER may not appeal ${matchClaim}: the finding went against the shop`, refused(ba, "only the shop of " + oids.kettle + " may appeal " + matchClaim), `${votes(ba)}  ${ba.msg.slice(0, 120)}`);
  const ss = await call("settleEarly", "stranger", "settle", [matchClaim]);
  ok(`STRANGER may not settle ${matchClaim} while the shop may still appeal`, refused(ss, matchClaim + " may be appealed by the shop for another"), `${votes(ss)}  ${ss.msg.slice(0, 120)}`);
  const ap = await call("appealShop", "shop", "appeal", [matchClaim, REASON], { watch: ["buyer", "shop"], expect: (j) => ({ buyer: j?.result === "upheld" ? REFUND : 0n, shop: 0n }) });
  ok("the validators carry one second reading of the same page, with the shop's reason fenced as its argument", ap.applied && ["same", "different", "unclear"].includes(String(ap.j?.product)), `${votes(ap)}  -> ${JSON.stringify({ product: ap.j?.product, stock: ap.j?.stock, price: ap.j?.price })}`);
  ok("upheld: the 0.20 GEN refund reaches BUYER in the same transaction, and the shop's 0.05 GEN bond goes to BUYER's credit", ap.j?.result === "upheld" && ap.j?.outcome === "matched" && ap.j?.final === "matched" && ap.j?.paid === String(REFUND) && ap.j?.bond_to === "buyer" && ap.j?.status === "matched" && ap.j?.credit === "0" && moved(ap, "buyer", REFUND) && moved(ap, "shop", 0n), `${JSON.stringify({ result: ap.j?.result, final: ap.j?.final, delta: ap.delta })}`);
  const again = await call("appealAgain", "shop", "appeal", [matchClaim, REASON]);
  ok(`SHOP may not appeal ${matchClaim} again: an appeal is never appealed`, refused(again, matchClaim + " is settled (appeal)"), `${votes(again)}  ${again.msg.slice(0, 120)}`);
  const v = await seen("claimsKettle", "claims_of", [oids.kettle]);
  const row = v.rows?.[1] || {};
  ok(`claims_of(${oids.kettle}) keeps both claims, each with the hash of the text it judged, and both readings of ${matchClaim} with the reason`, v.rows?.length === 2 && v.rows[0].final === "not_in_stock" && row.outcome === "matched" && row.appeal?.outcome === "matched" && row.appeal?.result === "upheld" && row.appeal?.reason === REASON && row.paid === String(REFUND) && /^[0-9a-f]{64}$/.test(String(row.page)) && row.page !== v.rows[0].page, JSON.stringify(row).slice(0, 200));
}

// ================================================================ phase D
console.log(`\n[${stamp()}] ---- phase D: price protection, in code`);
{
  const sr = await call("repriceStranger", "stranger", "reprice", [pids.earbuds, String(NEW_PRICE)]);
  ok(`STRANGER may not reprice ${pids.earbuds}`, refused(sr, "only the owner of " + shopId + " may reprice " + pids.earbuds), `${votes(sr)}  ${sr.msg.slice(0, 110)}`);
  const rp = await call("reprice", "shop", "reprice", [pids.earbuds, String(NEW_PRICE)]);
  ok(`SHOP reprices ${pids.earbuds} from 3.50 to 3.00 GEN`, rp.j?.ok === true && rp.j?.was === String(PRODUCTS[1].price) && rp.j?.price === String(NEW_PRICE), `${votes(rp)}  ${rp.msg.slice(0, 110)}`);
  const sd2 = await call("dropStranger", "stranger", "claim_drop", [oids.earbuds]);
  ok(`STRANGER may not claim the drop on BUYER's order ${oids.earbuds}`, refused(sd2, "only the buyer of " + oids.earbuds + " may claim a price drop on it"), `${votes(sd2)}  ${sd2.msg.slice(0, 110)}`);
  const d = await call("claimDrop", "buyer", "claim_drop", [oids.earbuds], { watch: ["buyer", "shop"], expect: { buyer: DROP, shop: 0n } });
  ok(`BUYER claims the drop: 0.50 GEN from ${oids.earbuds}'s own reservation in the same transaction, no model asked`, d.j?.ok === true && d.j?.paid === String(DROP) && d.j?.stands_at === String(NEW_PRICE) && d.j?.reserved === String(NEW_PRICE) && moved(d, "buyer", DROP) && moved(d, "shop", 0n), `${votes(d)}  ${JSON.stringify(d.delta)}`);
  const d2 = await call("claimDropAgain", "buyer", "claim_drop", [oids.earbuds]);
  ok("a second drop claim at the same price is refused: nothing left to claim", refused(d2, "there is no drop to claim"), `${votes(d2)}  ${d2.msg.slice(0, 110)}`);
}

// ================================================================ phase E
console.log(`\n[${stamp()}] ---- phase E: the window closes`);
{
  await until("order", oids.earbuds, "window_end");
  const r2 = await call("releaseEarbuds", "stranger", "release", [oids.earbuds], { watch: ["stranger", "shop"], expect: { stranger: 0n, shop: 0n } });
  ok(`STRANGER releases ${oids.earbuds} after its window: its 3.00 GEN reservation goes back to the free bond, nothing leaves the contract`, r2.j?.status === "released" && r2.j?.freed === String(NEW_PRICE) && r2.j?.free === String(LEFT) && moved(r2, "stranger", 0n), `${votes(r2)}  ${r2.msg.slice(0, 110)}`);
  const wr = await call("withdrawBond", "shop", "withdraw_bond", [shopId, String(LEFT)], { watch: ["shop"], expect: { shop: LEFT } });
  ok("SHOP withdraws the whole remaining bond, 6.30 GEN", wr.j?.ok === true && wr.j?.withdrawn === String(LEFT) && wr.j?.bond === "0" && moved(wr, "shop", LEFT), `${votes(wr)}  ${JSON.stringify(wr.delta)}`);
  const wc = await call("withdrawCredit", "buyer", "withdraw", [], { watch: ["buyer"], expect: { buyer: CREDIT + APPEAL_BOND } });
  ok("BUYER withdraws its 0.10 GEN of credit: its own 0.05 GEN and the shop's forfeited bond", wc.j?.withdrawn === String(CREDIT + APPEAL_BOND) && moved(wc, "buyer", CREDIT + APPEAL_BOND), `${votes(wc)}  ${JSON.stringify(wc.delta)}`);
  const ws = await call("withdrawShopCredit", "shop", "withdraw", []);
  ok("SHOP holds no credit any more: its appeal bond went to the buyer", refused(ws, "this address holds no claim-fee credit"), `${votes(ws)}  ${ws.msg.slice(0, 110)}`);
}

// ================================================================ phase F
console.log(`\n[${stamp()}] ---- phase F: the code read back, the views, the balances`);
{
  const file = readFileSync(new URL("../../contracts/price_match.py", import.meta.url));
  const chain = Buffer.from(String(await rpc("gen_getContractCode", [st.contract])), "base64");
  st.code = { address: st.contract, bytes: chain.length, sha256: sha(chain), file_bytes: file.length, file_sha256: sha(file), identical: Buffer.compare(chain, file) === 0 };
  save();
  ok(`the code deployed at ${st.contract} is byte for byte contracts/price_match.py`, st.code.identical, `${chain.length} bytes, sha256 ${st.code.sha256}`);
  const o1 = await seen("orderKettle", "order", [oids.kettle]);
  ok(`order(${oids.kettle}) reads matched: 0.20 GEN refunded, nothing reserved, nothing pending`, o1.status === "matched" && o1.ended_by === "match" && o1.refunded === String(REFUND) && o1.reserved === "0" && o1.pending === "", JSON.stringify({ status: o1.status, refunded: o1.refunded }));
  const o2 = await seen("orderEarbuds", "order", [oids.earbuds]);
  ok(`order(${oids.earbuds}) reads released, standing at 3.00 GEN after a 0.50 GEN drop`, o2.status === "released" && o2.dropped === String(DROP) && o2.stands_at === String(NEW_PRICE), JSON.stringify({ status: o2.status, dropped: o2.dropped }));
  const s1 = await seen("shop", "shop", [shopId]);
  ok(`shop(${shopId}) reads an empty bond, nothing reserved, 5.50 GEN of sales, 0.20 GEN refunded and 0.50 GEN dropped`, s1.bond === "0" && s1.reserved === "0" && s1.sales === String(SALES) && s1.refunded === String(REFUND) && s1.dropped === String(DROP) && s1.fees_won === "0" && s1.withdrawn === String(LEFT) && s1.open_orders === 0, JSON.stringify({ bond: s1.bond, sales: s1.sales, refunded: s1.refunded, dropped: s1.dropped }));
  const stats = await seen("stats", "stats", []);
  ok("stats(): two orders, two settled claims (one matched, one not in stock), one appeal upheld, one drop, one release, nothing held", stats.shops === 1 && stats.products === 2 && stats.orders === 2 && stats.claims === 2 && stats.settled === 2 && stats.pending === 0 && stats.matched === 1 && stats.not_in_stock === 1 && stats.appeals === 1 && stats.upheld === 1 && stats.overturned === 0 && stats.reprices === 1 && stats.drops === 1 && stats.released === 1 && stats.open_orders === 0 && stats.held === "0" && stats.stakes === "0" && stats.bonds_forfeited === String(APPEAL_BOND) && stats.refused_payments === 1 && stats.returned === String(PRODUCTS[0].price), JSON.stringify(stats));
  const rules = await seen("rules", "rules", []);
  ok("rules() publishes version 2, the stock question and the price question word for word, and the appeal", rules.version === 2 && rules.askings?.[2] === "3, blocks SPEC then PAGE: " + QUESTION_STOCK && rules.askings?.[4] === "5, blocks SPEC then PAGE: " + QUESTION_PRICE && String(rules.compared).includes("exact equality") && rules.appeal?.bond === String(APPEAL_BOND) + " atto of credit", String(rules.value));
  ok("the contract's own balance is zero", (await balance(st.contract)) === 0n, String(await balance(st.contract)));
  st.end = {}; for (const k of Object.keys(ROLES)) st.end[k] = String(await balance(acct[k].address));
  st.ended = new Date().toISOString(); save();
  const net = (k) => BigInt(st.end[k]) - BigInt(st.start[k]);
  const delta = SALES - REFUND - DROP - APPEAL_BOND;                 // 4.75 GEN
  const want = { shop: delta, buyer: -delta, stranger: 0n };
  ok("every account ends where the money table says: SHOP up 4.75 GEN, BUYER down 4.75 GEN, STRANGER whole", Object.keys(want).every((k) => net(k) === want[k]), Object.keys(want).map((k) => k.toUpperCase() + " " + Number(net(k)) / 1e18).join("  "));
}

st.checks = { pass, fail }; save();
console.log(`\n${pass} passed, ${fail} failed`);
console.log(`Price Match: ${st.contract}  ${EXPLORER}/address/${st.contract}`);
console.log("transactions:", st.order.reduce((n, id) => n + st.steps[id].tries.length, 0), "in", st.order.length, "steps; sent a second time:", st.order.filter((id) => st.steps[id].tries.length > 1).join(", ") || "none");
for (const id of st.order) { const s = st.steps[id]; console.log(`${id.padEnd(19)} ${s.tries.map((t) => t.tx + " " + tally(t.votes) + " " + t.exec).join(" | ")}`); }
console.log("record:", RECORD);
process.exit(fail ? 1 : 0);
