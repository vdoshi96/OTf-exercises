import type { NextRequest } from "next/server";
import { getDirectoryResponse } from "@/lib/directory";
import { parseDirectoryQuery } from "@/lib/query";
import type { DirectorySection } from "@/lib/types";

function isDirectorySection(value: string | null): value is DirectorySection {
  return value === "exercise" || value === "coaching";
}

export async function GET(request: NextRequest) {
  const section = request.nextUrl.searchParams.get("section") ?? "exercise";
  if (!isDirectorySection(section)) {
    return Response.json(
      { error: "section must be exercise or coaching" },
      { status: 400 }
    );
  }

  const query = parseDirectoryQuery(request.nextUrl.searchParams, section);
  const response = getDirectoryResponse(query);
  return Response.json(response, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
