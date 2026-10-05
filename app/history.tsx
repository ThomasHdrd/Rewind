import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Chip, EmptyState, Input, MediaArtwork, radius, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useHistory, useHistoryMedia } from "@/hooks/useMedia";
import { historyEntryDate, isGameEntry, watchEntries } from "@/lib/history";
import { useMyGames, useTracks } from "@/hooks/useGames";
import { igdbImageUrl } from "@/lib/games";
import { HistoryEntry, Media } from "@/types/media";

// The full watch log ("when did I watch that?"): grouped by day, with
// posters, filters and search; tapping an entry opens what it was.
const FILTERS = ["All", "Series", "Movies", "Games"] as const;
type Filter = (typeof FILTERS)[number];

interface Row {
  entry: HistoryEntry;
  date: Date | null;
  title: string;
  /** "E3 · The Other Side" / "Season 2" — empty for movies. */
  detail: string;
  isMovie: boolean;
  isGame: boolean;
  /** Game cover URL (games aren't TMDB media). */
  coverUrl?: string;
  episodes: number;
  media?: Media;
}

function dayLabel(d: Date): string {
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
}

export default function History() {
  const router = useRouter();
  const { data: history = [] } = useHistory();
  const { data: resolved } = useHistoryMedia(watchEntries(history));
  const tracks = useTracks();
  const { data: myGames = [] } = useMyGames(tracks.play);
  const gamesById = useMemo(() => new Map(myGames.map((g) => [g.id, g])), [myGames]);
  const filters = FILTERS.filter((f) => f !== "Games" || tracks.play);
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");

  const rows: Row[] = useMemo(
    () =>
      history.map((entry) => {
        const [title, ...rest] = entry.label.split(" — ");
        const detailRaw = rest.join(" — ");
        const isGame = isGameEntry(entry);
        const isMovie = !isGame && (entry.mediaId ? entry.mediaId.startsWith("movie:") : rest.length === 0);
        const game = isGame ? gamesById.get(entry.mediaId!) : undefined;
        const media =
          (entry.mediaId && resolved?.byId[entry.mediaId]) || resolved?.byTitle[title.toLowerCase()] || undefined;
        return {
          entry,
          date: historyEntryDate(entry),
          title: media?.title ?? title,
          detail: isGame
            ? `🎮 ${detailRaw === "Played" ? `Played ${entry.hours ?? 0} h` : detailRaw}`
            : detailRaw.replace(/^E(\d+)\s+/, "E$1 · "),
          isMovie,
          isGame,
          coverUrl: game ? igdbImageUrl(game.coverImageId, "t_cover_small") : undefined,
          episodes: isMovie || isGame ? 0 : Math.max(1, entry.episodeIds?.length ?? 1),
          media,
        };
      }),
    [history, resolved, gamesById]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === "All" ||
          (filter === "Games" ? r.isGame : !r.isGame && (filter === "Movies") === r.isMovie)) &&
        (!q || r.title.toLowerCase().includes(q) || r.detail.toLowerCase().includes(q))
    );
  }, [rows, filter, search]);

  const groups = useMemo(() => {
    const out: { label: string; rows: Row[] }[] = [];
    for (const r of visible) {
      const label = r.date ? dayLabel(r.date) : "Earlier";
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(r);
      else out.push({ label, rows: [r] });
    }
    return out;
  }, [visible]);

  const monthSummary = useMemo(() => {
    const now = new Date();
    const thisMonth = rows.filter(
      (r) => r.date && r.date.getMonth() === now.getMonth() && r.date.getFullYear() === now.getFullYear()
    );
    const episodes = thisMonth.reduce((sum, r) => sum + r.episodes, 0);
    const movies = thisMonth.filter((r) => r.isMovie).length;
    const gameHours = thisMonth.reduce((sum, r) => sum + (r.isGame ? (r.entry.hours ?? 0) : 0), 0);
    return { episodes, movies, gameHours };
  }, [rows]);

  const open = (r: Row) => {
    const mediaId = r.entry.mediaId ?? r.media?.id;
    if (r.entry.episodeIds?.length === 1) router.push(`/episode/${r.entry.episodeIds[0]}`);
    else if (mediaId?.startsWith("game:")) router.push(`/game/${mediaId}`);
    else if (mediaId) router.push(mediaId.startsWith("movie:") ? `/movie/${mediaId}` : `/series/${mediaId}`);
  };

  return (
    <Screen>
      <ScreenHeader title="History" />

      {history.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="time-outline" size={22} color={theme.textTertiary} />}
          title="No watch history yet"
          subtitle="Episodes and movies you mark as watched will show up here, day by day."
        />
      ) : (
        <>
          <View style={styles.summary}>
            <Text style={styles.summaryEyebrow}>THIS MONTH</Text>
            <Text style={styles.summaryText}>
              {monthSummary.episodes} {monthSummary.episodes === 1 ? "episode" : "episodes"} · {monthSummary.movies}{" "}
              {monthSummary.movies === 1 ? "movie" : "movies"}
              {tracks.play ? ` · ${monthSummary.gameHours} h played` : ""}
            </Text>
          </View>

          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search your history"
            icon={<Ionicons name="search" size={16} color={theme.textTertiary} />}
          />
          <View style={styles.filters}>
            {filters.map((f) => (
              <Chip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
            ))}
          </View>

          {groups.length === 0 ? (
            <Text style={styles.empty}>Nothing matches.</Text>
          ) : (
            groups.map((g) => (
              <View key={g.label} style={{ gap: 2 }}>
                <Text style={styles.dayLabel}>{g.label}</Text>
                {g.rows.map((r) => {
                  const canOpen = !!(r.entry.mediaId || r.media || r.entry.episodeIds?.length === 1);
                  return (
                    <Pressable
                      key={r.entry.id}
                      style={styles.row}
                      disabled={!canOpen}
                      onPress={() => open(r)}
                      accessibilityRole={canOpen ? "button" : undefined}
                    >
                      <MediaArtwork
                        path={r.media?.posterPath}
                        uri={r.coverUrl}
                        size="w185"
                        color={r.media?.artworkColor ?? theme.surfaceSecondary}
                        radius={radius.sm}
                        style={styles.poster}
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.title} numberOfLines={1}>
                          {r.title}
                        </Text>
                        <Text style={styles.detail} numberOfLines={1}>
                          {r.isMovie ? "Movie" : r.detail || (r.isGame ? "🎮 Game" : "Series")}
                        </Text>
                      </View>
                      <Text style={styles.time}>
                        {r.date ? r.date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.md,
    padding: 14,
    gap: 4,
  },
  summaryEyebrow: { color: theme.brandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  summaryText: { color: theme.textPrimary, fontSize: 16, fontWeight: "700" },
  filters: { flexDirection: "row", gap: 8 },
  dayLabel: {
    color: theme.textTertiary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 4,
    marginBottom: 4,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  poster: { width: 40, height: 60 },
  title: { color: theme.textPrimary, fontSize: 14, fontWeight: "700" },
  detail: { color: theme.textSecondary, fontSize: 12 },
  time: { color: theme.textTertiary, fontSize: 11 },
  empty: { color: theme.textTertiary, fontSize: 13 },
});
