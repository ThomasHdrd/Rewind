import { useEffect } from "react";
import { useAuthStore } from "@/state/authStore";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CatalogPage, CatalogQuery, mediaRepository, socialRepository, trackingRepository, userRepository } from "@/data/repositories";
import { auth } from "@/lib/firebase";
import {
  getUserDoc,
  MediaStatusEntry,
  seriesIdFromEpisodeId,
  DEFAULT_SETTINGS,
  saveUserSettings,
  setPreferences,
  UserPreferences,
  UserSettings,
  watchedSeriesIds,
} from "@/data/repositories/firestoreUser";
import { addComment, deleteComment, listComments, StoredComment } from "@/data/repositories/comments";
import {
  acceptFriendRequest,
  clearActivity,
  deleteFriendRequest,
  findByUsername,
  friendshipStatus,
  listFriendRequests,
  normalizeUsername,
  removeFriend,
  savePublicProfile,
  sendFriendRequest,
  subscribeToFriendFeeds,
  subscribeToSocialChanges,
  validateUsername,
} from "@/data/repositories/social";
import { fetchPlatformIds, PlatformIds } from "@/lib/streamingLinks";
import { getGamesByIds } from "@/data/games/repository";
import { igdbImageUrl, isGamesConfigured } from "@/lib/games";
import { computeGameRewind, computeRewind, RewindData, rewindHasLegacyEntries, rewindMediaIds } from "@/lib/rewind";
import { deriveEffectiveStatus } from "@/domain/watchStatus";
import {
  ActivityItem,
  Episode,
  Friend,
  HistoryEntry,
  ListModel,
  Media,
  UpcomingEpisode,
  UserProfile,
  WatchStatus,
} from "@/types/media";

export const useTrending = () =>
  useQuery<Media[]>({ queryKey: ["media", "trending"], queryFn: () => mediaRepository.listTrending() });

/** Discover's grid: the whole TMDB catalog for a kind/genres/sort, paged. */
export const useCatalog = (query: CatalogQuery, enabled = true) =>
  useInfiniteQuery({
    enabled,
    queryKey: ["media", "catalog", query.kind, [...query.genres].sort(), [...query.platforms].sort(), query.sort],
    queryFn: ({ pageParam }) => mediaRepository.browseCatalog(query, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last: CatalogPage, all) => (last.hasMore ? all.length + 1 : undefined),
  });

export const useComingSoon = (enabled: boolean) =>
  useQuery<Media[]>({
    queryKey: ["media", "coming-soon"],
    queryFn: () => mediaRepository.listComingSoon(),
    enabled,
  });

const EMPTY_PREFERENCES: UserPreferences = { genres: [], platforms: [] };

// The signed-in user's onboarding answers (genres + platforms), per account.
export const usePreferences = () =>
  useQuery<UserPreferences>({
    queryKey: ["preferences"],
    queryFn: async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return EMPTY_PREFERENCES;
      return (await getUserDoc(uid)).preferences ?? EMPTY_PREFERENCES;
    },
  });

export const useSavePreferences = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (preferences: UserPreferences) => {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("No signed-in user");
      await setPreferences(uid, preferences);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["preferences"] });
      qc.invalidateQueries({ queryKey: ["media", "for-you"] });
    },
  });
};

export const useForYou = (preferences: UserPreferences | undefined) =>
  useQuery<Media[]>({
    queryKey: ["media", "for-you", preferences?.genres, preferences?.platforms],
    queryFn: () => mediaRepository.listForYou(preferences ?? EMPTY_PREFERENCES),
    enabled: !!preferences && (preferences.genres.length > 0 || preferences.platforms.length > 0),
  });

export const useContinueWatching = () =>
  useQuery<Media[]>({
    queryKey: ["media", "continue-watching"],
    queryFn: () => mediaRepository.listContinueWatching(),
  });

