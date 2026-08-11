import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mediaRepository, socialRepository, trackingRepository, userRepository } from "@/data/repositories";
import { auth } from "@/lib/firebase";
import { getUserDoc, MediaStatusEntry, seriesIdFromEpisodeId, watchedSeriesIds } from "@/data/repositories/firestoreUser";
import { deriveEffectiveStatus } from "@/domain/watchStatus";
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

export const useTrending = () =>
  useQuery<Media[]>({ queryKey: ["media", "trending"], queryFn: () => mediaRepository.listTrending() });

export const useComingSoon = (enabled: boolean) =>
  useQuery<Media[]>({
    queryKey: ["media", "coming-soon"],
    queryFn: () => mediaRepository.listComingSoon(),
    enabled,
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
      const ids = Object.keys(doc.mediaStatus);
      const results = await Promise.all(ids.map((id) => mediaRepository.getById(id)));
      // Same real-progress-derived status as listContinueWatching() (see
      // deriveEffectiveStatus) so the Home "Watching" filter chip reflects
      // actual episode progress, not just the write-time status flag.
      return results
        .filter((m): m is Media => !!m)
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

export const useMediaDetail = (id: string) =>
  useQuery<Media | undefined>({ queryKey: ["media", id], queryFn: () => mediaRepository.getById(id) });

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

export const useEpisodeDetail = (episodeId: string) =>
  useQuery<Episode | undefined>({
    queryKey: ["episode", episodeId],
    queryFn: () => mediaRepository.getEpisodeById(episodeId),
  });

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

export const useChallenges = () =>
  useQuery<Challenge[]>({ queryKey: ["challenges"], queryFn: () => userRepository.getChallenges() });

export const useUpdateProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      patch: Partial<Pick<UserProfile, "firstName" | "bio" | "avatarColor" | "avatarIcon" | "bannerMode" | "bannerImageUri">>
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
export const useFavorites = () =>
  useQuery<Media[]>({
    queryKey: ["favorites"],
    queryFn: async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return [];
      const ids = (await getUserDoc(uid)).favorites;
      const results = await Promise.all(ids.map((id) => mediaRepository.getById(id)));
      return results.filter((m): m is Media => !!m);
    },
  });

export const useToggleFavorite = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mediaId: string) => userRepository.toggleFavorite(mediaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["favorites"] });
    },
  });
};

export const useAddFriend = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => socialRepository.addFriend(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friends"] }),
  });
};
