// Line icons drawn for this site on a 20-unit grid, square caps, 1.8 stroke. Decorative unless a
// title is given.

import * as React from "react";

type P = { size?: number; className?: string; title?: string };

function Svg({ size = 18, className, title, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M4 10.5 L8 14.5 L16.5 5.5" />
  </Svg>
);
export const IconCross = (p: P) => (
  <Svg {...p}>
    <path d="M5 5 L15 15 M15 5 L5 15" />
  </Svg>
);
export const IconQuestion = (p: P) => (
  <Svg {...p}>
    <path d="M7 7.2 C7 5.2 8.4 4 10.1 4 C11.9 4 13.2 5.2 13.2 6.8 C13.2 9.2 10.2 9.4 10.2 11.8" />
    <path d="M10.2 15.2 V15.6" />
  </Svg>
);
export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="7" />
    <path d="M10 6 V10 L13 12" />
  </Svg>
);
export const IconTag = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 10 L7 4.5 H17.5 V15.5 H7 Z" />
    <circle cx="7.4" cy="10" r="1.1" />
  </Svg>
);
export const IconReceipt = (p: P) => (
  <Svg {...p}>
    <path d="M5 2.5 H15 V17.5 L13.3 16.2 L11.7 17.5 L10 16.2 L8.3 17.5 L6.7 16.2 L5 17.5 Z" />
    <path d="M7.5 6.5 H12.5 M7.5 9.5 H12.5 M7.5 12.5 H10.5" />
  </Svg>
);
export const IconStore = (p: P) => (
  <Svg {...p}>
    <path d="M3 8 V17 H17 V8" />
    <path d="M2 8 L4 3 H16 L18 8 Z" />
    <path d="M8 17 V12 H12 V17" />
  </Svg>
);
export const IconBasket = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 7.5 H17.5 L15.5 16.5 H4.5 Z" />
    <path d="M6.5 7.5 L9 3 M13.5 7.5 L11 3" />
    <path d="M7.5 10.5 V13.5 M10 10.5 V13.5 M12.5 10.5 V13.5" />
  </Svg>
);
export const IconGlobe = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="7" />
    <path d="M3 10 H17 M10 3 C12.5 5.5 12.5 14.5 10 17 C7.5 14.5 7.5 5.5 10 3" />
  </Svg>
);
export const IconWallet = (p: P) => (
  <Svg {...p}>
    <path d="M3 5.5 H15.5 V16 H3 Z" />
    <path d="M3 5.5 L13 3 V5.5" />
    <path d="M11.5 10.5 H17 V13.5 H11.5 Z" />
  </Svg>
);
export const IconFaucet = (p: P) => (
  <Svg {...p}>
    <path d="M3 6 H11 C13.5 6 15 7.5 15 10 V11" />
    <path d="M7 3.5 V6 M5 3.5 H9" />
    <path d="M15 13.5 C15 15 14.2 16 13.5 17 C12.8 16 12 15 12 13.5 C12 12.6 13.5 11.5 13.5 11.5 C13.5 11.5 15 12.6 15 13.5 Z" />
  </Svg>
);
export const IconExternal = (p: P) => (
  <Svg {...p}>
    <path d="M11.5 3.5 H16.5 V8.5 M16.5 3.5 L9.5 10.5" />
    <path d="M14 12 V16.5 H3.5 V6 H8" />
  </Svg>
);
export const IconArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 10 H16 M11.5 5.5 L16 10 L11.5 14.5" />
  </Svg>
);
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M10 4 V16 M4 10 H16" />
  </Svg>
);
export const IconRefresh = (p: P) => (
  <Svg {...p}>
    <path d="M15.5 8 A6 6 0 1 0 15.5 12" />
    <path d="M16 3.5 V8 H11.5" />
  </Svg>
);
export const IconHourglass = (p: P) => (
  <Svg {...p}>
    <path d="M5 2.5 H15 M5 17.5 H15" />
    <path d="M6 2.5 C6 7 10 8 10 10 C10 12 6 13 6 17.5 M14 2.5 C14 7 10 8 10 10 C10 12 14 13 14 17.5" />
  </Svg>
);
export const IconPin = (p: P) => (
  <Svg {...p}>
    <path d="M10 17.5 C10 17.5 4.5 12 4.5 8 A5.5 5.5 0 0 1 15.5 8 C15.5 12 10 17.5 10 17.5 Z" />
    <circle cx="10" cy="8" r="1.8" />
  </Svg>
);
export const IconUnlock = (p: P) => (
  <Svg {...p}>
    <path d="M4 9 H16 V17 H4 Z" />
    <path d="M6.5 9 V6 A3.5 3.5 0 0 1 13.2 4.6" />
  </Svg>
);
export const IconCoins = (p: P) => (
  <Svg {...p}>
    <ellipse cx="8" cy="6" rx="5" ry="2.2" />
    <path d="M3 6 V9.5 C3 10.7 5.2 11.7 8 11.7 C10.8 11.7 13 10.7 13 9.5 V6" />
    <path d="M7 13.5 C7.6 14.5 9.6 15.2 12 15.2 C14.8 15.2 17 14.2 17 13 V9.5 C17 8.5 15.6 7.7 13.5 7.4" />
  </Svg>
);
