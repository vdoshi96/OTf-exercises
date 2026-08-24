import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import SiteNav from "@/components/SiteNav";
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
  metadataBase: new URL("https://o-tf-exercises.vercel.app"),
  title: {
    default: "Unofficial OTF Exercise Directory",
    template: "Unofficial OTF Exercise Directory | %s",
  },
  description:
    "Unofficial fan directory of Orangetheory Fitness exercises. Search video demos by muscle group, equipment, category, and creator before class starts.",
  openGraph: {
    title: "Unofficial OTF Exercise Directory",
    description:
      "Unofficial, searchable Orangetheory Fitness exercise demos with movement metadata and creator attribution.",
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
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${oswald.variable} dark h-full`}
    >
      <body className="app-shell flex min-h-full flex-col bg-background font-sans text-foreground antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-orange-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
        >
          Skip to main content
        </a>
        <SiteNav />

        <main id="main-content" className="flex-1" tabIndex={-1}>
          {children}
        </main>

        <footer className="border-t border-white/10 bg-[#060707]/95 py-8">
          <div className="mx-auto max-w-[92rem] space-y-2 px-4 text-center text-sm leading-6 text-stone-400 sm:px-6 lg:px-8">
            <p>
              Unofficial fan-made directory. Not affiliated with, endorsed by,
              or operated by Orangetheory Fitness. Orangetheory and related
              marks belong to their respective owners.
            </p>
            <p>
              Video demos link back to their original creators on Instagram,
              TikTok, and other source platforms.{" "}
              <Link
                href="/privacy"
                className="font-semibold text-stone-300 underline decoration-stone-600 underline-offset-4 transition hover:text-orange-200 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
              >
                Privacy
              </Link>
            </p>
          </div>
        </footer>
        {process.env.VERCEL === "1" ? <Analytics /> : null}
      </body>
    </html>
  );
}
