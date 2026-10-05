import { Platform } from "react-native";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { auth } from "@/lib/firebase";
import { isGamesConfigured } from "@/lib/games";
import { getUserDoc } from "@/data/repositories/firestoreUser";
import {
  browseGames,
  getGame,
  getGamesByIds,
  searchGames,
} from "@/data/games/repository";
import {
  addGameHours,
  rateGame,
  rateMission,
  setGameFavorite,
  setGameHours,
  hasProgress,
  setGameStatus,
  updateGameEntry,
} from "@/data/games/actions";
import {
  ChecklistItem,
  Game,
  GameEntry,
  GameQuery,
  GameStatus,
} from "@/data/games/types";
import {
  MISSION_INFO_VERSION,
  bundledKey,
  bundledMissions,
} from "@/data/games/missions";
import { getMissionRatings } from "@/data/games/missionRatings";

import { MissionLists, withMissionSeed } from "@/lib/gameMissions";
import {
  getCommunityMissions,
  publishCommunityMissions,
} from "@/data/games/communityMissions";
import { usePreferences } from "@/hooks/useMedia";

// Mission summaries are static files hosted with the web app (public/missions).
// Same origin on the web (also works on the local dev server); the hosted
// site from the native apps.
const MISSION_INFO_URL =
  Platform.OS === "web" ? "/missions" : "https://rewind.expo.app/missions";
/**
 * What this account tracks. Games only ever show up when the user opted in
 * (onboarding / Settings → Preferences) AND the games API is configured —
 * otherwise the app is exactly the movies & series app.
 */
export function useTracks(): { watch: boolean; play: boolean } {
  const { data: prefs } = usePreferences();
  const tracks = prefs?.tracks ?? "watch";
  const play = isGamesConfigured && (tracks === "play" || tracks === "both");
  return { watch: tracks !== "play" || !isGamesConfigured, play };
}

/** A game already in some cached list, to paint its page instantly. */
function findCachedGame(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
): Game | undefined {
  for (const query of qc.getQueryCache().findAll({ queryKey: ["games"] })) {
    const data = query.state.data as unknown;
    const lists: unknown[] = Array.isArray(data)
      ? [data]
      : data && typeof data === "object" && "pages" in data
        ? ((data as { pages: { items: Game[] }[] }).pages ?? []).map(
            (p) => p.items,
          )
        : [];
    for (const list of lists) {
      const hit = (list as Game[]).find((g) => g?.id === id);
      if (hit) return hit;
    }
  }
  return undefined;
}

export const useGame = (id: string) => {
  const qc = useQueryClient();
  return useQuery<Game | undefined>({
    queryKey: ["games", "detail", id],
    queryFn: () => getGame(id),
    placeholderData: () => findCachedGame(qc, id),
    enabled: isGamesConfigured && !!id,
  });
};

export const useGameSearch = (text: string, enabled: boolean) =>
  useQuery<Game[]>({
    queryKey: ["games", "search", text.trim()],
    queryFn: () => searchGames(text),
    enabled: enabled && isGamesConfigured && text.trim().length > 1,
  });

export const useGamesCatalog = (query: GameQuery, enabled = true) =>
  useInfiniteQuery({
    queryKey: [
      "games",
      "catalog",
      [...query.genres].sort(),
      [...query.consoles].sort(),
      query.sort,
    ],
    queryFn: ({ pageParam }) => browseGames(query, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, all) =>
      last.hasMore ? all.length + 1 : undefined,
    enabled: enabled && isGamesConfigured,
  });

export const useSimilarGames = (game: Game | undefined) =>
  useQuery<Game[]>({
    queryKey: ["games", "similar", game?.id],
    queryFn: () =>
      getGamesByIds(
        (game?.similarIds ?? []).slice(0, 12).map((n) => `game:${n}`),
      ),
    enabled: isGamesConfigured && !!game?.similarIds?.length,
  });

/** Every game in the user's library, resolved (cover, title…). */
export const useMyGames = (enabled = true) =>
  useQuery<Game[]>({
    queryKey: ["games", "library"],
    queryFn: async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return [];
      const entries = (await getUserDoc(uid)).games ?? {};
      return getGamesByIds(Object.keys(entries));
    },
    enabled: enabled && isGamesConfigured,
  });

const refreshGames = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["games"] });
  qc.invalidateQueries({ queryKey: ["history"] });
  qc.invalidateQueries({ queryKey: ["profile"] });
  qc.invalidateQueries({ queryKey: ["upcoming-games"] });
};

