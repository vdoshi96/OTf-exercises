import type { MetadataRoute } from "next";
import exercises from "@/data/exercises.json";
import type { GroupedExercise } from "@/lib/types";

const SITE_URL = "https://o-tf-exercises.vercel.app";
const allExercises = exercises as GroupedExercise[];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...allExercises.map((exercise) => ({
      url: `${SITE_URL}/exercise/${exercise.id}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
