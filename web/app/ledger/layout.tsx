import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The ledger",
  description: "The contract's totals, printed like a till's end-of-day report: every atto in a bond or a credit, and every claim's outcome.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
