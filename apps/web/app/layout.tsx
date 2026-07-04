import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Mono for ALL numbers, hashes, ledger rows — typewriter / counting-house lineage, true italic.
const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

// Grotesque for labels, headings, controls.
const grotesk = Space_Grotesk({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ThinkPay — a spending conscience for agents",
  description:
    "Give the agent a task and a budget. Watch it decide what's worth paying for.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexMono.variable} ${grotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
