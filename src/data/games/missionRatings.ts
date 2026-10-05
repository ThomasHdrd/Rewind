import { doc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Rewind members' ratings of a game's missions — the games' version of
// episode ratings. One shared doc per game (in the same open collection as
// title ratings) holding a sum + count per mission, so a game's whole list
// shows its stars with a single read instead of one per mission.
const COLLECTION = "mediaRatings";

type Aggregates = Record<string, { sum: number; count: number }>;

const ref = (gameId: string) =>
  doc(db, COLLECTION, `${gameId.replace(/\//g, "_")}~missions`);

/** Mission id ("main:5", "c-…") → Rewind average + count. */
export async function getMissionRatings(
  gameId: string,
): Promise<Record<string, { average: number; count: number }>> {
  const snap = await getDoc(ref(gameId));
  const data = (snap.exists() ? snap.data() : {}) as Aggregates;
  const out: Record<string, { average: number; count: number }> = {};
  for (const [id, a] of Object.entries(data)) {
    if (a?.count > 0)
      out[id] = {
        average: Math.round((a.sum / a.count) * 10) / 10,
        count: a.count,
      };
  }
  return out;
}

/** Adds, changes (re-rating) or removes (rating 0) one member's rating. */
export async function submitMissionRating(
  gameId: string,
  missionId: string,
  rating: number,
  previous: number,
) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref(gameId));
    const current = ((snap.exists() ? snap.data() : {}) as Aggregates)[
      missionId
    ] ?? { sum: 0, count: 0 };
    const had = previous > 0;
    if (rating === 0 && !had) return;
    const next =
      rating === 0
        ? { sum: current.sum - previous, count: Math.max(0, current.count - 1) }
        : had
          ? { sum: current.sum - previous + rating, count: current.count }
          : { sum: current.sum + rating, count: current.count + 1 };
    tx.set(ref(gameId), { [missionId]: next }, { merge: true });
  });
}
