import React, { useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import {
  Artwork,
  Avatar,
  Chip,
  EmptyState,
  Input,
  MediaArtwork,
  PosterCard,
  Skeleton,
  StatisticCard,
  radius,
  theme,
} from "@/design-system";
import { avatarIconEmoji } from "@/design-system/icons";
import { Screen } from "@/components/Screen";
import { SectionLabel } from "@/components/SectionLabel";
import { HScroll } from "@/components/HScroll";
import { useFavorites, useHistory, useLibrary, useProfile } from "@/hooks/useMedia";
import { formatRelativeTime, parseHistoryDate } from "@/lib/history";
import { WatchStatus } from "@/types/media";

const LIBRARY_TABS: { label: string; status: WatchStatus }[] = [
  { label: "Watched", status: "watched" },
  { label: "Watching", status: "watching" },
  { label: "Watchlist", status: "watchlist" },
];

// Exact 3-per-row width instead of a fixed guess — fills the available
// width (minus Screen's own 20px side padding and the inter-item gaps)
// so the posters are as large as possible with no leftover side margin.
const LIBRARY_GRID_COLUMNS = 3;
const LIBRARY_GRID_GAP = 8;
const LIBRARY_POSTER_WIDTH =
  (Dimensions.get("window").width - 40 - LIBRARY_GRID_GAP * (LIBRARY_GRID_COLUMNS - 1)) / LIBRARY_GRID_COLUMNS;

const LIBRARY_GRID_LIMIT = 6;

const MENU = [
  { label: "Watching History", href: "/history" },
  { label: "Statistics", href: "/statistics" },
  { label: "My Lists", href: "/lists" },
  { label: "Settings", href: "/settings" },
] as const;

export default function Profile() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: favorites = [] } = useFavorites();
  const { data: history = [] } = useHistory();
  const { data: library = [], isLoading: libraryLoading } = useLibrary();
  const [libraryTab, setLibraryTab] = useState<WatchStatus>("watched");
  const [librarySearch, setLibrarySearch] = useState("");

  const filteredLibrary = useMemo(() => {
    let list = library.filter((m) => m.status === libraryTab);
    if (librarySearch.trim()) {
      const q = librarySearch.trim().toLowerCase();
      list = list.filter((m) => m.title.toLowerCase().includes(q));
    }
    return list;
  }, [library, libraryTab, librarySearch]);

  // Cap the grid to the 6 most recent items, using the same title-substring
  // match against HistoryEntry as app/(tabs)/index.tsx's sortedContinueWatching:
  // items with a matching history entry sort newest-first, items with no
  // match sort after all of those (stable relative order preserved).
  const recentLibrary = useMemo(() => {
    const lastActivity = new Map<string, number>();
    for (const m of filteredLibrary) {
      const titleLower = m.title.toLowerCase();
      let latest: number | null = null;
      for (const entry of history) {
        if (!entry.label.toLowerCase().includes(titleLower)) continue;
        const d = parseHistoryDate(entry.timeLabel);
        if (d && (latest === null || d.getTime() > latest)) latest = d.getTime();
      }
      if (latest !== null) lastActivity.set(m.id, latest);
    }
    const sorted = [...filteredLibrary].sort((a, b) => {
      const ta = lastActivity.get(a.id);
      const tb = lastActivity.get(b.id);
      if (ta !== undefined && tb !== undefined) return tb - ta;
      if (ta !== undefined) return -1;
      if (tb !== undefined) return 1;
      return 0;
    });
    return sorted.slice(0, LIBRARY_GRID_LIMIT);
  }, [filteredLibrary, history]);

  const recentHistory = history.slice(0, 5);
  const findMediaForEntry = (label: string) => {
    const lower = label.toLowerCase();
    return library.find((m) => lower.includes(m.title.toLowerCase()));
  };

  if (!profile) return null;

  const favoriteSeries = favorites.filter((m) => m.kind === "series");
  const favoriteMovies = favorites.filter((m) => m.kind === "movie");

  const bannerMode = profile.bannerMode ?? "favorites";
  const bannerFavorite = favoriteSeries[0] ?? favorites[0];

  return (
    <Screen scroll contentStyle={{ padding: 0, paddingBottom: 40, gap: 0 }}>
      <View style={styles.banner}>
        {bannerMode === "image" && profile.bannerImageUri ? (
          <Image source={{ uri: profile.bannerImageUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : bannerFavorite ? (
          <MediaArtwork
            path={bannerFavorite.backdropPath ?? bannerFavorite.posterPath}
            color={bannerFavorite.artworkColor}
            size="original"
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <Artwork color={theme.surfaceSecondary} style={{ width: "100%", height: "100%" }} />
        )}
        <Pressable style={[styles.iconBtn, { right: 12 }]} onPress={() => router.push("/rewards")}>
          <Text style={styles.iconBtnGlyph}>🏆</Text>
        </Pressable>
        <Pressable style={[styles.iconBtn, { right: 54 }]} onPress={() => router.push("/settings")}>
          <Text style={styles.iconBtnGlyph}>⚙</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Avatar
            name={profile.firstName}
            color={profile.avatarColor}
            icon={avatarIconEmoji(profile.avatarIcon)}
            size={64}
          />
          <Text style={styles.name}>{profile.firstName}</Text>
        </View>

        <Pressable style={styles.levelCard} onPress={() => router.push("/rewards")}>
          <View style={styles.levelHeader}>
            <Text style={styles.levelLabel}>
              LEVEL {profile.level} · {profile.levelName.toUpperCase()}
            </Text>
            <View style={styles.plus}>
              <Text style={{ color: theme.textInverse, fontWeight: "800" }}>+</Text>
            </View>
          </View>
          <View style={styles.levelTrack}>
            <View
              style={[
                styles.levelFill,
                { width: `${Math.min(100, (profile.xp / (profile.xp + profile.xpToNext)) * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.levelMeta}>
            {profile.xp} XP · {profile.xpToNext} XP to next level
          </Text>
        </Pressable>

        <View style={styles.statsGrid}>
          <View style={styles.statsGridCell}>
            <StatisticCard value={profile.moviesCount} label="Movies" />
          </View>
          <View style={styles.statsGridCell}>
            <StatisticCard value={profile.seriesCount} label="Series" />
          </View>
          <View style={styles.statsGridCell}>
            <StatisticCard value={profile.episodesCount} label="Episodes" />
          </View>
          <View style={styles.statsGridCell}>
            <StatisticCard value={`${profile.hoursWatched}h`} label="Hours" />
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <SectionLabel large>Favorite Series</SectionLabel>
          {favoriteSeries.length > 0 ? (
            <HScroll gap={8}>
              {favoriteSeries.map((m) => (
                <Pressable key={m.id} onPress={() => router.push(`/series/${m.id}`)}>
                  <PosterCard artworkColor={m.artworkColor} posterPath={m.posterPath} width={110} />
                </Pressable>
              ))}
            </HScroll>
          ) : (
            <EmptyState
              variant="square"
              icon={<Ionicons name="tv-outline" size={22} color={theme.textTertiary} />}
              title="No favorite series yet"
              subtitle="Tap the bookmark on a series page to add it here."
            />
          )}
        </View>
        <View style={{ gap: 8 }}>
          <SectionLabel large>Favorite Movies</SectionLabel>
          {favoriteMovies.length > 0 ? (
            <HScroll gap={8}>
              {favoriteMovies.map((m) => (
                <Pressable key={m.id} onPress={() => router.push(`/movie/${m.id}`)}>
                  <PosterCard artworkColor={m.artworkColor} posterPath={m.posterPath} width={110} />
                </Pressable>
              ))}
            </HScroll>
          ) : (
            <EmptyState
              variant="square"
              icon={<Ionicons name="film-outline" size={22} color={theme.textTertiary} />}
              title="No favorite movies yet"
              subtitle="Tap the bookmark on a movie page to add it here."
            />
          )}
        </View>

        {recentHistory.length > 0 ? (
          <View style={{ gap: 8 }}>
            <SectionLabel large>Recently Watched</SectionLabel>
            <View style={{ gap: 10 }}>
              {recentHistory.map((entry) => {
                const media = findMediaForEntry(entry.label);
                return (
                  <View key={entry.id} style={styles.historyRow}>
                    <MediaArtwork
                      path={media?.posterPath}
                      color={media?.artworkColor}
                      radius={radius.sm}
                      style={styles.historyArtwork}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.historyLabel} numberOfLines={1}>
                        {entry.label}
                      </Text>
                      <Text style={styles.historyTime}>{formatRelativeTime(entry.timeLabel)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={{ gap: 12 }}>
          <SectionLabel large>My Library</SectionLabel>
          <Input
            value={librarySearch}
            onChangeText={setLibrarySearch}
            placeholder="Search my library"
            icon={<Text style={styles.searchIcon}>⌕</Text>}
          />
          <HScroll gap={6}>
            {LIBRARY_TABS.map((t) => (
              <Chip
                key={t.label}
                label={t.label}
                selected={libraryTab === t.status}
                onPress={() => setLibraryTab(t.status)}
              />
            ))}
          </HScroll>

          {libraryLoading ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Skeleton width={100} height={150} radius={10} />
              <Skeleton width={100} height={150} radius={10} />
              <Skeleton width={100} height={150} radius={10} />
            </View>
          ) : filteredLibrary.length === 0 ? (
            <EmptyState
              title="Your library is empty"
              subtitle="Titles you watchlist, watch, or track will show up here."
            />
          ) : (
            <View style={styles.libraryGrid}>
              {recentLibrary.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => router.push(m.kind === "movie" ? `/movie/${m.id}` : `/series/${m.id}`)}
                >
                  <PosterCard
                    title={m.title}
                    artworkColor={m.artworkColor}
                    posterPath={m.posterPath}
                    status={m.status}
                    width={LIBRARY_POSTER_WIDTH}
                  />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View>
          {MENU.map((item) => (
            <Pressable key={item.label} style={styles.menuRow} onPress={() => router.push(item.href)}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { height: 210, position: "relative" },
  iconBtn: {
    position: "absolute",
    top: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#000a",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnGlyph: { color: theme.textPrimary, fontSize: 18 },
  body: { padding: 20, gap: 20 },
  // Avatar is 64px; -32 pulls it up by exactly half its diameter so it
  // reads as intentionally straddling the banner's bottom edge.
  headerRow: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: -32 },
  name: { color: theme.textPrimary, fontSize: 20, fontWeight: "700" },
  levelCard: {
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.md,
    padding: 16,
    gap: 6,
  },
  levelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  levelLabel: { color: theme.textTertiary, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  plus: { width: 22, height: 22, borderRadius: 11, backgroundColor: theme.brandPrimary, alignItems: "center", justifyContent: "center" },
  levelTrack: { height: 6, borderRadius: 3, backgroundColor: theme.ratingTrack, overflow: "hidden" },
  levelFill: { height: "100%", backgroundColor: theme.brandPrimary },
  levelMeta: { color: theme.textTertiary, fontSize: 11 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statsGridCell: { width: "48%" },
  menuRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  menuLabel: { color: theme.textPrimary, fontSize: 16 },
  chevron: { color: theme.textTertiary },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  historyArtwork: { width: 56, height: 78 },
  historyLabel: { color: theme.textPrimary, fontSize: 16, fontWeight: "700" },
  historyTime: { color: theme.textTertiary, fontSize: 13 },
  searchIcon: { color: theme.textTertiary, fontSize: 14 },
  libraryGrid: { flexDirection: "row", flexWrap: "wrap", gap: LIBRARY_GRID_GAP },
});
