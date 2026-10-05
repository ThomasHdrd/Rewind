import { Episode, Media, WatchStatus } from "@/types/media";
import { CatalogPage, CatalogQuery, MediaRepository } from "./types";
import { tmdbFetch } from "@/lib/tmdb";
import { mapTmdbEpisode, mapTmdbMovie, mapTmdbTv } from "@/data/tmdb/mappers";
import { TmdbListResponse, TmdbMovie, TmdbSeason, TmdbTv } from "@/data/tmdb/types";
import { personalMediaStore } from "./firestore";
import { auth } from "@/lib/firebase";
import { getUserDoc, seriesIdFromEpisodeId, UserDoc, watchedSeriesIds } from "./firestoreUser";
import { getRatingAggregate } from "./mediaRatings";
import { GENRE_TMDB_IDS } from "@/lib/genres";
import { PLATFORM_PROVIDER_IDS, watchRegion } from "@/lib/platforms";
import { deriveEffectiveStatus, isAwaitingUnreleasedEpisode } from "@/domain/watchStatus";

// TMDB is a read-only catalog source: it never stores anything about the
// user. Any status/rating the user sets is written to Firestore (via
// personalMediaStore, see ./firestore.ts) keyed by our composite
// "movie:<tmdbId>" / "tv:<tmdbId>" id — TMDB is only consulted for catalog
// metadata (title, artwork, genres, episodes).
// Strict: exactly "movie:<n>" or "tv:<n>". Episode ids ("tv:1429:s1e2") must
// NOT parse — splitting on ":" and ignoring the rest used to turn every
// rated episode (stored in mediaStatus under its episode id) into its whole
// series, which duplicated series in My Library.
function parseId(id: string): { kind: "movie" | "tv"; tmdbId: number } {
  const match = id.match(/^(movie|tv):(\d+)$/);
  if (!match) throw new Error(`Not a TMDB-backed media id: ${id}`);
  return { kind: match[1] as "movie" | "tv", tmdbId: Number(match[2]) };
}

// Single doc fetch (not one getStatusAndRating() call per item) so a whole
// list hydrates from one consistent snapshot. For series, the raw stored
// status is never trusted as-is — it's re-derived from the real watched-
// episode count every time, the same self-correction listContinueWatching()
// already relies on. This is deliberate, not just an optimization: keeping
// every write path that can flip a series to/from "watching" perfectly in
// sync (undo, bulk mark/unmark, rapid taps, episode-detail toggle, and any
// path yet to be added) turned out to be exactly the kind of fragile,
// easy-to-miss bookkeeping that this codebase's "effective status" pattern
// exists to avoid — so status is now always computed at read time from
// what's actually true (episode watched flags) instead of relied on to
// have been correctly maintained at every write site.
// Start reading the user doc right away, IN PARALLEL with the TMDB request,
// instead of only after TMDB answered (two round trips back to back).
function startPersonalRead(): Promise<UserDoc | null> {
  const uid = auth.currentUser?.uid;
  return uid ? getUserDoc(uid).catch(() => null) : Promise.resolve(null);
}

async function hydratePersonal(list: Media[], personal: Promise<UserDoc | null> = startPersonalRead()): Promise<Media[]> {
  const doc = await personal;
  if (!doc) return list;
  return list.map((m) => {
    const entry = doc.mediaStatus[m.id] ?? {};
    if (m.kind === "movie") return { ...m, status: entry.status, userRating: entry.rating };
    const watchedEpisodeCount = Object.entries(doc.episodesWatched).filter(
      ([episodeId, watched]) => watched && seriesIdFromEpisodeId(episodeId) === m.id
    ).length;
    const status = deriveEffectiveStatus({ kind: m.kind, status: entry.status, totalEpisodes: m.totalEpisodes }, watchedEpisodeCount);
    return { ...m, status, userRating: entry.rating };
  });
}

