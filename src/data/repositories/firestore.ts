import { auth } from "@/lib/firebase";
import {
  ActivityItem,
  Challenge,
  Friend,
  HistoryEntry,
  ListModel,
  UpcomingEpisode,
  UserProfile,
  WatchStatus,
} from "@/types/media";
import { SocialRepository, TrackingRepository, UserRepository } from "./types";
import {
  getUserDoc,
  patchUserDoc,
  setEpisodesWatchedBulk,
  setMediaStatus,
  toggleEpisodeWatched as toggleEpisodeWatchedDoc,
  toggleFavorite as toggleFavoriteDoc,
  watchedSeriesIds,
} from "./firestoreUser";
import { computeLevel, computeStreaks, computeWeeklyChallenges, computeXp } from "@/lib/rewards";
// Imported lazily (dynamic import) inside getProfile() below to avoid a
// circular import: ./index wires this file's classes together with
// TmdbMediaRepository, and TmdbMediaRepository (./tmdb) itself imports
// personalMediaStore from this file.

// Every method here reads/writes the signed-in user's own document
// (nowatchUsers/{uid}) in Firestore. This is the "real" per-user store that
// Part 1 (empty-state) and Part 3 (Firebase auth) connect through: a brand
// new uid has no document yet, so every list below comes back empty until
// the user actually creates data, which is exactly what makes the existing
// EmptyState UI show up with no screen changes needed.
function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("No signed-in user — this repository only works behind AuthGate.");
  return uid;
}

// Shared helper the TMDB-backed MediaRepository (src/data/repositories/tmdb.ts)
// delegates its personal-data methods to, keeping "TMDB never stores
// anything" true — status/ratings/episode-watched all live here instead.
export const personalMediaStore = {
  async getStatusAndRating(mediaId: string) {
    const uid = auth.currentUser?.uid;
    if (!uid) return {};
    const doc = await getUserDoc(uid);
    return doc.mediaStatus[mediaId] ?? {};
  },
  async getAllWatching(): Promise<string[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    const doc = await getUserDoc(uid);
    return Object.entries(doc.mediaStatus)
      .filter(([, v]) => v.status === "watching")
      .map(([mediaId]) => mediaId);
  },
  async isEpisodeWatched(episodeId: string): Promise<boolean> {
    const uid = auth.currentUser?.uid;
    if (!uid) return false;
    const doc = await getUserDoc(uid);
    return !!doc.episodesWatched[episodeId];
  },
  async setWatchStatus(mediaId: string, status: WatchStatus | null) {
    // mediaId is "movie:<tmdbId>" or "tv:<tmdbId>" for every TMDB-backed
    // media — cache that as "kind" alongside status so profile stats can be
    // computed without an extra fetch per tracked id.
    const kind = mediaId.startsWith("movie:") ? "movie" : mediaId.startsWith("tv:") ? "series" : undefined;
    await setMediaStatus(requireUid(), mediaId, { status, kind });
  },
  async setUserRating(mediaId: string, rating: number) {
    await setMediaStatus(requireUid(), mediaId, { rating });
  },
  async toggleEpisodeWatched(episodeId: string) {
    return toggleEpisodeWatchedDoc(requireUid(), episodeId);
  },
  async setEpisodesWatched(episodeIds: string[], watched: boolean) {
    await setEpisodesWatchedBulk(requireUid(), episodeIds, watched);
  },
};

