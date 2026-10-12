import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Merchant desk",
  description: "Open a shop, fund its bond, list products with their specs and guarantee windows, and release ended orders.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
