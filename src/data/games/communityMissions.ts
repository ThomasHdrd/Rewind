import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// Main-mission lists shared between players, for games we don't ship a list
// for (see missions.ts). The first player to fill one in publishes it; only
// they can edit it afterwards, everyone else imports it by just opening the
// game.
const COLLECTION = "gameMissions";

interface CommunityMissions {
  titles: string[];
  authorUid: string;
}

const ref = (gameId: string) => doc(db, COLLECTION, gameId.replace(/\//g, "_"));

export async function getCommunityMissions(
  gameId: string,
): Promise<CommunityMissions | null> {
  const snap = await getDoc(ref(gameId));
  if (!snap.exists()) return null;
  const data = snap.data() as CommunityMissions;
  return Array.isArray(data.titles) && data.titles.length ? data : null;
}

export async function publishCommunityMissions(
  gameId: string,
  titles: string[],
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || titles.length === 0) return;
  await setDoc(ref(gameId), {
    titles: titles.slice(0, 300),
    authorUid: uid,
    updatedAt: serverTimestamp(),
  });
}
