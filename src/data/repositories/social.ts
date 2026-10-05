import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// Friends-only social layer. Everything a friend (or someone searching a
// username) may see lives OUTSIDE the private nowatchUsers/{uid} doc:
//
//   usernames/{handle}        → { uid }            unique @handle claim
//   publicProfiles/{uid}      → name, @handle, avatar, bio, xp/level
//   friendRequests/{from_to}  → { from, to }       pending request
//   friendships/{a_b}         → { members: [a, b] } (a < b), accepted
//   activityFeeds/{uid}       → { items }          recent watches, friends-only
//
// Security rules (see firestore.rules) enforce: one owner per handle, only
// the owner writes their public profile/feed, a friendship can only be
// created by the person who RECEIVED the request, and feeds are readable by
// friends only.

export interface PublicProfile {
  uid: string;
  username: string;
  firstName: string;
  bio?: string;
  avatarColor?: string;
  avatarIcon?: string;
  /** Small JPEG data URI (256px), when the user picked a photo. */
  avatarImage?: string;
  /** False = hidden from username search (Settings → Privacy). */
  discoverable?: boolean;
  xp?: number;
  level?: number;
  levelName?: string;
}

export interface FeedItem {
  id: string;
  label: string;
  mediaId?: string;
  /** ISO timestamp. */
  at: string;
}

export type FriendshipStatus = "self" | "friends" | "outgoing" | "incoming" | "none";

const FEED_LIMIT = 30;
export const USERNAME_RULES = "3–20 characters: lowercase letters, numbers, _ or .";

// Waits for Firebase to finish restoring the session: the UI can be
// interactive slightly before that (instant start from the cached-session
// hint), and an action fired in that window must not fail as "signed out".
async function requireUid(): Promise<string> {
  await auth.authStateReady();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("No signed-in user");
  return uid;
}

const pairId = (a: string, b: string) => [a, b].sort().join("_");

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

/** Null when valid, else a user-facing reason. */
export function validateUsername(handle: string): string | null {
  if (handle.length < 3) return "At least 3 characters";
  if (handle.length > 20) return "20 characters max";
  if (!/^[a-z0-9_.]+$/.test(handle)) return "Only lowercase letters, numbers, _ and .";
  if (handle.startsWith(".") || handle.endsWith(".") || handle.includes("..")) return "Can't start or end with a dot";
  return null;
}

export async function isUsernameAvailable(handle: string): Promise<boolean> {
  const snap = await getDoc(doc(db, "usernames", handle));
  return !snap.exists() || snap.data().uid === auth.currentUser?.uid;
}

/** Atomically claims `handle` for the signed-in user (releasing `previous`).
 * Throws "taken" if someone else owns it. */
export async function claimUsername(handle: string, previous?: string): Promise<void> {
  const uid = await requireUid();
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "usernames", handle);
    const snap = await tx.get(ref);
    if (snap.exists() && snap.data().uid !== uid) throw new Error("taken");
    if (!snap.exists()) tx.set(ref, { uid });
    if (previous && previous !== handle) tx.delete(doc(db, "usernames", previous));
  });
}

export async function savePublicProfile(patch: Partial<Omit<PublicProfile, "uid">>): Promise<void> {
  const uid = await requireUid();
  // Firestore rejects explicit undefined; null clears a field (e.g. avatar photo removed).
  const clean = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === undefined ? null : v]));
  await setDoc(doc(db, "publicProfiles", uid), { uid, ...clean }, { merge: true });
}

async function getPublicProfile(uid: string): Promise<PublicProfile | null> {
  const snap = await getDoc(doc(db, "publicProfiles", uid));
  return snap.exists() ? (snap.data() as PublicProfile) : null;
}

/** Exact @handle lookup — there's deliberately no browse/list of all users. */
export async function findByUsername(raw: string): Promise<PublicProfile | null> {
  const handle = normalizeUsername(raw);
  if (validateUsername(handle)) return null;
  const snap = await getDoc(doc(db, "usernames", handle));
  if (!snap.exists()) return null;
  const profile = await getPublicProfile(snap.data().uid as string);
  // Hidden accounts don't show up in search (yourself excepted).
  if (profile && profile.discoverable === false && profile.uid !== auth.currentUser?.uid) return null;
  return profile;
}