export class TmdbMediaRepository implements MediaRepository {
  async listTrending(): Promise<Media[]> {
    const personal = startPersonalRead();
    const [movies, tv] = await Promise.all([
      tmdbFetch<TmdbListResponse<TmdbMovie>>("/trending/movie/week"),
      tmdbFetch<TmdbListResponse<TmdbTv>>("/trending/tv/week"),
    ]);
    const media = [...movies.results.map(mapTmdbMovie), ...tv.results.map(mapTmdbTv)];
    return hydratePersonal(media, personal);
  }

  // Deliberately a different TMDB source than listTrending(): "New" just
  // re-sorts trending titles by year, but "Coming soon" needs actual
  // not-yet-released titles, otherwise both tabs show the same trending set.
  async listComingSoon(): Promise<Media[]> {
    const personal = startPersonalRead();
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
    return hydratePersonal(media, personal);
  }

  async browseCatalog(q: CatalogQuery, page: number): Promise<CatalogPage> {
    const personal = startPersonalRead();
    const today = new Date().toISOString().slice(0, 10);
    const ANIME_KEYWORD = 210024; // TMDB keyword "anime" — real anime, not all animation

    // Default view: this week's trending, paged.
    if (q.sort === "trending" && q.kind === "all" && q.genres.length === 0 && q.platforms.length === 0) {
      const resp = await tmdbFetch<TmdbListResponse<TmdbMovie & TmdbTv & { media_type?: string }>>("/trending/all/week", { page });
      const items = resp.results
        .filter((r) => r.media_type === "movie" || r.media_type === "tv")
        .map((r) => (r.media_type === "movie" ? mapTmdbMovie(r) : mapTmdbTv(r)));
      return { items: await hydratePersonal(items, personal), hasMore: page < Math.min(resp.total_pages ?? 1, 500) };
    }

    const movieGenres = new Set<number>();
    const tvGenres = new Set<number>();
    for (const g of q.genres) {
      GENRE_TMDB_IDS[g]?.movie.forEach((id) => movieGenres.add(id));
      GENRE_TMDB_IDS[g]?.tv.forEach((id) => tvGenres.add(id));
    }
    // A genre that only exists on one side (e.g. Horror has no TV genre) must
    // not fall back to an unfiltered query on the other side.
    const wantMovies = q.kind !== "series" && (q.genres.length === 0 || movieGenres.size > 0);
    const wantTv = q.kind !== "movie" && (q.genres.length === 0 || tvGenres.size > 0);

    const sortParams = (dateField: string): Record<string, string | number> => {
      if (q.sort === "new")
        return { sort_by: `${dateField}.desc`, [`${dateField}.lte`]: today, "vote_count.gte": 20 };
      if (q.sort === "coming-soon") return { sort_by: "popularity.desc", [`${dateField}.gte`]: today };
      return { sort_by: "popularity.desc", "vote_count.gte": 50 };
    };
    const anime = q.kind === "anime" ? { with_keywords: ANIME_KEYWORD } : {};
    // "On Netflix / Prime…": included in the subscription, in the viewer's region.
    const providerIds = Array.from(new Set(q.platforms.flatMap((p) => PLATFORM_PROVIDER_IDS[p] ?? [])));
    const onPlatforms = providerIds.length
      ? { with_watch_providers: providerIds.join("|"), watch_region: watchRegion(), with_watch_monetization_types: "flatrate" }
      : {};
    const [movies, tv] = await Promise.all([
      wantMovies
        ? tmdbFetch<TmdbListResponse<TmdbMovie>>("/discover/movie", {
            page,
            ...sortParams("primary_release_date"),
            ...anime,
            ...onPlatforms,
            with_genres: movieGenres.size ? Array.from(movieGenres).join("|") : undefined,
          })
        : null,
      wantTv
        ? tmdbFetch<TmdbListResponse<TmdbTv>>("/discover/tv", {
            page,
            ...sortParams("first_air_date"),
            ...anime,
            ...onPlatforms,
            with_genres: tvGenres.size ? Array.from(tvGenres).join("|") : undefined,
          })
        : null,
    ]);
    const movieList = movies?.results.map(mapTmdbMovie) ?? [];
    const tvList = tv?.results.map(mapTmdbTv) ?? [];
    // Interleave so "All" mixes movies and series instead of all movies first.
    const mixed: Media[] = [];
    for (let i = 0; i < Math.max(movieList.length, tvList.length); i++) {
      if (movieList[i]) mixed.push(movieList[i]);
      if (tvList[i]) mixed.push(tvList[i]);
    }
    // TMDB serves at most 500 pages per query.
    const hasMore = page < Math.min(500, Math.max(movies?.total_pages ?? 0, tv?.total_pages ?? 0));
    return { items: await hydratePersonal(mixed, personal), hasMore };
  }

