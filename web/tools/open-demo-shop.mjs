// Opens the demo shop (lib/demo-shop.ts) from its key, once: Harbour Lane Goods, matching the three
// demo competitors' pages on raw.githubusercontent.com pinned to COMMIT, with a bond and its three
// products. Run it by hand after the contract is deployed and the repository is pushed; nothing in the
// build runs it.
//
//   REGISTER=0x... DEMO_SHOP_KEY=0x... COMMIT=<40 hex> node tools/open-demo-shop.mjs
//   DRY=1 REGISTER=0x... COMMIT=<40 hex> node tools/open-demo-shop.mjs     # print the calls, send nothing
//   REPO=<owner>/<name> ...                                                # when the git remote does not name it
//
// The key is a throwaway Studio test key, the same one the site's server holds in DEMO_SHOP_KEY; it is
// read from the environment only and never printed. The bond is the key's own GEN, so the key is
// funded from Studio's faucet first when it holds too little. If this key already opened a shop under
// the demo name, that shop is kept and only the products it lacks are listed. Every page the shop will
// accept is fetched first and compared with competitors/ in this checkout, so a wrong COMMIT stops the
// script before anything is sent. Each transaction is followed to FINALIZED before the next one goes
// out. Needs Node 22.18 or later (it reads lib/*.ts directly).

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { getAddress } from "viem";

import { REPO_URL } from "../lib/config.ts";
import { cleanKey, keyProblem } from "../lib/demo-key.ts";
import { DEMO_BOND, DEMO_PAGES, DEMO_PRODUCTS, DEMO_SHOP_NAME, demoPrefixes, rawBase, repoOf } from "../lib/demo-shop.ts";
import { prefixesProblem, priceProblem, specProblem, titleProblem, windowProblem } from "../lib/rules.ts";

const RPC = "https://studio.genlayer.com/api";
const EXPLORER = "https://explorer-studio.genlayer.com";
const studio = { ...studionet, rpcUrls: { ...studionet.rpcUrls, default: { http: [RPC] } } };

const REGISTER = (process.env.REGISTER || "").trim();
const COMMIT = (process.env.COMMIT || "").trim();
// The repository the pages were pushed to: REPO, else the site's NEXT_PUBLIC_REPO_URL, else the git remote.
function remoteRepo() {
  try {
    const origin = execSync("git remote get-url origin", { cwd: new URL("..", import.meta.url), encoding: "utf8" }).trim();
    return (origin.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/) || [])[1] || "";
  } catch {
    return "";
  }
}
const REPO = (process.env.REPO || repoOf(REPO_URL) || remoteRepo()).trim();
const DRY = process.env.DRY === "1";

const fail = (message) => {
  console.error(message);
  process.exit(2);
};
if (!/^0x[0-9a-fA-F]{40}$/.test(REGISTER)) fail("REGISTER must be the deployed contract's 0x address.");
if (!/^[0-9a-f]{40}$/.test(COMMIT)) fail("COMMIT must be the 40-character commit the competitor pages were pushed in.");
if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(REPO)) fail("REPO must be <owner>/<name> on GitHub (or set the git remote origin).");
const problem = keyProblem(process.env.DEMO_SHOP_KEY);
if (!DRY && problem) fail(`DEMO_SHOP_KEY: ${problem}.`);

const PREFIXES = demoPrefixes(REPO, COMMIT);
const listCheck = prefixesProblem(JSON.stringify(PREFIXES));
if (listCheck.problem) fail(`The prefixes would be refused: ${listCheck.problem}.`);
for (const p of DEMO_PRODUCTS) {
  const why = titleProblem(p.title) || specProblem(p.spec) || priceProblem(BigInt(p.priceAtto)) || windowProblem(p.window);
  if (why) fail(`${p.key} would be refused: ${why}.`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gen = (atto) => (Number(BigInt(atto) / 10n ** 14n) / 10_000).toFixed(2) + " GEN";

async function rpc(method, params) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const body = await res.json();
      if (body.error) {
        await sleep(res.status === 429 || body.error.code === -32029 ? 20_000 : 5000);
        continue;
      }
      return body.result;
    } catch {
      await sleep(4000);
    }
  }
  throw new Error(`${method} did not answer`);
}

/** Follows a transaction to a final status; returns the contract's JSON return and the vote tally. */
async function follow(hash) {
  for (let i = 0; i < 300; i++) {
    await sleep(4000);
    const tx = await rpc("eth_getTransactionByHash", [hash]);
    const status = String(tx?.status ?? "");
    if (status === "FINALIZED" || status === "CANCELED" || status === "UNDETERMINED") {
      const lr = tx.consensus_data?.leader_receipt;
      const one = Array.isArray(lr) ? lr[0] : lr;
      let text = "";
      try {
        text = Buffer.from(one?.result ?? "", "base64").toString("utf8");
      } catch {
        text = "";
      }
      const start = text.indexOf("{");
      let json = null;
      try {
        json = start >= 0 ? JSON.parse(text.slice(start, text.lastIndexOf("}") + 1)) : null;
      } catch {
        json = null;
      }
      const votes = Object.values(tx.consensus_data?.votes ?? {});
      return { status, json, agree: votes.filter((v) => v === "agree").length, of: votes.length, exec: one?.execution_result ?? "", text };
    }
  }
  return { status: "TIMEOUT", json: null, agree: 0, of: 0, exec: "", text: "" };
}

