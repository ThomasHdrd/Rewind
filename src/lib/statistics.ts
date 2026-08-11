import { HistoryEntry } from "@/types/media";
import { MediaStatusEntry } from "@/data/repositories/firestoreUser";
import { parseHistoryDate } from "@/lib/history";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** 7 values (Sun..Sat) — counts of history entries per weekday, 0 when there's no (parseable) history. */
export function computeWeeklyActivity(history: HistoryEntry[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const entry of history) {
    const date = parseHistoryDate(entry.timeLabel);
    if (date) counts[date.getDay()] += 1;
  }
  return counts;
}

/** Most common weekday across history entries, or "—" when there's nothing to compute from. */
export function computeTopDay(history: HistoryEntry[]): string {
  const counts = computeWeeklyActivity(history);
  const max = Math.max(...counts);
  if (max <= 0) return "—";
  return WEEKDAY_LABELS[counts.indexOf(max)];
}

/** Average of all rated mediaStatus entries, or null when nothing has been rated yet. */
export function computeAvgRating(mediaStatus: Record<string, MediaStatusEntry>): number | null {
  const ratings = Object.values(mediaStatus)
    .map((v) => v.rating)
    .filter((r): r is number => typeof r === "number" && r > 0);
  if (ratings.length === 0) return null;
  const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  return Math.round(avg * 10) / 10;
}

/** Percentage breakdown of genres across a list of tracked media's genre arrays. */
export function computeGenreDistribution(genreLists: string[][]): { label: string; percent: number }[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const genres of genreLists) {
    for (const g of genres) {
      counts.set(g, (counts.get(g) ?? 0) + 1);
      total += 1;
    }
  }
  if (total === 0) return [];
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, percent: Math.round((count / total) * 100) }))
    .sort((a, b) => b.percent - a.percent);
}
