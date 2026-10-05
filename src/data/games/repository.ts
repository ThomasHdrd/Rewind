import { auth } from "@/lib/firebase";
import {
  CONSOLE_PLATFORM_IDS,
  GAME_GENRE_IDS,
  consoleLabel,
  igdbQuery,
} from "@/lib/games";
import { getUserDoc, UserDoc } from "@/data/repositories/firestoreUser";
import { getRatingAggregate } from "@/data/repositories/mediaRatings";
import { Game, GameQuery } from "./types";

// Raw IGDB shapes (only the fields we request).
interface IgdbGame {
  id: number;
  name: string;
  cover?: { image_id: string };
  first_release_date?: number; // unix seconds
  genres?: { name: string }[];
  platforms?: { id: number; abbreviation?: string; name: string }[];
  summary?: string;
  total_rating?: number; // 0–100
  total_rating_count?: number;
  screenshots?: { image_id: string }[];
  videos?: { video_id: string }[];
  similar_games?: number[];
}

const LIST_FIELDS =
  "name,cover.image_id,first_release_date,genres.name,platforms.id,platforms.abbreviation,platforms.name,total_rating,total_rating_count";
const DETAIL_FIELDS = `${LIST_FIELDS},summary,screenshots.image_id,videos.video_id,similar_games`;
const PAGE_SIZE = 30;

export const gameIdOf = (igdbId: number) => `game:${igdbId}`;
export function parseGameId(id: string): number | null {
  const m = id.match(/^game:(\d+)$/);
  return m ? Number(m[1]) : null;
}

function mapGame(g: IgdbGame): Game {
  const date = g.first_release_date
    ? new Date(g.first_release_date * 1000)
    : undefined;
  return {
    id: gameIdOf(g.id),
    igdbId: g.id,
    title: g.name,
    coverImageId: g.cover?.image_id,
    summary: g.summary,
    releaseDate: date?.toISOString().slice(0, 10),
    year: date?.getFullYear(),
    genres: (g.genres ?? []).map((x) => x.name),
    platforms: Array.from(
      new Set(
        (g.platforms ?? []).map((p) =>
          consoleLabel(p.id, p.abbreviation ?? p.name),
        ),
      ),
    ),
    rating: g.total_rating
      ? Math.round((g.total_rating / 20) * 10) / 10
      : undefined,
    ratingCount: g.total_rating_count,
    screenshotIds: g.screenshots?.map((s) => s.image_id),
    trailerKey: g.videos?.[0]?.video_id,
    similarIds: g.similar_games,
  };
}

function startPersonalRead(): Promise<UserDoc | null> {
  const uid = auth.currentUser?.uid;
  return uid ? getUserDoc(uid).catch(() => null) : Promise.resolve(null);
}

async function hydrate(
  list: Game[],
  personal: Promise<UserDoc | null>,
): Promise<Game[]> {
  const doc = await personal;
  const games = doc?.games ?? {};
  return list.map((g) => {
    const e = games[g.id];
    return e
      ? {
          ...g,
          status: ["wishlist", "dropped"].includes(e.status as string)
            ? "backlog"
            : e.status,
          hours: e.hours,
          platform: e.platform,
          hundredPercent: e.hundredPercent,
          userRating: e.rating,
          favorite: e.favorite,
          missionRatings: e.missionRatings,
          checklist: e.checklist?.map((c) => ({
            ...c,
            category:
              (c.category as string) === "story"
                ? "main"
                : (c.category as string) === "challenge"
                  ? "side"
                  : c.category,
          })),
        }
      : g;
  });
}

// IGDB search strings are double-quoted: strip quotes/backslashes from input.
const quote = (s: string) => `"${s.replace(/["\\]/g, " ").trim()}"`;

export async function searchGames(text: string): Promise<Game[]> {
  const q = text.trim();
  if (!q) return [];
  const personal = startPersonalRead();
  const rows = await igdbQuery<IgdbGame[]>(
    "games",
    `search ${quote(q)}; fields ${LIST_FIELDS}; where version_parent = null & cover != null; limit 20;`,
  );
  return hydrate(rows.map(mapGame), personal);
}

