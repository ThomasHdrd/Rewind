import {
  ActivityItem,
  Challenge,
  Episode,
  Friend,
  HistoryEntry,
  ListModel,
  Media,
  UpcomingEpisode,
  UserProfile,
  WatchStatus,
} from "@/types/media";

// Repository interfaces decouple screens from the data source. Today they
// are backed by in-memory mocks (see ./mock.ts); swapping to a real backend
// means writing a new class that implements these same interfaces and
// updating the wiring in ./index.ts — no screen code changes.

export interface MediaRepository {
  listTrending(): Promise<Media[]>;
  listComingSoon(): Promise<Media[]>;
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
}

export interface TrackingRepository {
  getUpcoming(): Promise<UpcomingEpisode[]>;
  getHistory(): Promise<HistoryEntry[]>;
  logWatch(mediaId: string): Promise<void>;
}

export interface SocialRepository {
  getFriends(): Promise<Friend[]>;
  getActivityFeed(): Promise<ActivityItem[]>;
  addFriend(): Promise<Friend>;
}

export interface UserRepository {
  getProfile(): Promise<UserProfile>;
  getLists(): Promise<ListModel[]>;
  getChallenges(): Promise<Challenge[]>;
  updateProfile(
    patch: Partial<Pick<UserProfile, "firstName" | "bio" | "avatarColor" | "avatarIcon" | "bannerMode" | "bannerImageUri">>
  ): Promise<UserProfile>;
  createList(name: string): Promise<ListModel>;
  renameList(listId: string, name: string): Promise<void>;
  removeFromList(listId: string, mediaId: string): Promise<void>;
  addToList(listId: string, mediaId: string): Promise<void>;
  toggleFavorite(mediaId: string): Promise<boolean>;
}
