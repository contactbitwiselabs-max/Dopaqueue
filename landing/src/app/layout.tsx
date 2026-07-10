import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DopaQueue — Spend Attention Like Money",
  description:
    "The anti-doomscroll Chrome extension. Set a daily scroll budget, save videos with one tap, and turn your Watch Later graveyard into an active second brain. Local-first, privacy-first, free forever.",
  manifest: "/manifest.json",
  keywords: [
    "doomscrolling",
    "productivity",
    "chrome extension",
    "youtube shorts",
    "instagram reels",
    "dopamine detox",
    "digital wellbeing",
    "second brain",
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DopaQueue",
  },
  openGraph: {
    title: "DopaQueue — Spend Attention Like Money",
    description:
      "The anti-doomscroll extension. Budget your dopamine, save what matters, grow your second brain.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a08",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
