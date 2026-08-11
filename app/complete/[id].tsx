import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { useEpisodes, useMediaDetail } from "@/hooks/useMedia";

export default function Complete() {
  const { id, kind, season } = useLocalSearchParams<{ id: string; kind?: string; season?: string }>();
  const router = useRouter();
  const { data: media } = useMediaDetail(id);
  const isSeason = kind === "season";
  const seasonNumber = Number(season ?? 1);
  const { data: seasonEpisodes = [] } = useEpisodes(id, isSeason ? seasonNumber : undefined);

  if (!media) return null;

  const watchedCount = seasonEpisodes.filter((e) => e.watched).length;
  const totalCount = seasonEpisodes.length;
  const hasNextSeason = isSeason && !!media.seasons && seasonNumber < media.seasons;

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.badge}>
        <Text style={styles.check}>✓</Text>
      </View>
      <Text style={styles.label}>{isSeason ? "Season Completed" : "Movie Completed"}</Text>
      <Text style={styles.title}>
        {isSeason ? `${media.title} — Season ${season ?? "1"}` : media.title}
      </Text>
      {isSeason ? (
        <Text style={styles.subtitle}>
          {watchedCount}/{totalCount} episodes · rate this season
        </Text>
      ) : null}
      {isSeason ? (
        <Button
          onPress={() =>
            hasNextSeason ? router.replace(`/series/${media.id}?season=${seasonNumber + 1}`) : router.replace(`/series/${media.id}`)
          }
          style={{ marginTop: 8 }}
        >
          {hasNextSeason ? `Start Season ${seasonNumber + 1}` : "Back to series"}
        </Button>
      ) : (
        <Button onPress={() => router.push(`/rate/${media.id}`)} style={{ marginTop: 8 }}>
          Rate this movie
        </Button>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: "center", justifyContent: "center", flex: 1, gap: 4, padding: 24 },
  badge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.brandPrimarySubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  check: { color: theme.brandPrimary, fontSize: 22 },
  label: { color: theme.textTertiary, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, marginBottom: 4 },
  title: { color: theme.textPrimary, fontSize: 18, fontWeight: "800", textAlign: "center" },
  subtitle: { color: theme.textSecondary, fontSize: 13, marginTop: 4, marginBottom: 20 },
});
