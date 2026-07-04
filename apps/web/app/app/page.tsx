import type { Metadata } from "next";
import Dashboard from "@/components/Dashboard";

export const metadata: Metadata = {
  title: "ThinkPay · Ledger",
  description: "The live decision ledger for ThinkPay agents.",
};

export default function Page() {
  return <Dashboard />;
}