/** Optimistically patches a game wherever it's cached (detail + lists). */
function patchCachedGame(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
  patch: Partial<Game>,
) {
  qc.setQueryData<Game | undefined>(["games", "detail", id], (old) =>
    old ? { ...old, ...patch } : old,
  );
  qc.setQueriesData<Game[]>({ queryKey: ["games", "library"] }, (old) =>
    old?.map((g) => (g.id === id ? { ...g, ...patch } : g)),
  );
}

export const useSetGameStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ game, status }: { game: Game; status: GameStatus | null }) =>
      setGameStatus(game, status),
    onMutate: ({ game, status }) => {
      patchCachedGame(qc, game.id, { status: status ?? undefined });
      if (status) {
        qc.setQueryData<Game[]>(["games", "library"], (old) =>
          old && !old.some((g) => g.id === game.id)
            ? [{ ...game, status }, ...old]
            : old,
        );
      } else if (!hasProgress(game)) {
        qc.setQueryData<Game[]>(["games", "library"], (old) =>
          old?.filter((g) => g.id !== game.id),
        );
      }
    },
    onSettled: () => refreshGames(qc),
  });
};

export const useSetGameFavorite = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ game, favorite }: { game: Game; favorite: boolean }) =>
      setGameFavorite(game, favorite),
    onMutate: ({ game, favorite }) => {
      patchCachedGame(qc, game.id, { favorite });
      if (favorite) {
        qc.setQueryData<Game[]>(["games", "library"], (old) =>
          old && !old.some((g) => g.id === game.id)
            ? [{ ...game, favorite }, ...old]
            : old,
        );
      } else if (!game.status) {
        qc.setQueryData<Game[]>(["games", "library"], (old) =>
          old?.filter((g) => g.id !== game.id),
        );
      }
    },
    onSettled: () => refreshGames(qc),
  });
};

export const useAddGameHours = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ game, delta }: { game: Game; delta: number }) =>
      addGameHours(game, delta),
    onMutate: ({ game, delta }) =>
      patchCachedGame(qc, game.id, {
        hours: Math.max(0, (game.hours ?? 0) + delta),
        status:
          !game.status || game.status === "backlog" ? "playing" : game.status,
      }),
    onSettled: () => refreshGames(qc),
  });
};

export const useUpdateGameEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      game,
      patch,
    }: {
      game: Game;
      patch: Pick<GameEntry, "platform" | "hundredPercent" | "checklist">;
    }) => updateGameEntry(game, patch),
    onMutate: ({ game, patch }) => patchCachedGame(qc, game.id, patch),
    onSettled: () => refreshGames(qc),
  });
};

export const useRateGame = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ game, rating }: { game: Game; rating: number }) =>
      rateGame(game, rating),
    onMutate: ({ game, rating }) => {
      const had = (game.userRating ?? 0) > 0;
      const count = game.rewindRatingCount ?? 0;
      const sum = (game.rewindRating ?? 0) * count;
      const nextCount =
        rating === 0 ? (had ? count - 1 : count) : had ? count : count + 1;
      const nextSum =
        rating === 0
          ? sum - (had ? game.userRating! : 0)
          : sum - (had ? game.userRating! : 0) + rating;
      patchCachedGame(qc, game.id, {
        userRating: rating || undefined,
        rewindRating:
          nextCount > 0
            ? Math.round((nextSum / nextCount) * 10) / 10
            : undefined,
        rewindRatingCount: Math.max(0, nextCount),
      });
    },
    onSettled: () => refreshGames(qc),
  });
};

export const useSetGameHours = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ game, hours }: { game: Game; hours: number }) =>
      setGameHours(game, hours),
    onMutate: ({ game, hours }) => patchCachedGame(qc, game.id, { hours }),
    onSettled: () => refreshGames(qc),
  });
};

/**
 * The lists to pre-fill a game with: shipped (instant, offline) or a main
 * mission list shared by another player.
 */
export const useMissionSeed = (game: Game | undefined) => {
  const bundled = game ? bundledMissions(game.igdbId) : undefined;
  return useQuery<{
    lists: MissionLists;
    source: "rewind" | "community";
    authorUid?: string;
  } | null>({
    queryKey: ["gameMissions", game?.id],
    queryFn: async () => {
      if (bundled) return { lists: bundled, source: "rewind" };
      const shared = await getCommunityMissions(game!.id);
      return shared
        ? {
            lists: { main: shared.titles },
            source: "community",
            authorUid: shared.authorUid,
          }
        : null;
    },
    initialData: bundled ? { lists: bundled, source: "rewind" } : undefined,
    staleTime: 60 * 60 * 1000,
    enabled: isGamesConfigured && !!game,
  });
};

/**
 * A game's full checklist (provided lists + the player's ticks and own
 * items). A list the player shared themselves stays theirs to edit, so it
 * isn't treated as provided for them.
 */
