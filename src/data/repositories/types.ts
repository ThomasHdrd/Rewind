import {
  ActivityItem,
  Episode,
  Friend,
  HistoryEntry,
  HistoryRef,
  ListModel,
  Media,
  UpcomingEpisode,
  UserProfile,
  WatchStatus,
} from "@/types/media";

export type CatalogKind = "all" | "movie" | "series" | "anime";
export type CatalogSort = "trending" | "popularity" | "new" | "coming-soon";
export interface CatalogQuery {
  kind: CatalogKind;
  /** Display genre labels (src/lib/genres.ts); any of them matches. */
  genres: string[];
  /** Platform names (src/lib/platforms.ts): only titles streaming there. */
  platforms: string[];
  sort: CatalogSort;
}
export interface CatalogPage {
  items: Media[];
  hasMore: boolean;
}

// Repository interfaces decouple screens from the data source. Today they
// are backed by in-memory mocks (see ./mock.ts); swapping to a real backend
// means writing a new class that implements these same interfaces and
// updating the wiring in ./index.ts — no screen code changes.

export interface MediaRepository {
  listTrending(): Promise<Media[]>;
  listComingSoon(): Promise<Media[]>;
  /** The WHOLE TMDB catalog, one page at a time (Discover's grid). */
  browseCatalog(query: CatalogQuery, page: number): Promise<CatalogPage>;
  /** Personalized picks from the user's onboarding answers: titles in any of
   * their genres, restricted to their streaming platforms when they picked
   * some. Empty when both lists are empty. */
  listForYou(preferences: { genres: string[]; platforms: string[] }): Promise<Media[]>;
  listContinueWatching(): Promise<Media[]>;
  search(query: string): Promise<Media[]>;
  getById(id: string): Promise<Media | undefined>;
  getEpisodes(seriesId: string, season?: number): Promise<Episode[]>;
  getEpisodeById(episodeId: string): Promise<Episode | undefined>;
  /** Real per-title recommendations (TMDB /recommendations), not global trending. */
  getRecommendations(id: string): Promise<Media[]>;
  setWatchStatus(mediaId: string, status: WatchStatus | null): Promise<void>;
  setUserRating(mediaId: string, rating: number): Promise<void>;
  toggleEpisodeWatched(episodeId: string): Promise<void>;
  /** Sets watched=true/false for many episodes in one atomic write — used by
   * "Mark all watched"/"Unmark all" to avoid the race condition N parallel
   * toggleEpisodeWatched() calls have (see setEpisodesWatchedBulk). */
  setEpisodesWatched(episodeIds: string[], watched: boolean): Promise<void>;
  /** Fresh count straight from the store (no client cache) — used right
   * after a write to compute the next status without racing a stale hook. */
  getSeriesWatchedEpisodeCount(seriesId: string): Promise<number>;
}

export interface TrackingRepository {
  getUpcoming(): Promise<UpcomingEpisode[]>;
  getHistory(): Promise<HistoryEntry[]>;
  logWatch(label: string, ref?: HistoryRef): Promise<void>;
  /** Undo of logWatch, for unmarking. Episode ids are removed from the
   * entries covering them (an entry is dropped once it covers none); a movie
   * ref (no episodeIds) drops that movie's entries. `legacyLabels` matches
   * entries logged before refs existed. */
  removeWatch(ref: HistoryRef, legacyLabels?: string[]): Promise<void>;
}

export interface SocialRepository {
  getFriends(): Promise<Friend[]>;
  getActivityFeed(): Promise<ActivityItem[]>;
}

export interface UserRepository {
  getProfile(): Promise<UserProfile>;
  getLists(): Promise<ListModel[]>;
  updateProfile(
    patch: Partial<
      Pick<UserProfile, "firstName" | "username" | "bio" | "avatarColor" | "avatarIcon" | "avatarImage" | "bannerMode" | "bannerImageUri">
    >
  ): Promise<UserProfile>;
  createList(name: string): Promise<ListModel>;
  renameList(listId: string, name: string): Promise<void>;
  removeFromList(listId: string, mediaId: string): Promise<void>;
  addToList(listId: string, mediaId: string): Promise<void>;
  toggleFavorite(mediaId: string): Promise<boolean>;
}
