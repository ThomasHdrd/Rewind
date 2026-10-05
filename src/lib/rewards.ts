import { Challenge, HistoryEntry } from "@/types/media";
import { historyEntryDate } from "@/lib/history";

export interface Achievement {
  id: string;
  label: string;
  achieved: boolean;
  /** Real progress toward `total`, capped at total. */
  current: number;
  total: number;
  xpReward: number;
}

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
  // Higher tiers now that completed challenges and achievements add XP too.
  { name: "Binge Legend", minXp: 2000 },
  { name: "Rewind Master", minXp: 4000 },
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
    const d = historyEntryDate(entry);
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



// ---------------------------------------------------------------------------
// Daily + weekly challenges and tiered achievements, all derived from real
// activity and computed together with the profile (so they refresh on every
// watch/rate action — they used to be a separate query that was never
// refetched, which is why "2 movies watched" could still read 1/2).
// Completed challenges (for every past day/week in history) and unlocked
// achievements now actually ADD their XP to the total.
// ---------------------------------------------------------------------------

export interface AchievementGroup {
  category: string;
  items: Achievement[];
}

export interface RewardsInput {
  history: HistoryEntry[];
  /** ISO dates the user rated something (mediaStatus[*].ratedAt). */
  ratedDates: string[];
  ratedCount: number;
  episodesCount: number;
  moviesCount: number;
  seriesFinished: number;
  friendsCount: number;
  bestStreak: number;
  /** Video games (absent/zero for movie-only accounts). */
  games?: { completed: number; hours: number; hundred: number };
}

export interface RewardsState {
  daily: Challenge[];
  weekly: Challenge[];
  achievementGroups: AchievementGroup[];
  /** XP from every completed daily/weekly challenge ever + unlocked achievements. */
  bonusXp: number;
}

interface Period {
  episodes: number;
  movies: number;
  titles: Set<string>;
  seasons: number;
}

const isEpisodeEntry = (h: HistoryEntry) =>
  h.mediaId ? !h.mediaId.startsWith("movie:") : h.label.includes(" — E") || h.label.includes(" — Season");
const titleOf = (h: HistoryEntry) => h.mediaId ?? h.label.split(" — ")[0];
const localDayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function emptyPeriod(): Period {
  return { episodes: 0, movies: 0, titles: new Set(), seasons: 0 };
}

function addToPeriod(p: Period, h: HistoryEntry) {
  if (isEpisodeEntry(h)) p.episodes += Math.max(1, h.episodeIds?.length ?? 1);
  else p.movies += 1;
  p.titles.add(titleOf(h));
  if (h.label.includes(" — Season")) p.seasons += 1;
}

function weeklyFrom(p: Period): Challenge[] {
  const c = (id: string, label: string, value: number, total: number, xpReward: number): Challenge => ({
    id,
    label,
    current: Math.min(value, total),
    total,
    xpReward,
  });
  return [
    c("weekly-episodes", "5 episodes this week", p.episodes, 5, 30),
    c("weekly-movies", "2 movies this week", p.movies, 2, 25),
    c("weekly-variety", "3 different titles this week", p.titles.size, 3, 20),
    c("weekly-season", "Complete 1 season this week", p.seasons, 1, 40),
  ];
}

function dailyFrom(episodes: number, ratings: number): Challenge[] {
  return [
    { id: "daily-episode", label: "Watch an episode today", current: Math.min(episodes, 1), total: 1, xpReward: 10 },
    { id: "daily-rate", label: "Rate a title today", current: Math.min(ratings, 1), total: 1, xpReward: 10 },
  ];
}

const completedXp = (list: Challenge[]) => list.filter((c) => c.current >= c.total).reduce((s, c) => s + c.xpReward, 0);

function tier(id: string, label: string, value: number, total: number, xpReward: number): Achievement {
  return { id, label, achieved: value >= total, current: Math.min(value, total), total, xpReward };
}

