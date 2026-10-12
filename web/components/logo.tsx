// The header's mark and wordmark: the yellow tag with its check, and PRICE MATCH in condensed capitals.

import { markSvg } from "@/lib/mark";

export function Mark({ size = 34 }: { size?: number }) {
  return <span aria-hidden="true" className="inline-block shrink-0" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: markSvg({ size }) }} />;
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <Mark />
      <span className="display text-[25px] leading-none font-extrabold tracking-[0.02em] uppercase">
        Price<span className="ml-1 bg-tag px-1">Match</span>
      </span>
    </span>
  );
}
