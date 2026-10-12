import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My orders",
  description: "Your orders with their guarantees counting down, your claim-fee credit, and the shops you run.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
