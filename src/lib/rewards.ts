import { Challenge, HistoryEntry } from "@/types/media";

export interface Achievement {
  id: string;
  label: string;
  achieved: boolean;
  xpReward: number;
}
import { parseHistoryDate } from "@/lib/history";

// XP is derived from real activity, not a separately-persisted counter that
// nothing ever increments (that was the bug: profile.xp/level always read
// the doc's untouched default). Simple, transparent weights — tune freely.
const XP_PER_EPISODE = 10;
const XP_PER_MOVIE = 25;

const LEVELS = [
  { name: "New Watcher", minXp: 0 },
  { name: "Curious", minXp: 100 },
  { name: "Enthusiast", minXp: 250 },
  { name: "Cinephile", minXp: 500 },
  { name: "Completionist", minXp: 1000 },
];

export function computeXp(episodesCount: number, moviesCount: number): number {
  return episodesCount * XP_PER_EPISODE + moviesCount * XP_PER_MOVIE;
}

export function computeLevel(xp: number): { level: number; levelName: string; xpToNext: number } {
  let levelIndex = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].minXp) levelIndex = i;
  }
  const next = LEVELS[levelIndex + 1];
  const xpToNext = next ? next.minXp - xp : 0;
  return { level: levelIndex + 1, levelName: LEVELS[levelIndex].name, xpToNext };
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Current consecutive-day streak (ending today or yesterday) and the longest streak ever seen in history. */
export function computeStreaks(history: HistoryEntry[]): { dayStreak: number; bestStreak: number } {
  const days = new Set<string>();
  for (const entry of history) {
    const d = parseHistoryDate(entry.timeLabel);
    if (d) days.add(dayKey(d));
  }
  if (days.size === 0) return { dayStreak: 0, bestStreak: 0 };

  const sorted = Array.from(days).sort();
  let bestStreak = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const cur = new Date(sorted[i]);
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86400000);
    run = diffDays === 1 ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
  }

  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  let dayStreak = 0;
  if (days.has(today) || days.has(yesterday)) {
    let cursor = days.has(today) ? new Date() : new Date(Date.now() - 86400000);
    while (days.has(dayKey(cursor))) {
      dayStreak += 1;
      cursor = new Date(cursor.getTime() - 86400000);
    }
  }

  return { dayStreak, bestStreak };
}

function startOfWeek(now = new Date()): Date {
  const d = new Date(now);
  const day = d.getDay(); // 0 = Sun
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Real weekly challenges derived from this week's watch history — replaces the always-empty stored `challenges` array. */
export function computeWeeklyChallenges(history: HistoryEntry[]): Challenge[] {
  const weekStart = startOfWeek();
  const thisWeek = history.filter((h) => {
    const d = parseHistoryDate(h.timeLabel);
    return d !== null && d >= weekStart;
  });

  const episodesThisWeek = thisWeek.filter((h) => h.label.includes(" — E") || h.label.includes(" — Season")).length;
  const moviesThisWeek = thisWeek.filter((h) => !h.label.includes(" — E") && !h.label.includes(" — Season")).length;
  // The title portion of a history label — everything before the " — E…" /
  // " — Season …" suffix for episode/season entries, or the whole label for
  // movies (logWatch is always called with either `${title} — E…`,
  // `${title} — Season …`, or just `title`).
  const titleFromLabel = (label: string) => label.split(" — ")[0];
  const distinctTitlesThisWeek = new Set(thisWeek.map((h) => titleFromLabel(h.label))).size;
  const seasonsCompletedThisWeek = thisWeek.filter((h) => h.label.includes(" — Season")).length;

  const EPISODE_GOAL = 5;
  const MOVIE_GOAL = 2;
  const VARIETY_GOAL = 3;
  const SEASON_GOAL = 1;

  return [
    {
      id: "weekly-episodes",
      label: `${EPISODE_GOAL} episodes this week`,
      current: Math.min(episodesThisWeek, EPISODE_GOAL),
      total: EPISODE_GOAL,
      xpReward: 30,
    },
    {
      id: "weekly-movies",
      label: `${MOVIE_GOAL} movies this week`,
      current: Math.min(moviesThisWeek, MOVIE_GOAL),
      total: MOVIE_GOAL,
      xpReward: 25,
    },
    {
      id: "weekly-variety",
      label: `${VARIETY_GOAL} different titles this week`,
      current: Math.min(distinctTitlesThisWeek, VARIETY_GOAL),
      total: VARIETY_GOAL,
      xpReward: 20,
    },
    {
      id: "weekly-season",
      label: `Complete ${SEASON_GOAL} season this week`,
      current: Math.min(seasonsCompletedThisWeek, SEASON_GOAL),
      total: SEASON_GOAL,
      xpReward: 40,
    },
  ];
}

/**
 * One-time milestone achievements — distinct from computeWeeklyChallenges:
 * these are earned once and never reset. Only computed from data we
 * genuinely track (friend count, episodes watched); no fabricated progress.
 */
export function computeAchievements(friendCount: number, episodesCount: number): Achievement[] {
  return [
    {
      id: "achievement-first-friend",
      label: "Add your first friend",
      achieved: friendCount >= 1,
      xpReward: 15,
    },
    {
      id: "achievement-five-friends",
      label: "Add 5 friends",
      achieved: friendCount >= 5,
      xpReward: 50,
    },
    {
      id: "achievement-fifty-episodes",
      label: "Watch 50 episodes",
      achieved: episodesCount >= 50,
      xpReward: 40,
    },
  ];
}
