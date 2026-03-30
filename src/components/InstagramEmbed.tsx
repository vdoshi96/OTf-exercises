"use client";

import { useEffect, useState } from "react";

interface InstagramEmbedProps {
  url: string;
}

export default function InstagramEmbed({ url }: InstagramEmbedProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const existing = document.querySelector(
      'script[src*="instagram.com/embed.js"]'
    );
    if (existing) {
      // Re-process embeds if script is already loaded
      if (window.instgrm?.Embeds?.process) {
        window.instgrm.Embeds.process();
      }
      setLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    script.onload = () => {
      setLoaded(true);
      if (window.instgrm?.Embeds?.process) {
        window.instgrm.Embeds.process();
      }
    };
    script.onerror = () => setError(true);
    document.body.appendChild(script);
  }, [url]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 p-8">
        <p className="mb-4 text-zinc-400">Could not load Instagram embed</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 font-medium text-white hover:from-purple-600 hover:to-pink-600 transition"
        >
          View on Instagram
        </a>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        style={{ maxWidth: 540, minWidth: 326, width: "100%" }}
      >
        <a href={url} target="_blank" rel="noopener noreferrer">
          {!loaded && (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-pink-500" />
            </div>
          )}
          View on Instagram
        </a>
      </blockquote>
    </div>
  );
}
