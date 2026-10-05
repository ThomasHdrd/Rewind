import React, { useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Chip,
  Input,
  MediaArtwork,
  PosterCard,
  Rating,
  radius,
  theme,
} from "@/design-system";
import { GameChecklist } from "@/components/GameChecklist";
import { Screen } from "@/components/Screen";
import { SectionLabel } from "@/components/SectionLabel";
import { HScroll } from "@/components/HScroll";
import { CommentsSection } from "@/components/CommentsSection";
import { LoadingScreen } from "@/components/LoadingScreen";
import { goBack } from "@/lib/navigation";
import { igdbImageUrl } from "@/lib/games";
import { nextMainMission } from "@/lib/gameMissions";
import { communityScore, rewindRatingFootnote } from "@/lib/statistics";
import { useToastStore } from "@/state/toastStore";
import {
  useGame,
  useRateGame,
  useMissionList,
  useSetGameFavorite,
  useSetGameHours,
  useSetGameStatus,
  useSimilarGames,
  useUpdateGameEntry,
} from "@/hooks/useGames";
import { GameStatus } from "@/data/games/types";

const STATUSES: { value: GameStatus; label: string }[] = [
  { value: "backlog", label: "To play" },
  { value: "playing", label: "Playing" },
  { value: "completed", label: "Completed" },
];

// Where to buy/play: the platform stores' own search for the title (no
// free source maps games to Game Pass / PS Plus catalogs).
const STORE_SEARCH: Record<
  string,
  { name: string; url: (q: string) => string }
> = {
  PS5: {
    name: "PlayStation Store",
    url: (q) => `https://store.playstation.com/search/${q}`,
  },
  PS4: {
    name: "PlayStation Store",
    url: (q) => `https://store.playstation.com/search/${q}`,
  },
  "Xbox Series": {
    name: "Xbox Store",
    url: (q) => `https://www.xbox.com/search?q=${q}`,
  },
  "Xbox One": {
    name: "Xbox Store",
    url: (q) => `https://www.xbox.com/search?q=${q}`,
  },
  Switch: {
    name: "Nintendo eShop",
    url: (q) => `https://www.nintendo.com/search/?q=${q}`,
  },
  PC: {
    name: "Steam",
    url: (q) => `https://store.steampowered.com/search/?term=${q}`,
  },
  Mac: {
    name: "Steam",
    url: (q) => `https://store.steampowered.com/search/?term=${q}`,
  },
};