// Every media the user has any status on (watching/watchlist/watched/etc),
// hydrated into full Media[] via the catalog repository — the "My Library"
// section on Home needs everything tracked, not just "watching" (which is
// all listContinueWatching() returns).
export const useLibrary = () =>
  useQuery<Media[]>({
    queryKey: ["library"],
    queryFn: async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return [];
      const doc = await getUserDoc(uid);
      // mediaStatus also holds per-episode ratings keyed by episode id
      // ("tv:1429:s1e2"); only whole titles with a status belong here.
      const ids = Object.entries(doc.mediaStatus)
        .filter(([id, v]) => /^(movie|tv):\d+$/.test(id) && !!v.status)
        .map(([id]) => id);
      const results = await Promise.all(ids.map((id) => mediaRepository.getById(id)));
      // Same real-progress-derived status as listContinueWatching() (see
      // deriveEffectiveStatus) so the Home "Watching" filter chip reflects
      // actual episode progress, not just the write-time status flag.
      return uniqueById(results.filter((m): m is Media => !!m))
        .map((m) => {
          const watchedEpisodeCount = Object.entries(doc.episodesWatched).filter(
            ([episodeId, watched]) => watched && seriesIdFromEpisodeId(episodeId) === m.id
          ).length;
          return { ...m, status: deriveEffectiveStatus(m, watchedEpisodeCount) };
        });
    },
  });

export const useMediaSearch = (query: string) =>
  useQuery<Media[]>({
    queryKey: ["media", "search", query],
    queryFn: () => mediaRepository.search(query),
    enabled: query.trim().length > 0,
  });

/** A title already sitting in any cached list (Discover, Home, Library,
 * search…), used to paint a detail page instantly. */
function findCachedMedia(qc: ReturnType<typeof useQueryClient>, id: string): Media | undefined {
  for (const query of qc.getQueryCache().getAll()) {
    const data = query.state.data as unknown;
    if (Array.isArray(data)) {
      const hit = data.find((m) => m && typeof m === "object" && (m as Media).id === id && (m as Media).title);
      if (hit) return hit as Media;
    }
  }
  return undefined;
}

// Opens instantly: until the full record (cast, providers, seasons…) arrives,
// the page shows what the tapped poster's list already had (title, poster,
// backdrop, synopsis, status). Fields only the full fetch provides stay
// undefined meanwhile — screens treat that as "still loading".
export const useMediaDetail = (id: string) => {
  const qc = useQueryClient();
  return useQuery<Media | undefined>({
    queryKey: ["media", id],
    queryFn: () => mediaRepository.getById(id),
    placeholderData: () => findCachedMedia(qc, id),
  });
};

export const useEpisodes = (seriesId: string, season?: number) =>
  useQuery<Episode[]>({
    queryKey: ["episodes", seriesId, season ?? 1],
    queryFn: () => mediaRepository.getEpisodes(seriesId, season),
  });

// Real per-title recommendations (TMDB /recommendations), replacing the
// previous placeholder use of useTrending() for "Similar Content".
export const useRecommendations = (id: string) =>
  useQuery<Media[]>({
    queryKey: ["media", id, "recommendations"],
    queryFn: () => mediaRepository.getRecommendations(id),
    enabled: !!id,
  });

// Same instant-open trick as useMediaDetail: the episode is usually already
// in a cached season list (the series page you tapped it from).
export const useEpisodeDetail = (episodeId: string) => {
  const qc = useQueryClient();
  return useQuery<Episode | undefined>({
    queryKey: ["episode", episodeId],
    queryFn: () => mediaRepository.getEpisodeById(episodeId),
    placeholderData: () => {
      for (const [, data] of qc.getQueriesData<Episode[]>({ queryKey: ["episodes"] })) {
        const hit = data?.find((e) => e.id === episodeId);
        if (hit) return hit;
      }
      return undefined;
    },
  });
};

export const useSetWatchStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mediaId, status }: { mediaId: string; status: WatchStatus | null }) =>
      mediaRepository.setWatchStatus(mediaId, status),
    onMutate: async ({ mediaId, status }) => {
      await qc.cancelQueries({ queryKey: ["media", mediaId] });
      const previous = qc.getQueryData<Media | undefined>(["media", mediaId]);
      qc.setQueryData<Media | undefined>(["media", mediaId], (old) =>
        old ? { ...old, status: status ?? undefined } : old
      );
      return { previous, mediaId };
    },
    onError: (_err, _vars, context) => {
      if (context) qc.setQueryData(["media", context.mediaId], context.previous);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["media"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["watchedMediaIds"] });
      // Watchlisting/un-watchlisting a series changes whether it should
      // appear in Up Next (Upcoming), and any status change changes what
      // Home's Continue-Watching / My Library sections should show.
      qc.invalidateQueries({ queryKey: ["upcoming"] });
      qc.invalidateQueries({ queryKey: ["library"] });
    },
  });
};

