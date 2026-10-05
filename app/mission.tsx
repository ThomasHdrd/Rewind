import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MediaArtwork, Rating, radius, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { LoadingScreen } from "@/components/LoadingScreen";
import { SectionLabel } from "@/components/SectionLabel";
import { CommentsSection } from "@/components/CommentsSection";
import { goBack } from "@/lib/navigation";
import { igdbImageUrl } from "@/lib/games";
import { missionLabel } from "@/lib/gameMissions";
import {
  useGame,
  useMissionInfo,
  useMissionList,
  useMissionRatings,
  useRateMission,
  useSaveChecklist,
} from "@/hooks/useGames";
import { useToastStore } from "@/state/toastStore";

// A game's mission, opened from its list — the games' version of an episode
// page: tick, Rewind members' rating + mine, a short summary (from the
// game's fan wiki, credited) and comments.
export default function MissionDetail() {
  const { game: gameId, item: itemId } = useLocalSearchParams<{
    game: string;
    item: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: game } = useGame(gameId);
  const { items, achievements } = useMissionList(game);
  const { data: ratings = {} } = useMissionRatings(game);
  const { data: info } = useMissionInfo(game);
  const saveChecklist = useSaveChecklist();
  const rate = useRateMission();
  const showToast = useToastStore((s) => s.show);

  const item = items.find((i) => i.id === itemId);
  if (!game || !item) return <LoadingScreen />;
  const siblings = items.filter((i) => i.category === item.category);
  const index = siblings.findIndex((i) => i.id === item.id);
  const prev = siblings[index - 1];
  const next = siblings[index + 1];
  const steam =
    item.category === "achievement"
      ? achievements.find((a) => a.name === item.title)
      : undefined;
  const summary = steam
    ? {
        text: `${steam.description || "Hidden achievement."} Unlocked by ${steam.percent}% of Steam players.`,
        page: "",
      }
    : info?.items[item.id];
  const community = ratings[item.id];
  const myRating = game.missionRatings?.[item.id] ?? 0;

  const toggle = () => {
    const status = saveChecklist(
      game,
      items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)),
    );
    showToast(
      status === "completed"
        ? `${game.title} completed 🎉`
        : item.done
          ? "Marked as not done"
          : "Done",
    );
  };
  const open = (id: string) =>
    router.replace(
      `/mission?game=${encodeURIComponent(game.id)}&item=${encodeURIComponent(id)}`,
    );

  return (
    <Screen
      scroll
      edges={["bottom"]}
      contentStyle={{ padding: 0, paddingBottom: 110, gap: 0 }}
    >
      <View style={styles.backdrop}>
        <MediaArtwork
          uri={igdbImageUrl(
            game.screenshotIds?.[index % (game.screenshotIds?.length || 1)] ??
              game.coverImageId,
            "t_720p",
          )}
          color={theme.surfaceSecondary}
          style={{ width: "100%", height: "100%" }}
        />
        <LinearGradient
          colors={[
            "rgba(0,0,0,0.15)",
            "transparent",
            "rgba(5,8,16,0.55)",
            theme.bgPrimary,
          ]}
          locations={[0, 0.3, 0.75, 1]}
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          onPress={() => goBack(router)}
          style={[styles.roundBtn, { left: 14, top: insets.top + 10 }]}
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={16} color={theme.textPrimary} />
        </Pressable>
        <Pressable
          onPress={toggle}
          accessibilityLabel={item.done ? "Mark as not done" : "Mark as done"}
          hitSlop={8}
          style={[
            styles.roundBtn,
            {
              right: 14,
              top: insets.top + 10,
              backgroundColor: item.done ? theme.brandPrimary : "#0007",
            },
          ]}
        >
          <Text style={{ color: theme.textPrimary, fontSize: 14 }}>✓</Text>
        </Pressable>
        <View style={styles.overlayText}>
          <Text style={styles.overlayTitle}>{game.title}</Text>
          <Text style={styles.overlaySubtitle}>
            {missionLabel(item.category, index + 1)} · {item.title}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.ratingRow}>
          <View style={styles.ratingCard}>
            <Rating
              mode="community"
              value={community?.average ?? 0}
              count={community?.count ?? 0}
              // Missions have no outside score (episodes get TMDB's): only
              // Rewind players' votes, so an empty one is an invitation.
              emptyLabel="Be the first to rate"
            />
          </View>
          <View style={styles.ratingCard}>
            <Rating
              mode="user"
              value={myRating}
              interactive
              onChange={(rating) => {
                rate.mutate({ game, missionId: item.id, rating });
                showToast(rating ? "Rating saved" : "Rating removed");
              }}
            />
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <SectionLabel>Synopsis</SectionLabel>
          <Text style={summary ? styles.synopsis : styles.noSynopsis}>
            {summary?.text ?? "No synopsis for this mission yet."}
          </Text>
          {steam ? (
            <Text style={styles.source}>Source: Steam Community</Text>
          ) : null}
          {summary && info && !steam ? (
            <Pressable
              onPress={() =>
                Linking.openURL(
                  `https://${info.wiki}/wiki/${encodeURIComponent(summary.page.replace(/ /g, "_"))}`,
                )
              }
              hitSlop={6}
            >
              <Text style={styles.source}>
                Source: {info.wiki.split(".")[0]} wiki (CC BY-SA) · Read more ›
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.navRow}>
          {prev ? (
            <Pressable
              onPress={() => open(prev.id)}
              style={styles.navBtn}
              hitSlop={6}
            >
              <Text style={styles.navLabel} numberOfLines={1}>
                ‹ {prev.title}
              </Text>
            </Pressable>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {next ? (
            <Pressable
              onPress={() => open(next.id)}
              style={[styles.navBtn, { alignItems: "flex-end" }]}
              hitSlop={6}
            >
              <Text style={styles.navLabel} numberOfLines={1}>
                {next.title} ›
              </Text>
            </Pressable>
          ) : null}
        </View>

        <CommentsSection targetId={`${game.id}~${item.id}`} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backdrop: { height: 260, position: "relative" },
  roundBtn: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0007",
    alignItems: "center",
    justifyContent: "center",
  },
  overlayText: {
    position: "absolute",
    bottom: 14,
    left: 20,
    right: 20,
    gap: 2,
  },
  overlayTitle: { color: theme.textPrimary, fontSize: 19, fontWeight: "800" },
  overlaySubtitle: { color: theme.textSecondary, fontSize: 12 },
  body: { padding: 20, gap: 20 },
  ratingRow: { flexDirection: "row", gap: 10 },
  ratingCard: {
    flex: 1,
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.sm,
    padding: 12,
  },
  synopsis: { color: theme.textSecondary, fontSize: 13, lineHeight: 21 },
  noSynopsis: { color: theme.textTertiary, fontSize: 13, fontStyle: "italic" },
  source: { color: theme.textTertiary, fontSize: 11 },
  navRow: { flexDirection: "row", gap: 12 },
  navBtn: { flex: 1 },
  navLabel: { color: theme.brandPrimary, fontSize: 13, fontWeight: "700" },
});
