import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How the unofficial OTF Exercise Directory handles previews, external media, and privacy-friendly analytics.",
};

export default function PrivacyPage() {
  return (
    <div className="reading-page">
      <h1 className="font-display display-tight mt-2 text-4xl font-semibold text-ink sm:text-5xl">
        Privacy
      </h1>
      <p className="mt-4 text-base leading-7 text-muted">
        This fan-made directory does not offer user accounts or ask you to
        submit personal information. Here is what happens when you browse its
        exercise previews and video links.
      </p>

      <div className="mt-8 space-y-5">
        <section className="rounded-lg border border-line bg-white p-5 sm:p-6">
          <h2 className="font-display text-2xl font-semibold text-ink">
            Local previews
          </h2>
          <p className="mt-2 leading-7 text-muted">
            Exercise preview images are served from this site. Merely viewing a
            local preview does not load Instagram or TikTok media.
          </p>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 sm:p-6">
          <h2 className="font-display text-2xl font-semibold text-ink">
            Instagram links
          </h2>
          <p className="mt-2 leading-7 text-muted">
            Instagram previews are outbound links, not embedded players.
            Choosing one opens the original post in a new tab. Instagram then
            receives that visit and handles it under its own privacy terms.
          </p>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 sm:p-6">
          <h2 className="font-display text-2xl font-semibold text-ink">
            TikTok players
          </h2>
          <p className="mt-2 leading-7 text-muted">
            TikTok’s embedded player is not loaded until you press a play
            control. After that choice, your browser contacts TikTok and TikTok
            may process the request under its own privacy terms. The player’s
            request uses the browser’s strict-origin referrer policy, so TikTok
            receives only this site’s origin rather than the directory page’s
            full address.
          </p>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 sm:p-6">
          <h2 className="font-display text-2xl font-semibold text-ink">
            Site analytics
          </h2>
          <p className="mt-2 leading-7 text-muted">
            The deployed site uses Vercel Web Analytics for anonymized page-view
            statistics. Depending on the request, those statistics may include
            the page or route, referrer, approximate country, browser, operating
            system, device type, and filtered query parameters. Vercel describes
            Web Analytics as cookie-free and says the data is not associated
            with an individual or IP address. The directory does not add its own
            analytics cookie.{" "}
            <a
              href="https://vercel.com/docs/analytics/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-accent underline decoration-orange-500/50 underline-offset-4 transition hover:text-accent focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
            >
              Read Vercel’s analytics privacy documentation
            </a>
            .
          </p>
        </section>
      </div>

      <Link
        href="/#directory"
        className="mt-8 inline-flex min-h-12 items-center rounded-md bg-accent-soft px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
      >
        Browse the directory
      </Link>
    </div>
  );
}
