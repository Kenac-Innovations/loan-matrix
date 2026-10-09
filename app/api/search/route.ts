import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchFineractAPIAsCurrentUser } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import {
  SEARCH_RESOURCES,
  SEARCH_TYPE_FILTERS,
  limitSearchResults,
  normalizeSearchResults,
} from "@/lib/global-search";

const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, "Search must be at least 2 characters.")
    .max(100, "Search must be 100 characters or fewer."),
  type: z.enum(SEARCH_TYPE_FILTERS).default("all"),
});

// GET /api/search?q=...&type=all|clients|loans|savings - Global search
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user?.userId) {
    return NextResponse.json({ error: "Your session expired. Sign in again." }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const parsed = searchQuerySchema.safeParse({
    q: params.get("q") ?? "",
    type: params.get("type") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid search request." },
      { status: 400 }
    );
  }

  const { q, type } = parsed.data;
  const resources = SEARCH_RESOURCES[type];

  try {
    // Strictly the user's own credentials, so results respect their Fineract permissions
    const raw = await fetchFineractAPIAsCurrentUser(
      "/search?query=" +
        encodeURIComponent(q) +
        "&resource=" +
        resources +
        "&exactMatch=false"
    );

    return NextResponse.json(limitSearchResults(normalizeSearchResults(raw)));
  } catch (error: unknown) {
    console.error("Error running global search:", error);
    return buildFineractErrorResponse(error, {
      action: "load",
      resource: "search results",
    });
  }
}
