"use client";

import type { Video } from "@/lib/types";
import TikTokEmbed from "./TikTokEmbed";
import InstagramEmbed from "./InstagramEmbed";

export default function VideoEmbed({
  video,
  exerciseName,
  index,
  total,
}: {
  video: Video;
  exerciseName: string;
  index: number;
  total: number;
}) {
  const caption = video.description?.split("#")[0]?.split("\n")[0]?.trim();
  const platform = video.source === "instagram" ? "Instagram" : "TikTok";
  return (
    <article className="video-article">
      {video.source === "instagram" ? (
        <InstagramEmbed url={video.url} thumbnail={video.thumbnail} eager />
      ) : (
        <TikTokEmbed
          url={video.url}
          videoId={video.id}
          thumbnailUrl={video.thumbnail}
          title={exerciseName}
          eager
        />
      )}
      <div className="video-credit">
        <a
          href={video.creator.profile_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {video.creator.display_name}{" "}
          <span>
            {video.creator.handle.startsWith("@")
              ? video.creator.handle
              : `@${video.creator.handle}`}
          </span>
        </a>
        <span>
          {platform}
          {total > 1 ? ` · ${index + 1} of ${total}` : ""}
        </span>
      </div>
      {caption && <p className="video-caption">{caption}</p>}
    </article>
  );
}