export class FirestoreTrackingRepository implements TrackingRepository {
  async getUpcoming(): Promise<UpcomingEpisode[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    const doc = await getUserDoc(uid);
    const trackedIds = (kindWanted: "series" | "movie") =>
      Object.entries(doc.mediaStatus)
        .filter(([id, v]) => {
          const kind = v.kind ?? (id.startsWith("tv:") ? "series" : "movie");
          return kind === kindWanted && (v.status === "watchlist" || v.status === "watching");
        })
        .map(([id]) => id);
    const followedSeriesIds = trackedIds("series");
    // Watchlisted movies weren't included at all before — Upcoming only
    // ever considered series' next episodes, so a watchlisted movie with a
    // real future release date (e.g. "Avengers: Doomsday") never showed up
    // as a reminder even though the user explicitly tracked it.
    const watchlistedMovieIds = trackedIds("movie");
    if (followedSeriesIds.length === 0 && watchlistedMovieIds.length === 0) return [];

    const { mediaRepository } = await import("./index");
    const [seriesList, movieList] = await Promise.all([
      Promise.all(followedSeriesIds.map((id) => mediaRepository.getById(id))),
      Promise.all(watchlistedMovieIds.map((id) => mediaRepository.getById(id))),
    ]);

    const todayMs = Date.now();
    const upcoming: UpcomingEpisode[] = [];
    for (const media of seriesList) {
      if (!media?.nextEpisodeToAir) continue;
      const airMs = new Date(media.nextEpisodeToAir.airDate).getTime();
      if (isNaN(airMs) || airMs < todayMs) continue;
      upcoming.push({
        id: media.id,
        seriesTitle: media.title,
        kind: "episode",
        season: media.nextEpisodeToAir.season,
        episode: media.nextEpisodeToAir.episode,
        airDate: media.nextEpisodeToAir.airDate,
        artworkColor: media.artworkColor,
        posterPath: media.posterPath,
      });
    }
    for (const media of movieList) {
      if (!media?.releaseDate) continue;
      const airMs = new Date(media.releaseDate).getTime();
      if (isNaN(airMs) || airMs < todayMs) continue;
      upcoming.push({
        id: media.id,
        seriesTitle: media.title,
        kind: "movie",
        airDate: media.releaseDate,
        artworkColor: media.artworkColor,
        posterPath: media.posterPath,
      });
    }
    upcoming.sort((a, b) => new Date(a.airDate).getTime() - new Date(b.airDate).getTime());
    return upcoming;
  }
  async getHistory(): Promise<HistoryEntry[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    return (await getUserDoc(uid)).history;
  }
  async logWatch(mediaId: string): Promise<void> {
    const uid = requireUid();
    const current = await getUserDoc(uid);
    const entry: HistoryEntry = {
      id: `h-${Date.now()}`,
      label: mediaId,
      timeLabel: new Date().toLocaleString(),
    };
    await patchUserDoc(uid, { history: [entry, ...current.history] });
  }
}

export class FirestoreSocialRepository implements SocialRepository {
  async getFriends(): Promise<Friend[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    return (await getUserDoc(uid)).friends;
  }
  async getActivityFeed(): Promise<ActivityItem[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    return (await getUserDoc(uid)).activity;
  }
  async addFriend(): Promise<Friend> {
    const uid = requireUid();
    const current = await getUserDoc(uid);
    const friend: Friend = { id: `friend-${Date.now()}`, name: "New Friend", xp: 0 };
    await patchUserDoc(uid, { friends: [...current.friends, friend] });
    return friend;
  }
}

export class FirestoreUserRepository implements UserRepository {
  async getProfile(): Promise<UserProfile> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("No signed-in user");
    const doc = await getUserDoc(uid);

    const watchedEntries = Object.entries(doc.mediaStatus).filter(([, v]) => v.status === "watched");
    const watchedMovieIds = watchedEntries.filter(([id, v]) => (v.kind ?? (id.startsWith("movie:") ? "movie" : "series")) === "movie").map(([id]) => id);
    // Series have no single "watched" status — progress is tracked per
    // episode — so seriesCount comes from distinct series with at least one
    // watched episode, not from mediaStatus (which would always read 0).
    const seriesIdsFromMediaStatus = watchedEntries
      .filter(([id, v]) => (v.kind ?? (id.startsWith("movie:") ? "movie" : "series")) === "series")
      .map(([id]) => id);
    const seriesIdsFromEpisodes = watchedSeriesIds(doc);
    const watchedSeriesIdSet = new Set([...seriesIdsFromMediaStatus, ...seriesIdsFromEpisodes]);
    const episodesCount = Object.values(doc.episodesWatched).filter(Boolean).length;

