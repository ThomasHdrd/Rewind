import { arrayUnion, deleteDoc, deleteField, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
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

// One document per user. Collection name matches the old "nowatch" web
// prototype (nowatchUsers/{uid}) for continuity with that Firebase project —
// confirm/adjust if different security rules are already deployed there.
const COLLECTION = "nowatchUsers";

export interface MediaStatusEntry {
  status?: WatchStatus;
  rating?: number;
  /** Media kind, cached alongside status so profile stats don't need an
   * extra fetch per tracked id to know movie vs series. */
  kind?: string;
  /** ISO time of the latest rating — powers the "Rate a title today" daily challenge. */
  ratedAt?: string;
}

/** Answers from onboarding's preferences step (editable later in Settings).
 * Drive Discover's personalized "For You" row. */
export interface UserPreferences {
  genres: string[];
  platforms: string[];
  /** What the user tracks. Absent (older accounts) = "watch". */
  tracks?: "watch" | "play" | "both";
  /** Video-game genres + consoles, when tracking games. */
  gameGenres?: string[];
  consoles?: string[];
}

/** Privacy + notification choices (Settings → Privacy / Notifications). */
export interface UserSettings {
  /** "friends": friends see what you watch; "private": nobody does. */
  activityVisibility: "friends" | "private";
  /** False hides you from exact-username search (friends keep you). */
  discoverable: boolean;
  notifyNewEpisodes: boolean;
  notifyFriendRequests: boolean;
  notifyRewind: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  activityVisibility: "friends",
  discoverable: true,
  notifyNewEpisodes: true,
  notifyFriendRequests: true,
  notifyRewind: true,
};

export interface UserDoc {
  profile: Omit<UserProfile, "id">;
  mediaStatus: Record<string, MediaStatusEntry>;
  episodesWatched: Record<string, boolean>;
  history: HistoryEntry[];
  lists: ListModel[];
  challenges: Challenge[];
  friends: Friend[];
  activity: ActivityItem[];
  upcoming: UpcomingEpisode[];
  favorites: string[];
  preferences: UserPreferences;
  /** Set once onboarding's preferences step is completed. */
  onboarded?: boolean;
  /** Years whose Rewind has already been auto-opened for this account. */
  rewindSeen?: number[];
  settings?: Partial<UserSettings>;
  /** Video games, keyed "game:<igdbId>" — kept apart from mediaStatus so
   * the movie/series logic never sees them. */
  games?: Record<string, import("@/data/games/types").GameEntry>;
}

// A brand-new user starts completely empty — this is what makes Home,
// Library, History, Ratings, Lists, Friends, Statistics and Rewards all
// render their existing EmptyState UI until the user actually does
// something, per the "reset to empty state" requirement.
export function defaultUserDoc(uid: string): UserDoc {
  return {
    profile: {
      firstName: "",
      bio: "",
      avatarColor: "#FD736D",
      level: 1,
      levelName: "New Watcher",
      xp: 0,
      xpToNext: 100,
      moviesCount: 0,
      seriesCount: 0,
      episodesCount: 0,
      hoursWatched: 0,
      dayStreak: 0,
      bestStreak: 0,
    },
    mediaStatus: {},
    episodesWatched: {},
    history: [],
    lists: [],
    challenges: [],
    friends: [],
    activity: [],
    upcoming: [],
    favorites: [],
    preferences: { genres: [], platforms: [] },
  };
}

function userRef(uid: string) {
  return doc(db, COLLECTION, uid);
}

// Concurrent reads share one request: opening Profile alone fires ~6
// queries that each read this doc at the same moment. Only an IN-FLIGHT read
// is shared (nothing is cached after it resolves), and every write below
// drops it first, so a read started after a write always sees that write.
const pendingReads = new Map<string, Promise<UserDoc>>();
function forgetPendingRead(uid: string) {
  pendingReads.delete(uid);
}

export async function getUserDoc(uid: string): Promise<UserDoc> {
  const pending = pendingReads.get(uid);
  if (pending) return pending;
  const read = (async () => {
    const snap = await getDoc(userRef(uid));
    if (!snap.exists()) return defaultUserDoc(uid);
    // Merge over defaults so older/partial docs (or a doc missing a field we
    // added later) don't crash screens expecting that field to exist.
    return { ...defaultUserDoc(uid), ...(snap.data() as Partial<UserDoc>) };
  })();
  pendingReads.set(uid, read);
  read.finally(() => {
    if (pendingReads.get(uid) === read) pendingReads.delete(uid);
  }).catch(() => {});
  return read;
}

/**
 * Whether this account already went through onboarding — stored on the
 * account (not the device) so it only ever shows once, at account creation,
 * whatever device the user later signs in from. Docs from before this flag
 * existed count as onboarded: nothing writes a user doc before onboarding's
 * preferences step, so an existing doc means it was completed.
 */
export async function isOnboarded(uid: string): Promise<boolean> {
  const snap = await getDoc(userRef(uid));
  if (!snap.exists()) {
    // Brand-new account: mark onboarding as started, so that once profile
    // setup creates the doc, quitting before the last step still brings the
    // user back to onboarding next time (an existing doc without the flag
    // is a legacy account, treated as onboarded).
    forgetPendingRead(uid);
  await setDoc(userRef(uid), { onboarded: false }, { merge: true });
    return false;
  }
  return snap.data().onboarded !== false;
}

export async function markOnboarded(uid: string): Promise<void> {
  forgetPendingRead(uid);
  await setDoc(userRef(uid), { onboarded: true }, { merge: true });
}

/** One write for a profile edit: sets `fields` and deletes `clear` inside
 * the `profile` map only — never rewrites the rest of the doc, so it can't
 * clobber e.g. preferences being saved at the same time. */
export async function writeProfileFields(uid: string, fields: Record<string, unknown>, clear: string[] = []): Promise<void> {
  const profile: Record<string, unknown> = { ...fields };
  clear.forEach((k) => (profile[k] = deleteField()));
  forgetPendingRead(uid);
  await setDoc(userRef(uid), { profile }, { merge: true });
}

/** Sets fields of one game entry; `null` deletes a field. */
export async function setGameEntry(
  uid: string,
  gameId: string,
  patch: { [K in keyof import("@/data/games/types").GameEntry]?: import("@/data/games/types").GameEntry[K] | null }
): Promise<void> {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) fields[k] = v === null ? deleteField() : v;
  forgetPendingRead(uid);
  await setDoc(userRef(uid), { games: { [gameId]: fields } }, { merge: true });
}

