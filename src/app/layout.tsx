import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "OTF Exercise Directory",
    template: "%s | OTF Exercise Directory",
  },
  description:
    "Searchable directory of OrangeTheory Fitness exercises from Coach Rudy's TikTok. Browse by muscle group, equipment, and category.",
  openGraph: {
    title: "OTF Exercise Directory",
    description:
      "Searchable directory of OrangeTheory Fitness exercises from Coach Rudy's TikTok.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} dark h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-zinc-950 font-sans text-zinc-100">
        <header className="sticky top-0 z-50 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 font-bold text-white">
                OT
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight text-zinc-100">
                  OTF Exercise Directory
                </h1>
                <p className="text-xs text-zinc-500">
                  Powered by Coach Rudy&apos;s TikTok
                </p>
              </div>
            </Link>
            <a
              href="https://www.tiktok.com/@coachingotf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.75a8.18 8.18 0 004.76 1.52V6.84a4.84 4.84 0 01-1-.15z" />
              </svg>
              @coachingotf
            </a>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-zinc-800/50 py-8">
          <div className="mx-auto max-w-7xl px-4 text-center text-sm text-zinc-600 sm:px-6">
            <p>
              Videos by{" "}
              <a
                href="https://www.tiktok.com/@coachingotf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-orange-400"
              >
                Coach Rudy (@coachingotf)
              </a>{" "}
              on TikTok. This is an unofficial fan directory.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