// CONFIRMED BUG this fixes: the "Your Rating" star pickers on the movie/
// series/episode detail screens were only ever local useState — nothing
// called mediaRepository.setUserRating(), so a submitted rating vanished on
// navigating away (never persisted) and the shared community aggregate's
// count never moved. This mutation actually persists it (and, via
// setUserRating's own implementation, updates the Rewind community
// aggregate too), with an optimistic update so the stars respond instantly.
/** Rewind members' average after the viewer rates `rating` (0 = removes
 * their rating) — same math as submitRating(), for an instant UI. */
function nextRewindAggregate(
  old: { userRating?: number; rewindRating?: number; rewindRatingCount?: number },
  rating: number
): { rewindRating?: number; rewindRatingCount: number } {
  const oldRating = old.userRating ?? 0;
  const oldCount = old.rewindRatingCount ?? 0;
  const oldSum = (old.rewindRating ?? 0) * oldCount;
  let sum = oldSum;
  let count = oldCount;
  if (rating === 0) {
    if (oldRating > 0) {
      sum -= oldRating;
      count -= 1;
    }
  } else if (oldRating > 0) sum += rating - oldRating;
  else {
    sum += rating;
    count += 1;
  }
  return { rewindRating: count > 0 ? Math.round((sum / count) * 10) / 10 : undefined, rewindRatingCount: Math.max(0, count) };
}

export const useSetUserRating = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mediaId, rating }: { mediaId: string; rating: number }) =>
      mediaRepository.setUserRating(mediaId, rating),
    onMutate: async ({ mediaId, rating }) => {
      await qc.cancelQueries({ queryKey: ["media", mediaId] });
      const previous = qc.getQueryData<Media | undefined>(["media", mediaId]);
      qc.setQueryData<Media | undefined>(["media", mediaId], (old) => {
        if (!old) return old;
        // Instant: your rating, plus the Rewind members' average (kept
        // apart from TMDB's communityRating — see tmdb.ts getById).
        const next = nextRewindAggregate(old, rating);
        return { ...old, userRating: rating || undefined, ...next };
      });
      // Episodes are shown from the episode query, not ["media", id].
      qc.setQueryData<Episode | undefined>(["episode", mediaId], (old) => {
        if (!old) return old;
        return { ...old, userRating: rating || undefined, ...nextRewindAggregate(old, rating) };
      });
      return { previous, mediaId };
    },
    onError: (_err, _vars, context) => {
      if (context) qc.setQueryData(["media", context.mediaId], context.previous);
    },
    onSuccess: (_data, { mediaId }) => {
      qc.invalidateQueries({ queryKey: ["media", mediaId] });
      qc.invalidateQueries({ queryKey: ["episode", mediaId] });
      qc.invalidateQueries({ queryKey: ["episodes"] });
      // Daily "rate a title", Critic achievements and XP live on the profile.
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};

export const useUpcoming = () =>
  useQuery<UpcomingEpisode[]>({ queryKey: ["upcoming"], queryFn: () => trackingRepository.getUpcoming() });

export const useHistory = () =>
  useQuery<HistoryEntry[]>({ queryKey: ["history"], queryFn: () => trackingRepository.getHistory() });

// Raw mediaStatus map (mediaId -> {status, rating}) from the signed-in
// user's Firestore doc. The narrower repository interfaces don't expose
// this directly, but Statistics needs it to compute real avg rating /
// genre breakdown instead of the previous hardcoded mock numbers.
export const useMediaStatusMap = () =>
  useQuery<Record<string, MediaStatusEntry>>({
    queryKey: ["mediaStatus"],
    queryFn: async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return {};
      return (await getUserDoc(uid)).mediaStatus;
    },
  });