/** Sets (or, with 0, clears) my rating of one of a game's missions. */
export async function setMissionRating(uid: string, gameId: string, missionId: string, rating: number): Promise<void> {
  forgetPendingRead(uid);
  await setDoc(
    userRef(uid),
    { games: { [gameId]: { missionRatings: { [missionId]: rating > 0 ? rating : deleteField() } } } },
    { merge: true }
  );
}

/** Removes a game from the library entirely. */
export async function removeGameEntry(uid: string, gameId: string): Promise<void> {
  forgetPendingRead(uid);
  await setDoc(userRef(uid), { games: { [gameId]: deleteField() } }, { merge: true });
}

export async function saveUserSettings(uid: string, patch: Partial<UserSettings>): Promise<void> {
  forgetPendingRead(uid);
  await setDoc(userRef(uid), { settings: patch }, { merge: true });
}

export async function markRewindSeen(uid: string, year: number): Promise<void> {
  forgetPendingRead(uid);
  await setDoc(userRef(uid), { rewindSeen: arrayUnion(year) }, { merge: true });
}

export async function deleteUserDoc(uid: string): Promise<void> {
  forgetPendingRead(uid);
  await deleteDoc(userRef(uid));
}

export async function setPreferences(uid: string, preferences: UserPreferences): Promise<void> {
  // Merge only touches the `preferences` field; arrays inside it are replaced
  // wholesale (Firestore never unions arrays on merge), so deselected
  // genres/platforms really are removed.
  forgetPendingRead(uid);
  await setDoc(userRef(uid), { preferences }, { merge: true });
}

export async function patchUserDoc(uid: string, patch: Partial<UserDoc>): Promise<UserDoc> {
  const current = await getUserDoc(uid);
  const next: UserDoc = { ...current, ...patch };
  forgetPendingRead(uid);
  await setDoc(userRef(uid), next, { merge: true });
  return next;
}

