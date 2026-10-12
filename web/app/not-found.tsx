import { ShelfLink } from "@/components/button";

export default function NotFound() {
  return (
    <div className="flex max-w-2xl flex-col items-start gap-3">
      <p className="kicker text-ink-3">404 · not on this shelf</p>
      <h1 className="text-5xl">Nothing here</h1>
      <p className="text-ink-2">This address is not part of the store. Shops live under /shop/S1, orders under /order/O1.</p>
      <ShelfLink href="/" variant="tag" className="mt-2">
        Back to the front of the store
      </ShelfLink>
    </div>
  );
}
