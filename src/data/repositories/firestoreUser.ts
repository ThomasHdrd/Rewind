import { deleteField, doc, getDoc, setDoc } from "firebase/firestore";
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
}

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
  };
}

function userRef(uid: string) {
  return doc(db, COLLECTION, uid);
}

export async function getUserDoc(uid: string): Promise<UserDoc> {
  const snap = await getDoc(userRef(uid));
  if (!snap.exists()) return defaultUserDoc(uid);
  // Merge over defaults so older/partial docs (or a doc missing a field we
  // added later) don't crash screens expecting that field to exist.
  return { ...defaultUserDoc(uid), ...(snap.data() as Partial<UserDoc>) };
}

export async function patchUserDoc(uid: string, patch: Partial<UserDoc>): Promise<UserDoc> {
  const current = await getUserDoc(uid);
  const next: UserDoc = { ...current, ...patch };
  await setDoc(userRef(uid), next, { merge: true });
  return next;
}

export async function setMediaStatus(
  uid: string,
  mediaId: string,
  entry: Partial<Omit<MediaStatusEntry, "status">> & { status?: WatchStatus | null }
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
  if (entry.rating !== undefined) patch.rating = entry.rating;
  if (entry.kind !== undefined) patch.kind = entry.kind;
  if (entry.status === null) {
    patch.status = deleteField();
  } else if (entry.status !== undefined) {
    patch.status = entry.status;
  }
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
  const next = isFavorited ? current.favorites.filter((id) => id !== mediaId) : [...current.favorites, mediaId];
  await setDoc(userRef(uid), { favorites: next }, { merge: true });
  return !isFavorited;
}

export async function toggleEpisodeWatched(uid: string, episodeId: string): Promise<boolean> {
  const current = await getUserDoc(uid);
  const nextWatched = !current.episodesWatched[episodeId];
  const next = { ...current.episodesWatched, [episodeId]: nextWatched };
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
  await setDoc(userRef(uid), { episodesWatched: next }, { merge: true });
}
