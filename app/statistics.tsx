import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Chip,
  GenreDistribution,
  MediaArtwork,
  StatisticCard,
  radius,
  theme,
} from "@/design-system";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionLabel } from "@/components/SectionLabel";
import { BarChart } from "@/components/BarChart";
import { useMyGames, useTracks } from "@/hooks/useGames";
import { igdbImageUrl } from "@/lib/games";
import { Game } from "@/data/games/types";
import { HistoryEntry } from "@/types/media";
import {
  useHistory,
  useHistoryMedia,
  useMediaStatusMap,
  useProfile,
  useTrackedGenres,
  useWatchedMediaIds,
} from "@/hooks/useMedia";
import {
  StatsPeriod,
  changeVsPrevious,
  computeAvgRating,
  computeGenreDistribution,
  computeGamePeriodStats,
  computePeriodStats,
  computeTopDay,
  periodLabel,
  previousPeriod,
  ratingDistribution,
} from "@/lib/statistics";

const GENRES_COLLAPSED_LIMIT = 5;
type Mode = "Month" | "Year" | "All time";
const SIDES = [
  { value: "watch", label: "🎬 Movies & Series" },
  { value: "play", label: "🎮 Games" },
] as const;
const STATUS_LABEL = {
  backlog: "To play",
  playing: "Playing",
  completed: "Completed",
} as const;

