import type { MetadataRoute } from "next";
import coaching from "@/data/coaching.json";
import exercises from "@/data/exercises.json";
import type { CoachingResource, GroupedExercise } from "@/lib/types";

const SITE_URL = "https://o-tf-exercises.vercel.app";
const allExercises = exercises as GroupedExercise[];
const allCoachingResources = coaching as CoachingResource[];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/coaching`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...allExercises.map((exercise) => ({
      url: `${SITE_URL}/exercise/${exercise.id}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...allCoachingResources.map((resource) => ({
      url: `${SITE_URL}/coaching/${resource.id}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
