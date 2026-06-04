import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Bolt Sentinel — Regulatory Operations Platform",
    template: "%s · Bolt Sentinel",
  },
  description:
    "AI-native regulatory operations platform: authority request response, fleet partner onboarding, and ongoing compliance monitoring.",
  // IP guardrail: private demo only — never publicly indexed (see README).
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-surface-subtle text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
