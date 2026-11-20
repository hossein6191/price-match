// Site settings. One place for the contract address, the demo pages' pinned commit, the name and the
// tagline.
//
// DEMO_CONTRACT is the deployed copy the site reads when NEXT_PUBLIC_CONTRACT is unset: the register of
// contract version 2 (stock, appeal, price protection). It is filled in once that register is
// deployed; while both are empty every page says the contract is not deployed yet, and the whole site
// still works with NEXT_PUBLIC_MOCK=1. The version 1 register is not read any more: its claims settle
// at once and it has no appeal, so the version 2 pages would misdescribe it.
export const DEMO_CONTRACT: string = "0xf8f4117b92899233597AB299ad8079bfe8E098c0";

/**
 * The commit of the public repository the demo competitor pages are pinned to: the demo shop's three
 * prefixes are raw.githubusercontent.com/<repo>/<DEMO_COMMIT>/competitors/<competitor>/. Fixed when
 * the demo shop opens (tools/open-demo-v2.mjs uses it unless given another); a shop's prefixes never change.
 */
export const DEMO_COMMIT: string = "f587a00d35e46c5e3cb6da283d831bafff3f1b2b";

export const SITE_NAME = "Price Match";
export const SITE_TAGLINE = "Found it cheaper? The network checks.";
export const SITE_LINE =
  "A lowest-price guarantee that enforces itself: validators open the competitor's page on the live web, agree it is the same product, in stock, and read its price, and the difference comes back from the shop's bond once the appeal window closes.";

/**
 * The public source repository; the footer link is hidden while this is empty. No account name is
 * written into the repository: NEXT_PUBLIC_REPO_URL names it, and on Vercel the repository the site
 * was built from names it by itself (its system variables NEXT_PUBLIC_VERCEL_GIT_REPO_OWNER and _SLUG).
 */
const builtFrom =
  process.env.NEXT_PUBLIC_VERCEL_GIT_PROVIDER === "github" && process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_OWNER && process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_SLUG
    ? `https://github.com/${process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_OWNER}/${process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_SLUG}`
    : "";
export const REPO_URL: string = process.env.NEXT_PUBLIC_REPO_URL || builtFrom || "";

/**
 * The demo shop's id on the contract in use. The site's server finds the demo shop by its key's
 * address (GET /api/demo/status), so this is only the fallback for a deploy without the key;
 * NEXT_PUBLIC_DEMO_SHOP overrides it.
 */
export const DEMO_SHOP_ID: string = "";

/** The contract in use: the deploy's environment first, then the committed address. */
export const contractAddress = (): string => process.env.NEXT_PUBLIC_CONTRACT || DEMO_CONTRACT || "";

/** The demo shop's id when the site's server cannot name it. */
export const demoShopFallback = (): string => process.env.NEXT_PUBLIC_DEMO_SHOP || DEMO_SHOP_ID || "";
