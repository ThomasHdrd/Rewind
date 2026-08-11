import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Chart, GenreDistribution, StatisticCard, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionLabel } from "@/components/SectionLabel";
import { useHistory, useMediaStatusMap, useProfile, useTrackedGenres, useWatchedMediaIds } from "@/hooks/useMedia";
import { computeAvgRating, computeGenreDistribution, computeTopDay, computeWeeklyActivity } from "@/lib/statistics";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const GENRES_COLLAPSED_LIMIT = 5;

function formatWatchTime(totalHours: number): { months: number; days: number; hours: number } {
  const totalDays = Math.floor(totalHours / 24);
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  const hours = Math.round(totalHours % 24);
  return { months, days, hours };
}

export default function Statistics() {
  const { data: profile } = useProfile();
  const { data: history = [] } = useHistory();
  const { data: mediaStatus = {} } = useMediaStatusMap();
  const { data: watchedIds = [] } = useWatchedMediaIds();
  const [genresExpanded, setGenresExpanded] = useState(false);

  const { data: genreLists = [] } = useTrackedGenres(watchedIds);

  const weeklyActivity = useMemo(() => computeWeeklyActivity(history), [history]);
  const topDay = useMemo(() => computeTopDay(history), [history]);
  const avgRating = useMemo(() => computeAvgRating(mediaStatus), [mediaStatus]);
  const genreDistribution = useMemo(() => computeGenreDistribution(genreLists), [genreLists]);
  const hasActivity = weeklyActivity.some((v) => v > 0);

  if (!profile) return null;

  const watchTime = formatWatchTime(profile.hoursWatched);
  const visibleGenres = genresExpanded ? genreDistribution : genreDistribution.slice(0, GENRES_COLLAPSED_LIMIT);

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <ScreenHeader title="Statistics" />
        <Text style={styles.subtitle}>
          {profile.moviesCount} movies · {profile.episodesCount} episodes · {profile.hoursWatched}h watched
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        <SectionLabel>Time Watched</SectionLabel>
        <View style={styles.timeRow}>
          <View style={styles.timeCard}>
            <Text style={styles.timeValue}>{watchTime.months}</Text>
            <Text style={styles.timeLabel}>Months</Text>
          </View>
          <View style={styles.timeCard}>
            <Text style={styles.timeValue}>{watchTime.days}</Text>
            <Text style={styles.timeLabel}>Days</Text>
          </View>
          <View style={styles.timeCard}>
            <Text style={styles.timeValue}>{watchTime.hours}</Text>
            <Text style={styles.timeLabel}>Hours</Text>
          </View>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <SectionLabel>Weekly Activity</SectionLabel>
        {hasActivity ? (
          <View style={styles.chartCard}>
            <Chart values={weeklyActivity} />
            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((d, i) => (
                <Text key={i} style={styles.weekdayLabel}>
                  {d}
                </Text>
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.emptyHint}>Nothing logged this week yet — your daily activity will show up here.</Text>
        )}
      </View>

      <View style={{ gap: 10 }}>
        <SectionLabel>Favorite Genres</SectionLabel>
        {genreDistribution.length > 0 ? (
          <View style={{ gap: 8 }}>
            <GenreDistribution data={visibleGenres} />
            {genreDistribution.length > GENRES_COLLAPSED_LIMIT ? (
              <Pressable onPress={() => setGenresExpanded((v) => !v)}>
                <Text style={styles.showMore}>
                  {genresExpanded ? "Show less" : `Show ${genreDistribution.length - GENRES_COLLAPSED_LIMIT} more`}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Text style={styles.emptyHint}>Not enough data yet — track some movies or shows to see this.</Text>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatisticCard value={avgRating !== null ? avgRating.toFixed(1) : "—"} label="Avg. rating" />
        <StatisticCard value={topDay} label="Top day" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { color: theme.textTertiary, fontSize: 12, marginTop: 2 },
  emptyHint: { color: theme.textTertiary, fontSize: 12 },
  showMore: { color: theme.brandPrimary, fontSize: 12, fontWeight: "700" },
  timeRow: { flexDirection: "row", gap: 10 },
  timeCard: {
    flex: 1,
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    gap: 2,
  },
  timeValue: { color: theme.textPrimary, fontSize: 22, fontWeight: "800" },
  timeLabel: { color: theme.textTertiary, fontSize: 11 },
  chartCard: {
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  weekdayRow: { flexDirection: "row", justifyContent: "space-between" },
  weekdayLabel: { color: theme.textTertiary, fontSize: 10, flex: 1, textAlign: "center" },
});
