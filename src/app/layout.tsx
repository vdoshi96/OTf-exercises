import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "OTF Exercise Directory",
    template: "%s | OTF Exercise Directory",
  },
  description:
    "Unofficial fan directory of Orangetheory Fitness exercises. Search video demos by muscle group, equipment, category, and creator before class starts.",
  openGraph: {
    title: "OTF Exercise Directory",
    description:
      "Searchable Orangetheory Fitness exercise demos with movement metadata and creator attribution.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${oswald.variable} dark h-full`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground antialiased">
        <a
          href="#directory"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-orange-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
        >
          Skip to directory
        </a>
        <header className="sticky top-0 z-50 border-b border-orange-950/70 bg-[#080604]/90 backdrop-blur-xl">
          <div className="h-0.5 bg-orange-500" />
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
            >
              <Image
                src="/otf-logo.svg"
                alt="Orangetheory Fitness"
                width={140}
                height={34}
                className="h-7 w-auto sm:h-8"
                priority
              />
              <span className="hidden border-l border-orange-500/30 pl-3 text-sm font-semibold text-stone-300 sm:inline">
                Exercise Directory
              </span>
            </Link>
            <nav aria-label="Primary">
              <a
                href="#directory"
                className="rounded-md px-3 py-2 text-sm font-semibold text-orange-200 transition hover:bg-orange-500/10 hover:text-orange-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
              >
                Directory
              </a>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-orange-950/70 bg-[#080604] py-8">
          <div className="mx-auto max-w-7xl px-4 text-center text-sm text-stone-500 sm:px-6">
            <p>
              Unofficial fan directory. Video demos link back to their original
              creators on Instagram, TikTok, and other source platforms.
            </p>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
