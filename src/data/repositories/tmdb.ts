import { Episode, Media, WatchStatus } from "@/types/media";
import { MediaRepository } from "./types";
import { tmdbFetch } from "@/lib/tmdb";
import { mapTmdbEpisode, mapTmdbMovie, mapTmdbTv } from "@/data/tmdb/mappers";
import { TmdbListResponse, TmdbMovie, TmdbSeason, TmdbTv } from "@/data/tmdb/types";
import { personalMediaStore } from "./firestore";
import { auth } from "@/lib/firebase";
import { getUserDoc, seriesIdFromEpisodeId, watchedSeriesIds } from "./firestoreUser";
import { deriveEffectiveStatus, isAwaitingUnreleasedEpisode } from "@/domain/watchStatus";

// TMDB is a read-only catalog source: it never stores anything about the
// user. Any status/rating the user sets is written to Firestore (via
// personalMediaStore, see ./firestore.ts) keyed by our composite
// "movie:<tmdbId>" / "tv:<tmdbId>" id — TMDB is only consulted for catalog
// metadata (title, artwork, genres, episodes).
function parseId(id: string): { kind: "movie" | "tv"; tmdbId: number } {
  const [kind, rest] = id.split(":");
  if ((kind !== "movie" && kind !== "tv") || !rest) {
    throw new Error(`Not a TMDB-backed media id: ${id}`);
  }
  return { kind, tmdbId: Number(rest) };
}

async function hydratePersonal(list: Media[]): Promise<Media[]> {
  return Promise.all(
    list.map(async (m) => {
      const { status, rating } = await personalMediaStore.getStatusAndRating(m.id);
      return { ...m, status, userRating: rating };
    })
  );
}

export class TmdbMediaRepository implements MediaRepository {
  async listTrending(): Promise<Media[]> {
    const [movies, tv] = await Promise.all([
      tmdbFetch<TmdbListResponse<TmdbMovie>>("/trending/movie/week"),
      tmdbFetch<TmdbListResponse<TmdbTv>>("/trending/tv/week"),
    ]);
    const media = [...movies.results.map(mapTmdbMovie), ...tv.results.map(mapTmdbTv)];
    return hydratePersonal(media);
  }

  // Deliberately a different TMDB source than listTrending(): "New" just
  // re-sorts trending titles by year, but "Coming soon" needs actual
  // not-yet-released titles, otherwise both tabs show the same trending set.
  async listComingSoon(): Promise<Media[]> {
    const today = new Date().toISOString().slice(0, 10);
    const [movies, tv] = await Promise.all([
      // /movie/upcoming is a small, chronologically-ordered, region-limited
      // list — it often misses the big anticipated titles further out.
      // /discover/movie with a future release-date floor, sorted by
      // popularity, surfaces the major upcoming releases instead.
      tmdbFetch<TmdbListResponse<TmdbMovie>>("/discover/movie", {
        "primary_release_date.gte": today,
        sort_by: "popularity.desc",
      }),
      // TMDB has no endpoint for "TV shows not yet released" directly, but
      // /discover/tv with first_air_date.gte=today gives exactly that: shows
      // whose first episode hasn't aired yet. Sorted by popularity so major
      // anticipated series surface first, not just whatever airs soonest.
      tmdbFetch<TmdbListResponse<TmdbTv>>("/discover/tv", {
        "first_air_date.gte": today,
        sort_by: "popularity.desc",
      }),
    ]);
    // /discover/movie's date floor is inclusive and TMDB's release-date data
    // can be noisy near the boundary, so filter to strictly-future dates too.
    const upcomingMovies = movies.results.filter((m) => !!m.release_date && m.release_date > today);
    const media = [...upcomingMovies.map(mapTmdbMovie), ...tv.results.map(mapTmdbTv)];
    return hydratePersonal(media);
  }

