import React, { useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Chip, Modal, PosterCard, Skeleton, radius, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { SectionLabel } from "@/components/SectionLabel";
import { HScroll } from "@/components/HScroll";
import { OfflineState } from "@/components/OfflineState";
import { useComingSoon, useTrending } from "@/hooks/useMedia";
import { Media, MediaKind } from "@/types/media";
import { ALL_GENRES } from "@/lib/genres";

// Exact 3-per-row width (same fix as Profile's My Library grid) instead of a
// fixed guess — fills the available width with no leftover side margin so
// the grid reads as centered instead of left-heavy with dead space on the right.
const GRID_COLUMNS = 3;
const GRID_GAP = 10;
const GRID_POSTER_WIDTH = (Dimensions.get("window").width - 40 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

const SORTS = ["Popularity", "New", "Coming soon"];
const CONTENT_TABS = ["All", "Series", "Movies", "Anime"];
// "TV" removed — CONTENT_TYPE_TO_KIND's "tv" entry never matched any real
// Media.kind (TMDB TV titles map to kind "series"), so the "TV" filter chip
// silently returned zero results.
const CONTENT_TYPES = ["Series", "Movies", "Anime"];
// Union of real MOVIE_GENRES/TV_GENRES display labels (src/data/tmdb/mappers.ts),
// normalized to one label per concept so the Filters modal covers both movie
// and TV genres.
const GENRES = ALL_GENRES;
const CONTENT_TYPE_TO_KIND: Record<string, MediaKind> = {
  Series: "series",
  Movies: "movie",
  Anime: "anime",
};
// TMDB uses different genre labels for movies vs TV (e.g. movies say
// "Science Fiction", TV says "Sci-Fi & Fantasy"), so a literal string match
// against our short display list ("Sci-Fi") only ever matched "Drama" (the
// one genre spelled identically on both sides) — every other style tab
// silently returned zero results. Resolve each display label to every real
// TMDB genre string it should match instead.
const STYLE_GENRE_ALIASES: Record<string, string[]> = {
  Action: ["Action", "Action & Adventure"],
  Adventure: ["Adventure", "Action & Adventure"],
  Animation: ["Animation"],
  Comedy: ["Comedy"],
  Crime: ["Crime"],
  Documentary: ["Documentary"],
  Drama: ["Drama"],
  Family: ["Family"],
  Fantasy: ["Fantasy", "Sci-Fi & Fantasy"],
  History: ["History"],
  Horror: ["Horror"],
  Music: ["Music"],
  Mystery: ["Mystery"],
  Romance: ["Romance"],
  "Sci-Fi": ["Science Fiction", "Sci-Fi & Fantasy"],
  Thriller: ["Thriller"],
  War: ["War", "War & Politics"],
  Western: ["Western"],
};
const genreMatches = (m: Media, label: string) =>
  (STYLE_GENRE_ALIASES[label] ?? [label]).some((g) => m.genres.includes(g));

// "12 Nov" style short date badge for Coming Soon poster cards.
const formatDateLabel = (releaseDate: string) => {
  const d = new Date(releaseDate);
  if (isNaN(d.getTime())) return undefined;
  // Force English regardless of device locale — the rest of the app's UI is
  // English, and `toLocaleDateString(undefined, ...)` was picking up the
  // device's locale (e.g. French), producing "16 déc." instead of "Dec 16".
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
};

export default function Discover() {
  const router = useRouter();
  const { data: trending = [], isLoading, isError, refetch } = useTrending();
  const [sort, setSort] = useState("Popularity");
  const {
    data: comingSoon = [],
    isLoading: comingSoonLoading,
    isError: comingSoonError,
    refetch: refetchComingSoon,
  } = useComingSoon(sort === "Coming soon");
  const [contentTab, setContentTab] = useState("All");

  const [filtersVisible, setFiltersVisible] = useState(false);
  const [appliedContentType, setAppliedContentType] = useState<string | null>(null);
  const [appliedGenres, setAppliedGenres] = useState<Set<string>>(new Set());
  const [pendingContentType, setPendingContentType] = useState<string | null>(null);
  const [pendingGenres, setPendingGenres] = useState<Set<string>>(new Set());

  const openFilters = () => {
    setPendingContentType(appliedContentType);
    setPendingGenres(new Set(appliedGenres));
    setFiltersVisible(true);
  };

  const applyFilters = () => {
    setAppliedContentType(pendingContentType);
    setAppliedGenres(new Set(pendingGenres));
    setFiltersVisible(false);
  };

  const resetFilters = () => {
    setPendingContentType(null);
    setPendingGenres(new Set());
  };

  const togglePendingGenre = (g: string) => {
    setPendingGenres((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const activeFilterCount = (appliedContentType ? 1 : 0) + appliedGenres.size;

  if (isError || (sort === "Coming soon" && comingSoonError)) {
    return (
      <Screen>
        <OfflineState onRetry={() => (sort === "Coming soon" ? refetchComingSoon() : refetch())} />
      </Screen>
    );
  }

  const matchesContentTab = (m: Media) => {
    if (contentTab === "All") return true;
    if (contentTab === "Series") return m.kind === "series";
    if (contentTab === "Movies") return m.kind === "movie";
    // TMDB has no real "anime" content type — the closest available proxy
    // from the data we get back is the Animation genre (kind is always just
    // "movie" or "series"), so the Anime tab filters on that instead of a
    // kind value that's never actually produced by the TMDB mappers.
    if (contentTab === "Anime") return genreMatches(m, "Animation");
    return true;
  };

  const isComingSoon = sort === "Coming soon";
  const sourceList = isComingSoon ? comingSoon : trending;
  const trendingIsLoading = isComingSoon ? comingSoonLoading : isLoading;

  const filteredTrending = useMemo(() => {
    let list = sourceList.filter((m) => matchesContentTab(m));
    if (appliedContentType) list = list.filter((m) => m.kind === CONTENT_TYPE_TO_KIND[appliedContentType]);
    if (appliedGenres.size > 0) list = list.filter((m) => Array.from(appliedGenres).some((g) => genreMatches(m, g)));
    if (isComingSoon) return list;
    if (sort === "New") list = [...list].sort((a, b) => b.year - a.year);
    else list = [...list].sort((a, b) => (b.communityRating ?? 0) - (a.communityRating ?? 0));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceList, contentTab, appliedContentType, appliedGenres, sort]);

  return (
    <Screen>
      <Pressable style={styles.search} onPress={() => router.push("/search")}>
        <Text style={styles.searchIcon}>⌕</Text>
        <Text style={styles.searchPlaceholder}>Series, movie, genre...</Text>
      </Pressable>

      <HScroll gap={8}>
        <Chip label={activeFilterCount > 0 ? `☰ Filters (${activeFilterCount})` : "☰ Filters"} onPress={openFilters} />
        {SORTS.map((s) => (
          <Chip key={s} label={s} selected={sort === s} onPress={() => setSort(s)} />
        ))}
      </HScroll>

      <HScroll gap={6}>
        {CONTENT_TABS.map((t) => (
          <Chip key={t} label={t} selected={contentTab === t} onPress={() => setContentTab(t)} />
        ))}
      </HScroll>

      <View style={{ gap: 12 }}>
        <SectionLabel>{isComingSoon ? "Coming Soon" : contentTab !== "All" ? contentTab : "Trending"}</SectionLabel>
        {trendingIsLoading ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Skeleton width={110} height={160} radius={10} />
            <Skeleton width={110} height={160} radius={10} />
            <Skeleton width={110} height={160} radius={10} />
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredTrending.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push(item.kind === "movie" ? `/movie/${item.id}` : `/series/${item.id}`)}
              >
                <PosterCard
                  title={item.title}
                  artworkColor={item.artworkColor}
                  posterPath={item.posterPath}
                  status={item.status}
                  dateLabel={isComingSoon && item.releaseDate ? formatDateLabel(item.releaseDate) : undefined}
                  width={GRID_POSTER_WIDTH}
                />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Modal visible={filtersVisible} title="Filters" onClose={() => setFiltersVisible(false)}>
        <View style={{ gap: 8 }}>
          <Text style={styles.modalLabel}>Content type</Text>
          <View style={styles.wrap}>
            {CONTENT_TYPES.map((ct) => (
              <Chip
                key={ct}
                label={ct}
                selected={pendingContentType === ct}
                onPress={() => setPendingContentType(pendingContentType === ct ? null : ct)}
              />
            ))}
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={styles.modalLabel}>Genres</Text>
          <View style={styles.wrap}>
            {GENRES.map((g) => (
              <Chip key={g} label={g} selected={pendingGenres.has(g)} onPress={() => togglePendingGenre(g)} />
            ))}
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button variant="secondary" style={{ flex: 1 }} onPress={resetFilters}>
            Reset
          </Button>
          <Button style={{ flex: 1 }} onPress={applyFilters}>
            Apply
          </Button>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  modalLabel: { color: theme.textTertiary, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.full,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  searchIcon: { color: theme.textTertiary, fontSize: 14 },
  searchPlaceholder: { color: theme.textTertiary, fontSize: 13 },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  rankIndex: { color: theme.textTertiary, fontSize: 13, width: 14 },
  rankTitle: { color: theme.textPrimary, fontSize: 13, flex: 1 },
  rankRating: { color: theme.brandPrimary, fontSize: 12 },
});