  async listForYou(preferences: { genres: string[]; platforms: string[] }): Promise<Media[]> {
    const personal = startPersonalRead();
    const movieGenres = new Set<number>();
    const tvGenres = new Set<number>();
    for (const g of preferences.genres) {
      GENRE_TMDB_IDS[g]?.movie.forEach((id) => movieGenres.add(id));
      GENRE_TMDB_IDS[g]?.tv.forEach((id) => tvGenres.add(id));
    }
    const providers = Array.from(new Set(preferences.platforms.flatMap((p) => PLATFORM_PROVIDER_IDS[p] ?? [])));
    if (movieGenres.size === 0 && tvGenres.size === 0 && providers.length === 0) return [];

    // "|" is TMDB's OR: any of the user's genres, on any of their platforms.
    // flatrate = included in the subscription (not rent/buy). The vote floor
    // keeps obscure, barely-rated titles out of a "picked for you" row.
    const common = {
      sort_by: "popularity.desc",
      "vote_count.gte": 100,
      ...(providers.length
        ? { with_watch_providers: providers.join("|"), watch_region: watchRegion(), with_watch_monetization_types: "flatrate" }
        : {}),
    };
    // A genre picked only on the movie side (e.g. Horror: TMDB TV has no such
    // genre) must not fall back to an unfiltered TV query.
    const wantMovies = movieGenres.size > 0 || preferences.genres.length === 0;
    const wantTv = tvGenres.size > 0 || preferences.genres.length === 0;
    const [movies, tv] = await Promise.all([
      wantMovies
        ? tmdbFetch<TmdbListResponse<TmdbMovie>>("/discover/movie", {
            ...common,
            with_genres: movieGenres.size ? Array.from(movieGenres).join("|") : undefined,
          })
        : null,
      wantTv
        ? tmdbFetch<TmdbListResponse<TmdbTv>>("/discover/tv", {
            ...common,
            with_genres: tvGenres.size ? Array.from(tvGenres).join("|") : undefined,
          })
        : null,
    ]);
    const movieList = movies?.results.map(mapTmdbMovie) ?? [];
    const tvList = tv?.results.map(mapTmdbTv) ?? [];
    // Interleave so the row mixes movies and series instead of all movies first.
    const mixed: Media[] = [];
    for (let i = 0; i < Math.max(movieList.length, tvList.length); i++) {
      if (movieList[i]) mixed.push(movieList[i]);
      if (tvList[i]) mixed.push(tvList[i]);
    }
    // Already-watched titles aren't recommendations.
    return (await hydratePersonal(mixed, personal)).filter((m) => m.status !== "watched");
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
    const personal = startPersonalRead();
    const q = query.trim();
    if (!q) return [];
    const [movies, tv] = await Promise.all([
      tmdbFetch<TmdbListResponse<TmdbMovie>>("/search/movie", { query: q }),
      tmdbFetch<TmdbListResponse<TmdbTv>>("/search/tv", { query: q }),
    ]);
    const media = [...movies.results.map(mapTmdbMovie), ...tv.results.map(mapTmdbTv)];
    return hydratePersonal(media, personal);
  }

