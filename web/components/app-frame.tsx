"use client";

// The store around every page: the header with the mark, the aisle signs and the wallet; the shelf
// edge under it; the demo bar in mock mode; the wrong-chain banner; and the footer. Under 900 px the
// aisle signs fold into a menu, so the header fits a 375 px phone with no sideways scroll.

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Wordmark } from "@/components/logo";
import { MockBar } from "@/components/mock-bar";
import { WalletButton, WrongChainBanner } from "@/components/wallet";
import { EXPLORER_URL, contractInUse, isMock } from "@/lib/chain";
import { REPO_URL } from "@/lib/config";
import { cx } from "@/lib/cx";

const AISLES = [
  { href: "/shop", n: "01", label: "Demo shop" },
  { href: "/mine", n: "02", label: "My orders" },
  { href: "/shops", n: "03", label: "All shops" },
  { href: "/merchant", n: "04", label: "Merchant" },
  { href: "/ledger", n: "05", label: "Ledger" },
  { href: "/how", n: "06", label: "How it works" },
];

const isHere = (path: string, href: string) => path === href || (href !== "/shop" && path.startsWith(href + "/")) || (href === "/mine" && path.startsWith("/order/"));

export function AppFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "/";
  const [open, setOpen] = React.useState(false);
  const [lastPath, setLastPath] = React.useState(path);
  if (lastPath !== path) {
    setLastPath(path);
    setOpen(false);
  }
  const contract = contractInUse();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-paper">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="min-w-0 shrink-0" aria-label="Price Match, home">
            <Wordmark />
          </Link>
          <nav aria-label="Aisles" className="hidden min-w-0 items-center gap-1 min-[900px]:flex">
            {AISLES.map((a) => {
              const here = isHere(path, a.href);
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  aria-current={here ? "page" : undefined}
                  className={cx("flex items-center gap-1.5 border-2 px-2 py-1 whitespace-nowrap", here ? "border-ink bg-ink text-white" : "border-transparent hover:border-ink")}
                >
                  <span className={cx("display text-[12px] font-bold", here ? "text-tag" : "text-ink-3")}>{a.n}</span>
                  <span className="display text-[16px] font-bold tracking-[0.03em] uppercase">{a.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex min-w-0 items-center gap-2">
            {!isMock && <WalletButton />}
            <button
              type="button"
              className="btn btn-sm min-[900px]:hidden"
              aria-expanded={open}
              aria-controls="aisle-menu"
              onClick={() => setOpen((o) => !o)}
            >
              <span>{open ? "Close" : "Aisles"}</span>
            </button>
          </div>
        </div>
        {open && (
          <nav id="aisle-menu" aria-label="Aisles" className="border-t-2 border-ink bg-paper min-[900px]:hidden">
            <ul className="mx-auto grid max-w-[1180px] grid-cols-2 gap-1.5 px-4 py-3">
              {AISLES.map((a) => {
                const here = isHere(path, a.href);
                return (
                  <li key={a.href}>
                    <Link
                      href={a.href}
                      aria-current={here ? "page" : undefined}
                      className={cx("flex items-center gap-2 border-2 px-2.5 py-2", here ? "border-ink bg-ink text-white" : "border-ink bg-paper")}
                    >
                      <span className={cx("display text-[12px] font-bold", here ? "text-tag" : "text-ink-3")}>{a.n}</span>
                      <span className="display text-[17px] font-bold uppercase">{a.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
        <div className="shelf-edge" aria-hidden="true" />
      </header>
      {isMock && <MockBar />}
      <WrongChainBanner />
      <main id="main" className="mx-auto w-full max-w-[1180px] flex-1 px-4 pt-7 pb-16">
        {children}
      </main>
      <footer className="bg-shelf">
        <div className="shelf-edge-thin" aria-hidden="true" />
        <div className="mx-auto flex max-w-[1180px] flex-col gap-2 px-4 py-6 text-[13px] text-ink-2 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="display text-[15px] font-bold uppercase">Price Match</span> · an Intelligent Contract on GenLayer Studio. Every shop and brand on this site is fictional.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            {contract && (
              <a className="link" href={`${EXPLORER_URL}/address/${contract}`} target="_blank" rel="noreferrer">
                {isMock ? "Demo contract" : "The contract"}
              </a>
            )}
            <a className="link" href="/competitors/index.html">
              Competitor pages
            </a>
            {REPO_URL && (
              <a className="link" href={REPO_URL} target="_blank" rel="noreferrer">
                Source
              </a>
            )}
          </p>
        </div>
      </footer>
    </div>
  );
}
