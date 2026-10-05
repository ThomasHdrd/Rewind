import { auth } from "@/lib/firebase";
import {
  getUserDoc,
  patchUserDoc,
  removeGameEntry,
  setGameEntry,
  setMissionRating,
} from "@/data/repositories/firestoreUser";
import { submitMissionRating } from "./missionRatings";
import { submitRating } from "@/data/repositories/mediaRatings";
import { pushActivity } from "@/data/repositories/social";
import { historyEntryDate } from "@/lib/history";
import { HistoryEntry } from "@/types/media";
import { Game, GameEntry, GameStatus } from "./types";

async function requireUid(): Promise<string> {
  await auth.authStateReady();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("No signed-in user");
  return uid;
}

async function logGameHistory(
  uid: string,
  game: Game,
  label: string,
  hours?: number,
) {
  const doc = await getUserDoc(uid);
  const entry: HistoryEntry = {
    id: `h-${Date.now()}`,
    label: `${game.title} — ${label}`,
    timeLabel: new Date().toISOString(),
    mediaId: game.id,
    ...(hours ? { hours } : {}),
  };
  await patchUserDoc(uid, { history: [entry, ...doc.history] });
  if (doc.settings?.activityVisibility !== "private" && label !== "Played") {
    pushActivity({ label: entry.label, mediaId: game.id }).catch(() => {});
  }
}

/** Anything on a game worth keeping beyond its status. */
export function hasProgress(game: Game): boolean {
  return (
    !!game.favorite ||
    (game.hours ?? 0) > 0 ||
    (game.userRating ?? 0) > 0 ||
    Object.keys(game.missionRatings ?? {}).length > 0 ||
    (game.checklist ?? []).some((i) => i.done || i.id.startsWith("c-"))
  );
}

export async function setGameStatus(
  game: Game,
  status: GameStatus | null,
): Promise<void> {
  const uid = await requireUid();
  if (status === null) {
    // Only the status goes when there's progress to keep (ticked missions,
    // hours, ratings, heart) — un-tapping "Completed" must not wipe a game.
    if (hasProgress(game)) await setGameEntry(uid, game.id, { status: null });
    else await removeGameEntry(uid, game.id);
    return;
  }
  const patch: Parameters<typeof setGameEntry>[2] = { status };
  if (status === "completed") patch.completedAt = new Date().toISOString();
  await setGameEntry(uid, game.id, patch);
  if (status === "completed" && game.status !== "completed")
    await logGameHistory(uid, game, "Completed");
  if (status === "playing" && !game.status)
    await logGameHistory(uid, game, "Started playing");
}

/**
 * Adds play time. Same-day sessions of the same game merge into one history
 * line ("Played 3h") instead of one line per tap. Playing implies "playing".
 */
export async function addGameHours(game: Game, delta: number): Promise<void> {
  const uid = await requireUid();
  const doc = await getUserDoc(uid);
  const current = doc.games?.[game.id];
  const hours = Math.max(
    0,
    Math.round(((current?.hours ?? 0) + delta) * 10) / 10,
  );
  const patch: Parameters<typeof setGameEntry>[2] = { hours };
  if (
    !current?.status ||
    current.status === "backlog" ||
    (current.status as string) === "wishlist"
  )
    patch.status = "playing";
  await setGameEntry(uid, game.id, patch);
  if (delta <= 0) return;
  const today = new Date().toDateString();
  const idx = doc.history.findIndex(
    (h) =>
      h.mediaId === game.id &&
      h.label.endsWith("— Played") &&
      historyEntryDate(h)?.toDateString() === today,
  );
  if (idx >= 0) {
    const history = [...doc.history];
    history[idx] = {
      ...history[idx],
      hours: Math.round(((history[idx].hours ?? 0) + delta) * 10) / 10,
    };
    await patchUserDoc(uid, { history });
  } else {
    await logGameHistory(uid, game, "Played", delta);
  }
}

/** Sets play time to an exact number of hours (typed in). */
export async function setGameHours(game: Game, hours: number): Promise<void> {
  const uid = await requireUid();
  await setGameEntry(uid, game.id, {
    hours: Math.max(0, Math.round(hours * 10) / 10),
  });
}

export async function updateGameEntry(
  game: Game,
  patch: Pick<GameEntry, "platform" | "hundredPercent" | "checklist">,
): Promise<void> {
  const uid = await requireUid();
  await setGameEntry(uid, game.id, patch);
}

export async function setGameFavorite(
  game: Game,
  favorite: boolean,
): Promise<void> {
  const uid = await requireUid();
  if (!favorite && !game.status) await removeGameEntry(uid, game.id);
  else await setGameEntry(uid, game.id, { favorite: favorite || null });
}

/** Rate one mission 1–5 (0 removes) — mine + the shared Rewind average. */
export async function rateMission(
  game: Game,
  missionId: string,
  rating: number,
): Promise<void> {
  const uid = await requireUid();
  await submitMissionRating(
    game.id,
    missionId,
    rating,
    game.missionRatings?.[missionId] ?? 0,
  );
  await setMissionRating(uid, game.id, missionId, rating);
}

/** Rate 1–5, or 0 to remove — feeds the same shared community aggregate. */
export async function rateGame(game: Game, rating: number): Promise<void> {
  const uid = await requireUid();
  await submitRating(uid, game.id, rating, game.userRating ?? 0);
  await setGameEntry(
    uid,
    game.id,
    rating === 0
      ? { rating: null, ratedAt: null }
      : { rating, ratedAt: new Date().toISOString() },
  );
}
