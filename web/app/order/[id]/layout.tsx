// The route's own browser title, from the URL alone: no chain read, and a made-up id never reaches the title.
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const m = /^O?([1-9]\d{0,8})$/i.exec(id);
  return {
    title: m ? `Order O${m[1]}` : "Order",
    description: "One order: its guarantee window, the claim with a competitor's page, and the receipt of every judged claim.",
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
