import { Media, WatchStatus } from "@/types/media";

/**
 * Derives the *effective* watch status for a media item, self-correcting for
 * series/TV using real per-episode progress instead of trusting the
 * write-time `status` flag alone (which episode-watch actions set but never
 * un-set/re-derive, so it can drift out of sync with actual progress).
 *
 * Movies have no progress concept — they always use the raw stored status.
 */
export function deriveEffectiveStatus(media: Pick<Media, "kind" | "status" | "totalEpisodes">, watchedEpisodeCount: number): WatchStatus | undefined {
  if (media.kind === "movie") return media.status;
  // An explicit "Stop watching" (dropped) wins over episode progress: the
  // watched episodes stay in history, but the series leaves Watching,
  // Continue Watching and Up Next.
  if (media.status === "dropped") return "dropped";
  // When we have a real total-episode count, trust real progress over the
  // stored status flag — the flag is write-time-only and nothing ever
  // downgrades it, so a series that was ever (even mistakenly, e.g. from an
  // earlier bug, or by watching just one season of a long-running show)
  // flagged "watched" would stay stuck showing as fully watched forever,
  // contradicting real per-episode progress. Real counts self-correct.
  if (media.totalEpisodes !== undefined && media.totalEpisodes > 0) {
    if (watchedEpisodeCount >= media.totalEpisodes) return "watched";
    if (watchedEpisodeCount > 0) return "watching";
    // Zero real progress contradicts a raw "watching" flag (you can't be
    // "in progress" with nothing watched — this happens when a stale
    // "watching" write from an earlier bug, or from un-marking every
    // episode, never got corrected back down). Downgrade that specific case
    // to "watchlist"; any other stored status (watchlist, or nothing) with
    // zero progress has nothing to contradict, so it's left alone.
    return media.status === "watching" ? "watchlist" : media.status;
  }
  // No total-episode data available to verify against — fall back to the
  // stored status as-is.
  return media.status;
}

/**
 * True when a series only still reads as "in progress" because every
 * episode TMDB currently knows about has been watched, and the next episode
 * genuinely hasn't aired yet (no nextEpisodeToAir, or its airDate is in the
 * future). This is different from the user simply being behind on content
 * that's already released — that case keeps totalEpisodes ahead of
 * watchedEpisodeCount and is left alone.
 */
export function isAwaitingUnreleasedEpisode(
  media: Pick<Media, "kind" | "totalEpisodes" | "nextEpisodeToAir">,
  watchedEpisodeCount: number
): boolean {
  if (media.kind !== "series" || media.totalEpisodes === undefined) return false;
  if (watchedEpisodeCount < media.totalEpisodes) return false;
  const airDate = media.nextEpisodeToAir?.airDate;
  if (!airDate) return true;
  const parsed = new Date(airDate);
  if (isNaN(parsed.getTime())) return true;
  return parsed.getTime() > Date.now();
}

/** False for an episode (or movie) whose air/release date is still in the
 * future — those can't be marked watched from anywhere. A missing or
 * unparseable date counts as aired (TMDB omits dates on some old titles). */
export function isAired(date?: string): boolean {
  if (!date) return true;
  const d = new Date(date);
  return isNaN(d.getTime()) || d.getTime() <= Date.now();
}

/**
 * The season a series page should open on: the first season the user hasn't
 * finished (so a finished season 1 isn't shown again), or the last season
 * once everything is watched. Unaired episodes count toward a season's
 * total, so a season still airing stays "current".
 */
export function currentSeasonFor(
  seasonsInfo: { number: number; episodeCount: number }[] | undefined,
  watchedPerSeason: Record<number, number> | undefined
): number | undefined {
  if (!seasonsInfo?.length || !watchedPerSeason) return undefined;
  const ordered = [...seasonsInfo].sort((a, b) => a.number - b.number);
  const unfinished = ordered.find((s) => (watchedPerSeason[s.number] ?? 0) < s.episodeCount);
  return (unfinished ?? ordered[ordered.length - 1]).number;
}