export const useMissionList = (game: Game | undefined) => {
  const { data: seed } = useMissionSeed(game);
  const mine =
    seed?.source === "community" && seed.authorUid === auth.currentUser?.uid;
  const lists = seed && !mine ? seed.lists : undefined;
  return { items: withMissionSeed(game?.checklist, lists), lists, seed, mine };
};

export const usePublishMissions = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ game, titles }: { game: Game; titles: string[] }) =>
      publishCommunityMissions(game.id, titles),
    onMutate: ({ game, titles }) =>
      qc.setQueryData(["gameMissions", game.id], {
        lists: { main: titles },
        source: "community",
        authorUid: auth.currentUser?.uid,
      }),
  });
};

/** Rewind members' average per mission of a game (one read per game). */
export const useMissionRatings = (game: Game | undefined) =>
  useQuery({
    queryKey: ["gameMissionRatings", game?.id],
    queryFn: () => getMissionRatings(game!.id),
    staleTime: 5 * 60 * 1000,
    enabled: isGamesConfigured && !!game,
  });

export const useRateMission = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      game,
      missionId,
      rating,
    }: {
      game: Game;
      missionId: string;
      rating: number;
    }) => rateMission(game, missionId, rating),
    onMutate: ({ game, missionId, rating }) => {
      const previous = game.missionRatings?.[missionId] ?? 0;
      const missionRatings = { ...game.missionRatings };
      if (rating > 0) missionRatings[missionId] = rating;
      else delete missionRatings[missionId];
      patchCachedGame(qc, game.id, { missionRatings });
      qc.setQueryData<Record<string, { average: number; count: number }>>(
        ["gameMissionRatings", game.id],
        (old = {}) => {
          const cur = old[missionId] ?? { average: 0, count: 0 };
          const sum = cur.average * cur.count - previous + rating;
          const count =
            cur.count +
            (previous > 0 ? 0 : 1) -
            (rating === 0 && previous > 0 ? 1 : 0);
          const next = { ...old };
          if (count > 0)
            next[missionId] = {
              average: Math.round((sum / count) * 10) / 10,
              count,
            };
          else delete next[missionId];
          return next;
        },
      );
    },
    onSettled: (_d, _e, { game }) => {
      qc.invalidateQueries({ queryKey: ["gameMissionRatings", game.id] });
      refreshGames(qc);
    },
  });
};

/**
 * Short summaries of a shipped game's missions (from its fan wiki, CC BY-SA),
 * hosted with the web app and fetched once per game — like an episode's
 * overview. Games without a shipped list have none.
 */
export const useMissionInfo = (game: Game | undefined) => {
  const key = game ? bundledKey(game.igdbId) : undefined;
  return useQuery<{
    wiki: string;
    items: Record<string, { page: string; text: string }>;
  } | null>({
    // Keyed by the summaries' version: new lists/summaries are fetched at
    // once instead of after the cached copy expires. Offline/missing → null,
    // never kept (a null result is stale at once, so the next visit retries).
    queryKey: ["missionInfo", MISSION_INFO_VERSION, key],
    queryFn: async () => {
      try {
        const res = await fetch(
          `${MISSION_INFO_URL}/${key}.json?v=${MISSION_INFO_VERSION}`,
        );
        if (
          !res.ok ||
          !(res.headers.get("content-type") ?? "").includes("json")
        )
          return null;
        return await res.json();
      } catch {
        return null;
      }
    },
    staleTime: (query) => (query.state.data ? 24 * 60 * 60 * 1000 : 0),
    enabled: !!key,
  });
};

/**
 * Saves a game's checklist and keeps its status in step with the story,
 * like a series' status follows its episodes: first main mission ticked →
 * Playing, every main mission ticked → Completed, one unticked on a
 * completed game → back to Playing. Returns the new status, if it changed.
 */
export const useSaveChecklist = () => {
  const update = useUpdateGameEntry();
  const setStatus = useSetGameStatus();
  return (game: Game, checklist: ChecklistItem[]): GameStatus | undefined => {
    update.mutate({ game, patch: { checklist } });
    const main = checklist.filter((i) => i.category === "main");
    const released =
      !game.releaseDate ||
      game.releaseDate <= new Date().toISOString().slice(0, 10);
    if (!main.length || !released) return undefined;
    const done = main.filter((i) => i.done).length;
    const next: GameStatus | undefined =
      done === main.length
        ? "completed"
        : game.status === "completed" || (done > 0 && game.status !== "playing")
          ? "playing"
          : undefined;
    if (!next || next === game.status) return undefined;
    setStatus.mutate({ game, status: next });
    return next;
  };
};
