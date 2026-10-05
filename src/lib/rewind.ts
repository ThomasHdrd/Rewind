import { HistoryEntry, Media } from "@/types/media";
import { gameEntries, historyEntryDate, watchEntries } from "@/lib/history";

// "Rewind" — the yearly recap (à la Spotify Wrapped / Deezer "My Year"),
// computed purely from the user's dated watch history for one calendar year.
// Episodes have no cheap per-episode runtime, so time uses the same 45-min
// estimate as the profile's hoursWatched (see firestore.ts getProfile).
const AVG_EPISODE_MINUTES = 45;
const DEFAULT_MOVIE_MINUTES = 110;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface RewindTitle {
  title: string;
  media?: Media;
  count: number;
  userRating?: number;
}

export interface RewindPersona {
  name: string;
  tagline: string;
}

export interface RewindData {
  year: number;
  /** False while the year is still running ("so far"). */
  isFinal: boolean;
  totalMinutes: number;
  moviesCount: number;
  episodesCount: number;
  titlesCount: number;
  /** Series by episodes watched this year, most first (top 5). */
  topSeries: RewindTitle[];
  /** Movies watched this year, best-rated first (top 5). */
  topMovies: RewindTitle[];
  topGenres: { label: string; percent: number }[];
  genresCount: number;
  busiestMonth: { name: string; count: number } | null;
  favoriteDay: string | null;
  bestStreak: number;
  biggestBinge: { dateLabel: string; episodes: number; title?: string } | null;
  persona: RewindPersona | null;
  /** Year in games (null when no game was played that year). */
  games?: GameRewind | null;
}

interface WatchEvent {
  date: Date;
  key: string;
  title: string;
  isMovie: boolean;
  episodes: number;
}

const titleFromLabel = (label: string) => label.split(" — ")[0];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** History entries dated within `year`, as normalized watch events. */
function eventsForYear(history: HistoryEntry[], year: number): WatchEvent[] {
  const events: WatchEvent[] = [];
  for (const entry of watchEntries(history)) {
    const date = historyEntryDate(entry);
    if (!date || date.getFullYear() !== year) continue;
    const isEpisodeLabel = entry.label.includes(" — E") || entry.label.includes(" — Season");
    const isMovie = entry.mediaId ? entry.mediaId.startsWith("movie:") : !isEpisodeLabel;
    events.push({
      date,
      key: entry.mediaId ?? `title:${titleFromLabel(entry.label)}`,
      title: titleFromLabel(entry.label),
      isMovie,
      // A season logged in bulk counts every episode it covered; entries from
      // before episode ids were stored count as one.
      episodes: isMovie ? 0 : Math.max(1, entry.episodeIds?.length ?? 1),
    });
  }
  return events;
}

/** Media ids worth fetching to resolve this year's titles (posters, genres, runtimes). */
export function rewindMediaIds(history: HistoryEntry[], year: number): string[] {
  return Array.from(
    new Set(eventsForYear(history, year).flatMap((e) => (e.key.startsWith("title:") ? [] : [e.key])))
  );
}

/** Whether any history entry predating stored media ids falls in `year` (needs title matching). */
export function rewindHasLegacyEntries(history: HistoryEntry[], year: number): boolean {
  return eventsForYear(history, year).some((e) => e.key.startsWith("title:"));
}