export default function Statistics() {
  const router = useRouter();
  const now = new Date();
  const { data: profile } = useProfile();
  const { data: history = [] } = useHistory();
  const { data: resolved } = useHistoryMedia(history);
  const { data: mediaStatus = {} } = useMediaStatusMap();
  const { data: watchedIds = [] } = useWatchedMediaIds();
  const { data: genreLists = [] } = useTrackedGenres(watchedIds);
  const [mode, setMode] = useState<Mode>("Month");
  const [cursor, setCursor] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });
  const [genresExpanded, setGenresExpanded] = useState(false);

  const period: StatsPeriod =
    mode === "Month"
      ? { kind: "month", year: cursor.year, month: cursor.month }
      : mode === "Year"
        ? { kind: "year", year: cursor.year }
        : { kind: "all" };
  const runtimeFor = (id?: string) =>
    id ? resolved?.byId[id]?.runtimeMinutes : undefined;
  const stats = useMemo(
    () => computePeriodStats(history, period, runtimeFor),
    // period/runtimeFor are rebuilt every render; these are their real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, resolved, mode, cursor.year, cursor.month],
  );
  const prev = previousPeriod(period);
  const prevStats = useMemo(
    () => (prev ? computePeriodStats(history, prev, runtimeFor) : null),
    // period/runtimeFor are rebuilt every render; these are their real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, resolved, mode, cursor.year, cursor.month],
  );

  const tracks = useTracks();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const [side, setSide] = useState<"watch" | "play">(
    section === "play" ? "play" : "watch",
  );
  const showGames = tracks.play && (!tracks.watch || side === "play");
  const { data: myGames = [] } = useMyGames(tracks.play);
  const genreDistribution = useMemo(
    () => computeGenreDistribution(genreLists),
    [genreLists],
  );
  const avgRating = useMemo(() => computeAvgRating(mediaStatus), [mediaStatus]);
  const ratings = useMemo(() => ratingDistribution(mediaStatus), [mediaStatus]);
  const topDay = useMemo(() => computeTopDay(history), [history]);
  const maxRatingCount = Math.max(1, ...ratings.map((r) => r.count));

  if (!profile) return null;

  const isCurrent =
    mode === "All time" ||
    (cursor.year === now.getFullYear() &&
      (mode === "Year" || cursor.month === now.getMonth()));
  const step = (dir: -1 | 1) =>
    setCursor((c) => {
      if (mode === "Year") return { ...c, year: c.year + dir };
      const m = c.month + dir;
      return m < 0
        ? { year: c.year - 1, month: 11 }
        : m > 11
          ? { year: c.year + 1, month: 0 }
          : { ...c, month: m };
    });
  const hours = Math.round(stats.minutes / 60);
  const change = prevStats
    ? changeVsPrevious(
        stats.episodes + stats.movies,
        prevStats.episodes + prevStats.movies,
      )
    : null;
  const visibleGenres = genresExpanded
    ? genreDistribution
    : genreDistribution.slice(0, GENRES_COLLAPSED_LIMIT);
  const open = (key: string) => {
    if (key.startsWith("movie:")) router.push(`/movie/${key}`);
    else if (key.startsWith("tv:")) router.push(`/series/${key}`);
  };

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <ScreenHeader title="Statistics" />
        <Text style={styles.subtitle}>
          {showGames
            ? `All time: ${profile.gamesCount ?? 0} games · ${profile.gamesCompleted ?? 0} completed · ${profile.hoursPlayed ?? 0}h played`
            : `All time: ${profile.moviesCount} movies · ${profile.episodesCount} episodes · ${profile.hoursWatched}h watched`}
        </Text>
      </View>

      {/* Separate sides, like Discover: watch stats and game stats are
          measured differently (episodes vs hours) and never mixed. */}
      {tracks.play && tracks.watch ? (
        <View style={styles.sideSwitch}>
          {SIDES.map((o) => {
            const selected = (o.value === "play") === showGames;
            return (
              <Pressable
                key={o.value}
                style={[styles.sideOption, selected && styles.sideOptionActive]}
                onPress={() => setSide(o.value)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[styles.sideLabel, selected && styles.sideLabelActive]}
                >
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.modes}>
        {(["Month", "Year", "All time"] as Mode[]).map((m) => (
          <Chip
            key={m}
            label={m}
            selected={mode === m}
            onPress={() => setMode(m)}
          />
        ))}
      </View>

      {mode !== "All time" ? (
        <View style={styles.stepper}>
          <Pressable
            onPress={() => step(-1)}
            hitSlop={10}
            accessibilityLabel="Previous period"
          >
            <Ionicons name="chevron-back" size={20} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.periodLabel}>{periodLabel(period)}</Text>
          <Pressable
            onPress={() => step(1)}
            disabled={isCurrent}
            hitSlop={10}
            accessibilityLabel="Next period"
            style={{ opacity: isCurrent ? 0.3 : 1 }}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textPrimary}
            />
          </Pressable>
        </View>
      ) : null}

      {showGames ? (
        <GameStats
          history={history}
          period={period}
          myGames={myGames}
          onOpen={(id) => router.push(`/game/${id}`)}
        />
      ) : (
        <>
          <View style={styles.statsGrid}>
            <View style={styles.cell}>
              <StatisticCard value={stats.episodes} label="Episodes" />
            </View>
            <View style={styles.cell}>
              <StatisticCard value={stats.movies} label="Movies" />
            </View>
            <View style={styles.cell}>
              <StatisticCard value={`${hours}h`} label="Watched" />
            </View>
            <View style={styles.cell}>
              <StatisticCard value={stats.titles} label="Titles" />
            </View>
          </View>
          {change !== null && prev ? (
            <Text style={styles.change}>
              {change >= 0 ? "▲" : "▼"} {Math.abs(change)}%{" "}
              {change >= 0 ? "more" : "less"} than {periodLabel(prev)}
            </Text>
          ) : null}

          <View style={styles.card}>
            <SectionLabel>Activity</SectionLabel>
            <BarChart
              buckets={stats.buckets}
              unit="watched"
              labelEvery={mode === "Month" ? 5 : 1}
              describe={(label) =>
                mode === "Month"
                  ? new Date(
                      cursor.year,
                      cursor.month,
                      Number(label),
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : label
              }
            />
          </View>

          {stats.topSeries.length > 0 ? (
            <TopList
              title="Top series"
              unit="ep"
              items={stats.topSeries}
              resolved={resolved}
              onOpen={open}
            />
          ) : null}
          {stats.topMovies.length > 0 ? (
            <TopList
              title="Movies watched"
              unit="×"
              items={stats.topMovies}
              resolved={resolved}
              onOpen={open}
            />
          ) : null}

          <View style={{ gap: 10 }}>
            <SectionLabel>Favorite genres · all time</SectionLabel>
            {genreDistribution.length > 0 ? (
              <View style={{ gap: 8 }}>
                <GenreDistribution data={visibleGenres} />
                {genreDistribution.length > GENRES_COLLAPSED_LIMIT ? (
                  <Pressable onPress={() => setGenresExpanded((v) => !v)}>
                    <Text style={styles.showMore}>
                      {genresExpanded
                        ? "Show less"
                        : `Show ${genreDistribution.length - GENRES_COLLAPSED_LIMIT} more`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Text style={styles.emptyHint}>
                Track some movies or shows to see this.
              </Text>
            )}
          </View>

          <View style={{ gap: 10 }}>
            <SectionLabel>Your ratings · all time</SectionLabel>
            <View style={{ gap: 6 }}>
              {ratings.map((r) => (
                <View key={r.stars} style={styles.ratingRow}>
                  <Text style={styles.ratingLabel}>{r.stars}★</Text>
                  <View style={styles.ratingTrack}>
                    <View
                      style={[
                        styles.ratingFill,
                        {
                          width: r.count
                            ? `${Math.max(3, (r.count / maxRatingCount) * 100)}%`
                            : 0,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.ratingCount}>{r.count}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <StatisticCard
              value={avgRating !== null ? avgRating.toFixed(1) : "—"}
              label="Avg. rating"
            />
            <StatisticCard value={topDay} label="Top day" />
            <StatisticCard value={profile.bestStreak} label="Best streak" />
          </View>
        </>
      )}
    </Screen>
  );
}

function GameStats({
  history,
  period,
  myGames,
  onOpen,
}: {
  history: HistoryEntry[];
  period: StatsPeriod;
  myGames: Game[];
  onOpen: (id: string) => void;
}) {
  const stats = useMemo(
    () => computeGamePeriodStats(history, period),
    [history, period],
  );
  const prev = previousPeriod(period);
  const prevStats = prev ? computeGamePeriodStats(history, prev) : null;
  const change = prevStats
    ? changeVsPrevious(stats.hours, prevStats.hours)
    : null;
  const byStatus = (["backlog", "playing", "completed"] as const).map((st) => ({
    st,
    count: myGames.filter((g) => g.status === st).length,
  }));
  const consoleCounts = new Map<string, number>();
  for (const g of myGames)
    if (g.platform)
      consoleCounts.set(g.platform, (consoleCounts.get(g.platform) ?? 0) + 1);
  const consoles = Array.from(consoleCounts).sort((a, b) => b[1] - a[1]);
  const maxConsole = Math.max(1, ...consoles.map(([, n]) => n));
  const rated = myGames.filter((g) => (g.userRating ?? 0) > 0);
  const avg = rated.length
    ? rated.reduce((sum, g) => sum + (g.userRating ?? 0), 0) / rated.length
    : null;

  return (
    <>
      <View style={styles.statsGrid}>
        <View style={styles.cell}>
          <StatisticCard value={`${stats.hours}h`} label="Played" />
        </View>
        <View style={styles.cell}>
          <StatisticCard value={stats.completed} label="Finished" />
        </View>
        <View style={styles.cell}>
          <StatisticCard value={stats.gamesPlayed} label="Games" />
        </View>
        <View style={styles.cell}>
          <StatisticCard
            value={myGames.filter((g) => g.hundredPercent).length}
            label="100% · all time"
          />
        </View>
      </View>
      {change !== null && prev ? (
        <Text style={styles.change}>
          {change >= 0 ? "▲" : "▼"} {Math.abs(change)}%{" "}
          {change >= 0 ? "more" : "less"} playtime than {periodLabel(prev)}
        </Text>
      ) : null}

      <View style={styles.card}>
        <SectionLabel>Hours played</SectionLabel>
        <BarChart
          buckets={stats.buckets}
          unit="h played"
          labelEvery={period.kind === "month" ? 5 : 1}
          describe={(label) =>
            period.kind === "month"
              ? new Date(
                  period.year,
                  period.month,
                  Number(label),
                ).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : label
          }
        />
      </View>

      {stats.topGames.length > 0 ? (
        <View style={{ gap: 6 }}>
          <SectionLabel>Most played</SectionLabel>
          {stats.topGames.map((t, i) => {
            const g = myGames.find((x) => x.id === t.key);
            return (
              <Pressable
                key={t.key}
                style={styles.topRow}
                onPress={() => onOpen(t.key)}
              >
                <Text style={styles.rank}>{i + 1}</Text>
                <MediaArtwork
                  uri={igdbImageUrl(g?.coverImageId, "t_cover_small")}
                  color={theme.surfaceSecondary}
                  radius={radius.sm}
                  style={{ width: 32, height: 44 }}
                />
                <Text style={styles.topTitle} numberOfLines={1}>
                  {g?.title ?? t.title}
                </Text>
                <Text style={styles.topCount}>{t.count} h</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <SectionLabel>Your games · all time</SectionLabel>
        <View style={styles.statusRow}>
          {byStatus.map(({ st, count }) => (
            <View key={st} style={styles.statusCell}>
              <Text style={styles.statusValue}>{count}</Text>
              <Text style={styles.statusLabel}>{STATUS_LABEL[st]}</Text>
            </View>
          ))}
        </View>
      </View>

      {consoles.length > 0 ? (
        <View style={{ gap: 10 }}>
          <SectionLabel>Consoles · all time</SectionLabel>
          <View style={{ gap: 6 }}>
            {consoles.map(([name, n]) => (
              <View key={name} style={styles.ratingRow}>
                <Text style={[styles.ratingLabel, { width: 84 }]}>{name}</Text>
                <View style={styles.ratingTrack}>
                  <View
                    style={[
                      styles.ratingFill,
                      { width: `${Math.max(3, (n / maxConsole) * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.ratingCount}>{n}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatisticCard
          value={avg !== null ? avg.toFixed(1) : "—"}
          label="Avg. game rating"
        />
      </View>
    </>
  );
}

function TopList({
  title,
  unit,
  items,
  resolved,
  onOpen,
}: {
  title: string;
  unit: string;
  items: { key: string; title: string; count: number }[];
  resolved?: { byId: Record<string, import("@/types/media").Media> };
  onOpen: (key: string) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <SectionLabel>{title}</SectionLabel>
      {items.map((t, i) => {
        const media = resolved?.byId[t.key];
        return (
          <Pressable
            key={t.key}
            style={styles.topRow}
            onPress={() => onOpen(t.key)}
          >
            <Text style={styles.rank}>{i + 1}</Text>
            <MediaArtwork
              path={media?.posterPath}
              size="w185"
              color={media?.artworkColor ?? theme.surfaceSecondary}
              radius={radius.sm}
              style={{ width: 32, height: 48 }}
            />
            <Text style={styles.topTitle} numberOfLines={1}>
              {media?.title ?? t.title}
            </Text>
            <Text style={styles.topCount}>
              {t.count} {unit}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { color: theme.textTertiary, fontSize: 12, marginTop: 2 },
  modes: { flexDirection: "row", gap: 8 },
  sideSwitch: {
    flexDirection: "row",
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.full,
    padding: 4,
    gap: 4,
  },
  sideOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  sideOptionActive: { backgroundColor: theme.brandPrimary },
  sideLabel: { color: theme.textSecondary, fontSize: 14, fontWeight: "700" },
  sideLabelActive: { color: theme.textInverse },
  statusRow: { flexDirection: "row", gap: 6 },
  statusCell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.md,
    paddingVertical: 10,
  },
  statusValue: { color: theme.textPrimary, fontSize: 18, fontWeight: "800" },
  statusLabel: { color: theme.textTertiary, fontSize: 10 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  periodLabel: { color: theme.textPrimary, fontSize: 16, fontWeight: "800" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: { width: "48%", flexGrow: 1 },
  change: { color: theme.textSecondary, fontSize: 12 },
  card: {
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  emptyHint: { color: theme.textTertiary, fontSize: 12 },
  showMore: { color: theme.brandPrimary, fontSize: 12, fontWeight: "700" },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  rank: {
    color: theme.textTertiary,
    fontSize: 13,
    fontWeight: "800",
    width: 16,
  },
  topTitle: {
    flex: 1,
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  topCount: { color: theme.textSecondary, fontSize: 12 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ratingLabel: { color: theme.textSecondary, fontSize: 12, width: 24 },
  ratingTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.surfacePrimary,
    overflow: "hidden",
  },
  ratingFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: theme.brandPrimary,
  },
  ratingCount: {
    color: theme.textSecondary,
    fontSize: 12,
    width: 28,
    textAlign: "right",
  },
});
