"use client";

// Any shop's shelf: its competitor prefixes, its bond and its products.

import { useParams } from "next/navigation";

import { ShelfLink } from "@/components/button";
import { ShopView } from "@/components/shop-view";
import { parseShopId } from "@/lib/rules";

export default function ShopPage() {
  const params = useParams<{ id: string }>();
  const id = parseShopId(String(params?.id ?? ""));
  if (!id)
    return (
      <div className="card-soft p-5">
        <h1 className="text-3xl">That is not a shop id</h1>
        <p className="mt-2 text-ink-2">Shops are S1, S2 and so on.</p>
        <ShelfLink href="/shops" className="mt-4">
          All shops
        </ShelfLink>
      </div>
    );
  return <ShopView id={id} />;
}
