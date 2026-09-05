import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import SiteNav from "@/components/SiteNav";
import "./globals.css";

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
    <html lang="en" data-scroll-behavior="smooth" className="h-full">
      <body className="app-shell flex min-h-full flex-col bg-background font-sans text-foreground antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-accent-soft focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
        >
          Skip to main content
        </a>
        <SiteNav />

        <main id="main-content" className="flex-1" tabIndex={-1}>
          {children}
        </main>

        <footer className="site-footer">
          <div className="page-width space-y-2 text-sm leading-6 text-muted">
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
                className="font-semibold text-muted underline decoration-stone-600 underline-offset-4 transition hover:text-accent focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
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
