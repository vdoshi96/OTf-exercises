"use client";

import { useEffect, useRef, useState } from "react";

interface TikTokEmbedProps {
  url: string;
}

export default function TikTokEmbed({ url }: TikTokEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const videoId = url.split("/video/")[1]?.split("?")[0];

  useEffect(() => {
    if (!videoId) {
      setError(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.tiktok.com/embed.js";
    script.async = true;
    script.onload = () => setLoaded(true);
    script.onerror = () => setError(true);
    document.body.appendChild(script);

    return () => {
      try {
        document.body.removeChild(script);
      } catch {
        // Script may have already been removed
      }
    };
  }, [videoId]);

  if (error || !videoId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 p-8">
        <p className="mb-4 text-zinc-400">Could not load TikTok embed</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-orange-500 px-4 py-2 font-medium text-white hover:bg-orange-600 transition"
        >
          Watch on TikTok
        </a>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex justify-center">
      <blockquote
        className="tiktok-embed"
        cite={url}
        data-video-id={videoId}
        style={{ maxWidth: 605, minWidth: 325 }}
      >
        <section>
          {!loaded && (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-orange-500" />
            </div>
          )}
          <a href={url} target="_blank" rel="noopener noreferrer">
            Watch on TikTok
          </a>
        </section>
      </blockquote>
    </div>
  );
}
