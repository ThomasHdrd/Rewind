import { HistoryEntry } from "@/types/media";

// Shared HistoryEntry.timeLabel parsing, extracted from src/lib/statistics.ts
// and src/lib/rewards.ts (both previously had their own copy). timeLabel is a
// free-form display string ("Today, 21:40", "Yesterday, 20:15", "Aug 6", or a
// real logWatch() timestamp produced via `new Date().toLocaleString()`).
// There's no structured date field on HistoryEntry, so this is a best-effort
// parse — entries that can't be confidently placed on a real calendar day
// return null rather than guessing wrong.
export function parseHistoryDate(timeLabel: string): Date | null {
  const now = new Date();
  const lower = timeLabel.toLowerCase();
  if (lower.startsWith("today")) return now;
  if (lower.startsWith("yesterday")) {
    const d = new Date(now);
    d.setDate(now.getDate() - 1);
    return d;
  }
  const parsed = new Date(timeLabel);
  if (!isNaN(parsed.getTime())) return parsed;
  // Try "Mon D" style (e.g. "Aug 6") against the current year.
  const match = timeLabel.match(/^([A-Za-z]{3,9})\s+(\d{1,2})/);
  if (match) {
    const withYear = new Date(`${match[1]} ${match[2]}, ${now.getFullYear()}`);
    if (!isNaN(withYear.getTime())) return withYear;
  }
  return null;
}

/**
 * Real date of a history entry. Prefer this over parseHistoryDate(timeLabel):
 * entries logged before timeLabel became an ISO string stored
 * `new Date().toLocaleString()`, which is locale-dependent — a French device
 * wrote "01/10/2026 14:32" (1 Oct) that `new Date()` reads back as 10 Jan,
 * silently pushing every entry out of "this week" (weekly challenges stuck
 * at 0, streaks wrong). Those entries' ids are `h-<Date.now()>`, an
 * unambiguous timestamp, so that's used before falling back to the label.
 */
export function historyEntryDate(entry: HistoryEntry): Date | null {
  const fromId = entry.id.match(/^h-(\d{12,})$/);
  if (fromId) return new Date(Number(fromId[1]));
  return parseHistoryDate(entry.timeLabel);
}

// Formats a HistoryEntry.timeLabel as a short relative string ("21 min ago",
// "2h ago", "Yesterday", or a short date for anything older), for the
// Profile "Recently Watched" section. Falls back to the raw label when it
// can't be parsed into a real date (parseHistoryDate returns null).
export function formatRelativeTime(timeLabelOrEntry: string | HistoryEntry): string {
  const date =
    typeof timeLabelOrEntry === "string" ? parseHistoryDate(timeLabelOrEntry) : historyEntryDate(timeLabelOrEntry);
  if (!date) return typeof timeLabelOrEntry === "string" ? timeLabelOrEntry : timeLabelOrEntry.timeLabel;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24 && now.toDateString() === date.toDateString()) return `${diffHr}h ago`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// History labels, shared by every place that logs (or, for entries logged
// before HistoryEntry carried ids, label-matches to remove) a watch.
export const episodeHistoryLabel = (seriesTitle: string, episode: { number: number; title: string }) =>
  `${seriesTitle} — E${episode.number} ${episode.title}`.trim();
export const seasonHistoryLabel = (seriesTitle: string, season: number) => `${seriesTitle} — Season ${season}`.trim();

/** Game history entries ("game:<id>") — never counted as episodes/movies. */
export const isGameEntry = (h: HistoryEntry) => !!h.mediaId?.startsWith("game:");
/** Only the movie/series part of the history (all watch stats use this). */
export const watchEntries = (history: HistoryEntry[]) => history.filter((h) => !isGameEntry(h));
/** Only the video-game part of the history. */
export const gameEntries = (history: HistoryEntry[]) => history.filter(isGameEntry);