  async listContinueWatching(): Promise<Media[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    const doc = await getUserDoc(uid);
    // Candidates: anything raw-flagged "watching" (covers movies, which have
    // no progress concept), plus every series with at least one watched
    // episode — INCLUDING ones already flagged "watched" in mediaStatus.
    // That flag is write-time-only and nothing ever downgrades it, so a
    // series that was ever mistakenly (or prematurely, e.g. after finishing
    // just one season of a long-running show) marked "watched" needs to
    // still be considered here — deriveEffectiveStatus below re-derives the
    // real status from actual episode counts and self-corrects it. Excluding
    // raw-"watched" series from the candidate list up front (the previous
    // bug) meant that self-correction never got a chance to run.
    const rawWatchingIds = Object.entries(doc.mediaStatus)
      .filter(([, v]) => v.status === "watching")
      .map(([id]) => id);
    const candidateIds = Array.from(new Set([...rawWatchingIds, ...watchedSeriesIds(doc)]));
    const items = await Promise.all(candidateIds.map((id) => this.getById(id)));
    const media = items.filter((m): m is Media => !!m);
    const withEffectiveStatus = media.map((m) => {
      const watchedEpisodeCount = Object.entries(doc.episodesWatched).filter(
        ([episodeId, watched]) => watched && seriesIdFromEpisodeId(episodeId) === m.id
      ).length;
      return { ...m, watchedEpisodeCount, status: deriveEffectiveStatus(m, watchedEpisodeCount) };
    });
    return withEffectiveStatus
      .filter(
        (m) => m.status === "watching" && !isAwaitingUnreleasedEpisode(m, m.watchedEpisodeCount)
      )
      .map(({ watchedEpisodeCount, ...m }) => m);
  }

  async search(query: string): Promise<Media[]> {
    const q = query.trim();
    if (!q) return [];
    const [movies, tv] = await Promise.all([
      tmdbFetch<TmdbListResponse<TmdbMovie>>("/search/movie", { query: q }),
      tmdbFetch<TmdbListResponse<TmdbTv>>("/search/tv", { query: q }),
    ]);
    const media = [...movies.results.map(mapTmdbMovie), ...tv.results.map(mapTmdbTv)];
    return hydratePersonal(media);
  }

  async getById(id: string): Promise<Media | undefined> {
    try {
      const { kind, tmdbId } = parseId(id);
      if (kind === "movie") {
        const movie = await tmdbFetch<TmdbMovie>(`/movie/${tmdbId}`, {
          append_to_response: "videos,credits,watch/providers",
        });
        const [media] = await hydratePersonal([mapTmdbMovie(movie)]);
        return media;
      }
      const tv = await tmdbFetch<TmdbTv>(`/tv/${tmdbId}`, {
        append_to_response: "videos,credits,watch/providers",
      });
      const [media] = await hydratePersonal([mapTmdbTv(tv)]);
      return media;
    } catch {
      return undefined;
    }
  }

  async getRecommendations(id: string): Promise<Media[]> {
    try {
      const { kind, tmdbId } = parseId(id);
      if (kind === "movie") {
        const resp = await tmdbFetch<TmdbListResponse<TmdbMovie>>(`/movie/${tmdbId}/recommendations`);
        return hydratePersonal(resp.results.map(mapTmdbMovie));
      }
      const resp = await tmdbFetch<TmdbListResponse<TmdbTv>>(`/tv/${tmdbId}/recommendations`);
      return hydratePersonal(resp.results.map(mapTmdbTv));
    } catch {
      return [];
    }
  }

  async getEpisodes(seriesId: string, season = 1): Promise<Episode[]> {
    const { kind, tmdbId } = parseId(seriesId);
    if (kind !== "tv") return [];
    const seasonData = await tmdbFetch<TmdbSeason>(`/tv/${tmdbId}/season/${season}`);
    const episodes = (seasonData.episodes ?? []).map((e) => mapTmdbEpisode(seriesId, e));
    const withWatched = await Promise.all(
      episodes.map(async (e) => ({ ...e, watched: await personalMediaStore.isEpisodeWatched(e.id) }))
    );
    return withWatched;
  }

  async getEpisodeById(episodeId: string): Promise<Episode | undefined> {
    // episodeId shape: "tv:<id>:s<season>e<number>"
    const match = episodeId.match(/^tv:(\d+):s(\d+)e(\d+)$/);
    if (!match) return undefined;
    const [, tvId, season] = match;
    const episodes = await this.getEpisodes(`tv:${tvId}`, Number(season));
    return episodes.find((e) => e.id === episodeId && String(e.season) === season);
  }

  async setWatchStatus(mediaId: string, status: WatchStatus | null): Promise<void> {
    await personalMediaStore.setWatchStatus(mediaId, status);
  }

  async setUserRating(mediaId: string, rating: number): Promise<void> {
    await personalMediaStore.setUserRating(mediaId, rating);
  }

  async toggleEpisodeWatched(episodeId: string): Promise<void> {
    await personalMediaStore.toggleEpisodeWatched(episodeId);
  }

  async setEpisodesWatched(episodeIds: string[], watched: boolean): Promise<void> {
    await personalMediaStore.setEpisodesWatched(episodeIds, watched);
  }
}
