"use client";

import { useState } from "react";
import type { Video } from "@/lib/types";
import VideoEmbed from "./VideoEmbed";

export default function VideoGallery({
  videos,
  title,
  children,
}: {
  videos: Video[];
  title: string;
  children?: React.ReactNode;
}) {
  const [selected, setSelected] = useState(0);
  return (
    <div className="detail-layout">
      <section aria-label="Video demonstrations" className="selected-demo">
        <VideoEmbed
          key={videos[selected].id}
          video={videos[selected]}
          exerciseName={title}
          index={selected}
          total={videos.length}
        />
      </section>
      <aside aria-label="Exercise metadata" className="detail-context">
        {videos.length > 1 && (
          <section
            className="demo-selector"
            aria-labelledby="demo-selector-heading"
          >
            <h2 id="demo-selector-heading">
              Choose a demonstration <span>({videos.length})</span>
            </h2>
            <div className="demo-options">
              {videos.map((video, index) => (
                <button
                  key={video.id}
                  type="button"
                  aria-pressed={selected === index}
                  onClick={() => setSelected(index)}
                  className="demo-option"
                >
                  <span className="demo-number">{index + 1}</span>
                  <span>
                    <strong>{video.creator.display_name}</strong>
                    <small>
                      {video.source === "instagram" ? "Instagram" : "TikTok"} ·{" "}
                      {video.creator.handle.startsWith("@")
                        ? video.creator.handle
                        : `@${video.creator.handle}`}
                    </small>
                  </span>
                  {selected === index && (
                    <span className="selected-mark" aria-hidden="true">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="m5 12 4 4L19 6" />
                      </svg>
                    </span>
                  )}
                </button>
              ))}
            </div>
            <noscript>
              <p>Open any demonstration at its source:</p>
              <ul>
                {videos.map((video, index) => (
                  <li key={video.id}>
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {index + 1}. {video.creator.display_name} on{" "}
                      {video.source === "instagram" ? "Instagram" : "TikTok"}
                    </a>
                  </li>
                ))}
              </ul>
            </noscript>
          </section>
        )}
        {children}
      </aside>
    </div>
  );
}