    // hoursWatched: sum real runtimeMinutes for watched movies (fetched via
    // the catalog repository, same batching pattern as useTrackedGenres),
    // plus an estimated 45 min/episode for watched episodes — TMDB episode
    // runtimes aren't cheaply available in bulk here without a per-episode
    // fetch, so a typical-episode-length estimate is used instead.
    const AVG_EPISODE_MINUTES = 45;
    let movieMinutes = 0;
    if (watchedMovieIds.length > 0) {
      const { mediaRepository } = await import("./index");
      const movies = await Promise.all(watchedMovieIds.map((id) => mediaRepository.getById(id)));
      movieMinutes = movies.reduce((sum, m) => sum + (m?.runtimeMinutes ?? 0), 0);
    }
    const episodeMinutes = episodesCount * AVG_EPISODE_MINUTES;
    const hoursWatched = Math.round((movieMinutes + episodeMinutes) / 60);

    // XP/level/streaks are derived from real activity (episodes/movies
    // watched, watch-history dates) instead of a stored counter that nothing
    // ever incremented — that was the bug: xp/level/dayStreak/bestStreak
    // always read the doc's untouched defaults (0 / Level 1 / New Watcher)
    // no matter how much the user actually watched.
    const xp = computeXp(episodesCount, watchedMovieIds.length);
    const { level, levelName, xpToNext } = computeLevel(xp);
    const { dayStreak, bestStreak } = computeStreaks(doc.history);

    return {
      id: uid,
      ...doc.profile,
      moviesCount: watchedMovieIds.length,
      seriesCount: watchedSeriesIdSet.size,
      episodesCount,
      hoursWatched,
      xp,
      level,
      levelName,
      xpToNext,
      dayStreak,
      bestStreak,
    };
  }
  async getLists(): Promise<ListModel[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    return (await getUserDoc(uid)).lists;
  }
  async getChallenges(): Promise<Challenge[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    const doc = await getUserDoc(uid);
    return computeWeeklyChallenges(doc.history);
  }
  async updateProfile(
    patch: Partial<Pick<UserProfile, "firstName" | "bio" | "avatarColor" | "avatarIcon" | "bannerMode" | "bannerImageUri">>
  ): Promise<UserProfile> {
    const uid = requireUid();
    const current = await getUserDoc(uid);
    // Firestore's setDoc rejects any field explicitly set to `undefined`
    // (crashed here with "Unsupported field value: undefined" whenever the
    // caller passed e.g. `bannerImageUri: undefined` to mean "clear/skip
    // this field") — strip undefined-valued keys so spreading over the
    // current profile can't silently write `undefined` into a field that
    // already had a real value, and never sends undefined to Firestore.
    const definedPatch = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const nextProfile = { ...current.profile, ...definedPatch };
    await patchUserDoc(uid, { profile: nextProfile });
    return { id: uid, ...nextProfile };
  }
  async createList(name: string): Promise<ListModel> {
    const uid = requireUid();
    const current = await getUserDoc(uid);
    const list: ListModel = { id: `list-${Date.now()}`, name, mediaIds: [] };
    await patchUserDoc(uid, { lists: [...current.lists, list] });
    return list;
  }
  async renameList(listId: string, name: string): Promise<void> {
    const uid = requireUid();
    const current = await getUserDoc(uid);
    const lists = current.lists.map((l) => (l.id === listId ? { ...l, name } : l));
    await patchUserDoc(uid, { lists });
  }
  async removeFromList(listId: string, mediaId: string): Promise<void> {
    const uid = requireUid();
    const current = await getUserDoc(uid);
    const lists = current.lists.map((l) => (l.id === listId ? { ...l, mediaIds: l.mediaIds.filter((id) => id !== mediaId) } : l));
    await patchUserDoc(uid, { lists });
  }
  async addToList(listId: string, mediaId: string): Promise<void> {
    const uid = requireUid();
    const current = await getUserDoc(uid);
    const lists = current.lists.map((l) =>
      l.id === listId && !l.mediaIds.includes(mediaId) ? { ...l, mediaIds: [...l.mediaIds, mediaId] } : l
    );
    await patchUserDoc(uid, { lists });
  }
  async toggleFavorite(mediaId: string): Promise<boolean> {
    const uid = requireUid();
    return toggleFavoriteDoc(uid, mediaId);
  }
}
