import { ImageResponse } from "next/og";

import { markDataUri } from "@/lib/mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The app icon: the yellow tag with its check, on a black tile.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#111111" }}>
        <img src={markDataUri({ size: 180, tile: true })} width={180} height={180} alt="" />
      </div>
    ),
    size,
  );
}
