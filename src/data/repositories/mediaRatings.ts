import { doc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUserDoc } from "./firestoreUser";

// One doc per title, shared across every Rewind user — this is the actual
// "community" aggregate (distinct from TMDB's own external score, which
// never moves no matter what anyone rates inside the app). Kept as a sum +
// count rather than a running average so re-rating (a user changing their
// score) can adjust the total exactly instead of drifting.
const COLLECTION = "mediaRatings";

interface RatingAggregate {
  sum: number;
  count: number;
}

function ratingRef(mediaId: string) {
  // Firestore document ids can't contain "/" — our media ids are like
  // "movie:603" / "tv:1399", which is already slash-free, but sanitize
  // defensively in case a future id format introduces one.
  return doc(db, COLLECTION, mediaId.replace(/\//g, "_"));
}

export async function getRatingAggregate(mediaId: string): Promise<{ average: number; count: number } | null> {
  const snap = await getDoc(ratingRef(mediaId));
  if (!snap.exists()) return null;
  const data = snap.data() as RatingAggregate;
  if (!data.count) return null;
  return { average: Math.round((data.sum / data.count) * 10) / 10, count: data.count };
}

/**
 * Submits (or updates) a user's rating for a title and keeps the shared
 * community aggregate in sync — in one atomic transaction, so concurrent
 * ratings from different users can't clobber each other's totals the way
 * a naive read-then-write would (the same class of race condition fixed
 * earlier for bulk episode-watched writes).
 */
export async function submitRating(uid: string, mediaId: string, rating: number): Promise<void> {
  const aggregateRef = ratingRef(mediaId);
  const userDoc = await getUserDoc(uid); // read outside the transaction: user doc isn't part of the aggregate's consistency need
  const previousRating = userDoc.mediaStatus[mediaId]?.rating;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(aggregateRef);
    const current: RatingAggregate = snap.exists() ? (snap.data() as RatingAggregate) : { sum: 0, count: 0 };
    const next: RatingAggregate =
      previousRating !== undefined && previousRating > 0
        ? { sum: current.sum - previousRating + rating, count: current.count } // re-rating: adjust sum only
        : { sum: current.sum + rating, count: current.count + 1 }; // first rating from this user
    tx.set(aggregateRef, next);
  });
}
