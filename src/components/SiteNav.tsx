"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { directoryPageHref, parseDirectoryQuery } from "@/lib/query";

function BackArrow() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 19l-7-7 7-7"
      />
    </svg>
  );
}

function NavLink({
  active,
  children,
  href,
}: {
  active: boolean;
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "relative inline-flex min-h-12 items-center rounded-md px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 " +
        (active ? "text-ink" : "text-muted hover:bg-white/5 hover:text-accent")
      }
    >
      {children}
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-3 bottom-0 h-0.5 bg-accent-soft"
        />
      ) : null}
    </Link>
  );
}

export default function SiteNav() {
  const pathname = usePathname();
  const directoryActive = pathname === "/" || pathname.startsWith("/exercise/");
  const coachingActive =
    pathname === "/coaching" || pathname.startsWith("/coaching/");

  return (
    <header className="site-header">
      <div className="page-width site-header-inner">
        <Link
          href="/"
          aria-label="Unofficial OTF Exercise Directory home"
          className="site-brand"
        >
          <Image src="/otf-logo.svg" alt="" width={140} height={34} preload />
          <span>
            <strong>Exercise directory</strong>
            <small>Unofficial fan directory</small>
          </span>
        </Link>
        <nav aria-label="Primary">
          <NavLink active={directoryActive} href="/#directory">
            Exercises
          </NavLink>
          <NavLink active={coachingActive} href="/coaching">
            Coaching
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export function DirectoryBackLink({
  className,
  section = "exercise",
}: {
  className: string;
  section?: "exercise" | "coaching";
}) {
  const searchParams = useSearchParams();
  const normalizedQuery = parseDirectoryQuery(
    new URLSearchParams(searchParams.toString()),
    section,
  );
  const pathname = section === "coaching" ? "/coaching" : "/";
  const href = directoryPageHref(pathname, normalizedQuery) + "#directory";

  return (
    <Link href={href} className={className}>
      <BackArrow />
      Back to {section === "coaching" ? "coaching" : "directory"}
    </Link>
  );
}