export function computeRewardsState(input: RewardsInput): RewardsState {
  const now = new Date();
  const thisWeekKey = startOfWeek(now).getTime();
  const todayKey = localDayKey(now);

  const weeks = new Map<number, Period>();
  const dayEpisodes = new Map<string, number>();
  const allTitles = new Set<string>();
  for (const h of input.history) {
    const d = historyEntryDate(h);
    if (!d) continue;
    const wk = startOfWeek(d).getTime();
    const period = weeks.get(wk) ?? emptyPeriod();
    addToPeriod(period, h);
    weeks.set(wk, period);
    allTitles.add(titleOf(h));
    if (isEpisodeEntry(h)) dayEpisodes.set(localDayKey(d), (dayEpisodes.get(localDayKey(d)) ?? 0) + 1);
  }
  const dayRatings = new Map<string, number>();
  for (const iso of input.ratedDates) {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) dayRatings.set(localDayKey(d), (dayRatings.get(localDayKey(d)) ?? 0) + 1);
  }

  const weekly = weeklyFrom(weeks.get(thisWeekKey) ?? emptyPeriod());
  const daily = dailyFrom(dayEpisodes.get(todayKey) ?? 0, dayRatings.get(todayKey) ?? 0);

  const achievementGroups: AchievementGroup[] = [
    {
      category: "Watching",
      items: [
        tier("ach-ep-10", "Watch 10 episodes", input.episodesCount, 10, 20),
        tier("ach-ep-50", "Watch 50 episodes", input.episodesCount, 50, 40),
        tier("ach-ep-100", "Watch 100 episodes", input.episodesCount, 100, 80),
        tier("ach-ep-500", "Watch 500 episodes", input.episodesCount, 500, 200),
        tier("ach-mv-1", "Watch your first movie", input.moviesCount, 1, 15),
        tier("ach-mv-10", "Watch 10 movies", input.moviesCount, 10, 40),
        tier("ach-mv-50", "Watch 50 movies", input.moviesCount, 50, 120),
      ],
    },
    {
      category: "Completion",
      items: [
        tier("ach-fin-1", "Finish a series", input.seriesFinished, 1, 30),
        tier("ach-fin-5", "Finish 5 series", input.seriesFinished, 5, 100),
      ],
    },
    {
      category: "Habits",
      items: [
        tier("ach-streak-7", "7-day watching streak", input.bestStreak, 7, 40),
        tier("ach-streak-30", "30-day watching streak", input.bestStreak, 30, 150),
      ],
    },
    {
      category: "Explorer",
      items: [
        tier("ach-titles-10", "Watch 10 different titles", allTitles.size, 10, 20),
        tier("ach-titles-50", "Watch 50 different titles", allTitles.size, 50, 60),
      ],
    },
    {
      category: "Critic",
      items: [
        tier("ach-rate-10", "Rate 10 titles", input.ratedCount, 10, 20),
        tier("ach-rate-50", "Rate 50 titles", input.ratedCount, 50, 60),
      ],
    },
    ...(input.games && (input.games.completed > 0 || input.games.hours > 0)
      ? [
          {
            category: "Gamer",
            items: [
              tier("ach-game-1", "Finish your first game", input.games.completed, 1, 30),
              tier("ach-game-5", "Finish 5 games", input.games.completed, 5, 100),
              tier("ach-game-100h", "Play 100 hours", Math.floor(input.games.hours), 100, 80),
              tier("ach-game-100pct", "100% a game", input.games.hundred, 1, 60),
            ],
          },
        ]
      : []),
    {
      category: "Social",
      items: [
        tier("ach-friend-1", "Add your first friend", input.friendsCount, 1, 15),
        tier("ach-friend-5", "Add 5 friends", input.friendsCount, 5, 50),
      ],
    },
  ];

  // Every completed challenge in history counts, not just the current ones.
  let bonusXp = 0;
  for (const period of weeks.values()) bonusXp += completedXp(weeklyFrom(period));
  for (const key of new Set([...dayEpisodes.keys(), ...dayRatings.keys()])) {
    bonusXp += completedXp(dailyFrom(dayEpisodes.get(key) ?? 0, dayRatings.get(key) ?? 0));
  }
  for (const group of achievementGroups) bonusXp += group.items.filter((a) => a.achieved).reduce((s, a) => s + a.xpReward, 0);
  // Playing earns XP too: 50 per finished game, 2 per hour played.
  if (input.games) bonusXp += input.games.completed * 50 + Math.floor(input.games.hours) * 2;

  return { daily, weekly, achievementGroups, bonusXp };
}
