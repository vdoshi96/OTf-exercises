"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  directoryPageHref,
  parseDirectoryQuery,
} from "@/lib/query";

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
        (active
          ? "text-stone-50"
          : "text-stone-300 hover:bg-white/5 hover:text-orange-200")
      }
    >
      {children}
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-3 bottom-0 h-0.5 bg-orange-500"
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
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#060707]/90 backdrop-blur-2xl">
      <div className="h-1 bg-orange-500" />
      <div className="mx-auto grid max-w-[92rem] gap-1 px-4 py-2 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:py-3 lg:px-8">
        <Link
          href="/"
          aria-label="Unofficial OTF Exercise Directory home"
          className="flex min-h-12 min-w-0 items-center gap-3 rounded-md py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
        >
          <Image
            src="/otf-logo.svg"
            alt=""
            width={140}
            height={34}
            className="h-6 w-auto flex-none sm:h-8"
            preload
          />
          <span className="min-w-0 border-l border-white/15 pl-3 leading-tight">
            <span className="block whitespace-nowrap text-[0.625rem] font-bold uppercase tracking-[0.12em] text-orange-400 sm:text-[0.6875rem]">
              Unofficial fan directory
            </span>
            <span className="block whitespace-nowrap text-sm font-semibold text-stone-200">
              Exercise Directory
            </span>
          </span>
        </Link>

        <nav aria-label="Primary" className="-mx-1 flex items-center sm:mx-0">
          <NavLink active={directoryActive} href="/#directory">
            Directory
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