function longestStreak(days: Date[]): number {
  const sorted = Array.from(new Set(days.map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()))).sort(
    (a, b) => a - b
  );
  let best = sorted.length ? 1 : 0;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = Math.round((sorted[i] - sorted[i - 1]) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

function pickPersona(d: Omit<RewindData, "persona">, events: WatchEvent[]): RewindPersona | null {
  if (d.moviesCount + d.episodesCount === 0) return null;
  if (d.biggestBinge && d.biggestBinge.episodes >= 6) {
    return {
      name: "The Binge Machine",
      tagline: `Once you press play, there's no stopping you — ${d.biggestBinge.episodes} episodes in a single day.`,
    };
  }
  const nightEvents = events.filter((e) => e.date.getHours() >= 22 || e.date.getHours() < 4).length;
  if (events.length >= 5 && nightEvents / events.length >= 0.4) {
    return { name: "The Night Owl", tagline: "Your best stories start after 10pm. Sleep can wait." };
  }
  if (d.moviesCount >= 3 && d.moviesCount * 3 >= d.episodesCount) {
    return { name: "The Cinephile", tagline: `${d.moviesCount} movies this year. The big screen is your home.` };
  }
  const top = d.topSeries[0];
  if (top && d.episodesCount >= 5 && top.count / d.episodesCount >= 0.5) {
    return { name: "The Loyal Fan", tagline: `${top.title} owned your year. Some stories are worth living in.` };
  }
  if (d.genresCount >= 8) {
    return { name: "The Explorer", tagline: `${d.genresCount} different genres. You never watch the same thing twice.` };
  }
  return { name: "The Storyteller", tagline: "A little of everything, always chasing the next great story." };
}

export function computeRewind(
  history: HistoryEntry[],
  year: number,
  resolve: (key: string, title: string) => Media | undefined,
  userRatingFor: (mediaId: string) => number | undefined
): RewindData {
  const events = eventsForYear(history, year);

  const byTitle = new Map<string, RewindTitle & { isMovie: boolean }>();
  for (const e of events) {
    const media = resolve(e.key, e.title);
    // Group by resolved media id when we have one, so legacy title-only
    // entries and newer id-carrying entries for the same show merge.
    const groupKey = media?.id ?? e.key;
    const current = byTitle.get(groupKey) ?? {
      title: media?.title ?? e.title,
      media,
      count: 0,
      isMovie: e.isMovie,
      userRating: media ? userRatingFor(media.id) : undefined,
    };
    current.count += e.isMovie ? 1 : e.episodes;
    byTitle.set(groupKey, current);
  }
  const titles = Array.from(byTitle.values());

  const moviesCount = events.filter((e) => e.isMovie).length;
  const episodesCount = events.reduce((sum, e) => sum + e.episodes, 0);
  const movieMinutes = titles
    .filter((t) => t.isMovie)
    .reduce((sum, t) => sum + t.count * (t.media?.runtimeMinutes || DEFAULT_MOVIE_MINUTES), 0);
  const totalMinutes = movieMinutes + episodesCount * AVG_EPISODE_MINUTES;

  const strip = ({ isMovie, ...t }: RewindTitle & { isMovie: boolean }): RewindTitle => t;
  const topSeries = titles.filter((t) => !t.isMovie).sort((a, b) => b.count - a.count).slice(0, 5).map(strip);
  const topMovies = titles
    .filter((t) => t.isMovie)
    .sort((a, b) => (b.userRating ?? 0) - (a.userRating ?? 0) || b.count - a.count)
    .slice(0, 5)
    .map(strip);

  // Genres weighted by how much was watched (a 20-episode binge counts more
  // than one movie).
  const genreCounts = new Map<string, number>();
  let genreTotal = 0;
  for (const t of titles) {
    for (const g of t.media?.genres ?? []) {
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + t.count);
      genreTotal += t.count;
    }
  }
  const topGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, count]) => ({ label, percent: Math.round((count / genreTotal) * 100) }));

  const perMonth = new Array(12).fill(0);
  const perWeekday = new Array(7).fill(0);
  const perDay = new Map<string, { date: Date; episodes: number; titles: Map<string, number> }>();
  for (const e of events) {
    const weight = e.isMovie ? 1 : e.episodes;
    perMonth[e.date.getMonth()] += weight;
    perWeekday[e.date.getDay()] += weight;
    if (!e.isMovie) {
      const k = dayKey(e.date);
      const day = perDay.get(k) ?? { date: e.date, episodes: 0, titles: new Map() };
      day.episodes += e.episodes;
      day.titles.set(e.title, (day.titles.get(e.title) ?? 0) + e.episodes);
      perDay.set(k, day);
    }
  }
  const monthMax = Math.max(...perMonth);
  const weekdayMax = Math.max(...perWeekday);
  const bingeDay = Array.from(perDay.values()).sort((a, b) => b.episodes - a.episodes)[0];

  const base: Omit<RewindData, "persona"> = {
    year,
    // December is "release month" (see RewindAutoOpen): the year reads as a
    // full recap from then on, not "so far".
    isFinal: new Date().getFullYear() > year || new Date().getMonth() === 11,
    totalMinutes,
    moviesCount,
    episodesCount,
    titlesCount: titles.length,
    topSeries,
    topMovies,
    topGenres,
    genresCount: genreCounts.size,
    busiestMonth: monthMax > 0 ? { name: MONTHS[perMonth.indexOf(monthMax)], count: monthMax } : null,
    favoriteDay: weekdayMax > 0 ? WEEKDAYS[perWeekday.indexOf(weekdayMax)] : null,
    bestStreak: longestStreak(events.map((e) => e.date)),
    biggestBinge:
      bingeDay && bingeDay.episodes >= 2
        ? {
            dateLabel: bingeDay.date.toLocaleDateString("en-US", { month: "long", day: "numeric" }),
            episodes: bingeDay.episodes,
            title: Array.from(bingeDay.titles.entries()).sort((a, b) => b[1] - a[1])[0]?.[0],
          }
        : null,
  };
  return { ...base, persona: pickPersona(base, events) };
}

// ---- Games part of the yearly Rewind (its own slide) ----

export interface GameRewind {
  hours: number;
  finished: number;
  gamesPlayed: number;
  topGame?: { id: string; title: string; hours: number; coverUrl?: string };
}

/** Year in games from the history ("Played" hours + "Completed" entries). */
export function computeGameRewind(history: HistoryEntry[], year: number): GameRewind | null {
  let hours = 0;
  let finished = 0;
  const perGame = new Map<string, { title: string; hours: number }>();
  for (const h of gameEntries(history)) {
    const d = historyEntryDate(h);
    if (!d || d.getFullYear() !== year) continue;
    const title = h.label.split(" — ")[0];
    const g = perGame.get(h.mediaId!) ?? { title, hours: 0 };
    if (h.hours) {
      hours += h.hours;
      g.hours += h.hours;
    }
    if (h.label.endsWith("— Completed")) finished += 1;
    perGame.set(h.mediaId!, g);
  }
  if (perGame.size === 0) return null;
  const [topId, top] = Array.from(perGame.entries()).sort((a, b) => b[1].hours - a[1].hours)[0];
  return {
    hours: Math.round(hours),
    finished,
    gamesPlayed: perGame.size,
    topGame: { id: topId, title: top.title, hours: Math.round(top.hours) },
  };
}