  async getById(id: string): Promise<Media | undefined> {
    const personal = startPersonalRead();
    try {
      const { kind, tmdbId } = parseId(id);
      // Started now, awaited last: runs alongside the TMDB + user-doc reads.
      const aggregate = getRatingAggregate(id).catch(() => null);
      let media: Media;
      if (kind === "movie") {
        const movie = await tmdbFetch<TmdbMovie>(`/movie/${tmdbId}`, {
          append_to_response: "videos,credits,watch/providers,release_dates",
        });
        [media] = await hydratePersonal([mapTmdbMovie(movie)], personal);
      } else {
        const tv = await tmdbFetch<TmdbTv>(`/tv/${tmdbId}`, {
          append_to_response: "videos,credits,watch/providers",
        });
        [media] = await hydratePersonal([mapTmdbTv(tv)], personal);
      }
      // Overlay Rewind's own community aggregate (real users rating inside
      // this app) over TMDB's number once at least one Rewind user has
      // rated this title — only done here (single-item fetch), not in bulk
      // list hydration, so browsing a big list doesn't add N extra reads.
      // Kept SEPARATE from TMDB's score: overwriting it meant one person's
      // first rating became "the community rating" (their own score, 1
      // rating). The UI shows TMDB as the community score and adds the
      // Rewind members' average once enough of them have rated.
      const rewindAggregate = await aggregate;
      if (rewindAggregate) {
        media.rewindRating = rewindAggregate.average;
        media.rewindRatingCount = rewindAggregate.count;
      }
      return media;
    } catch {
      return undefined;
    }
  }

  async getRecommendations(id: string): Promise<Media[]> {
    const personal = startPersonalRead();
    try {
      const { kind, tmdbId } = parseId(id);
      if (kind === "movie") {
        const resp = await tmdbFetch<TmdbListResponse<TmdbMovie>>(`/movie/${tmdbId}/recommendations`);
        return hydratePersonal(resp.results.map(mapTmdbMovie), personal);
      }
      const resp = await tmdbFetch<TmdbListResponse<TmdbTv>>(`/tv/${tmdbId}/recommendations`);
      return hydratePersonal(resp.results.map(mapTmdbTv), personal);
    } catch {
      return [];
    }
  }

  async getEpisodes(seriesId: string, season = 1): Promise<Episode[]> {
    const { kind, tmdbId } = parseId(seriesId);
    if (kind !== "tv") return [];
    const seasonData = await tmdbFetch<TmdbSeason>(`/tv/${tmdbId}/season/${season}`);
    const episodes = (seasonData.episodes ?? []).map((e) => mapTmdbEpisode(seriesId, e));
    // ONE read of the user doc for the whole season. This used to do two
    // full-doc reads PER EPISODE (watched + rating); on a long show (One
    // Piece seasons run 60+ episodes) and with Home walking seasons to find
    // the next episode, that fired hundreds of Firestore reads at once,
    // starving every other request — detail pages stayed blank for ~30 s.
    const uid = auth.currentUser?.uid;
    const doc = uid ? await getUserDoc(uid) : null;
    return episodes.map((e) => ({
      ...e,
      watched: !!doc?.episodesWatched[e.id],
      userRating: doc?.mediaStatus[e.id]?.rating,
    }));
  }

  async getEpisodeById(episodeId: string): Promise<Episode | undefined> {
    // episodeId shape: "tv:<id>:s<season>e<number>"
    const match = episodeId.match(/^tv:(\d+):s(\d+)e(\d+)$/);
    if (!match) return undefined;
    const [, tvId, season] = match;
    const [episodes, aggregate] = await Promise.all([
      this.getEpisodes(`tv:${tvId}`, Number(season)),
      getRatingAggregate(episodeId).catch(() => null),
    ]);
    const episode = episodes.find((e) => e.id === episodeId && String(e.season) === season);
    if (!episode) return undefined;
    return aggregate ? { ...episode, rewindRating: aggregate.average, rewindRatingCount: aggregate.count } : episode;
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

  async getSeriesWatchedEpisodeCount(seriesId: string): Promise<number> {
    return personalMediaStore.getSeriesWatchedEpisodeCount(seriesId);
  }
}
