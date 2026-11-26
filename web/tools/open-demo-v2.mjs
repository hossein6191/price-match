// Opens the demo shop on a contract version 2 register: Harbour Lane Goods with its bond and its nine
// products, pinned to the demo pages' commit, and then 0.20 GEN of the shop's own credit so it can stake
// an appeal bond when a visitor asks it to appeal a match. It runs tools/open-demo-shop.mjs for the shop,
// the bond and the products (so a rerun only adds what is missing) and adds the credit itself.
//
//   node tools/open-demo-v2.mjs <register 0x...> <key.json> [commit]
//   DRY=1 node tools/open-demo-v2.mjs <register 0x...> <key.json> [commit]     # print the calls, send nothing
//
// <key.json> is a JSON file holding the demo shop's throwaway Studio key, as {"privateKey": "0x..."}
// (also read: "private_key", "key", "DEMO_SHOP_KEY"), or a JSON string of the key. The key is read from
// that file only, never printed and never written anywhere; the same key goes into the site host's
// DEMO_SHOP_KEY. [commit] defaults to DEMO_COMMIT in lib/config.ts. Studio v0.123 charges fees: every
// write carries the fees quoted by estimateTransactionFees() (lib/fees.ts). Needs Node 22.18 or later.

import { readFileSync } from "node:fs";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

import { DEMO_COMMIT } from "../lib/config.ts";
import { cleanKey, keyProblem } from "../lib/demo-key.ts";
import { quoteFees } from "../lib/fees.ts";
import { APPEAL_BOND } from "../lib/rules.ts";

const fail = (message) => {
  console.error(message);
  process.exit(2);
};

const [register = "", keyPath = "", commitArg = ""] = process.argv.slice(2);
if (!/^0x[0-9a-fA-F]{40}$/.test(register.trim())) fail("usage: node tools/open-demo-v2.mjs <register 0x...> <key.json> [commit]");
if (!keyPath) fail("usage: node tools/open-demo-v2.mjs <register 0x...> <key.json> [commit]: the key file is missing");
const commit = (commitArg || DEMO_COMMIT).trim();
if (!/^[0-9a-f]{40}$/.test(commit)) fail("the commit is the 40-character commit the competitor pages were pushed in; set DEMO_COMMIT in lib/config.ts or pass it");

/** The key from the file, whatever its common shape; "" when there is none. Never printed. */
function keyFrom(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    fail(`could not read the key file ${path}`);
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    fail("the key file is not JSON");
  }
  if (typeof value === "string") return value;
  if (value && typeof value === "object") for (const k of ["privateKey", "private_key", "key", "DEMO_SHOP_KEY"]) if (typeof value[k] === "string") return value[k];
  return "";
}

const raw = keyFrom(keyPath);
const problem = keyProblem(raw);
if (problem) fail(`the key file: ${problem}.`);

process.env.REGISTER = register.trim();
process.env.COMMIT = commit;
process.env.DEMO_SHOP_KEY = cleanKey(raw);

// The shop, its bond and its nine products. It exits by itself on a dry run or a failure.
await import("./open-demo-shop.mjs");

// ---- credit for appeal bonds ------------------------------------------------------------------------------
const RPC = "https://studio.genlayer.com/api";
const studio = { ...studionet, rpcUrls: { ...studionet.rpcUrls, default: { http: [RPC] } } };
const account = createAccount(process.env.DEMO_SHOP_KEY);
const client = createClient({ chain: studio, account });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WANT = APPEAL_BOND * 4n;

let credit = -1n;
for (let i = 0; i < 8 && credit < 0n; i++) {
  try {
    const rawRow = await client.readContract({ address: register.trim(), functionName: "account", args: [account.address.toLowerCase()] });
    const row = typeof rawRow === "string" ? JSON.parse(rawRow) : rawRow;
    credit = BigInt(row.credit ?? "0");
  } catch {
    await sleep(5000);
  }
}
if (credit < 0n) fail("could not read the demo shop's credit from Studio; run this again to add it");
if (credit >= APPEAL_BOND) {
  console.log(`SKIP  deposit: the demo shop already holds ${credit} atto of credit, enough for an appeal bond`);
} else {
  const hash = await client.writeContract({ address: register.trim(), functionName: "deposit", args: [], value: WANT - credit, fees: await quoteFees(client) });
  console.log(`SENT  deposit of ${WANT - credit} atto for appeal bonds  https://explorer-studio.genlayer.com/tx/${hash}`);
}
console.log(`\nSet DEMO_CONTRACT in lib/config.ts to ${register.trim()} and DEMO_SHOP_KEY on the site's host to the same key.`);