export default function GameDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: game } = useGame(id);
  const { data: similar = [] } = useSimilarGames(game);
  const setStatus = useSetGameStatus();
  const setFavorite = useSetGameFavorite();
  const { items: missionItems } = useMissionList(game);
  const updateEntry = useUpdateGameEntry();
  const rate = useRateGame();
  const setHours = useSetGameHours();
  const [editingHours, setEditingHours] = useState(false);
  const [hoursDraft, setHoursDraft] = useState("");
  const showToast = useToastStore((s) => s.show);

  if (!game) return <LoadingScreen />;

  const stores = Array.from(
    new Map(
      game.platforms
        .filter((p) => STORE_SEARCH[p])
        .map((p) => [STORE_SEARCH[p].name, STORE_SEARCH[p]]),
    ).values(),
  );
  // Not out yet: it can be followed (To play) but not played or finished —
  // same rule as unaired episodes.
  const released =
    !game.releaseDate ||
    game.releaseDate <= new Date().toISOString().slice(0, 10);
  const releaseLabel = game.releaseDate
    ? new Date(game.releaseDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const hours = game.hours ?? 0;
  const target = game.hundredPercent
    ? game.timeToBeat?.completionist
    : game.timeToBeat?.main;
  // Finished but no time logged: show the typical length as an estimate
  // rather than a contradictory "0 h played" (people rarely know their real
  // hours). Stats only ever count hours the user actually logged.
  // Ticked missions without logged time: estimate from story progress
  // (half the main missions of a 40 h game ≈ 20 h).
  const story = nextMainMission(missionItems);
  const fromMissions =
    hours === 0 &&
    game.status !== "completed" &&
    story.done > 0 &&
    game.timeToBeat?.main
      ? Math.max(
          1,
          Math.round((game.timeToBeat.main * story.done) / story.total),
        )
      : null;
  const estimated =
    hours === 0 && game.status === "completed" && target
      ? target
      : fromMissions;
  const saveHours = () => {
    const n = Number(hoursDraft.replace(",", "."));
    if (!isNaN(n) && n >= 0) setHours.mutate({ game, hours: n });
    setEditingHours(false);
  };
  const score = communityScore({
    communityRating: game.rating,
    ratingCount: game.ratingCount,
    rewindRating: game.rewindRating,
    rewindRatingCount: game.rewindRatingCount,
  });

  return (
    <Screen
      scroll
      edges={["bottom"]}
      contentStyle={{ padding: 0, paddingBottom: 110, gap: 0 }}
    >
      <View style={styles.backdrop}>
        <MediaArtwork
          uri={igdbImageUrl(
            game.screenshotIds?.[0] ?? game.coverImageId,
            game.screenshotIds?.[0] ? "t_720p" : "t_cover_big",
          )}
          color={theme.surfaceSecondary}
          style={{ width: "100%", height: "100%" }}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.1)", "transparent", theme.bgPrimary]}
          locations={[0, 0.35, 1]}
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          onPress={() => goBack(router)}
          style={[styles.backBtn, { top: insets.top + 10 }]}
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={16} color={theme.textPrimary} />
        </Pressable>
        {game.trailerKey ? (
          <Pressable
            style={[styles.trailer, { top: insets.top + 10 }]}
            onPress={() =>
              Linking.openURL(
                `https://www.youtube.com/watch?v=${game.trailerKey}`,
              )
            }
          >
            <Text style={styles.trailerLabel}>▶ Trailer</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <MediaArtwork
            uri={igdbImageUrl(game.coverImageId)}
            color={theme.surfaceSecondary}
            radius={radius.md}
            style={styles.cover}
          />
          <View style={styles.headerText}>
            <Text style={styles.title}>{game.title}</Text>
            <Text style={styles.meta}>
              🎮 {game.year ? `${game.year} · ` : ""}
              {game.genres.slice(0, 2).join(", ")}
            </Text>
            <Text style={styles.meta} numberOfLines={2}>
              {game.platforms.join(" · ")}
            </Text>
          </View>
          <Pressable
            style={[styles.heart, game.favorite && styles.heartActive]}
            accessibilityRole="button"
            accessibilityLabel={
              game.favorite ? "Remove from favorites" : "Add to favorites"
            }
            accessibilityState={{ selected: !!game.favorite }}
            onPress={() => {
              setFavorite.mutate({ game, favorite: !game.favorite });
              showToast(
                game.favorite ? "Removed from favorites" : "Added to favorites",
              );
            }}
          >
            <Ionicons
              name={game.favorite ? "heart" : "heart-outline"}
              size={20}
              color={game.favorite ? theme.textInverse : theme.textSecondary}
            />
          </Pressable>
        </View>

        <View style={{ gap: 8 }}>
          <View style={styles.wrap}>
            {STATUSES.map((s) => (
              <Chip
                key={s.value}
                label={s.label}
                selected={game.status === s.value}
                onPress={() => {
                  if (
                    !released &&
                    (s.value === "playing" || s.value === "completed")
                  ) {
                    showToast(
                      `Not out yet — releases ${releaseLabel}. Add it to To play.`,
                    );
                    return;
                  }
                  const next = game.status === s.value ? null : s.value;
                  setStatus.mutate({ game, status: next });
                  // Like "Watched" on a series ticking every episode:
                  // Completed means the story is done, so its main
                  // missions are all ticked too.
                  const main = missionItems.filter(
                    (i) => i.category === "main",
                  );
                  if (
                    game.status === "completed" &&
                    next === null &&
                    main.some((i) => i.done)
                  ) {
                    // Un-tapping Completed undoes it the same way: main
                    // missions unticked; ratings, heart, side lists kept.
                    updateEntry.mutate({
                      game,
                      patch: {
                        checklist: missionItems.map((i) =>
                          i.category === "main" ? { ...i, done: false } : i,
                        ),
                      },
                    });
                  } else if (
                    next === "completed" &&
                    main.some((i) => !i.done)
                  ) {
                    updateEntry.mutate({
                      game,
                      patch: {
                        checklist: missionItems.map((i) =>
                          i.category === "main" ? { ...i, done: true } : i,
                        ),
                      },
                    });
                  }
                  showToast(
                    next === "completed" && main.length
                      ? "Completed · all main missions ticked"
                      : next
                        ? `Marked as ${s.label}`
                        : "Removed from your games",
                  );
                }}
              />
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.hoursRow}>
            <View style={{ flex: 1, gap: 2 }}>
              {editingHours ? (
                <Input
                  value={hoursDraft}
                  onChangeText={setHoursDraft}
                  placeholder="Hours"
                  onSubmitEditing={saveHours}
                  maxLength={5}
                />
              ) : (
                <Pressable
                  onPress={() => {
                    setHoursDraft(hours ? String(hours) : "");
                    setEditingHours(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Edit hours played"
                >
                  <Text style={styles.hoursValue}>
                    {estimated ? `~${estimated} h` : `${hours} h played`}{" "}
                    <Text style={styles.editHint}>✎</Text>
                  </Text>
                </Pressable>
              )}
              <Text style={styles.cardMeta}>
                {fromMissions
                  ? `Estimated from your missions (${story.done}/${story.total}) · tap to set yours`
                  : estimated
                    ? "Estimated from the typical playtime · tap to set yours"
                    : target
                      ? `~${target} h to ${game.hundredPercent ? "100%" : "beat"}`
                      : "Log your play time"}
              </Text>
            </View>
            {editingHours ? (
              <Pressable
                style={[styles.stepBtn, styles.stepBtnPrimary]}
                onPress={saveHours}
                accessibilityLabel="Save hours"
              >
                <Text style={[styles.stepLabel, { color: theme.textInverse }]}>
                  Save
                </Text>
              </Pressable>
            ) : null}
          </View>
          {target ? (
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.min(100, ((hours || estimated || 0) / target) * 100)}%`,
                  },
                ]}
              />
            </View>
          ) : null}
        </View>

        <GameChecklist game={game} />

        {game.platforms.length > 0 ? (
          <View style={{ gap: 8 }}>
            <SectionLabel>Playing on</SectionLabel>
            <View style={styles.wrap}>
              {game.platforms.map((p) => (
                <Chip
                  key={p}
                  label={p}
                  selected={game.platform === p}
                  onPress={() =>
                    updateEntry.mutate({ game, patch: { platform: p } })
                  }
                />
              ))}
            </View>
          </View>
        ) : null}

        {game.status === "completed" ? (
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>🏆 Completed 100%</Text>
            <Switch
              value={!!game.hundredPercent}
              onValueChange={(v) =>
                updateEntry.mutate({ game, patch: { hundredPercent: v } })
              }
              trackColor={{
                false: theme.surfaceInteractive,
                true: theme.brandPrimary,
              }}
              thumbColor={theme.textPrimary}
              accessibilityLabel="Completed 100%"
            />
          </View>
        ) : null}

        <View style={styles.ratingRow}>
          <View style={styles.ratingCard}>
            <Rating
              mode="community"
              value={score.value}
              count={score.count}
              footnote={rewindRatingFootnote(game)}
            />
          </View>
          <View style={styles.ratingCard}>
            <Rating
              mode="user"
              value={game.userRating ?? 0}
              interactive
              onChange={(rating) => {
                rate.mutate({ game, rating });
                showToast(rating ? "Rating saved" : "Rating removed");
              }}
            />
          </View>
        </View>

        {game.summary ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>About</SectionLabel>
            <Text style={styles.summary}>{game.summary}</Text>
          </View>
        ) : null}

        {stores.length > 0 ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>Where to play</SectionLabel>
            {stores.map((store) => (
              <Pressable
                key={store.name}
                style={styles.storeRow}
                onPress={() =>
                  Linking.openURL(store.url(encodeURIComponent(game.title)))
                }
              >
                <Text style={styles.storeName}>{store.name}</Text>
                <Ionicons
                  name="open-outline"
                  size={16}
                  color={theme.textTertiary}
                />
              </Pressable>
            ))}
          </View>
        ) : null}

        {game.screenshotIds?.length ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>Screenshots</SectionLabel>
            <HScroll>
              {game.screenshotIds.slice(0, 8).map((sid) => (
                <MediaArtwork
                  key={sid}
                  uri={igdbImageUrl(sid, "t_screenshot_med")}
                  color={theme.surfaceSecondary}
                  radius={radius.sm}
                  style={{ width: 220, height: 124 }}
                />
              ))}
            </HScroll>
          </View>
        ) : null}

        <CommentsSection targetId={game.id} />

        {similar.length > 0 ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>Similar games</SectionLabel>
            <HScroll>
              {similar.map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => router.push(`/game/${g.id}`)}
                >
                  <PosterCard
                    title={g.title}
                    imageUrl={igdbImageUrl(g.coverImageId)}
                    status={g.status}
                    width={110}
                  />
                </Pressable>
              ))}
            </HScroll>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backdrop: { height: 200, position: "relative" },
  backBtn: {
    position: "absolute",
    left: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0008",
    alignItems: "center",
    justifyContent: "center",
  },
  trailer: {
    position: "absolute",
    right: 14,
    backgroundColor: "#000a",
    borderRadius: radius.full,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  trailerLabel: { color: theme.textPrimary, fontSize: 11, fontWeight: "700" },
  body: { padding: 20, gap: 20 },
  headerRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: -46,
    alignItems: "flex-start",
  },
  cover: {
    width: 100,
    height: 133,
    borderWidth: 2,
    borderColor: theme.bgPrimary,
  },
  headerText: { paddingTop: 52, gap: 2, flex: 1, flexShrink: 1 },
  heart: {
    marginTop: 52,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    alignItems: "center",
    justifyContent: "center",
  },
  heartActive: {
    backgroundColor: theme.brandPrimary,
    borderColor: theme.brandPrimary,
  },
  title: { color: theme.textPrimary, fontSize: 20, fontWeight: "800" },
  meta: { color: theme.textTertiary, fontSize: 12 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: {
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.md,
    padding: 14,
    gap: 10,
  },
  hoursRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  hoursValue: { color: theme.textPrimary, fontSize: 18, fontWeight: "800" },
  cardMeta: { color: theme.textTertiary, fontSize: 12 },
  editHint: { color: theme.textTertiary, fontSize: 14, fontWeight: "400" },
  stepBtn: {
    minWidth: 44,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnPrimary: {
    backgroundColor: theme.brandPrimary,
    borderColor: theme.brandPrimary,
  },
  stepLabel: { color: theme.textPrimary, fontSize: 15, fontWeight: "800" },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.ratingTrack,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: theme.brandPrimary },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabel: { color: theme.textPrimary, fontSize: 14, fontWeight: "600" },
  ratingRow: { flexDirection: "row", gap: 10 },
  ratingCard: {
    flex: 1,
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.md,
    padding: 12,
  },
  summary: { color: theme.textSecondary, fontSize: 13, lineHeight: 21 },
  storeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  storeName: { color: theme.textPrimary, fontSize: 14, fontWeight: "600" },
});
