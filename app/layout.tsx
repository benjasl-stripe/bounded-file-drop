import type { Metadata } from "next";
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
  title: "Bounded file drop",
  description:
    "Pay for a file envelope before upload. Hard size, retention, and transfer limits. Agents: read /openapi.json and pay HTTP 402s.",
  alternates: {
    types: {
      "application/openapi+json": "/openapi.json",
      "text/plain": "/llms.txt",
    },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <link
          rel="service-desc"
          type="application/openapi+json"
          href="/openapi.json"
        />
        <link
          rel="describedby"
          type="application/openapi+json"
          href="/openapi.json"
        />
        <link rel="describedby" type="text/plain" href="/llms.txt" />
      </head>
      <body>{children}</body>
    </html>
  );
}
