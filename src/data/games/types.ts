// Video games — a separate world from movies/series (own source: IGDB via the
// Worker proxy; own storage: `games` on the user doc). Shared on purpose:
// comments, ratings aggregate, history, friends feed, XP and Rewind.

// "backlog" is shown as "To play" — the games' "+ Watchlist". A separate
// "wishlist" status was dropped (too close to To play); old "wishlist"
// entries are read as "backlog" (see repository hydrate).
// "dropped" was removed too; old dropped entries are read as "backlog".
export type GameStatus = "backlog" | "playing" | "completed";

// Older checklists used "story"/"challenge" — read as "main"/"side".
export type ChecklistCategory =
  "main" | "side" | "boss" | "collectible" | "easter-egg";

/** A user-defined step on a game: mission, boss, easter egg, collectible… */
export interface ChecklistItem {
  id: string;
  title: string;
  category: ChecklistCategory;
  done: boolean;
}

export interface Game {
  /** "game:<igdbId>" — the prefix keeps it apart from movie:/tv: ids. */
  id: string;
  igdbId: number;
  title: string;
  coverImageId?: string;
  summary?: string;
  /** ISO date of first release. */
  releaseDate?: string;
  year?: number;
  genres: string[];
  /** Short platform names ("PS5", "Switch", "PC"…). */
  platforms: string[];
  /** IGDB critic+user rating, converted to /5. */
  rating?: number;
  ratingCount?: number;
  screenshotIds?: string[];
  trailerKey?: string;
  similarIds?: number[];
  /** Hours to beat: main story / completionist (IGDB time-to-beat). */
  timeToBeat?: { main?: number; completionist?: number };
  /** Rewind members' average + count (detail fetch only). */
  rewindRating?: number;
  rewindRatingCount?: number;
  // Personal (hydrated from the user doc)
  status?: GameStatus;
  hours?: number;
  platform?: string;
  hundredPercent?: boolean;
  userRating?: number;
  checklist?: ChecklistItem[];
  favorite?: boolean;
  /** My ratings of this game's missions, by mission id ("main:5"). */
  missionRatings?: Record<string, number>;
}

/** What's stored per game on the user doc (`games[gameId]`). */
export interface GameEntry {
  status?: GameStatus;
  hours?: number;
  platform?: string;
  hundredPercent?: boolean;
  rating?: number;
  ratedAt?: string;
  /** ISO — set when status becomes "completed". */
  completedAt?: string;
  checklist?: ChecklistItem[];
  /** Hearted — shown in "Favorite games" on the profile. A favorite can
   * exist without a status (the entry then isn't in the library tabs). */
  favorite?: boolean;
  /** 1–5 per mission id ("main:5", "c-…") — like episode ratings. */
  missionRatings?: Record<string, number>;
}

export type GameSort = "popularity" | "new" | "coming-soon";
export interface GameQuery {
  genres: string[];
  consoles: string[];
  sort: GameSort;
}
