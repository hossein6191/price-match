// The Price Match mark: a yellow shelf price tag, punched for its string, with a check mark on it.
// One drawing, used by the header (components/logo.tsx), the browser icon (app/icon.svg), the app
// icon and the share card.

export const TAG_YELLOW = "#FFD400";
export const INK = "#111111";
export const RED = "#E1251B";

/** The mark as SVG markup on a 32-unit grid. `tile` draws it on a black rounded square. */
export function markSvg({ size = 32, tile = false }: { size?: number; tile?: boolean } = {}): string {
  const back = tile ? `<rect x="0" y="0" width="32" height="32" rx="6" fill="${INK}"/>` : "";
  const edge = tile ? TAG_YELLOW : INK;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">` +
    back +
    `<path d="M3.5 16 L11 7.5 H28.5 V24.5 H11 Z" fill="${TAG_YELLOW}" stroke="${edge}" stroke-width="2" stroke-linejoin="round"/>` +
    `<circle cx="10.2" cy="16" r="1.9" fill="${tile ? INK : "#FFFFFF"}" stroke="${INK}" stroke-width="1.4"/>` +
    `<path d="M15 16.2 L18.6 19.8 L25.2 12.6" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="square" stroke-linejoin="miter"/>` +
    `</svg>`
  );
}

/** The mark as a data URI, for next/og images. */
export const markDataUri = (opts: { size?: number; tile?: boolean } = {}): string => "data:image/svg+xml;base64," + Buffer.from(markSvg(opts)).toString("base64");
