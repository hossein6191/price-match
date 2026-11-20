import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works",
  description: "The six askings, the stock question, the appeal, price protection, why reading the live web makes this a GenLayer job, where the money goes, and the limits.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
