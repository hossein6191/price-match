// Barlow Condensed and Space Mono for the share card, fetched from Google Fonts when the card is built
// and cut down to the characters it prints. If the fetch fails the card is still built, in the
// renderer's own font.

type Font = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 700 | 800; style: "normal" };

async function loadGoogleFont(family: string, weight: number, text: string): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url)).text();
  const resource = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
  if (!resource) throw new Error("no font in the stylesheet");
  const res = await fetch(resource[1]);
  if (res.status !== 200) throw new Error("font fetch failed");
  return res.arrayBuffer();
}

export async function shelfFonts(text: string): Promise<Font[]> {
  try {
    const [condensed, condensedHeavy, mono] = await Promise.all([
      loadGoogleFont("Barlow Condensed", 600, text),
      loadGoogleFont("Barlow Condensed", 800, text),
      loadGoogleFont("Space Mono", 700, text),
    ]);
    return [
      { name: "Barlow Condensed", data: condensed, weight: 600, style: "normal" },
      { name: "Barlow Condensed", data: condensedHeavy, weight: 800, style: "normal" },
      { name: "Space Mono", data: mono, weight: 700, style: "normal" },
    ];
  } catch {
    return [];
  }
}
