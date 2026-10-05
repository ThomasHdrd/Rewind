export type MediaKind = "series" | "movie" | "anime" | "tv";

export type WatchStatus = "watching" | "watchlist" | "watched" | "paused" | "dropped";

export interface Media {
  id: string;
  title: string;
  kind: MediaKind;
  year: number;
  genres: string[];
  runtimeMinutes?: number;
  artworkColor: string;
  synopsis?: string;
  communityRating?: number;
  ratingCount?: number;
  userRating?: number;
  status?: WatchStatus;
  seasons?: number;
  /** Regular seasons (no specials): episode count and TMDB's season overview. */
  seasonsInfo?: { number: number; episodeCount: number; overview?: string }[];
  /** Total episode count across all seasons, from TMDB's number_of_episodes. */
  totalEpisodes?: number;
  /** Next episode TMDB has scheduled to air for this series, if any. */
  nextEpisodeToAir?: { season: number; episode: number; title: string; airDate: string };
  // TMDB-sourced catalog metadata (optional — only present for TMDB-backed
  // media). posterPath/backdropPath are TMDB relative paths, combine with
  // tmdbImageUrl() from src/lib/tmdb.ts to get a full image URL.
  tmdbId?: number;
  posterPath?: string | null;
  backdropPath?: string | null;
  /** YouTube video id for the official trailer, when TMDB has one. */
  trailerKey?: string | null;
  /** Top billed cast members, when TMDB has credits data. */
  cast?: { id: number; name: string; profilePath: string | null }[];
  /** Real streaming ("flatrate") providers from TMDB's watch/providers, for
   * the configured region (defaults to FR, falls back to US). Empty/absent
   * when TMDB has no streaming data for this title in that region. */
  watchProviders?: { providerName: string; logoPath: string | null }[];
  /** TMDB's single "where to watch" link for this title in the resolved
   * region (FR primary, US fallback) — same one link for every provider row,
   * TMDB doesn't give a per-provider deep link. */
  watchProvidersLink?: string;
  /** Raw release date (movie release_date / TV first_air_date), ISO
   * "YYYY-MM-DD", when available. */
  releaseDate?: string;
  /** Movies only, detail fetch only: still showing in cinemas in the
   * watch region (released theatrically there within the last 8 weeks). */
  inTheaters?: boolean;
  /** Rewind's own members' average rating (1–5) and count, kept apart from
   * TMDB's communityRating/ratingCount. Detail fetch only. */
  rewindRating?: number;
  rewindRatingCount?: number;
}

export interface Episode {
  id: string;
  seriesId: string;
  season: number;
  number: number;
  title: string;
  runtimeMinutes: number;
  /** TMDB episode overview, when it has one. */
  synopsis?: string;
  rating?: number;
  ratingCount?: number;
  watched: boolean;
  airDate?: string;
  tmdbId?: number;
  stillPath?: string | null;
  /** The signed-in user's own rating for this episode, if they've given one. */
  userRating?: number;
  /** Rewind members' average and count for this episode (detail fetch only). */
  rewindRating?: number;
  rewindRatingCount?: number;
}

export interface Person {
  id: string;
  name: string;
  color?: string;
}

export interface WhereToWatch {
  provider: string;
  actionLabel: string;
}

export interface CommentModel {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface Friend {
  /** The friend's Firebase uid. */
  id: string;
  name: string;
  xp: number;
  username?: string;
  avatarColor?: string;
  avatarIcon?: string;
  avatarImage?: string;
}

export interface ActivityItem {
  id: string;
  friendName: string;
  action: string;
  timeAgo: string;
  mediaTitle: string;
  artworkColor: string;
  rating?: number;
  likeCount: number;
  friendAvatarColor?: string;
  friendAvatarIcon?: string;
  friendAvatarImage?: string;
  mediaId?: string;
}

export interface UpcomingEpisode {
  id: string;
  seriesTitle: string;
  /** "movie" for a watchlisted movie's own release date — season/episode don't apply. Defaults to "episode" when absent. */
  kind?: "episode" | "movie" | "game";
  /** Full image URL (game covers) when there's no TMDB poster path. */
  imageUrl?: string;
  season?: number;
  episode?: number;
  airDate: string;
  artworkColor: string;
  posterPath?: string | null;
}

export interface ListModel {
  id: string;
  name: string;
  mediaIds: string[];
}

export interface HistoryEntry {
  id: string;
  label: string;
  timeLabel: string;
  /** What this entry is for, so unmarking can remove it again. A movie entry
   * has only mediaId; an episode/season entry has the episode ids it covers.
   * Absent on entries logged before these fields existed (label-matched). */
  mediaId?: string;
  episodeIds?: string[];
  /** Game play time logged by this entry ("Played"). */
  hours?: number;
}

export type HistoryRef = { mediaId: string; episodeIds?: string[] };

export interface Challenge {
  id: string;
  label: string;
  current: number;
  total: number;
  xpReward: number;
}

export interface UserProfile {
  id: string;
  firstName: string;
  /** Unique @handle (lowercase, no @), chosen at sign-up. Absent on accounts
   * created before usernames existed — they're asked for one on Friends. */
  username?: string;
  bio?: string;
  avatarColor: string;
  /** Icon key from AVATAR_ICONS (src/design-system/icons.tsx), when the user picked "Icon" mode. Absent = initials mode. */
  avatarIcon?: string;
  /** Small JPEG data URI (256px square) when the user picked a photo; wins
   * over icon/initials. */
  avatarImage?: string;
  /** Profile banner rendering mode. Absent/"favorites" = show favorited series artwork. */
  bannerMode?: "favorites" | "image";
  /** Local device URI for an imported banner image (client-only — not uploaded to storage, won't sync/survive reinstall). */
  bannerImageUri?: string;
  level: number;
  levelName: string;
  xp: number;
  xpToNext: number;
  moviesCount: number;
  seriesCount: number;
  episodesCount: number;
  hoursWatched: number;
  dayStreak: number;
  bestStreak: number;
  /** Video games (0 for movie-only accounts). */
  gamesCount?: number;
  gamesCompleted?: number;
  hoursPlayed?: number;
  /** Computed with the profile so they refresh with every watch/rate. */
  dailyChallenges?: Challenge[];
  weeklyChallenges?: Challenge[];
  achievementGroups?: { category: string; items: (Challenge & { achieved: boolean })[] }[];
}
