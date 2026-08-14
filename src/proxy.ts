import { NextResponse, type NextRequest } from "next/server";
import coaching from "@/data/coaching.json";
import exercises from "@/data/exercises.json";
import { tiktokContentSecurityPolicy } from "@/lib/security";

const exerciseIds = new Set(exercises.map((exercise) => exercise.id));
const coachingIds = new Set(coaching.map((resource) => resource.id));

function isPublicDetail(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 2) return false;
  const [section, id] = segments;

  if (section === "exercise") return exerciseIds.has(id);
  if (section === "coaching") return coachingIds.has(id);
  return false;
}

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (isPublicDetail(request.nextUrl.pathname)) {
    response.headers.set(
      "Content-Security-Policy",
      tiktokContentSecurityPolicy,
    );
  }
  return response;
}

export const config = {
  matcher: ["/exercise/:id", "/coaching/:id"],
};