// Genres for every tracked media id, fetched via the catalog repository and
// batched. Only re-fetches when the set of tracked ids changes.
export const useTrackedGenres = (mediaIds: string[]) =>
  useQuery<string[][]>({
    queryKey: ["trackedGenres", [...mediaIds].sort()],
    queryFn: async () => {
      const results = await Promise.all(mediaIds.map((id) => mediaRepository.getById(id)));
      return results.map((m) => m?.genres ?? []);
    },
    enabled: mediaIds.length > 0,
  });

// Media ids the user has actually WATCHED (movies with status "watched",
// plus series with at least one watched episode) — distinct from "tracked"
// (which also includes watchlist-only items). Statistics should derive from
// this, not from every tracked id, so "Favorite Genres" stays consistent
// with the "X movies · Y episodes watched" header instead of counting
// genres of things the user has merely added to a watchlist.
export const useWatchedMediaIds = () =>
  useQuery<string[]>({
    queryKey: ["watchedMediaIds"],
    queryFn: async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return [];
      const doc = await getUserDoc(uid);
      const watchedMovies = Object.entries(doc.mediaStatus)
        .filter(([, v]) => v.status === "watched")
        .map(([id]) => id);
      return Array.from(new Set([...watchedMovies, ...watchedSeriesIds(doc)]));
    },
  });

// Count of watched episodes for a series across ALL seasons (not just the
// currently-selected one) — used by the "whole-series completion" badge on
// app/series/[id].tsx, alongside media.totalEpisodes for the denominator.
/** Watched-episode count per season for one series ({ 1: 10, 2: 3 }). */
export const useSeasonWatchedCounts = (seriesId: string) =>
  useQuery<Record<number, number>>({
    queryKey: ["seasonWatchedCounts", seriesId],
    queryFn: async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return {};
      const doc = await getUserDoc(uid);
      const counts: Record<number, number> = {};
      for (const [episodeId, watched] of Object.entries(doc.episodesWatched)) {
        if (!watched || seriesIdFromEpisodeId(episodeId) !== seriesId) continue;
        const season = Number(episodeId.match(/[:-]s(\d+)e\d+$/i)?.[1]);
        if (season) counts[season] = (counts[season] ?? 0) + 1;
      }
      return counts;
    },
    enabled: !!seriesId,
  });

export const useSeriesWatchedEpisodeCount = (seriesId: string) =>
  useQuery<number>({
    queryKey: ["seriesWatchedEpisodeCount", seriesId],
    queryFn: async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return 0;
      const doc = await getUserDoc(uid);
      return Object.entries(doc.episodesWatched).filter(
        ([episodeId, watched]) => watched && seriesIdFromEpisodeId(episodeId) === seriesId
      ).length;
    },
    enabled: !!seriesId,
  });

// Real watched-episode progress (watchedCount/totalCount + percent) for a
// batch of Continue Watching series, computed the same way
// app/series/[id].tsx's "Your Progress" card computes it (episodesWatched
// map filtered by seriesIdFromEpisodeId, denominator = media.totalEpisodes)
// so Home and the series detail screen always agree on the numbers. Used to
// replace the previously-hardcoded ratio/percent on Home's Continue
// Watching cards.
export interface SeriesProgress {
  watchedCount: number;
  totalCount: number;
  percent: number;
}

export const useContinueWatchingProgress = (series: Media[]) => {
  const ids = series.map((m) => m.id);
  return useQuery<Record<string, SeriesProgress>>({
    queryKey: ["continueWatchingProgress", [...ids].sort()],
    queryFn: async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return {};
      const doc = await getUserDoc(uid);
      const result: Record<string, SeriesProgress> = {};
      for (const m of series) {
        const watchedCount = Object.entries(doc.episodesWatched).filter(
          ([episodeId, watched]) => watched && seriesIdFromEpisodeId(episodeId) === m.id
        ).length;
        const totalCount = m.totalEpisodes ?? 0;
        const percent = totalCount > 0 ? Math.round((watchedCount / totalCount) * 100) : 0;
        result[m.id] = { watchedCount, totalCount, percent };
      }
      return result;
    },
    enabled: ids.length > 0,
  });
};