async function profilesFor(uids: string[]): Promise<PublicProfile[]> {
  const profiles = await Promise.all(uids.map((u) => getPublicProfile(u).catch(() => null)));
  return profiles.filter((p): p is PublicProfile => !!p);
}

export async function listFriends(): Promise<PublicProfile[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const snap = await getDocs(query(collection(db, "friendships"), where("members", "array-contains", uid)));
  const others = snap.docs.map((d) => (d.data().members as string[]).find((m) => m !== uid)).filter(Boolean) as string[];
  return profilesFor(others);
}

export async function countFriends(): Promise<number> {
  const uid = auth.currentUser?.uid;
  if (!uid) return 0;
  const snap = await getDocs(query(collection(db, "friendships"), where("members", "array-contains", uid)));
  return snap.size;
}

export async function listFriendRequests(): Promise<{ incoming: PublicProfile[]; outgoing: PublicProfile[] }> {
  const uid = auth.currentUser?.uid;
  if (!uid) return { incoming: [], outgoing: [] };
  const [inSnap, outSnap] = await Promise.all([
    getDocs(query(collection(db, "friendRequests"), where("to", "==", uid))),
    getDocs(query(collection(db, "friendRequests"), where("from", "==", uid))),
  ]);
  const [incoming, outgoing] = await Promise.all([
    profilesFor(inSnap.docs.map((d) => d.data().from as string)),
    profilesFor(outSnap.docs.map((d) => d.data().to as string)),
  ]);
  return { incoming, outgoing };
}

export async function friendshipStatus(otherUid: string): Promise<FriendshipStatus> {
  const uid = await requireUid();
  if (otherUid === uid) return "self";
  const [friendship, outgoing, incoming] = await Promise.all([
    getDoc(doc(db, "friendships", pairId(uid, otherUid))).catch(() => null),
    getDoc(doc(db, "friendRequests", `${uid}_${otherUid}`)).catch(() => null),
    getDoc(doc(db, "friendRequests", `${otherUid}_${uid}`)).catch(() => null),
  ]);
  if (friendship?.exists()) return "friends";
  if (incoming?.exists()) return "incoming";
  if (outgoing?.exists()) return "outgoing";
  return "none";
}

/** Sends a request — or, if they already asked us, accepts theirs instead. */
export async function sendFriendRequest(otherUid: string): Promise<"sent" | "accepted"> {
  const uid = await requireUid();
  const status = await friendshipStatus(otherUid);
  if (status === "self") throw new Error("That's you!");
  if (status === "friends" || status === "outgoing") return "sent";
  if (status === "incoming") {
    await acceptFriendRequest(otherUid);
    return "accepted";
  }
  await setDoc(doc(db, "friendRequests", `${uid}_${otherUid}`), {
    from: uid,
    to: otherUid,
    createdAt: new Date().toISOString(),
  });
  return "sent";
}

export async function acceptFriendRequest(fromUid: string): Promise<void> {
  const uid = await requireUid();
  const members = [uid, fromUid].sort();
  const batch = writeBatch(db);
  batch.set(doc(db, "friendships", members.join("_")), { members, createdAt: new Date().toISOString() });
  batch.delete(doc(db, "friendRequests", `${fromUid}_${uid}`));
  await batch.commit();
}

/** Declines an incoming request or cancels an outgoing one. */
export async function deleteFriendRequest(from: string, to: string): Promise<void> {
  await deleteDoc(doc(db, "friendRequests", `${from}_${to}`));
}

export async function removeFriend(otherUid: string): Promise<void> {
  await deleteDoc(doc(db, "friendships", pairId(await requireUid(), otherUid)));
}

