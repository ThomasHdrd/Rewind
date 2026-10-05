import { HistoryEntry } from "@/types/media";
import { MediaStatusEntry } from "@/data/repositories/firestoreUser";
import { gameEntries, historyEntryDate, watchEntries } from "@/lib/history";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** 7 values (Sun..Sat) — counts of history entries per weekday, 0 when there's no (parseable) history. */
export function computeWeeklyActivity(history: HistoryEntry[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const entry of watchEntries(history)) {
    const date = historyEntryDate(entry);
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

// Below this many Rewind ratings, the in-app average mostly reflects one or
// two people (often the viewer themself), so it isn't shown.
export const MIN_REWIND_RATINGS = 3;

/** "Rewind members: 4.3/5 · 12" once enough members rated, else undefined. */
export function rewindRatingFootnote(media: { rewindRating?: number; rewindRatingCount?: number }): string | undefined {
  if (!media.rewindRating || !media.rewindRatingCount || media.rewindRatingCount < MIN_REWIND_RATINGS) return undefined;
  return `Rewind members: ${media.rewindRating.toFixed(1)}/5 · ${media.rewindRatingCount}`;
}

/**
 * The "Community" score: TMDB's votes and Rewind members' votes combined,
 * so rating a title visibly counts (130 votes → 131) and moves the average
 * by exactly one vote's weight.
 */
export function communityScore(media: {
  communityRating?: number;
  ratingCount?: number;
  rewindRating?: number;
  rewindRatingCount?: number;
}): { value: number; count: number } {
  const tmdbCount = media.communityRating ? media.ratingCount ?? 0 : 0;
  const rewindCount = media.rewindRating ? media.rewindRatingCount ?? 0 : 0;
  const count = tmdbCount + rewindCount;
  if (count === 0) return { value: media.communityRating ?? 0, count: media.ratingCount ?? 0 };
  const sum = (media.communityRating ?? 0) * tmdbCount + (media.rewindRating ?? 0) * rewindCount;
  return { value: Math.round((sum / count) * 10) / 10, count };
}

// ---- Period statistics (Statistics screen) ----

export type StatsPeriod = { kind: "month"; year: number; month: number } | { kind: "year"; year: number } | { kind: "all" };

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AVG_EPISODE_MINUTES = 45;
const DEFAULT_MOVIE_MINUTES = 110;

export interface PeriodStats {
  episodes: number;
  movies: number;
  minutes: number;
  titles: number;
  /** Activity per bucket: days of the month, months of the year, or years. */
  buckets: { label: string; value: number }[];
  /** Most watched series (episodes) and movies (watch count) in the period. */
  topSeries: { key: string; title: string; count: number }[];
  topMovies: { key: string; title: string; count: number }[];
}

function inPeriod(d: Date, p: StatsPeriod): boolean {
  if (p.kind === "all") return true;
  if (p.kind === "year") return d.getFullYear() === p.year;
  return d.getFullYear() === p.year && d.getMonth() === p.month;
}

export function previousPeriod(p: StatsPeriod): StatsPeriod | null {
  if (p.kind === "all") return null;
  if (p.kind === "year") return { kind: "year", year: p.year - 1 };
  return p.month === 0 ? { kind: "month", year: p.year - 1, month: 11 } : { kind: "month", year: p.year, month: p.month - 1 };
}

export function periodLabel(p: StatsPeriod): string {
  if (p.kind === "all") return "All time";
  if (p.kind === "year") return String(p.year);
  return new Date(p.year, p.month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Stats for one period from the dated watch history. `runtimeFor` gives a
 * movie's real runtime when known (episodes use the same 45-min estimate as
 * the profile). Titles are keyed by media id, or label title for old entries.
 */
export function computePeriodStats(
  history: HistoryEntry[],
  period: StatsPeriod,
  runtimeFor: (mediaId: string | undefined) => number | undefined = () => undefined
): PeriodStats {
  const entries = watchEntries(history)
    .map((h) => ({ h, d: historyEntryDate(h) }))
    .filter((x): x is { h: HistoryEntry; d: Date } => !!x.d && inPeriod(x.d, period));

  let buckets: { label: string; value: number }[];
  let bucketOf: (d: Date) => number;
  if (period.kind === "month") {
    const days = new Date(period.year, period.month + 1, 0).getDate();
    buckets = Array.from({ length: days }, (_, i) => ({ label: String(i + 1), value: 0 }));
    bucketOf = (d) => d.getDate() - 1;
  } else if (period.kind === "year") {
    buckets = MONTH_SHORT.map((label) => ({ label, value: 0 }));
    bucketOf = (d) => d.getMonth();
  } else {
    const years = entries.map((x) => x.d.getFullYear());
    const first = years.length ? Math.min(...years) : new Date().getFullYear();
    const last = new Date().getFullYear();
    buckets = Array.from({ length: last - first + 1 }, (_, i) => ({ label: String(first + i), value: 0 }));
    bucketOf = (d) => d.getFullYear() - first;
  }

  let episodes = 0;
  let movies = 0;
  let minutes = 0;
  const series = new Map<string, { title: string; count: number }>();
  const films = new Map<string, { title: string; count: number }>();
  for (const { h, d } of entries) {
    const isMovie = h.mediaId ? h.mediaId.startsWith("movie:") : !(h.label.includes(" — E") || h.label.includes(" — Season"));
    const title = h.label.split(" — ")[0];
    const key = h.mediaId ?? `title:${title}`;
    const weight = isMovie ? 1 : Math.max(1, h.episodeIds?.length ?? 1);
    if (isMovie) {
      movies += 1;
      minutes += runtimeFor(h.mediaId) || DEFAULT_MOVIE_MINUTES;
      const f = films.get(key) ?? { title, count: 0 };
      f.count += 1;
      films.set(key, f);
    } else {
      episodes += weight;
      minutes += weight * AVG_EPISODE_MINUTES;
      const s = series.get(key) ?? { title, count: 0 };
      s.count += weight;
      series.set(key, s);
    }
    const b = bucketOf(d);
    if (buckets[b]) buckets[b].value += weight;
  }
  const top = (m: Map<string, { title: string; count: number }>) =>
    Array.from(m.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  return {
    episodes,
    movies,
    minutes,
    titles: series.size + films.size,
    buckets,
    topSeries: top(series),
    topMovies: top(films),
  };
}

/** Count of your ratings per star value, 5★ first. */
export function ratingDistribution(mediaStatus: Record<string, MediaStatusEntry>): { stars: number; count: number }[] {
  const counts = [0, 0, 0, 0, 0];
  for (const v of Object.values(mediaStatus)) {
    const r = Math.round(v.rating ?? 0);
    if (r >= 1 && r <= 5) counts[r - 1] += 1;
  }
  return [5, 4, 3, 2, 1].map((stars) => ({ stars, count: counts[stars - 1] }));
}

/** "+25% vs September" style change, or null when there's nothing to compare. */
export function changeVsPrevious(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Video-game stats for a period (Statistics' separate "🎮 Games" side). */
export function computeGamePeriodStats(history: HistoryEntry[], period: StatsPeriod) {
  // Same buckets as the watch side, so both charts read the same way.
  const shell = computePeriodStats([], period);
  const buckets = shell.buckets.map((b) => ({ ...b }));
  let firstYear = 0;
  if (period.kind === "all") {
    const years = gameEntries(history)
      .map((h) => historyEntryDate(h)?.getFullYear())
      .filter((y): y is number => !!y);
    firstYear = years.length ? Math.min(...years) : new Date().getFullYear();
    buckets.length = 0;
    for (let y = firstYear; y <= new Date().getFullYear(); y++) buckets.push({ label: String(y), value: 0 });
  }
  const bucketOf = (d: Date) =>
    period.kind === "month" ? d.getDate() - 1 : period.kind === "year" ? d.getMonth() : d.getFullYear() - firstYear;

  let hours = 0;
  let completed = 0;
  const byGame = new Map<string, { title: string; hours: number }>();
  for (const h of gameEntries(history)) {
    const d = historyEntryDate(h);
    if (!d || !inPeriod(d, period)) continue;
    const title = h.label.split(" — ")[0];
    const g = byGame.get(h.mediaId!) ?? { title, hours: 0 };
    if (h.label.endsWith("— Completed")) completed += 1;
    if (h.hours) {
      hours += h.hours;
      g.hours += h.hours;
      const b = bucketOf(d);
      if (buckets[b]) buckets[b].value = Math.round((buckets[b].value + h.hours) * 10) / 10;
    }
    byGame.set(h.mediaId!, g);
  }
  const topGames = Array.from(byGame.entries())
    .filter(([, v]) => v.hours > 0)
    .map(([key, v]) => ({ key, title: v.title, count: Math.round(v.hours * 10) / 10 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  return { hours: Math.round(hours * 10) / 10, completed, gamesPlayed: byGame.size, buckets, topGames };
}