// Next unwatched episode per series, for a batch of Continue Watching media —
// scans seasons in order (mirrors app/series/[id].tsx's `episodes.find(e =>
// !e.watched)`, but that only looks at the currently-selected season; here we
// don't have a "current season" concept on Home, so we walk seasons 1..N
// until we find one with an unwatched episode). Movies have no entry. Used to
// drive the Continue Watching checkmark action so it advances progress
// instead of blasting the whole-series status.
export const useNextEpisodes = (series: Media[]) => {
  const ids = series.map((m) => m.id);
  return useQuery<Record<string, Episode | undefined>>({
    queryKey: ["nextEpisode", [...ids].sort()],
    queryFn: async () => {
      const result: Record<string, Episode | undefined> = {};
      await Promise.all(
        series.map(async (m) => {
          if (m.kind !== "series") return;
          const seasonCount = m.seasons ?? 1;
          for (let s = 1; s <= seasonCount; s++) {
            const episodes = await mediaRepository.getEpisodes(m.id, s);
            const next = episodes.find((e) => !e.watched);
            if (next) {
              result[m.id] = next;
              return;
            }
          }
        })
      );
      return result;
    },
    enabled: ids.length > 0,
  });
};

// Hydrates a list of media ids (e.g. a ListModel.mediaIds) into full Media[]
// via the catalog repository, batched — same pattern as useFavorites /
// useTrackedGenres. Needed because app/lists/[id].tsx previously used a
// mock-only lookup that couldn't resolve real TMDB-backed ids.
export const useListItems = (mediaIds: string[]) =>
  useQuery<Media[]>({
    queryKey: ["listItems", [...mediaIds].sort()],
    queryFn: async () => {
      const results = await Promise.all(mediaIds.map((id) => mediaRepository.getById(id)));
      return results.filter((m): m is Media => !!m);
    },
    enabled: mediaIds.length > 0,
  });

export const useAddToList = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, mediaId }: { listId: string; mediaId: string }) =>
      userRepository.addToList(listId, mediaId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lists"] }),
  });
};

export const useFriends = () =>
  useQuery<Friend[]>({ queryKey: ["friends"], queryFn: () => socialRepository.getFriends() });

export const useActivityFeed = () =>
  useQuery<ActivityItem[]>({ queryKey: ["activity"], queryFn: () => socialRepository.getActivityFeed() });

export const useProfile = () =>
  useQuery<UserProfile>({ queryKey: ["profile"], queryFn: () => userRepository.getProfile() });

export const useLists = () =>
  useQuery<ListModel[]>({ queryKey: ["lists"], queryFn: () => userRepository.getLists() });


export const useUpdateProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      patch: Partial<
        Pick<UserProfile, "firstName" | "username" | "bio" | "avatarColor" | "avatarIcon" | "avatarImage" | "bannerMode" | "bannerImageUri">
      >
    ) =>
      userRepository.updateProfile(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
};

export const useCreateList = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => userRepository.createList(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lists"] }),
  });
};

export const useRenameList = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, name }: { listId: string; name: string }) => userRepository.renameList(listId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lists"] }),
  });
};

export const useRemoveFromList = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, mediaId }: { listId: string; mediaId: string }) =>
      userRepository.removeFromList(listId, mediaId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lists"] }),
  });
};

// Favorited media ids from the signed-in user's Firestore doc, hydrated into
// full Media[] via the catalog repository (batched, same pattern as
// useTrackedGenres).
/** Drops repeated ids (first wins) — lists render with key={id}. */
function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

export const useFavorites = () =>
  useQuery<Media[]>({
    queryKey: ["favorites"],
    queryFn: async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return [];
      // Set: two quick taps on the heart could store the same id twice.
      const ids = Array.from(new Set((await getUserDoc(uid)).favorites));
      const results = await Promise.all(ids.map((id) => mediaRepository.getById(id)));
      return uniqueById(results.filter((m): m is Media => !!m));
    },
  });

