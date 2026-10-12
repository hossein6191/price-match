import { ImageResponse } from "next/og";

import { DEMO_PAGES, DEMO_PRODUCTS } from "@/lib/demo-shop";
import { markDataUri } from "@/lib/mark";
import { shelfFonts } from "@/lib/og-fonts";

export const alt = "Price Match: found it cheaper? The network checks. Validators read the competitor's page and the difference comes back from the shop's bond.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#111111";
const TAG = "#FFD400";
const RED = "#E1251B";

// The card shared links show: a white shelf with its yellow rail, the kettle's tag struck through
// with the red PRICE MATCHED sticker, and a strip of till receipt beside the one sentence.
export default async function OpengraphImage() {
  const kettle = DEMO_PRODUCTS[0];
  const page = DEMO_PAGES[0];
  const headline = "FOUND IT CHEAPER?";
  const headline2 = "THE NETWORK CHECKS.";
  const sub = "Validators open the competitor's page on the live web, agree it is the same product and read its price. The difference comes back from the shop's bond.";
  const lines = ["PRICE MATCH", "COMPETITOR PAGE READ", "SAME PRODUCT", "THEIR PRICE 1.80 GEN", "OUR PRICE 2.00 GEN", "REFUND 0.20 GEN"];
  const fonts = await shelfFonts([headline, headline2, sub, ...lines, "PRICE MATCHED -0.20 GEN 2.00 LUMIO K3 KETTLE An Intelligent Contract on GenLayer", kettle.title, page.says].join(" "));
  const cond = fonts.length ? "Barlow Condensed" : undefined;
  const mono = fonts.length ? "Space Mono" : undefined;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#FFFFFF", color: INK, fontFamily: cond }}>
        <div style={{ display: "flex", alignItems: "center", padding: "30px 56px 22px" }}>
          <img src={markDataUri({ size: 56 })} width={56} height={56} alt="" />
          <div style={{ display: "flex", marginLeft: 14, fontSize: 40, fontWeight: 800, letterSpacing: 1 }}>
            PRICE <span style={{ marginLeft: 10, backgroundColor: TAG, padding: "0 8px" }}>MATCH</span>
          </div>
        </div>
        <div style={{ display: "flex", height: 16, backgroundColor: "#D6DCE1", borderBottom: `7px solid ${TAG}` }} />
        <div style={{ display: "flex", flex: 1, padding: "34px 56px 40px" }}>
          <div style={{ display: "flex", flexDirection: "column", width: 560, justifyContent: "center" }}>
            <div style={{ fontSize: 86, fontWeight: 800, lineHeight: 0.95 }}>{headline}</div>
            <div style={{ display: "flex", marginTop: 6 }}>
              <div style={{ fontSize: 86, fontWeight: 800, lineHeight: 0.95, backgroundColor: TAG, padding: "0 10px" }}>{headline2}</div>
            </div>
            <div style={{ marginTop: 24, fontSize: 27, fontWeight: 600, lineHeight: 1.25, color: "#383B3E" }}>{sub}</div>
          </div>
          <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", position: "relative", marginRight: 30 }}>
              <div style={{ display: "flex", flexDirection: "column", backgroundColor: TAG, border: `3px solid ${INK}`, padding: "14px 26px 14px 46px", boxShadow: `6px 6px 0 ${INK}` }}>
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 2 }}>LUMIO K3 KETTLE</div>
                <div style={{ display: "flex", alignItems: "flex-start", fontWeight: 800 }}>
                  <div style={{ fontSize: 120, lineHeight: 0.85, textDecoration: "line-through", textDecorationColor: RED }}>2</div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ fontSize: 46, lineHeight: 0.95 }}>.00</div>
                    <div style={{ fontSize: 18, letterSpacing: 3 }}>GEN</div>
                  </div>
                </div>
              </div>
              <div
                style={{
                  position: "absolute",
                  top: -34,
                  right: -40,
                  width: 128,
                  height: 128,
                  borderRadius: 64,
                  backgroundColor: RED,
                  border: "5px solid #FFFFFF",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  fontWeight: 800,
                  fontSize: 26,
                  lineHeight: 0.95,
                  transform: "rotate(-11deg)",
                }}
              >
                <div>PRICE</div>
                <div>MATCHED</div>
                <div style={{ fontSize: 18, marginTop: 4 }}>-0.20 GEN</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", marginTop: 28, backgroundColor: "#FDFCF7", border: "1.5px solid #C8CED3", padding: "12px 16px", fontFamily: mono, fontSize: 16, width: 300 }}>
                {lines.map((l, i) => (
                  <div key={l} style={{ display: "flex", fontWeight: i === 0 || i === lines.length - 1 ? 700 : 400 }}>
                    {l}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
