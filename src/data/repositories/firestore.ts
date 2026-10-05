import { auth } from "@/lib/firebase";
import {
  ActivityItem,
  Friend,
  HistoryEntry,
  HistoryRef,
  ListModel,
  UpcomingEpisode,
  UserProfile,
  WatchStatus,
} from "@/types/media";
import { MediaRepository, SocialRepository, TrackingRepository, UserRepository } from "./types";
import {
  getUserDoc,
  writeProfileFields,
  patchUserDoc,
  seriesIdFromEpisodeId,
  setEpisodesWatchedBulk,
  setMediaStatus,
  toggleEpisodeWatched as toggleEpisodeWatchedDoc,
  toggleFavorite as toggleFavoriteDoc,
  watchedSeriesIds,
} from "./firestoreUser";
import { submitRating } from "./mediaRatings";
import { countFriends, friendsFeed, listFriends, pushActivity, removeActivity, savePublicProfile } from "./social";
import { formatRelativeTime, watchEntries } from "@/lib/history";
import { computeLevel, computeRewardsState, computeStreaks, computeXp } from "@/lib/rewards";
// The TMDB catalog repository, handed in by ./index at startup. Importing it
// here directly would be circular (./tmdb imports personalMediaStore from
// this file), and the previous workaround — `await import("./index")` at call
// time — produced an empty lazy chunk on web, so Upcoming silently came back
// empty there. A plain setter has neither problem.
let catalog: MediaRepository | null = null;
export function setCatalogRepository(repo: MediaRepository) {
  catalog = repo;
}
function requireCatalog(): MediaRepository {
  if (!catalog) throw new Error("Catalog repository not wired — see ./index");
  return catalog;
}

// Every method here reads/writes the signed-in user's own document
// (nowatchUsers/{uid}) in Firestore. This is the "real" per-user store that
// Part 1 (empty-state) and Part 3 (Firebase auth) connect through: a brand
// new uid has no document yet, so every list below comes back empty until
// the user actually creates data, which is exactly what makes the existing
// EmptyState UI show up with no screen changes needed.
// Waits for Firebase to finish restoring the session: the UI can be
// interactive slightly before that (instant start from the cached-session
// hint), and an action fired in that window must not fail as "signed out".
async function requireUid(): Promise<string> {
  await auth.authStateReady();
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
  // Reads straight from Firestore (getUserDoc does a fresh getDoc every
  // call, no client-side memoization) rather than the seriesWatchedCount
  // React Query hook, which stays stale across a burst of rapid taps: two
  // unmarks fired before the first one's invalidation+refetch lands would
  // both compute their delta from the SAME pre-burst count, under-counting
  // and permanently leaving the series' status one step short of "no real
  // progress" (stuck on "watching" forever no matter how much gets
  // unmarked). Called fresh after each individual write instead.
  async getSeriesWatchedEpisodeCount(seriesId: string): Promise<number> {
    const uid = auth.currentUser?.uid;
    if (!uid) return 0;
    const doc = await getUserDoc(uid);
    return Object.entries(doc.episodesWatched).filter(
      ([episodeId, watched]) => watched && seriesIdFromEpisodeId(episodeId) === seriesId
    ).length;
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
    await setMediaStatus(await requireUid(), mediaId, { status, kind });
  },
  async setUserRating(mediaId: string, rating: number) {
    const uid = await requireUid();
    // Two writes: the user's own rating (private, same as before) and the
    // shared per-title aggregate (sum/count) that makes "Community" actually
    // move as real Rewind users rate things, instead of being a frozen
    // TMDB-only number forever. submitRating does this as one atomic
    // transaction so concurrent raters can't clobber each other's totals.
    // Order matters: submitRating reads the user's CURRENT stored rating to
    // compute the sum/count delta, so it must run before setMediaStatus
    // overwrites that value — otherwise it reads back the new rating as if
    // it were the old one, and the aggregate never moves on a first rating.
    await submitRating(uid, mediaId, rating);
    // rating 0 = "remove my rating" (tap the selected star again).
    await setMediaStatus(uid, mediaId, rating === 0 ? { rating: null } : { rating, ratedAt: new Date().toISOString() });
  },
  async toggleEpisodeWatched(episodeId: string) {
    return toggleEpisodeWatchedDoc(await requireUid(), episodeId);
  },
  async setEpisodesWatched(episodeIds: string[], watched: boolean) {
    await setEpisodesWatchedBulk(await requireUid(), episodeIds, watched);
  },
};

