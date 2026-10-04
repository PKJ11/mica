import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted so builds don't depend on fetching from Google Fonts.
const sans = localFont({
  src: [
    { path: "./fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/ibm-plex-sans-latin-500-normal.woff2", weight: "500" },
    { path: "./fonts/ibm-plex-sans-latin-600-normal.woff2", weight: "600" },
    { path: "./fonts/ibm-plex-sans-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-sans",
  display: "swap",
});
const mono = localFont({ src: "./fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500", variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "MICA Portal",
  description: "Business Analytics & AI — course activities",
  // Icons come from app/favicon.ico, app/icon.svg and app/apple-icon.png (content/Favicon set).
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0E1828",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