export async function setMediaStatus(
  uid: string,
  mediaId: string,
  entry: Partial<Omit<MediaStatusEntry, "status" | "rating">> & { status?: WatchStatus | null; rating?: number | null }
): Promise<void> {
  // Write only the changed sub-fields at their dot-path, rather than
  // read-modify-write the whole mediaStatus map. This matters specifically
  // for clearing a status: setDoc(..., {merge:true}) deep-merges nested map
  // fields — a key simply *absent* from the merged object (e.g. after
  // `delete merged.status`) is left untouched server-side, not removed. Only
  // the deleteField() sentinel actually clears a nested field, which is what
  // was missing before (the optimistic UI cleared correctly, but the
  // background refetch after invalidateQueries pulled the untouched — still
  // "watchlist"/"watched" — status back from Firestore).
  const patch: Record<string, unknown> = {};
  if (entry.rating === null) {
    // Rating removed: clear it (and its date) for real.
    patch.rating = deleteField();
    patch.ratedAt = deleteField();
  } else if (entry.rating !== undefined) patch.rating = entry.rating;
  if (entry.ratedAt !== undefined) patch.ratedAt = entry.ratedAt;
  if (entry.kind !== undefined) patch.kind = entry.kind;
  if (entry.status === null) {
    patch.status = deleteField();
  } else if (entry.status !== undefined) {
    patch.status = entry.status;
  }
  forgetPendingRead(uid);
  await setDoc(userRef(uid), { mediaStatus: { [mediaId]: patch } }, { merge: true });
}

// Episode ids look like "tv:<tmdbId>:s<season>e<number>" (TMDB) or
// "<mockSeriesId>-s<season>e<number>" (mock fixtures) — both end with a
// "[:-]s<season>e<number>" suffix, so the series id is everything before it.
export function seriesIdFromEpisodeId(episodeId: string): string | null {
  const match = episodeId.match(/^(.+)[:-]s\d+e\d+$/i);
  return match ? match[1] : null;
}

// Distinct series the user has watched at least one episode of. Series have
// no single "watched" status of their own (progress is tracked per-episode),
// so this — not mediaStatus — is the real source of truth for "how many
// series has this user watched".
export function watchedSeriesIds(doc: UserDoc): string[] {
  const ids = new Set<string>();
  for (const [episodeId, watched] of Object.entries(doc.episodesWatched)) {
    if (!watched) continue;
    const seriesId = seriesIdFromEpisodeId(episodeId);
    if (seriesId) ids.add(seriesId);
  }
  return Array.from(ids);
}

export async function toggleFavorite(uid: string, mediaId: string): Promise<boolean> {
  const current = await getUserDoc(uid);
  const isFavorited = current.favorites.includes(mediaId);
  const next = isFavorited
    ? current.favorites.filter((id) => id !== mediaId)
    : Array.from(new Set([...current.favorites, mediaId]));
  forgetPendingRead(uid);
  await setDoc(userRef(uid), { favorites: next }, { merge: true });
  return !isFavorited;
}

export async function toggleEpisodeWatched(uid: string, episodeId: string): Promise<boolean> {
  const current = await getUserDoc(uid);
  const nextWatched = !current.episodesWatched[episodeId];
  const next = { ...current.episodesWatched, [episodeId]: nextWatched };
  forgetPendingRead(uid);
  await setDoc(userRef(uid), { episodesWatched: next }, { merge: true });
  return nextWatched;
}

// Bulk version used by "Mark all watched" / "Unmark all" — firing N parallel
// toggleEpisodeWatched() calls (each an independent read-modify-write of the
// WHOLE episodesWatched map) is a real race: every call reads the same
// stale snapshot and its write resends every key at that stale value, so
// concurrent calls clobber each other and most of the intended change is
// lost even though the toast fires "success". This does one read + one
// write for the whole batch instead, so there's nothing to race.
export async function setEpisodesWatchedBulk(uid: string, episodeIds: string[], watched: boolean): Promise<void> {
  const current = await getUserDoc(uid);
  const next = { ...current.episodesWatched };
  for (const id of episodeIds) next[id] = watched;
  forgetPendingRead(uid);
  await setDoc(userRef(uid), { episodesWatched: next }, { merge: true });
}