export class FirestoreTrackingRepository implements TrackingRepository {
  async getUpcoming(): Promise<UpcomingEpisode[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    const doc = await getUserDoc(uid);
    const watchedEpisodeCountFor = (seriesId: string) =>
      Object.entries(doc.episodesWatched).filter(
        ([episodeId, watched]) => watched && seriesIdFromEpisodeId(episodeId) === seriesId
      ).length;
    const trackedIds = (kindWanted: "series" | "movie") =>
      Object.entries(doc.mediaStatus)
        .filter(([id, v]) => {
          const kind = v.kind ?? (id.startsWith("tv:") ? "series" : "movie");
          if (kind !== kindWanted) return false;
          if (v.status === "watchlist") return true;
          // A raw "watching" flag with zero real episodes watched is stale,
          // not a genuine in-progress show — e.g. checking an episode then
          // hitting "Undo" reverts the episode but not this status flip (see
          // series/[id].tsx's toggleEpisode undo handler), leaving orphaned
          // series permanently stuck here even though nothing was ever
          // actually watched. Continue Watching already self-corrects this
          // via deriveEffectiveStatus; Up Next needs the same guard.
          if (v.status === "watching") {
            return kindWanted === "movie" || watchedEpisodeCountFor(id) > 0;
          }
          return false;
        })
        .map(([id]) => id);
    const followedSeriesIds = trackedIds("series");
    // Watchlisted movies weren't included at all before — Upcoming only
    // ever considered series' next episodes, so a watchlisted movie with a
    // real future release date (e.g. "Avengers: Doomsday") never showed up
    // as a reminder even though the user explicitly tracked it.
    const watchlistedMovieIds = trackedIds("movie");
    if (followedSeriesIds.length === 0 && watchlistedMovieIds.length === 0) return [];

    const mediaRepository = requireCatalog();
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
  async logWatch(label: string, ref?: HistoryRef): Promise<void> {
    const uid = await requireUid();
    const current = await getUserDoc(uid);
    const entry: HistoryEntry = {
      id: `h-${Date.now()}`,
      label,
      // Firestore rejects explicit `undefined`, so only set what's present.
      ...(ref ? { mediaId: ref.mediaId } : {}),
      ...(ref?.episodeIds ? { episodeIds: ref.episodeIds } : {}),
      // ISO, not toLocaleString(): locale-formatted dates ("01/10/2026" on a
      // French device) get misread as another day when parsed back.
      timeLabel: new Date().toISOString(),
    };
    await patchUserDoc(uid, { history: [entry, ...current.history] });
    // Friends' activity feed is best-effort: a failure there must not undo
    // or block the user's own history. Skipped entirely when the user set
    // their activity to private (Settings → Privacy).
    if (current.settings?.activityVisibility !== "private") {
      pushActivity({ label, mediaId: ref?.mediaId }).catch(() => {});
    }
  }

  async removeWatch(ref: HistoryRef, legacyLabels: string[] = []): Promise<void> {
    const uid = await requireUid();
    const current = await getUserDoc(uid);
    const removedEpisodes = new Set(ref.episodeIds ?? []);
    const history: HistoryEntry[] = [];
    const dropped = new Set<string>();
    for (const entry of current.history) {
      if (!entry.mediaId) {
        if (!legacyLabels.includes(entry.label)) history.push(entry);
        else dropped.add(entry.label);
        continue;
      }
      if (entry.mediaId !== ref.mediaId) {
        history.push(entry);
        continue;
      }
      if (!ref.episodeIds) {
        dropped.add(entry.label); // movie unmarked: drop its entries
        continue;
      }
      if (!entry.episodeIds) {
        history.push(entry);
        continue;
      }
      const remaining = entry.episodeIds.filter((id) => !removedEpisodes.has(id));
      if (remaining.length === entry.episodeIds.length) history.push(entry);
      else if (remaining.length > 0) history.push({ ...entry, episodeIds: remaining });
      else dropped.add(entry.label);
    }
    if (dropped.size > 0) removeActivity((item) => dropped.has(item.label)).catch(() => {});
    if (history.length !== current.history.length || history.some((h, i) => h !== current.history[i])) {
      await patchUserDoc(uid, { history });
    }
  }
}

// Real friends (accepted friendships, see ./social.ts). The old per-user
// `friends` / `activity` arrays on the private doc were placeholders and are
// no longer read.
export class FirestoreSocialRepository implements SocialRepository {
  async getFriends(): Promise<Friend[]> {
    const friends = await listFriends();
    return friends.map((p) => ({
      id: p.uid,
      name: p.firstName || `@${p.username}`,
      xp: p.xp ?? 0,
      username: p.username,
      avatarColor: p.avatarColor,
      avatarIcon: p.avatarIcon,
      avatarImage: p.avatarImage,
    }));
  }
  async getActivityFeed(): Promise<ActivityItem[]> {
    const feed = await friendsFeed(await listFriends());
    return feed.map(({ friend, item }) => {
      // Game entries read "<title> — Completed" / "— Started playing": turn
      // that into the verb ("completed Hades") instead of "watched …".
      const isGame = item.mediaId?.startsWith("game:");
      const [title, what] = item.label.split(" — ");
      const action = !isGame ? "watched" : what === "Completed" ? "🎮 completed" : "🎮 started playing";
      return {
        id: `${friend.uid}-${item.id}`,
        friendName: friend.firstName || `@${friend.username}`,
        action,
        timeAgo: formatRelativeTime(item.at),
        mediaTitle: isGame ? title : item.label,
        artworkColor: friend.avatarColor ?? "#3D5A6C",
        likeCount: 0,
        friendAvatarColor: friend.avatarColor,
        friendAvatarIcon: friend.avatarIcon,
        friendAvatarImage: friend.avatarImage,
        mediaId: item.mediaId,
      };
    });
  }
}

export class FirestoreUserRepository implements UserRepository {
  async getProfile(): Promise<UserProfile> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("No signed-in user");
    const doc = await getUserDoc(uid);

