"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FALLBACK_THUMBNAIL } from "./thumbnailFallback";

interface TikTokEmbedProps {
  url: string;
  videoId: string;
  thumbnailUrl?: string;
  title: string;
  eager?: boolean;
}

function TikTokMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 4.76 1.52V6.84a4.84 4.84 0 0 1-1-.15Z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-8 w-8"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M8 5v14l11-7Z" />
    </svg>
  );
}

export default function TikTokEmbed({
  url,
  videoId,
  thumbnailUrl,
  title,
  eager = false,
}: TikTokEmbedProps) {
  const [playing, setPlaying] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const hasLocalThumbnail =
    Boolean(thumbnailUrl?.startsWith("/thumbs/")) && !thumbnailError;

  useEffect(() => {
    if (playing) playerRef.current?.focus();
  }, [playing]);

  if (!videoId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-[#0f1010] p-8 text-center">
        <p className="mb-4 text-stone-400">This TikTok preview is unavailable.</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-md bg-orange-500 px-4 py-2 font-semibold text-black transition hover:bg-orange-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
        >
          Watch on TikTok
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-lg border border-white/10 bg-[#0f1010]">
      <div className="relative aspect-[9/16] w-full overflow-hidden bg-black">
        {playing ? (
          <iframe
            ref={playerRef}
            src={`https://www.tiktok.com/player/v1/${encodeURIComponent(videoId)}?autoplay=1&controls=1&loop=0&music_info=1&description=1&rel=0`}
            title={`${title} on TikTok`}
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play ${title} on TikTok`}
            className="group absolute inset-0 flex h-full w-full items-center justify-center overflow-hidden text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-orange-400"
          >
            {hasLocalThumbnail ? (
              <Image
                src={thumbnailUrl!}
                alt={`${title} TikTok preview`}
                fill
                sizes="(max-width: 639px) calc(100vw - 4rem), 420px"
                loading={eager ? "eager" : "lazy"}
                onError={() => setThumbnailError(true)}
                className="object-cover transition duration-300 group-hover:scale-[1.02]"
              />
            ) : (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,#252626,#060707_70%)] px-6 text-stone-300">
                <Image
                  src={FALLBACK_THUMBNAIL}
                  alt=""
                  fill
                  sizes="(max-width: 639px) calc(100vw - 4rem), 420px"
                  loading={eager ? "eager" : "lazy"}
                  className="object-cover opacity-25"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/30" />
                <span className="relative">
                  <TikTokMark className="h-12 w-12" />
                </span>
                <span className="relative text-center text-sm font-semibold">
                  Preview on TikTok
                </span>
              </span>
            )}
            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/25" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-orange-500 bg-black/65 pl-1 shadow-2xl backdrop-blur-sm transition group-hover:scale-105 group-hover:bg-orange-500 group-hover:text-black">
              <PlayIcon />
            </span>
            <span className="absolute bottom-4 left-4 right-4 rounded-md bg-black/70 px-3 py-2 text-sm font-semibold backdrop-blur-sm">
              Tap to play on TikTok
            </span>
          </button>
        )}
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-11 items-center justify-center gap-2 border-t border-white/10 px-4 py-2 text-sm font-semibold text-stone-300 transition hover:bg-white/5 hover:text-orange-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-orange-400"
      >
        <TikTokMark />
        Open original on TikTok
      </a>
    </div>
  );
}
