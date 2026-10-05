import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  ContinueWatchingCard,
  EmptyState,
  MediaListItem,
  Skeleton,
  UpNextRow,
  theme,
} from "@/design-system";
import { avatarIconEmoji } from "@/design-system/icons";
import { Screen } from "@/components/Screen";
import { SectionLabel } from "@/components/SectionLabel";
import { OfflineState } from "@/components/OfflineState";
import {
  useContinueWatching,
  useContinueWatchingProgress,
  useHistory,
  useNextEpisodes,
  useProfile,
  useSetWatchStatus,
  useUpcoming,
} from "@/hooks/useMedia";
import { mediaRepository, trackingRepository } from "@/data/repositories";
import { episodeHistoryLabel, historyEntryDate } from "@/lib/history";
import { isAired } from "@/domain/watchStatus";
import { RewindAutoOpen } from "@/components/RewindAutoOpen";
import { ContinuePlaying } from "@/components/ContinuePlaying";
import { useTracks } from "@/hooks/useGames";
import { useToastStore } from "@/state/toastStore";
import { Media } from "@/types/media";

export default function Home() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: continueWatching = [], isLoading, isError, refetch } = useContinueWatching();
  const { data: profile } = useProfile();
  const { data: upcoming = [] } = useUpcoming();
  const tracks = useTracks();
  const { data: history = [] } = useHistory();
  const setWatchStatus = useSetWatchStatus();
  const showToast = useToastStore((s) => s.show);

  // Order Continue Watching by real recency: the most recent HistoryEntry
  // whose label mentions the series' title (same title-substring-match
  // convention used elsewhere for classifying history entries), descending.
  // Series with no matching history entry fall back to listContinueWatching()'s
  // existing order, sorted after every series that has a real timestamp.
  const sortedContinueWatching = useMemo(() => {
    const lastActivity = new Map<string, number>();
    for (const m of continueWatching) {
      const titleLower = m.title.toLowerCase();
      let latest: number | null = null;
      for (const entry of history) {
        if (!entry.label.toLowerCase().includes(titleLower)) continue;
        const d = historyEntryDate(entry);
        if (d && (latest === null || d.getTime() > latest)) latest = d.getTime();
      }
      if (latest !== null) lastActivity.set(m.id, latest);
    }
    return [...continueWatching].sort((a, b) => {
      const ta = lastActivity.get(a.id);
      const tb = lastActivity.get(b.id);
      if (ta !== undefined && tb !== undefined) return tb - ta;
      if (ta !== undefined) return -1;
      if (tb !== undefined) return 1;
      return 0; // keep listContinueWatching()'s relative order
    });
  }, [continueWatching, history]);

  const featured = sortedContinueWatching[0];
  const { data: progressById = {} } = useContinueWatchingProgress(sortedContinueWatching);
  const { data: nextEpisodeById = {} } = useNextEpisodes(sortedContinueWatching);

  // Series only: a movie has no partial progress to resume (it's watchlist
  // or watched), and nothing in the app sets a movie to "watching", so the
  // old Series/Movies toggle's Movies tab was always empty.
  const typedList = useMemo(
    () => sortedContinueWatching.filter((m) => m.kind !== "movie"),
    [sortedContinueWatching]
  );

  const invalidateWatchedData = () => {
    qc.invalidateQueries({ queryKey: ["episodes"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["watchedMediaIds"] });
    qc.invalidateQueries({ queryKey: ["history"] });
    qc.invalidateQueries({ queryKey: ["media", "continue-watching"] });
    qc.invalidateQueries({ queryKey: ["library"] });
    qc.invalidateQueries({ queryKey: ["upcoming"] });
    qc.invalidateQueries({ queryKey: ["continueWatchingProgress"] });
    qc.invalidateQueries({ queryKey: ["nextEpisode"] });
  };

  // Tapping the checkmark should advance progress — mark the series' next
  // unwatched episode as watched — not blast the whole series to "watched".
  // Movies have no episode concept, so they fall back to the whole-status
  // toggle. Once real progress reaches 100%, listContinueWatching()'s
  // existing deriveEffectiveStatus-based filtering makes the series drop out
  // of Continue Watching on its own — so we also flip the raw status to
  // "watched" once the last episode is marked, mirroring
  // app/series/[id].tsx's updateSeriesStatusAfterWatch (the raw status flag
  // is what deriveEffectiveStatus falls back on once every episode is
  // watched).
  const markNextWatched = async (item: Media) => {
    const nextEp = nextEpisodeById[item.id];
    if (item.kind === "series" && nextEp) {
      if (!isAired(nextEp.airDate)) {
        showToast("The next episode hasn't aired yet");
        return;
      }
      // Instant feedback: toast + progress bump now, saves in the background.
      showToast("Episode marked as watched");
      const progress = progressById[item.id];
      qc.setQueriesData<Record<string, { watchedCount: number; totalCount: number; percent: number }>>(
        { queryKey: ["continueWatchingProgress"] },
        (old) => {
          const p = old?.[item.id];
          if (!old || !p) return old;
          const watchedCount = p.watchedCount + 1;
          const percent = p.totalCount ? Math.round((watchedCount / p.totalCount) * 100) : p.percent;
          return { ...old, [item.id]: { ...p, watchedCount, percent } };
        }
      );
      try {
        await mediaRepository.toggleEpisodeWatched(nextEp.id);
        await trackingRepository.logWatch(episodeHistoryLabel(item.title, nextEp), {
          mediaId: item.id,
          episodeIds: [nextEp.id],
        });
        if (progress?.totalCount && item.status !== "watched" && progress.watchedCount + 1 >= progress.totalCount) {
          await mediaRepository.setWatchStatus(item.id, "watched");
        }
      } catch {
        showToast("Couldn't save — check your connection");
      }
      invalidateWatchedData();
    } else {
      setWatchStatus.mutate({ mediaId: item.id, status: "watched" });
      showToast("Marked as watched");
    }
  };

  return (
    <Screen onRefresh={refetch} refreshing={isLoading}>
      <RewindAutoOpen />
      <View style={styles.header}>
        <Text style={styles.greeting}>Good evening, {profile?.firstName ?? ""}</Text>
        <Avatar
          name={profile?.firstName ?? "?"}
          color={profile?.avatarColor}
          icon={avatarIconEmoji(profile?.avatarIcon)}
          size={40}
        />
      </View>

      {!tracks.watch ? null : isError ? (
        <OfflineState onRetry={() => refetch()} />
      ) : (
        <View style={{ gap: 16 }}>
          <View style={{ gap: 12 }}>
            <SectionLabel>Continue Watching</SectionLabel>

            {isLoading ? (
              <View style={{ gap: 12 }}>
                <Skeleton height={210} radius={16} />
                <Skeleton height={14} width="60%" />
              </View>
            ) : !featured ? (
              <EmptyState
                title="Nothing here yet"
                subtitle="Content you track will show up here."
                actionLabel="Discover content"
                onAction={() => router.push("/discover")}
              />
            ) : (
              <ContinueWatchingCard
                title={featured.title}
                episodeMeta={
                  nextEpisodeById[featured.id]
                    ? `Next episode · S${nextEpisodeById[featured.id]!.season}E${nextEpisodeById[featured.id]!.number}`
                    : featured.totalEpisodes
                    ? `${featured.totalEpisodes} episodes`
                    : "In progress"
                }
                ratio={
                  progressById[featured.id]
                    ? `${progressById[featured.id].watchedCount}/${progressById[featured.id].totalCount}`
                    : "—"
                }
                percent={progressById[featured.id]?.percent ?? 0}
                artworkColor={featured.artworkColor}
                posterPath={featured.posterPath}
                badgeLabel="RESUME"
                onPress={() => router.push(`/series/${featured.id}`)}
                onMarkWatched={() => markNextWatched(featured)}
              />
            )}
          </View>

          {!isLoading && sortedContinueWatching.length > 0 ? (
            <View style={{ gap: 12 }}>
              <Text style={styles.countLabel}>
                {typedList.length} series in progress
              </Text>

              {typedList.length === 0 ? (
                <EmptyState
                  title="No series in progress"
                  subtitle="Titles you're watching will show up here."
                />
              ) : (
                <View>
                  {typedList.map((item) => {
                    const progress = progressById[item.id];
                    const nextEp = nextEpisodeById[item.id];
                    const meta = nextEp
                      ? `Next · S${nextEp.season}E${nextEp.number}${progress ? ` · ${progress.watchedCount}/${progress.totalCount}` : ""}`
                      : progress?.totalCount
                      ? `${progress.watchedCount}/${progress.totalCount}`
                      : "In progress";
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => router.push(item.kind === "movie" ? `/movie/${item.id}` : `/series/${item.id}`)}
                      >
                        <MediaListItem
                          title={item.title}
                          meta={meta}
                          progress={progress?.percent ?? 0}
                          artworkColor={item.artworkColor}
                          posterPath={item.posterPath}
                          action={
                            <Pressable
                              onPress={() => markNextWatched(item)}
                              style={styles.rowCheck}
                              hitSlop={8}
                            >
                              <Text style={styles.rowCheckGlyph}>✓</Text>
                            </Pressable>
                          }
                        />
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          ) : null}
        </View>
      )}

      {/* Games: a separate block, below the series one. */}
      {tracks.play ? <ContinuePlaying hideWhenEmpty={tracks.watch} /> : null}

      {tracks.watch && upcoming.length > 0 ? (
        <View style={{ gap: 4 }}>
          <SectionLabel>Up Next</SectionLabel>
          {upcoming.slice(0, 3).map((u) => {
            const isMovie = u.kind === "movie";
            const dateLabel = new Date(u.airDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
            return (
              <UpNextRow
                key={u.id}
                title={u.seriesTitle}
                meta={
                  isMovie
                    ? `Movie release — ${dateLabel}`
                    : `S${String(u.season).padStart(2, "0")} E${String(u.episode).padStart(2, "0")} — ${dateLabel}`
                }
                onAction={() => router.push(isMovie ? `/movie/${u.id}` : `/series/${u.id}`)}
              />
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting: { fontFamily: "ArchivoBlack_400Regular", color: theme.textPrimary, fontSize: 22 },
  countLabel: { color: theme.textTertiary, fontSize: 12, fontWeight: "600" },
  rowCheck: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.surfaceInteractive,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCheckGlyph: { color: theme.textPrimary },
});
