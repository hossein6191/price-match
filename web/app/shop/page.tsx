"use client";

// The demo shop's shelf: Harbour Lane Goods, its three products with their prices and guarantee
// windows, and Buy. The shop's id comes from the site's server (it finds the shop its demo key
// opened), or from the site's settings when the server has no key.

import { DemoNote } from "@/components/bits";
import { ShelfLink } from "@/components/button";
import { Placeholder } from "@/components/read-state";
import { ShopView } from "@/components/shop-view";
import { useDemoStatus } from "@/components/use-demo";
import { hasContract } from "@/lib/chain";
import { NotDeployed } from "@/components/read-state";

export default function DemoShopPage() {
  const status = useDemoStatus();
  if (!hasContract()) return <NotDeployed />;
  if (!status) return <Placeholder lines={6} />;
  if (!status.shop)
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <p className="kicker text-ink-3">The demo shop</p>
        <h1 className="text-5xl">Not open yet</h1>
        <DemoNote />
        <p className="text-ink-2">Every other shop on the contract works as usual, and you can open your own.</p>
        <div className="flex flex-wrap gap-2">
          <ShelfLink href="/shops" variant="tag">
            All shops
          </ShelfLink>
          <ShelfLink href="/merchant">Open a shop</ShelfLink>
        </div>
      </div>
    );
  return <ShopView id={status.shop} demoHint />;
}
