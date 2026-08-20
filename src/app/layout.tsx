import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crazy Time Live Tracker — Real Spins, Stats & Predictions",
  description:
    "Real-time Evolution Gaming Crazy Time live tracker with live spins history, statistics, top slot matches, bonus flapper results, latest top multipliers and prediction insights. 100% live data.",
  keywords: [
    "Crazy Time",
    "Crazy Time Live",
    "Crazy Time Tracker",
    "Crazy Time Statistics",
    "Crazy Time Spins",
    "Evolution Gaming",
    "CasinoScores",
  ],
  authors: [{ name: "Crazy Time Live Tracker" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Crazy Time Live Tracker",
    description:
      "Real-time Evolution Gaming Crazy Time live spins, statistics and predictions.",
    siteName: "Crazy Time Live Tracker",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Crazy Time Live Tracker",
    description:
      "Real-time Evolution Gaming Crazy Time live spins, statistics and predictions.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