async function read(client, functionName, args) {
  for (let i = 0; i < 8; i++) {
    try {
      const raw = await client.readContract({ address: REGISTER, functionName, args });
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      await sleep(5000);
    }
  }
  throw new Error(`could not read ${functionName}() from Studio`);
}

// ---- the pages the shop will accept must be at that commit --------------------------------------------
const base = rawBase(REPO, COMMIT);
for (const page of DEMO_PAGES) {
  const here = readFileSync(new URL(`../../competitors/${page.competitor}/${page.file}`, import.meta.url), "utf8");
  let there = "";
  try {
    const r = await fetch(base + page.competitor + "/" + page.file);
    there = r.ok ? await r.text() : "";
  } catch {
    there = "";
  }
  if (there !== here) fail(`${base}${page.competitor}/${page.file}\ndoes not serve competitors/${page.competitor}/${page.file} as it is in this checkout. Push the repository and pass that commit as COMMIT.`);
}
console.log(`the ${DEMO_PAGES.length} demo pages are at ${base}`);

console.log(`${DRY ? "DRY RUN: " : ""}${DEMO_SHOP_NAME} to ${REGISTER}`);
if (DRY) {
  console.log(`open_shop(${JSON.stringify(DEMO_SHOP_NAME)}, ${JSON.stringify(JSON.stringify(PREFIXES))})`);
  console.log(`fund(<the new shop>) with ${gen(DEMO_BOND)}`);
  for (const p of DEMO_PRODUCTS) console.log(`list_product(<the new shop>, ${JSON.stringify(p.title)}, <spec, ${p.spec.length} chars>, "${p.priceAtto}", ${p.window})`);
  process.exit(0);
}

const account = createAccount(cleanKey(process.env.DEMO_SHOP_KEY));
const owner = account.address.toLowerCase();
console.log(`demo shop owner ${account.address}`);
const client = createClient({ chain: studio, account });

async function send(functionName, args, value = 0n) {
  for (let tries = 1; ; tries++) {
    try {
      const hash = await client.writeContract({ address: REGISTER, functionName, args, value });
      const r = await follow(hash);
      return { ...r, hash };
    } catch (e) {
      if (tries >= 3) throw new Error(`${functionName} not sent (${String(e?.shortMessage || e?.message || e).slice(0, 80)})`);
      await sleep(15_000);
    }
  }
}

// ---- the shop: kept when this key already opened it -----------------------------------------------------
const mine = await read(client, "shops_of", [owner, 0, 20]);
let shop = (mine.rows ?? []).filter((r) => r.name === DEMO_SHOP_NAME).map((r) => r.shop).sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)))[0] ?? "";
if (shop) console.log(`SKIP  open_shop: this key already runs ${shop}`);
else {
  const r = await send("open_shop", [DEMO_SHOP_NAME, JSON.stringify(PREFIXES)]);
  shop = r.json?.ok === true ? r.json.shop : "";
  console.log(`${shop ? "OK  " : "FAIL"}  open_shop: ${shop || r.status + " " + r.exec + " " + r.text.slice(0, 120)}  ${r.agree}/${r.of} agree  ${EXPLORER}/tx/${r.hash}`);
  if (!shop) process.exit(1);
}

// ---- the bond --------------------------------------------------------------------------------------------
const row = await read(client, "shop", [shop]);
const short = DEMO_BOND - BigInt(row.bond ?? "0");
if (short > 0n) {
  const have = BigInt((await rpc("eth_getBalance", [account.address, "latest"])) || "0x0");
  if (have < short + 10n ** 18n) {
    await rpc("sim_fundAccount", { account_address: getAddress(account.address), amount: Number(short / 10n ** 18n + 5n) * 1e18 });
    for (let i = 0; i < 20 && BigInt((await rpc("eth_getBalance", [account.address, "latest"])) || "0x0") <= have; i++) await sleep(3000);
  }
  const r = await send("fund", [shop], short);
  console.log(`${r.json?.ok === true ? "OK  " : "FAIL"}  fund: ${r.json?.ok === true ? "bond " + gen(r.json.bond) : r.json?.reason || r.status}  ${EXPLORER}/tx/${r.hash}`);
} else console.log(`SKIP  fund: the bond is already ${gen(row.bond)}`);

// ---- the three products: only those not listed yet --------------------------------------------------------
const listed = new Set(((await read(client, "products_of", [shop, 0, 20])).rows ?? []).map((p) => p.spec));
const made = [];
for (const p of DEMO_PRODUCTS) {
  if (listed.has(p.spec)) {
    console.log(`SKIP  ${p.title}: already listed`);
    continue;
  }
  const r = await send("list_product", [shop, p.title, p.spec, p.priceAtto, p.window]);
  const id = r.json?.ok === true ? r.json.product : "";
  console.log(`${id ? "OK  " : "FAIL"}  ${p.title}: ${id || r.status + " " + r.exec + " " + r.text.slice(0, 120)}  ${EXPLORER}/tx/${r.hash}`);
  if (id) made.push(id);
}
console.log(`\nThe demo shop is ${shop}${made.length ? ", with " + made.join(", ") + " listed now" : ""}. The site's server finds it by the key's address.`);
