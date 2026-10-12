// What this browser remembers about each order and each shop: the transactions it sent for them, with
// what each one did. A contract does not know the hashes of the transactions that ran it, so an order
// on chain cannot list them; the browser that sent them can, and the pages link each one to the
// explorer. Claims whose round stored nothing are remembered too, so the receipt can say a page was
// tried and could not be read.

import { readItem, writeItem } from "./browser-store.ts";
import { contractAddress } from "./config.ts";

export type Remembered = { hash: string; label: string; at: number };

const HASH = /^0x[0-9a-fA-F]{64}$/;
// The in-memory contract of mock mode starts again on every load and hands out O1, O2... again, so
// what this browser remembers about it is kept per load: a new O7 never inherits an old O7's list.
const MOCK = process.env.NEXT_PUBLIC_MOCK === "1";
const MOCK_LOAD = typeof window === "undefined" ? "" : Math.random().toString(36).slice(2, 10);
const scope = () => (MOCK ? `mock-${MOCK_LOAD}` : contractAddress() || "no-contract").toLowerCase();
const keyOf = (thing: string) => `price-match:tx:${scope()}:${thing}`;

/** The raw stored list for an order or a shop id (a string, so it can be a stable store snapshot). */
export const rememberedRaw = (thing: string): string => readItem(keyOf(thing));

export function parseRemembered(raw: string): Remembered[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as Remembered[];
    return Array.isArray(list) ? list.filter((r) => r && HASH.test(String(r.hash)) && typeof r.label === "string") : [];
  } catch {
    return [];
  }
}

export function rememberTx(thing: string, hash: string, label: string): void {
  if (!thing || !HASH.test(hash)) return;
  const list = parseRemembered(rememberedRaw(thing)).filter((r) => r.hash !== hash);
  list.unshift({ hash, label, at: Math.floor(Date.now() / 1000) });
  writeItem(keyOf(thing), JSON.stringify(list.slice(0, 12)));
}

/** The label a claim is remembered under, so a reload can follow it again and the receipt can name the page. */
export const claimLabel = (page: string) => `Claim with ${page}`;
export const isClaimLabel = (label: string) => label.startsWith("Claim with ");
export const pageOfClaimLabel = (label: string) => (isClaimLabel(label) ? label.slice("Claim with ".length) : "");
