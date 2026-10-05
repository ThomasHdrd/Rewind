import { QueryClient, Query } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { removeOldestQuery } from "@tanstack/react-query-persist-client";

const DAY = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Must outlive the persisted copy below, or restored queries would be
      // garbage-collected before a screen uses them.
      gcTime: DAY,
      retry: 1,
    },
  },
});

// Last session's data is kept on the device (AsyncStorage = localStorage on
// web) so screens paint INSTANTLY on open/reload, then refresh in the
// background (anything older than staleTime is refetched on mount). Cleared
// on sign-out / account deletion via queryClient.clear().
export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "rewind.queryCache",
  throttleTime: 2000,
  // Web localStorage caps around 5 MB: drop the oldest entries instead of
  // failing to save at all.
  retry: removeOldestQuery,
});

// Only what a screen needs to paint immediately — not comments, lookups or
// one-off searches.
const PERSISTED_ROOTS = new Set([
  "profile",
  "preferences",
  "settings",
  "games",
  "gameMissions",
  "gameMissionRatings",
  "missionInfo",
  "library",
  "favorites",
  "history",
  "upcoming",
  "media",
  "episodes",
  "friends",
  "friendRequests",
  "activity",
  "seasonWatchedCounts",
  "continueWatchingProgress",
  "nextEpisode",
]);

export const persistOptions = {
  persister: queryPersister,
  maxAge: DAY,
  // Bump to drop every device's stored cache after a data-shape change.
  buster: "v2",
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) =>
      query.state.status === "success" && PERSISTED_ROOTS.has(String(query.queryKey[0])) &&
      !(query.queryKey[0] === "media" && query.queryKey[1] === "search"),
  },
};
