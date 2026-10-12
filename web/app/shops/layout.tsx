import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "All shops",
  description: "Every shop on the contract, newest first, with its bond and the competitors it matches.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