export const useToggleFavorite = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mediaId: string) => userRepository.toggleFavorite(mediaId),
    // Instant heart: flip the cached favorites list first, save after.
    onMutate: async (mediaId) => {
      await qc.cancelQueries({ queryKey: ["favorites"] });
      const previous = qc.getQueryData<Media[]>(["favorites"]);
      const media = qc.getQueryData<Media | undefined>(["media", mediaId]);
      qc.setQueryData<Media[]>(["favorites"], (old = []) =>
        old.some((m) => m.id === mediaId) ? old.filter((m) => m.id !== mediaId) : media ? [...old, media] : old
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context) qc.setQueryData(["favorites"], context.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["favorites"] });
    },
  });
};

// ---- Friends (see src/data/repositories/social.ts) ----

const invalidateSocial = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["friends"] });
  qc.invalidateQueries({ queryKey: ["friendRequests"] });
  qc.invalidateQueries({ queryKey: ["activity"] });
  qc.invalidateQueries({ queryKey: ["friendshipStatus"] });
};

/** Keeps friends / requests / activity / lookup results live while mounted. */
export const useSocialRealtime = () => {
  const qc = useQueryClient();
  // From the auth store (not auth.currentUser) so the listeners re-subscribe
  // when a different account signs in — and only once Firebase confirmed the
  // session (the UI can be showing earlier from the cached-session hint,
  // when Firestore would still reject the listeners).
  const uid = useAuthStore((s) => (s.authConfirmed ? s.userId : null));
  useEffect(() => {
    if (!uid) return;
    return subscribeToSocialChanges(uid, () => {
      invalidateSocial(qc);
      qc.invalidateQueries({ queryKey: ["userLookup"] });
    });
  }, [uid, qc]);

  // Friends' activity: re-subscribed whenever the friend list changes.
  const { data: friends = [] } = useQuery<Friend[]>({
    queryKey: ["friends"],
    queryFn: () => socialRepository.getFriends(),
    enabled: !!uid,
  });
  const friendKey = friends
    .map((f) => f.id)
    .sort()
    .join(",");
  useEffect(() => {
    if (!uid || !friendKey) return;
    return subscribeToFriendFeeds(friendKey.split(","), () => qc.invalidateQueries({ queryKey: ["activity"] }));
  }, [uid, friendKey, qc]);
};

export const useFriendRequests = () =>
  useQuery({ queryKey: ["friendRequests"], queryFn: () => listFriendRequests() });

export const useUserLookup = (username: string) => {
  const handle = normalizeUsername(username);
  return useQuery({
    queryKey: ["userLookup", handle],
    queryFn: async () => {
      const profile = await findByUsername(handle);
      return profile ? { profile, status: await friendshipStatus(profile.uid) } : null;
    },
    enabled: !validateUsername(handle),
  });
};

export const useSendFriendRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uid: string) => sendFriendRequest(uid),
    onSuccess: () => {
      invalidateSocial(qc);
      qc.invalidateQueries({ queryKey: ["userLookup"] });
    },
  });
};

export const useRespondToRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, accept }: { uid: string; accept: boolean }) =>
      accept ? acceptFriendRequest(uid) : deleteFriendRequest(uid, auth.currentUser?.uid ?? ""),
    onSuccess: () => invalidateSocial(qc),
  });
};

export const useCancelRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uid: string) => deleteFriendRequest(auth.currentUser?.uid ?? "", uid),
    onSuccess: () => {
      invalidateSocial(qc);
      qc.invalidateQueries({ queryKey: ["userLookup"] });
    },
  });
};

export const useRemoveFriend = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uid: string) => removeFriend(uid),
    onSuccess: () => invalidateSocial(qc),
  });
};

export const useComments = (targetId: string) =>
  useQuery<StoredComment[]>({ queryKey: ["comments", targetId], queryFn: () => listComments(targetId) });

export const useAddComment = (targetId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => addComment(targetId, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", targetId] }),
  });
};

export const useDeleteComment = (targetId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", targetId] }),
  });
};

