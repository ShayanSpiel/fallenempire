import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Central Bank | EIntelligence",
  description: "Economic analytics and transaction monitoring",
};

export default function CentralBankLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
