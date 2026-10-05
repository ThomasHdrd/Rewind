import React, { useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Chip, Modal, PosterCard, Skeleton, radius, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { SectionLabel } from "@/components/SectionLabel";
import { HScroll } from "@/components/HScroll";
import { OfflineState } from "@/components/OfflineState";
import { useCatalog, useForYou, usePreferences } from "@/hooks/useMedia";
import { CatalogKind, CatalogSort } from "@/data/repositories";
import { ALL_GENRES } from "@/lib/genres";
import { KNOWN_PLATFORMS } from "@/lib/platforms";
import { ALL_GAME_GENRES, KNOWN_CONSOLES, igdbImageUrl } from "@/lib/games";
import { useGamesCatalog, useTracks } from "@/hooks/useGames";

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
// Tab / content-type label → catalog kind queried from TMDB.
const KIND_FOR_LABEL: Record<string, CatalogKind> = {
  All: "all",
  Series: "series",
  Movies: "movie",
  Anime: "anime",
};

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
  const [sort, setSort] = useState("Popularity");
  const [contentTab, setContentTab] = useState("All");
  // Two separate sections, chosen at the very top: Movies & Series (exactly
  // the original Discover) or Games (its own consoles / genres / sorts).
  // Games never sit in the movie/series rows. Only "Both" accounts get the
  // switch; single-world accounts land straight in their section.
  const tracks = useTracks();
  const [section, setSectionRaw] = useState<"watch" | "play">("watch");
  const isGamesTab = tracks.play && (!tracks.watch || section === "play");
  const tabs = CONTENT_TABS;
  // Browse by platform ("everything on Netflix"): quick chips, multi-select.
  const [platforms, setPlatforms] = useState<string[]>([]);
  const togglePlatform = (p: string) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  // Streaming platforms and consoles (or movie and game genres) don't mix:
  // clear them when switching section.
  const setSection = (next: "watch" | "play") => {
    if (next === section) return;
    setPlatforms([]);
    setAppliedGenres(new Set());
    setAppliedContentType(null);
    setSectionRaw(next);
  };
  const { data: preferences } = usePreferences();
  const { data: forYou = [], isLoading: forYouLoading } = useForYou(preferences);
  const hasPreferences = !!preferences && (preferences.genres.length > 0 || preferences.platforms.length > 0);

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

  // Everything below queries the WHOLE TMDB catalog (filters used to only
  // narrow this week's ~40 trending titles, so e.g. "Western" found nothing
  // while Django Unchained was one search away).
  const isComingSoon = sort === "Coming soon";
  const kind: CatalogKind = KIND_FOR_LABEL[appliedContentType ?? contentTab] ?? "all";
  const genres = Array.from(appliedGenres);
  const catalogSort: CatalogSort =
    sort === "New"
      ? "new"
      : isComingSoon
        ? "coming-soon"
        : kind === "all" && genres.length === 0 && platforms.length === 0
          ? "trending"
          : "popularity";
  const catalog = useCatalog({ kind, genres, platforms, sort: catalogSort }, !isGamesTab);
  const gamesCatalog = useGamesCatalog(
    { genres, consoles: platforms, sort: sort === "New" ? "new" : isComingSoon ? "coming-soon" : "popularity" },
    isGamesTab
  );
  const games = useMemo(() => {
    const seen = new Set<string>();
    return (gamesCatalog.data?.pages ?? []).flatMap((p) => p.items).filter((g) => !seen.has(g.id) && !!seen.add(g.id));
  }, [gamesCatalog.data]);
  const active = isGamesTab ? gamesCatalog : catalog;
  const items = useMemo(() => {
    // Pages can overlap when TMDB's popularity shifts between requests.
    const seen = new Set<string>();
    return (catalog.data?.pages ?? []).flatMap((p) => p.items).filter((m) => !seen.has(m.id) && !!seen.add(m.id));
  }, [catalog.data]);

  const sectionTitle = isGamesTab
    ? `${isComingSoon ? "Upcoming games" : sort === "New" ? "New games" : "Popular games"}${
        genres.length ? ` · ${genres.join(", ")}` : ""
      }${platforms.length ? ` · on ${platforms.join(", ")}` : ""}`
    : catalogSort === "trending"
      ? "Trending"
      : `${isComingSoon ? "Coming soon" : sort === "New" ? "New" : "Popular"}${
          kind === "all" ? "" : ` · ${appliedContentType ?? contentTab}`
        }${genres.length ? ` · ${genres.join(", ")}` : ""}${platforms.length ? ` · on ${platforms.join(", ")}` : ""}`;

  const shownCount = isGamesTab ? games.length : items.length;
  if (active.isError && shownCount === 0) {
    return (
      <Screen>
        <OfflineState onRetry={() => active.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      {tracks.play && tracks.watch ? (
        <View style={styles.sectionSwitch}>
          {(
            [
              { value: "watch", label: "🎬 Movies & Series" },
              { value: "play", label: "🎮 Games" },
            ] as const
          ).map((o) => {
            const selected = (o.value === "play") === isGamesTab;
            return (
              <Pressable
                key={o.value}
                style={[styles.sectionOption, selected && styles.sectionOptionActive]}
                onPress={() => setSection(o.value)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.sectionLabel, selected && styles.sectionLabelActive]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Pressable style={styles.search} onPress={() => router.push("/search")}>
        <Text style={styles.searchIcon}>⌕</Text>
        <Text style={styles.searchPlaceholder}>{isGamesTab ? "Search games..." : "Series, movie, genre..."}</Text>
      </Pressable>

      <HScroll gap={8}>
        <Chip
          label={activeFilterCount > 0 ? `☰ Filters (${activeFilterCount})` : "☰ Filters"}
          onPress={openFilters}
        />
        {SORTS.map((s) => (
          <Chip key={s} label={s} selected={sort === s} onPress={() => setSort(s)} />
        ))}
      </HScroll>

      {isGamesTab ? null : (
        <HScroll gap={6}>
          {tabs.map((t) => (
            <Chip key={t} label={t} selected={contentTab === t} onPress={() => setContentTab(t)} />
          ))}
        </HScroll>
      )}

      <HScroll gap={6}>
        {/* Selected platforms first, so an active one is never hidden
            off-screen (e.g. Crunchyroll silently emptying "Western"). */}
        {[...platforms, ...(isGamesTab ? KNOWN_CONSOLES : KNOWN_PLATFORMS).filter((p) => !platforms.includes(p))].map(
          (p) => (
            <Chip key={p} label={p} selected={platforms.includes(p)} onPress={() => togglePlatform(p)} />
          )
        )}
      </HScroll>

      {/* Personalized from this account's own onboarding answers (genres +
          platforms). Only on the unfiltered default view so it doesn't
          compete with an explicit filter the user just applied. */}
      {!isGamesTab &&
        hasPreferences &&
        !isComingSoon &&
        contentTab === "All" &&
        activeFilterCount === 0 &&
        platforms.length === 0 && (
          <View style={{ gap: 12 }}>
            <SectionLabel>For You</SectionLabel>
            {forYouLoading ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Skeleton width={110} height={160} radius={10} />
                <Skeleton width={110} height={160} radius={10} />
                <Skeleton width={110} height={160} radius={10} />
              </View>
            ) : forYou.length === 0 ? (
              <Pressable onPress={() => router.push("/settings/preferences")}>
                <Text style={styles.forYouEmpty}>
                  Nothing matches your genres on your platforms yet. Tap to adjust your preferences.
                </Text>
              </Pressable>
            ) : (
              <HScroll gap={10}>
                {forYou.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => router.push(item.kind === "movie" ? `/movie/${item.id}` : `/series/${item.id}`)}
                  >
                    <PosterCard
                      title={item.title}
                      artworkColor={item.artworkColor}
                      posterPath={item.posterPath}
                      status={item.status}
                      width={110}
                    />
                  </Pressable>
                ))}
              </HScroll>
            )}
          </View>
        )}

      <View style={{ gap: 12 }}>
        <SectionLabel>{sectionTitle}</SectionLabel>
        {active.isLoading ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Skeleton width={110} height={160} radius={10} />
            <Skeleton width={110} height={160} radius={10} />
            <Skeleton width={110} height={160} radius={10} />
          </View>
        ) : (
          <View style={styles.grid}>
            {isGamesTab
              ? games.map((g) => (
                  <Pressable key={g.id} onPress={() => router.push(`/game/${g.id}`)}>
                    <PosterCard
                      title={g.title}
                      imageUrl={igdbImageUrl(g.coverImageId)}
                      status={g.status}
                      dateLabel={isComingSoon && g.releaseDate ? formatDateLabel(g.releaseDate) : undefined}
                      width={GRID_POSTER_WIDTH}
                    />
                  </Pressable>
                ))
              : null}
            {(isGamesTab ? [] : items).map((item) => (
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
        {!active.isLoading && shownCount === 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={styles.forYouEmpty}>
              {platforms.length && genres.length
                ? `No ${genres.join(" / ")} titles on ${platforms.join(" / ")} right now.`
                : platforms.length
                  ? `Nothing on ${platforms.join(" / ")} matches right now.`
                  : "Nothing matches these filters."}
            </Text>
            <View style={styles.wrap}>
              {platforms.length ? <Chip label={`✕ ${platforms.join(", ")}`} onPress={() => setPlatforms([])} /> : null}
              {genres.length ? (
                <Chip label={`✕ ${genres.join(", ")}`} onPress={() => setAppliedGenres(new Set())} />
              ) : null}
              <Chip
                label="Reset all"
                onPress={() => {
                  setPlatforms([]);
                  setAppliedGenres(new Set());
                  setAppliedContentType(null);
                  setContentTab(tabs[0]);
                  setSort("Popularity");
                }}
              />
            </View>
          </View>
        ) : null}
        {active.hasNextPage ? (
          <Button
            variant="secondary"
            fullWidth
            loading={active.isFetchingNextPage}
            onPress={() => active.fetchNextPage()}
          >
            Show more
          </Button>
        ) : null}
      </View>

      <Modal visible={filtersVisible} title="Filters" onClose={() => setFiltersVisible(false)}>
        {isGamesTab ? null : (
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
        )}
        <View style={{ gap: 8 }}>
          <Text style={styles.modalLabel}>Genres</Text>
          <View style={styles.wrap}>
            {(isGamesTab ? ALL_GAME_GENRES : GENRES).map((g) => (
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
  modalLabel: {
    color: theme.textTertiary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
  sectionSwitch: {
    flexDirection: "row",
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.full,
    padding: 4,
    gap: 4,
  },
  sectionOption: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radius.full },
  sectionOptionActive: { backgroundColor: theme.brandPrimary },
  sectionLabel: { color: theme.textSecondary, fontSize: 14, fontWeight: "700" },
  sectionLabelActive: { color: theme.textInverse },
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
  forYouEmpty: { color: theme.textTertiary, fontSize: 13, lineHeight: 19 },
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
