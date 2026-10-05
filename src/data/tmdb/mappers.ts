import { Episode, Media } from "@/types/media";
import { TmdbCredits, TmdbEpisode, TmdbMovie, TmdbTv, TmdbVideosResponse, TmdbWatchProvidersResponse } from "./types";

// The owner is French (matches the "CGR"/"Pathé Gaumont" cinema chains
// already hardcoded on the movie screen), so default the watch-providers
// region to FR, falling back to US when TMDB has no FR data for a title.
const WATCH_PROVIDER_REGION_PRIMARY = "FR";
const WATCH_PROVIDER_REGION_FALLBACK = "US";

function pickWatchProviderRegion(resp?: TmdbWatchProvidersResponse) {
  return resp?.results?.[WATCH_PROVIDER_REGION_PRIMARY] ?? resp?.results?.[WATCH_PROVIDER_REGION_FALLBACK];
}

function pickWatchProviders(resp?: TmdbWatchProvidersResponse): Media["watchProviders"] {
  const flatrate = pickWatchProviderRegion(resp)?.flatrate ?? [];
  if (flatrate.length === 0) return undefined;
  return flatrate.map((p) => ({ providerName: p.provider_name, logoPath: p.logo_path ?? null }));
}

function pickWatchProvidersLink(resp?: TmdbWatchProvidersResponse): Media["watchProvidersLink"] {
  return pickWatchProviderRegion(resp)?.link;
}

const CAST_LIMIT = 8;

function mapCast(credits?: TmdbCredits): Media["cast"] {
  const cast = credits?.cast ?? [];
  return cast.slice(0, CAST_LIMIT).map((c) => ({ id: c.id, name: c.name, profilePath: c.profile_path ?? null }));
}

// Picks the best official YouTube trailer out of TMDB's videos list, falling
// back to any YouTube "Trailer" if nothing is marked official.
function pickTrailerKey(videos?: TmdbVideosResponse): string | null {
  const list = videos?.results ?? [];
  const youtubeTrailers = list.filter((v) => v.site === "YouTube" && v.type === "Trailer");
  return youtubeTrailers.find((v) => v.official)?.key ?? youtubeTrailers[0]?.key ?? null;
}

// TMDB's official genre id -> name lists (stable, documented by TMDB).
// Fetching /genre/movie/list and /genre/tv/list would be more "live" but
// these ids have been stable for years and avoid an extra round trip on
// every catalog screen.
export const MOVIE_GENRES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

export const TV_GENRES: Record<number, string> = {
  10759: "Action & Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  10762: "Kids",
  9648: "Mystery",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
  37: "Western",
};

const genreNames = (map: Record<number, string>, genres?: { id: number; name: string }[], ids?: number[]) => {
  if (genres && genres.length) return genres.map((g) => g.name);
  if (ids && ids.length) return ids.map((id) => map[id]).filter(Boolean) as string[];
  return [];
};

// A stable, deterministic placeholder color derived from the tmdb id, used
// as the Artwork fallback while a real poster image loads (or is missing).
export function colorForId(id: number): string {
  const palette = ["#274257", "#8B4A43", "#3D5A6C", "#5B3A5C", "#3E2F1C", "#1E4A45", "#4A3B7A", "#6B4226"];
  return palette[id % palette.length];
}

// A typical French theatrical run is 4–8 weeks; past that a film is
// effectively out of cinemas even if a few screens still show it.
const THEATRICAL_RUN_DAYS = 56;

function isInTheaters(m: TmdbMovie): boolean | undefined {
  const regions = m.release_dates?.results;
  if (!regions) return undefined; // not fetched (list results)
  const region =
    regions.find((r) => r.iso_3166_1 === WATCH_PROVIDER_REGION_PRIMARY) ??
    regions.find((r) => r.iso_3166_1 === WATCH_PROVIDER_REGION_FALLBACK);
  const theatrical = (region?.release_dates ?? [])
    .filter((d) => d.type === 2 || d.type === 3)
    .map((d) => new Date(d.release_date).getTime())
    .filter((t) => !isNaN(t));
  if (theatrical.length === 0) return false;
  const opened = Math.min(...theatrical);
  const now = Date.now();
  return opened <= now && now - opened <= THEATRICAL_RUN_DAYS * 86400000;
}

export function mapTmdbMovie(m: TmdbMovie): Media {
  return {
    id: `movie:${m.id}`,
    title: m.title,
    kind: "movie",
    year: m.release_date ? Number(m.release_date.slice(0, 4)) || 0 : 0,
    genres: genreNames(MOVIE_GENRES, m.genres, m.genre_ids),
    runtimeMinutes: m.runtime,
    artworkColor: colorForId(m.id),
    synopsis: m.overview,
    communityRating: m.vote_average ? Math.round((m.vote_average / 2) * 10) / 10 : undefined,
    ratingCount: m.vote_count,
    releaseDate: m.release_date,
    tmdbId: m.id,
    posterPath: m.poster_path,
    backdropPath: m.backdrop_path,
    trailerKey: pickTrailerKey(m.videos),
    cast: mapCast(m.credits),
    watchProviders: pickWatchProviders(m["watch/providers"]),
    watchProvidersLink: pickWatchProvidersLink(m["watch/providers"]),
    inTheaters: isInTheaters(m),
  };
}

export function mapTmdbTv(t: TmdbTv): Media {
  return {
    id: `tv:${t.id}`,
    title: t.name,
    kind: "series",
    year: t.first_air_date ? Number(t.first_air_date.slice(0, 4)) || 0 : 0,
    genres: genreNames(TV_GENRES, t.genres, t.genre_ids),
    artworkColor: colorForId(t.id),
    synopsis: t.overview,
    communityRating: t.vote_average ? Math.round((t.vote_average / 2) * 10) / 10 : undefined,
    ratingCount: t.vote_count,
    seasons: t.number_of_seasons,
    totalEpisodes: t.number_of_episodes,
    seasonsInfo: t.seasons
      ?.filter((s) => s.season_number > 0)
      .map((s) => ({ number: s.season_number, episodeCount: s.episode_count, overview: s.overview || undefined })),
    releaseDate: t.first_air_date,
    nextEpisodeToAir:
      t.next_episode_to_air && t.next_episode_to_air.air_date
        ? {
            season: t.next_episode_to_air.season_number,
            episode: t.next_episode_to_air.episode_number,
            title: t.next_episode_to_air.name,
            airDate: t.next_episode_to_air.air_date,
          }
        : undefined,
    tmdbId: t.id,
    posterPath: t.poster_path,
    backdropPath: t.backdrop_path,
    trailerKey: pickTrailerKey(t.videos),
    cast: mapCast(t.credits),
    watchProviders: pickWatchProviders(t["watch/providers"]),
    watchProvidersLink: pickWatchProvidersLink(t["watch/providers"]),
  };
}

export function mapTmdbEpisode(seriesId: string, e: TmdbEpisode): Episode {
  return {
    id: `${seriesId}:s${e.season_number}e${e.episode_number}`,
    seriesId,
    season: e.season_number,
    number: e.episode_number,
    title: e.name,
    runtimeMinutes: e.runtime ?? 0,
    synopsis: e.overview || undefined,
    rating: e.vote_average ? Math.round((e.vote_average / 2) * 10) / 10 : undefined,
    ratingCount: e.vote_count,
    watched: false,
    airDate: e.air_date,
    tmdbId: e.id,
    stillPath: e.still_path,
  };
}
