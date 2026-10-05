import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { auth } from "@/lib/firebase";
import { getUserDoc, markRewindSeen } from "@/data/repositories/firestoreUser";
import { useRewind } from "@/hooks/useMedia";

/** Which year's Rewind is "released" right now: December reveals the current
 * year (like Spotify Wrapped), January still catches anyone who missed it. */
export function releasedRewindYear(now = new Date()): number | null {
  if (now.getMonth() === 11) return now.getFullYear();
  if (now.getMonth() === 0) return now.getFullYear() - 1;
  return null;
}

// Mounted on Home: opens the yearly Rewind full-screen once per account per
// year, during its release window, and only when there's something to show.
// Stored on the account (Firestore), so it doesn't replay on another device.
export function RewindAutoOpen() {
  const router = useRouter();
  const year = releasedRewindYear();
  const uid = auth.currentUser?.uid;
  const opened = useRef(false);

  const { data: seen } = useQuery({
    queryKey: ["rewindSeen", uid, year],
    queryFn: async () => (uid && year ? ((await getUserDoc(uid)).rewindSeen ?? []).includes(year) : true),
    enabled: !!uid && year !== null,
  });
  const { data: rewind } = useRewind(year ?? 0, seen === false);

  useEffect(() => {
    if (opened.current || seen !== false || !rewind || !uid || year === null) return;
    if (rewind.moviesCount + rewind.episodesCount === 0 && !rewind.games) return;
    opened.current = true;
    markRewindSeen(uid, year).catch(() => {});
    router.push(`/rewind?year=${year}`);
  }, [seen, rewind, uid, year, router]);

  return null;
}
