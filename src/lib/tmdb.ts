// Typed fetch client for the TMDB (themoviedb.org) read-only catalog API.
// Auth uses the v4 Bearer access token (NOT the v3 api_key query param).
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

const ACCESS_TOKEN = process.env.EXPO_PUBLIC_TMDB_ACCESS_TOKEN;

export class TmdbError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "TmdbError";
  }
}

/** True once a real (non-placeholder) TMDB token has been configured. */
export const isTmdbConfigured = Boolean(ACCESS_TOKEN && !ACCESS_TOKEN.includes("REPLACE_ME"));

export async function tmdbFetch<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  if (!isTmdbConfigured) {
    throw new TmdbError(
      "TMDB access token is not configured. Set EXPO_PUBLIC_TMDB_ACCESS_TOKEN in .env to a real v4 Bearer token."
    );
  }
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new TmdbError(`TMDB request failed: ${res.status} ${res.statusText} (${path})`, res.status);
  }
  return (await res.json()) as T;
}

export type TmdbImageSize = "w92" | "w185" | "w342" | "w500" | "w780" | "original";

/** Builds a full image URL from a TMDB relative path (e.g. "/abc.jpg"). */
export function tmdbImageUrl(path: string | null | undefined, size: TmdbImageSize = "w500"): string | undefined {
  if (!path) return undefined;
  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}
