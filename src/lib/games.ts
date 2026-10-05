// IGDB access through the Rewind Worker proxy (worker/igdb-proxy) — the
// app never holds the Twitch secret. Until EXPO_PUBLIC_GAMES_API_URL is set,
// games are "not configured" and every games UI stays hidden.

const GAMES_API_URL = (process.env.EXPO_PUBLIC_GAMES_API_URL ?? "").replace(
  /\/+$/,
  "",
);
export const isGamesConfigured = GAMES_API_URL.startsWith("https://");

// Same in-memory cache + in-flight dedupe idea as tmdbFetch.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; promise: Promise<unknown> }>();

/** POSTs an IGDB "apicalypse" query to an allowlisted endpoint. */
export function igdbQuery<T>(
  endpoint: "games" | "game_time_to_beats" | "external_games",
  body: string,
): Promise<T> {
  if (!isGamesConfigured)
    return Promise.reject(new Error("Games API not configured"));
  const key = `${endpoint}|${body}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS)
    return hit.promise as Promise<T>;
  const promise = fetch(`${GAMES_API_URL}/${endpoint}`, {
    method: "POST",
    body,
  }).then(async (res) => {
    if (!res.ok) throw new Error(`IGDB ${endpoint} ${res.status}`);
    return (await res.json()) as T;
  });
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  return promise;
}

export interface SteamAchievement {
  name: string;
  description: string;
  /** Share of Steam players who unlocked it. */
  percent: number;
  icon: string;
}

/**
 * A game's Steam achievements (via the Worker, which reads Steam's public
 * stats page), most unlocked first — roughly story order. Empty for games
 * not on Steam. Works for any Steam game, not just the listed ones.
 */
export async function getSteamAchievements(
  igdbId: number,
): Promise<SteamAchievement[]> {
  const links = await igdbQuery<{ uid: string }[]>(
    "external_games",
    `fields uid; where game = ${igdbId} & external_game_source = 1; limit 1;`,
  );
  const appid = links[0]?.uid;
  if (!appid || !/^\d+$/.test(appid)) return [];
  const res = await fetch(`${GAMES_API_URL}/steam/achievements/${appid}`);
  if (!res.ok) return [];
  const list = (await res.json()) as SteamAchievement[];
  // Same name twice (rare) would collide as checklist titles: keep the first.
  const seen = new Set<string>();
  return list
    .filter((a) => a.name && !seen.has(a.name) && seen.add(a.name))
    .sort((a, b) => b.percent - a.percent);
}

export type IgdbImageSize =
  | "t_cover_small"
  | "t_cover_big"
  | "t_screenshot_med"
  | "t_screenshot_big"
  | "t_720p";

export function igdbImageUrl(
  imageId: string | undefined,
  size: IgdbImageSize = "t_cover_big",
): string | undefined {
  return imageId
    ? `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`
    : undefined;
}

// Display labels → IGDB ids. Consoles group generations people think of as
// one choice ("Xbox" = Series X|S + One).
export const CONSOLE_PLATFORM_IDS: Record<string, number[]> = {
  PS5: [167],
  PS4: [48],
  "Xbox Series": [169],
  "Xbox One": [49],
  Switch: [130, 508],
  PC: [6],
  Mac: [14],
  Mobile: [34, 39],
};
export const KNOWN_CONSOLES = Object.keys(CONSOLE_PLATFORM_IDS);

export const GAME_GENRE_IDS: Record<string, number> = {
  Adventure: 31,
  RPG: 12,
  Shooter: 5,
  Platform: 8,
  Strategy: 15,
  Puzzle: 9,
  Racing: 10,
  Sport: 14,
  Fighting: 4,
  Simulator: 13,
  Indie: 32,
  "Hack and slash": 25,
  Tactical: 24,
  Arcade: 33,
  "Point-and-click": 2,
  "Visual novel": 34,
};
export const ALL_GAME_GENRES = Object.keys(GAME_GENRE_IDS);

/** IGDB platform id → the short label shown in the app. */
export function consoleLabel(platformId: number, fallback: string): string {
  for (const [label, ids] of Object.entries(CONSOLE_PLATFORM_IDS))
    if (ids.includes(platformId)) return label;
  return fallback;
}