    const watchedEntries = Object.entries(doc.mediaStatus).filter(([, v]) => v.status === "watched");
    const watchedMovieIds = watchedEntries
      .filter(([id, v]) => (v.kind ?? (id.startsWith("movie:") ? "movie" : "series")) === "movie")
      .map(([id]) => id);
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
      const mediaRepository = requireCatalog();
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
    // Movie/series history only — games have their own stats and rewards.
    const watchHistory = watchEntries(doc.history);
    const { dayStreak, bestStreak } = computeStreaks(watchHistory);
    const ratings = Object.values(doc.mediaStatus).filter((v) => (v.rating ?? 0) > 0);
    // Favorite-only entries (no status) aren't games "in the library".
    const gameEntriesList = Object.values(doc.games ?? {}).filter((g) => g.status);
    const gameStats = {
      completed: gameEntriesList.filter((g) => g.status === "completed").length,
      hours: gameEntriesList.reduce((s, g) => s + (g.hours ?? 0), 0),
      hundred: gameEntriesList.filter((g) => g.hundredPercent).length,
    };
    const rewards = computeRewardsState({
      history: watchHistory,
      ratedDates: ratings.map((v) => v.ratedAt).filter((d): d is string => !!d),
      ratedCount: ratings.length,
      episodesCount,
      moviesCount: watchedMovieIds.length,
      seriesFinished: seriesIdsFromMediaStatus.length,
      friendsCount: await countFriends().catch(() => 0),
      bestStreak,
      games: gameStats,
    });
    // Watching earns base XP; completed daily/weekly challenges (all-time)
    // and unlocked achievements add theirs on top.
    const xp = computeXp(episodesCount, watchedMovieIds.length) + rewards.bonusXp;
    const { level, levelName, xpToNext } = computeLevel(xp);
    // Friends see XP/level on the leaderboard: keep the public copy current.
    if (doc.profile.username) savePublicProfile({ xp, level, levelName }).catch(() => {});

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
      gamesCount: gameEntriesList.length,
      gamesCompleted: gameStats.completed,
      hoursPlayed: Math.round(gameStats.hours),
      dailyChallenges: rewards.daily,
      weeklyChallenges: rewards.weekly,
      achievementGroups: rewards.achievementGroups,
    };
  }
  async getLists(): Promise<ListModel[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    return (await getUserDoc(uid)).lists;
  }

  async updateProfile(
    patch: Partial<
      Pick<
        UserProfile,
        | "firstName"
        | "username"
        | "bio"
        | "avatarColor"
        | "avatarIcon"
        | "avatarImage"
        | "bannerMode"
        | "bannerImageUri"
      >
    >
  ): Promise<UserProfile> {
    const uid = await requireUid();
    const current = await getUserDoc(uid);
    // Firestore's setDoc rejects any field explicitly set to `undefined`
    // (crashed here with "Unsupported field value: undefined" whenever the
    // caller passed e.g. `bannerImageUri: undefined` to mean "clear/skip
    // this field") — strip undefined-valued keys so spreading over the
    // current profile can't silently write `undefined` into a field that
    // already had a real value, and never sends undefined to Firestore.
    const definedPatch = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const nextProfile = { ...current.profile, ...definedPatch };
    // Explicit "clear" for the optional avatar fields (initials / icon / photo
    // modes are exclusive): a key passed as undefined means remove it.
    const cleared = (["avatarIcon", "avatarImage"] as const).filter((k) => k in patch && patch[k] === undefined);
    cleared.forEach((k) => delete nextProfile[k]);
    // Private profile + public copy written in parallel (was 4 sequential
    // round trips: re-read, full-doc write, field clear, public profile).
    await Promise.all([
      writeProfileFields(uid, definedPatch, [...cleared]),
      nextProfile.username
        ? savePublicProfile({
            username: nextProfile.username,
            firstName: nextProfile.firstName,
            bio: nextProfile.bio,
            avatarColor: nextProfile.avatarColor,
            avatarIcon: nextProfile.avatarIcon,
            avatarImage: nextProfile.avatarImage,
          })
        : Promise.resolve(),
    ]);
    return { id: uid, ...nextProfile };
  }
  async createList(name: string): Promise<ListModel> {
    const uid = await requireUid();
    const current = await getUserDoc(uid);
    const list: ListModel = { id: `list-${Date.now()}`, name, mediaIds: [] };
    await patchUserDoc(uid, { lists: [...current.lists, list] });
    return list;
  }
  async renameList(listId: string, name: string): Promise<void> {
    const uid = await requireUid();
    const current = await getUserDoc(uid);
    const lists = current.lists.map((l) => (l.id === listId ? { ...l, name } : l));
    await patchUserDoc(uid, { lists });
  }
  async removeFromList(listId: string, mediaId: string): Promise<void> {
    const uid = await requireUid();
    const current = await getUserDoc(uid);
    const lists = current.lists.map((l) =>
      l.id === listId ? { ...l, mediaIds: l.mediaIds.filter((id) => id !== mediaId) } : l
    );
    await patchUserDoc(uid, { lists });
  }
  async addToList(listId: string, mediaId: string): Promise<void> {
    const uid = await requireUid();
    const current = await getUserDoc(uid);
    const lists = current.lists.map((l) =>
      l.id === listId && !l.mediaIds.includes(mediaId) ? { ...l, mediaIds: [...l.mediaIds, mediaId] } : l
    );
    await patchUserDoc(uid, { lists });
  }
  async toggleFavorite(mediaId: string): Promise<boolean> {
    const uid = await requireUid();
    return toggleFavoriteDoc(uid, mediaId);
  }
}
