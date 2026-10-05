// Minimal typed shapes for the TMDB endpoints this app consumes. Not
// exhaustive — only the fields we actually map into src/types/media.ts.
export interface TmdbListResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official?: boolean;
}

export interface TmdbVideosResponse {
  results: TmdbVideo[];
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
}

export interface TmdbCredits {
  cast: TmdbCastMember[];
}

// One TMDB /watch/providers entry (movie or tv), region-keyed. Only the
// "flatrate" (subscription-streaming) list is consumed by the app — rent/buy
// aren't surfaced to keep the "Where to watch" section simple.
export interface TmdbWatchProviderEntry {
  provider_name: string;
  logo_path: string | null;
}

export interface TmdbWatchProviderRegion {
  link?: string;
  flatrate?: TmdbWatchProviderEntry[];
  rent?: TmdbWatchProviderEntry[];
  buy?: TmdbWatchProviderEntry[];
}

export interface TmdbWatchProvidersResponse {
  results: Record<string, TmdbWatchProviderRegion>;
}

export interface TmdbMovie {
  id: number;
  title: string;
  overview?: string;
  release_date?: string;
  genre_ids?: number[];
  genres?: TmdbGenre[];
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  runtime?: number;
  videos?: TmdbVideosResponse;
  credits?: TmdbCredits;
  "watch/providers"?: TmdbWatchProvidersResponse;
  /** append_to_response=release_dates: per-country release list. type 2 =
   * limited theatrical, 3 = theatrical, 4 = digital, 5 = physical, 6 = TV. */
  release_dates?: {
    results: { iso_3166_1: string; release_dates: { release_date: string; type: number }[] }[];
  };
}

export interface TmdbTv {
  id: number;
  name: string;
  overview?: string;
  first_air_date?: string;
  genre_ids?: number[];
  genres?: TmdbGenre[];
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  /** Per-season summary (season 0 = specials). */
  seasons?: { season_number: number; episode_count: number; name?: string; overview?: string; air_date?: string | null }[];
  videos?: TmdbVideosResponse;
  credits?: TmdbCredits;
  "watch/providers"?: TmdbWatchProvidersResponse;
  next_episode_to_air?: {
    air_date?: string;
    episode_number: number;
    season_number: number;
    name: string;
  } | null;
}

export interface TmdbSeason {
  season_number: number;
  episodes: TmdbEpisode[];
}

export interface TmdbEpisode {
  id: number;
  season_number: number;
  episode_number: number;
  name: string;
  runtime?: number | null;
  vote_average?: number;
  vote_count?: number;
  air_date?: string;
  overview?: string;
  still_path?: string | null;
}
