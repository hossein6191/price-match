import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The demo shop",
  description: "Harbour Lane Goods: nine products, each with a lowest-price guarantee the network enforces from the shop's bond.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
