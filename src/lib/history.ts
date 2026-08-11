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

// Formats a HistoryEntry.timeLabel as a short relative string ("21 min ago",
// "2h ago", "Yesterday", or a short date for anything older), for the
// Profile "Recently Watched" section. Falls back to the raw label when it
// can't be parsed into a real date (parseHistoryDate returns null).
export function formatRelativeTime(timeLabel: string): string {
  const date = parseHistoryDate(timeLabel);
  if (!date) return timeLabel;
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
