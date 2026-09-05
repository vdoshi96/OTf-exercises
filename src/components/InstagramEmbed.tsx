"use client";
import Image from "next/image";
import { useState } from "react";
import { FALLBACK_THUMBNAIL } from "./thumbnailFallback";

export default function InstagramEmbed({
  url,
  thumbnail,
  eager = false,
}: {
  url: string;
  thumbnail?: string;
  eager?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const src =
    thumbnail?.startsWith("/thumbs/") && !imgError
      ? thumbnail
      : FALLBACK_THUMBNAIL;
  return (
    <div className="platform-media">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open the original post on Instagram in a new tab"
        className="media-stage instagram-stage"
      >
        <Image
          src={src}
          alt=""
          fill
          sizes="(min-width: 1000px) 650px, 100vw"
          loading={eager ? "eager" : "lazy"}
          onError={() => setImgError(true)}
          className="object-contain"
        />
        <span className="media-action">
          Watch on Instagram{" "}
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 5h5v5M10 14l9-9M19 13v6H5V5h6" />
          </svg>
        </span>
      </a>
      <p className="media-note">
        Opens the original post in a new tab. Instagram may ask you to sign in.
      </p>
    </div>
  );
}