// Yearly "Rewind" recap. Resolves this year's history entries to real media
// (posters, genres, runtimes): by stored media id, or — for entries logged
// before ids were stored — by exact title against everything the user tracks.
export const useRewind = (year: number, enabled = true) =>
  useQuery<RewindData>({
    queryKey: ["rewind", year],
    enabled,
    queryFn: async () => {
      const uid = auth.currentUser?.uid;
      const doc = uid ? await getUserDoc(uid) : null;
      const history = doc?.history ?? [];
      const ids = new Set(rewindMediaIds(history, year));
      if (doc && rewindHasLegacyEntries(history, year)) Object.keys(doc.mediaStatus).forEach((id) => ids.add(id));
      const fetched = await Promise.all(
        Array.from(ids).map((id) => mediaRepository.getById(id).catch(() => undefined))
      );
      const byId = new Map<string, Media>();
      const byTitle = new Map<string, Media>();
      for (const m of fetched) {
        if (!m) continue;
        byId.set(m.id, m);
        if (!byTitle.has(m.title)) byTitle.set(m.title, m);
      }
      const rewind = computeRewind(
        history,
        year,
        (key, title) => byId.get(key) ?? byTitle.get(title),
        (mediaId) => doc?.mediaStatus[mediaId]?.rating
      );
      const games = computeGameRewind(history, year);
      if (games?.topGame && isGamesConfigured) {
        const [top] = await getGamesByIds([games.topGame.id]).catch(() => []);
        if (top) games.topGame = { ...games.topGame, coverUrl: igdbImageUrl(top.coverImageId) };
      }
      return { ...rewind, games };
    },
  });

// History entries resolved to their media (poster, kind, where to navigate):
// by stored media id, or — for entries logged before ids were stored — by
// the title prefix of the label against everything the user tracks.
export const useHistoryMedia = (history: HistoryEntry[]) => {
  const ids = Array.from(new Set(history.map((h) => h.mediaId).filter((id): id is string => !!id))).sort();
  const hasLegacy = history.some((h) => !h.mediaId);
  return useQuery<{ byId: Record<string, Media>; byTitle: Record<string, Media> }>({
    queryKey: ["historyMedia", ids, hasLegacy],
    queryFn: async () => {
      const uid = auth.currentUser?.uid;
      const legacyIds =
        hasLegacy && uid
          ? Object.entries((await getUserDoc(uid)).mediaStatus)
              .filter(([id, v]) => /^(movie|tv):\d+$/.test(id) && !!v.status)
              .map(([id]) => id)
          : [];
      const all = Array.from(new Set([...ids, ...legacyIds]));
      const results = await Promise.all(all.map((id) => mediaRepository.getById(id).catch(() => undefined)));
      const byId: Record<string, Media> = {};
      const byTitle: Record<string, Media> = {};
      for (const m of results) {
        if (!m) continue;
        byId[m.id] = m;
        byTitle[m.title.toLowerCase()] ??= m;
      }
      return { byId, byTitle };
    },
    enabled: history.length > 0,
  });
};

// ---- Settings → Privacy / Notifications ----

export const useUserSettings = () =>
  useQuery<UserSettings>({
    queryKey: ["settings"],
    queryFn: async () => {
      const uid = auth.currentUser?.uid;
      const stored = uid ? (await getUserDoc(uid)).settings : undefined;
      return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
    },
  });

export const useSaveUserSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<UserSettings>) => {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("No signed-in user");
      await saveUserSettings(uid, patch);
      // Applied right away where it has an effect.
      if (patch.activityVisibility === "private") await clearActivity();
      if (patch.discoverable !== undefined) await savePublicProfile({ discoverable: patch.discoverable });
    },
    // Instant toggle.
    onMutate: async (patch) => {
      const previous = qc.getQueryData<UserSettings>(["settings"]);
      qc.setQueryData<UserSettings>(["settings"], (old) => ({ ...DEFAULT_SETTINGS, ...(old ?? {}), ...patch }));
      return { previous };
    },
    onError: (_e, _p, ctx) => ctx && qc.setQueryData(["settings"], ctx.previous),
  });
};

/** Platform ids (Netflix, Prime…) for a title, for direct product links. */
export const usePlatformIds = (media: Media | undefined) =>
  useQuery<PlatformIds>({
    queryKey: ["platformIds", media?.id],
    queryFn: () => fetchPlatformIds(media!.kind === "movie" ? "movie" : "tv", media!.tmdbId!),
    enabled: !!media?.tmdbId && (media.watchProviders?.length ?? 0) > 0,
    staleTime: 7 * 24 * 60 * 60 * 1000, // ids rarely change
    retry: 0,
  });
