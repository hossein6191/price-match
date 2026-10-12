// The round sticker slapped on a tag once a claim is judged: red "PRICE MATCHED" with the refund, or a
// black one for the outcomes that move no refund. It lands once, and not at all for reduced motion.

import { OUTCOME_WORDS, type Outcome } from "@/lib/rules";
import { cx } from "@/lib/cx";

export function Sticker({ outcome, line, land, size = 112, className }: { outcome: Outcome; line?: string; land?: boolean; size?: number; className?: string }) {
  const w = OUTCOME_WORDS[outcome];
  const words = w.sticker.split(" ");
  return (
    <span
      className={cx("sticker", outcome !== "matched" && "sticker-quiet", land && "sticker-land", className)}
      style={{ width: size, height: size, fontSize: Math.round(size / (words.length > 1 ? 5.4 : 5)) }}
      role="img"
      aria-label={w.sticker + (line ? ", " + line : "")}
    >
      <span className="flex flex-col items-center px-2">
        {words.map((word) => (
          <span key={word}>{word}</span>
        ))}
        {line && <span className="mt-1 border-t border-white/60 pt-0.5 text-[0.62em] tracking-[0.06em]">{line}</span>}
      </span>
    </span>
  );
}