/**
 * Live updates: calls `onChange` whenever a friend request to/from `uid` or
 * one of their friendships is created or removed — e.g. the other person
 * accepting your request, so "Sent requests" clears on its own instead of
 * staying stale until a manual refresh. Returns an unsubscribe function.
 */
export function subscribeToSocialChanges(uid: string, onChange: () => void): () => void {
  let primed = 0;
  // Each listener fires once immediately with the current state; skip
  // those initial snapshots so mounting doesn't trigger a refetch storm.
  const handler = (index: number) => () => {
    if (!(primed & (1 << index))) {
      primed |= 1 << index;
      return;
    }
    onChange();
  };
  const onError = () => {}; // e.g. offline or signed out: keep the cached data
  const unsubs = [
    onSnapshot(query(collection(db, "friendRequests"), where("to", "==", uid)), handler(0), onError),
    onSnapshot(query(collection(db, "friendRequests"), where("from", "==", uid)), handler(1), onError),
    onSnapshot(query(collection(db, "friendships"), where("members", "array-contains", uid)), handler(2), onError),
  ];
  return () => unsubs.forEach((u) => u());
}

/** Live updates of friends' activity feeds (one small doc each): fires
 * `onChange` when any friend logs or removes a watch. */
export function subscribeToFriendFeeds(friendUids: string[], onChange: () => void): () => void {
  const unsubs = friendUids.map((friendUid) => {
    let primed = false;
    return onSnapshot(
      doc(db, "activityFeeds", friendUid),
      () => {
        if (!primed) {
          primed = true; // skip the initial snapshot
          return;
        }
        onChange();
      },
      () => {} // not friends anymore / offline: ignore
    );
  });
  return () => unsubs.forEach((u) => u());
}

// ---- Activity feed (what friends see) ----

async function readFeed(uid: string): Promise<FeedItem[]> {
  const snap = await getDoc(doc(db, "activityFeeds", uid));
  return snap.exists() ? ((snap.data().items as FeedItem[]) ?? []) : [];
}

export async function pushActivity(item: Omit<FeedItem, "id" | "at">): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const current = await readFeed(uid);
  const entry: FeedItem = { id: `a-${Date.now()}`, at: new Date().toISOString(), label: item.label };
  if (item.mediaId) entry.mediaId = item.mediaId;
  await setDoc(doc(db, "activityFeeds", uid), { items: [entry, ...current].slice(0, FEED_LIMIT) });
}

/** Empties the friends-visible feed (activity switched to private). */
export async function clearActivity(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await setDoc(doc(db, "activityFeeds", uid), { items: [] });
}

/** Mirrors removeWatch: drop feed entries for an unmarked watch. */
export async function removeActivity(match: (item: FeedItem) => boolean): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const current = await readFeed(uid);
  const next = current.filter((i) => !match(i));
  if (next.length !== current.length) await setDoc(doc(db, "activityFeeds", uid), { items: next });
}

export async function friendsFeed(friends: PublicProfile[]): Promise<{ friend: PublicProfile; item: FeedItem }[]> {
  const feeds = await Promise.all(
    friends.map(async (friend) => (await readFeed(friend.uid).catch(() => [])).map((item) => ({ friend, item })))
  );
  return feeds
    .flat()
    .sort((a, b) => b.item.at.localeCompare(a.item.at))
    .slice(0, 50);
}

/** Account deletion: every social trace of the user. */
export async function deleteSocialData(uid: string, username?: string): Promise<void> {
  const [friendships, reqFrom, reqTo] = await Promise.all([
    getDocs(query(collection(db, "friendships"), where("members", "array-contains", uid))),
    getDocs(query(collection(db, "friendRequests"), where("from", "==", uid))),
    getDocs(query(collection(db, "friendRequests"), where("to", "==", uid))),
  ]);
  const batch = writeBatch(db);
  [...friendships.docs, ...reqFrom.docs, ...reqTo.docs].forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "publicProfiles", uid));
  batch.delete(doc(db, "activityFeeds", uid));
  if (username) batch.delete(doc(db, "usernames", username));
  await batch.commit();
}
