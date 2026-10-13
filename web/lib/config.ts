// Site settings. One place for the contract address, the name and the tagline.
//
// DEMO_CONTRACT is the deployed copy the site reads when NEXT_PUBLIC_CONTRACT is unset. It is filled
// in once the contract is deployed; while both are empty every page says the contract is not
// deployed yet, and the whole site still works with NEXT_PUBLIC_MOCK=1.
export const DEMO_CONTRACT: string = "0x8F861A0e6c1A18936df901828aAD5C9b50c9C073";

export const SITE_NAME = "Price Match";
export const SITE_TAGLINE = "Found it cheaper? The network checks.";
export const SITE_LINE =
  "A lowest-price guarantee that enforces itself: validators open the competitor's page on the live web, agree it is the same product and read its price, and the difference comes back from the shop's bond in the same transaction.";

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
