import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import { Analytics } from "@vercel/analytics/next";
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
    "Unofficial fan directory of OrangeTheory Fitness exercises. Browse video demos by muscle group, equipment, category, and creator.",
  openGraph: {
    title: "OTF Exercise Directory",
    description:
      "Unofficial fan directory of OrangeTheory Fitness exercises with searchable video demos.",
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
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/otf-logo.svg"
                alt="Orangetheory Fitness"
                width={140}
                height={34}
                className="h-8 w-auto"
                priority
              />
            </Link>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-zinc-800/50 py-8">
          <div className="mx-auto max-w-7xl px-4 text-center text-sm text-zinc-600 sm:px-6">
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
