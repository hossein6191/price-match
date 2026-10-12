// The route's own browser title, from the URL alone: no chain read, and a made-up id never reaches the title.
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const m = /^S?([1-9]\d{0,8})$/i.exec(id);
  return {
    title: m ? `Shop S${m[1]}` : "Shop",
    description: "One shop: the competitor pages it matches, its guarantee bond and its products.",
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
