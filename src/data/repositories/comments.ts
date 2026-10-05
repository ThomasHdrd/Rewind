import { addDoc, collection, deleteDoc, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { getUserDoc } from "./firestoreUser";

// Public comments, shared across every Rewind user — one doc per comment,
// keyed by the thing being commented on (`targetId` = a media id like
// "movie:603" / "tv:1399", or an episode id). Security rules let any
// signed-in user read and create, but only the author delete (uid match).
const COLLECTION = "comments";

export interface StoredComment {
  id: string;
  targetId: string;
  uid: string;
  authorName: string;
  text: string;
  /** ISO timestamp. */
  createdAt: string;
}

export async function listComments(targetId: string): Promise<StoredComment[]> {
  // Single equality filter only (sorted client-side) so this needs no
  // composite Firestore index.
  const snap = await getDocs(query(collection(db, COLLECTION), where("targetId", "==", targetId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<StoredComment, "id">) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addComment(targetId: string, text: string): Promise<void> {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error("No signed-in user");
  const profile = (await getUserDoc(user.uid)).profile;
  const authorName = profile.firstName.trim() || user.displayName || "Guest";
  await addDoc(collection(db, COLLECTION), {
    targetId,
    uid: user.uid,
    authorName,
    text,
    createdAt: new Date().toISOString(),
  });
}

export async function deleteComment(commentId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, commentId));
}

/** Removes every comment the user wrote — part of account deletion. */
export async function deleteAllCommentsBy(uid: string): Promise<void> {
  const snap = await getDocs(query(collection(db, COLLECTION), where("uid", "==", uid)));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
