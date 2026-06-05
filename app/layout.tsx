import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
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

// Force desktop layout on mobile — no responsive scaling.
export const viewport: Viewport = {
  width: 1280,
  initialScale: 1,
};

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Dark is the default; users opt into light via the top-bar toggle (persisted in the
  // `theme` cookie). Reading it here renders the correct theme server-side — no flash.
  const theme = (await cookies()).get("theme")?.value;
  const isDark = theme !== "light";
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased${isDark ? " dark" : ""}`}
    >
      <body className="min-h-full bg-surface-subtle text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
