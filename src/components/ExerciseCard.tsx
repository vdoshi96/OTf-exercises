"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type {
  DirectoryItemSummary,
  DirectoryQuery,
  GroupedExercise,
} from "@/lib/types";
import { directoryDetailHref } from "@/lib/query";
import ExercisePlaceholder from "./ExercisePlaceholder";

export default function ExerciseCard({
  item,
  query,
}: {
  item: DirectoryItemSummary;
  query: DirectoryQuery;
}) {
  const [thumbnailError, setThumbnailError] = useState(false);
  const equipment = item.equipment.length
    ? item.equipment.join(", ")
    : "Equipment not specified";
  return (
    <Link
      href={directoryDetailHref(query, item.id)}
      data-testid="exercise-card"
      className={`result-card ${item.kind === "coaching" ? "resource-card" : ""}`}
    >
      <div className="result-identity">
        <h3>{item.title}</h3>
        <p>
          {item.classificationLabel}
          {item.kind === "exercise" ? ` · ${equipment}` : ""}
        </p>
      </div>
      <div className="result-image">
        {item.thumbnail && !thumbnailError ? (
          <Image
            src={item.thumbnail}
            alt=""
            fill
            sizes="(max-width: 650px) 102px, (max-width: 1000px) 35vw, 25vw"
            loading="lazy"
            onError={() => setThumbnailError(true)}
            className="object-cover"
          />
        ) : (
          <ExercisePlaceholder
            category={
              item.kind === "exercise"
                ? (item.classification as GroupedExercise["category"])
                : "other"
            }
            exerciseName={item.title}
            muscleGroups={item.muscleGroups}
          />
        )}
      </div>
      <div className="result-credit">
        <p>
          {item.creators.map((creator) => creator.display_name).join(" · ") ||
            "Creator pending"}
        </p>
        <p>
          {item.videoCount}{" "}
          {item.kind === "exercise"
            ? item.videoCount === 1
              ? "demo"
              : "demos"
            : item.videoCount === 1
              ? "video"
              : "videos"}{" "}
          ·{" "}
          {item.sources
            .map((source) => (source === "tiktok" ? "TikTok" : "Instagram"))
            .join(" / ")}
        </p>
        {item.matchedBy.length > 0 && (
          <p className="match-reason">Matched: {item.matchedBy.join(", ")}</p>
        )}
      </div>
    </Link>
  );
}
