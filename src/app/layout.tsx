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
      <body className="app-shell flex min-h-full flex-col bg-background font-sans text-foreground antialiased">
        <a
          href="#directory"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-orange-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
        >
          Skip to directory
        </a>
        <header className="sticky top-0 z-50 border-b border-white/10 bg-[#060707]/90 backdrop-blur-2xl">
          <div className="h-1 bg-orange-500" />
          <div className="mx-auto flex max-w-[92rem] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="flex items-center gap-4 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
            >
              <Image
                src="/otf-logo.svg"
                alt="Orangetheory Fitness"
                width={140}
                height={34}
                className="h-7 w-auto sm:h-8"
                priority
              />
              <span className="hidden border-l border-white/15 pl-4 text-sm font-semibold text-stone-300 sm:inline">
                Exercise Directory
              </span>
            </Link>
            <nav aria-label="Primary">
              <a
                href="#directory"
                className="relative inline-flex min-h-10 items-center rounded-md px-3 text-sm font-semibold text-stone-100 transition hover:text-orange-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
              >
                Directory
                <span className="absolute inset-x-3 -bottom-4 h-0.5 bg-orange-500" />
              </a>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-white/10 bg-[#060707]/95 py-8">
          <div className="mx-auto max-w-[92rem] px-4 text-center text-sm leading-6 text-stone-500 sm:px-6 lg:px-8">
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