/** The whole IGDB catalog for genres/consoles/sort, one page at a time. */
export async function browseGames(
  query: GameQuery,
  page: number,
): Promise<{ items: Game[]; hasMore: boolean }> {
  const personal = startPersonalRead();
  const now = Math.floor(Date.now() / 1000);
  const where = ["cover != null", "version_parent = null"];
  const platformIds = query.consoles.flatMap(
    (c) => CONSOLE_PLATFORM_IDS[c] ?? [],
  );
  if (platformIds.length) where.push(`platforms = (${platformIds.join(",")})`);
  const genreIds = query.genres.map((g) => GAME_GENRE_IDS[g]).filter(Boolean);
  if (genreIds.length) where.push(`genres = (${genreIds.join(",")})`);
  let sort: string;
  if (query.sort === "coming-soon") {
    where.push(`first_release_date > ${now}`);
    sort = "hypes desc";
  } else if (query.sort === "new") {
    where.push(
      `first_release_date < ${now}`,
      `first_release_date > ${now - 365 * 86400}`,
      "total_rating_count > 3",
    );
    sort = "first_release_date desc";
  } else {
    where.push("total_rating_count > 20");
    sort = "total_rating_count desc";
  }
  const rows = await igdbQuery<IgdbGame[]>(
    "games",
    `fields ${LIST_FIELDS}; where ${where.join(" & ")}; sort ${sort}; limit ${PAGE_SIZE}; offset ${(page - 1) * PAGE_SIZE};`,
  );
  return {
    items: await hydrate(rows.map(mapGame), personal),
    hasMore: rows.length === PAGE_SIZE,
  };
}

export async function getGame(id: string): Promise<Game | undefined> {
  const igdbId = parseGameId(id);
  if (igdbId === null) return undefined;
  const personal = startPersonalRead();
  const aggregate = getRatingAggregate(id).catch(() => null);
  const [rows, ttb] = await Promise.all([
    igdbQuery<IgdbGame[]>(
      "games",
      `fields ${DETAIL_FIELDS}; where id = ${igdbId};`,
    ),
    igdbQuery<{ hastily?: number; normally?: number; completely?: number }[]>(
      "game_time_to_beats",
      `fields hastily,normally,completely; where game_id = ${igdbId};`,
    ).catch(() => []),
  ]);
  if (!rows[0]) return undefined;
  const [game] = await hydrate([mapGame(rows[0])], personal);
  const t = ttb[0];
  // "hastily" ≈ main story (Elden Ring 46 h); "normally" includes side
  // content (119 h), so it reads as "to beat" far too high.
  const main = t?.hastily ?? t?.normally;
  if (t && (main || t.completely)) {
    game.timeToBeat = {
      main: main ? Math.round(main / 3600) : undefined,
      completionist: t.completely ? Math.round(t.completely / 3600) : undefined,
    };
  }
  const agg = await aggregate;
  if (agg) {
    game.rewindRating = agg.average;
    game.rewindRatingCount = agg.count;
  }
  return game;
}

/** Several games by id (library, similar games, history posters). */
export async function getGamesByIds(ids: string[]): Promise<Game[]> {
  const igdbIds = ids.map(parseGameId).filter((n): n is number => n !== null);
  if (!igdbIds.length) return [];
  const personal = startPersonalRead();
  const rows = await igdbQuery<IgdbGame[]>(
    "games",
    `fields ${LIST_FIELDS}; where id = (${igdbIds.join(",")}); limit ${Math.min(500, igdbIds.length)};`,
  );
  const byId = new Map(rows.map((r) => [gameIdOf(r.id), mapGame(r)]));
  return hydrate(
    ids.map((id) => byId.get(id)).filter((g): g is Game => !!g),
    personal,
  );
}
