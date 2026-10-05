import React, { useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { goBack } from "@/lib/navigation";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Chip, EpisodeRow, MediaArtwork, PosterCard, ProgressBar, Rating, radius, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { LoadingScreen } from "@/components/LoadingScreen";
import { SectionLabel } from "@/components/SectionLabel";
import { HScroll } from "@/components/HScroll";
import { CommentsSection } from "@/components/CommentsSection";
import { currentSeasonFor, isAired } from "@/domain/watchStatus";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { episodeHistoryLabel, seasonHistoryLabel } from "@/lib/history";
import {
  useEpisodes,
  useFavorites,
  useMediaDetail,
  usePlatformIds,
  useRecommendations,
  useSeasonWatchedCounts,
  useSeriesWatchedEpisodeCount,
  useSetUserRating,
  useSetWatchStatus,
  useToggleFavorite,
} from "@/hooks/useMedia";
import { mediaRepository, trackingRepository } from "@/data/repositories";
import { useQueryClient } from "@tanstack/react-query";
import { Episode } from "@/types/media";
import { useToastStore } from "@/state/toastStore";
import { communityScore, rewindRatingFootnote } from "@/lib/statistics";
import { tmdbImageUrl } from "@/lib/tmdb";
import { watchProviderTitleUrl } from "@/lib/watchProviders";

export default function SeriesDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { data: media } = useMediaDetail(id);
  // Direct product-page links (Netflix/Prime/… title pages) for Where to watch.
  const { data: platformIds } = usePlatformIds(media);
  const { data: seasonWatchedCounts } = useSeasonWatchedCounts(id);
  // Opens on the season in progress (first unfinished one), not always
  // season 1; an explicit chip tap overrides it.
  const [pickedSeason, setSeason] = useState<number | null>(null);
  const [seasonOverviewOpen, setSeasonOverviewOpen] = useState(false);
  // Watched toggles update the screen instantly and save in the background.
  // Saves run one after another (not in parallel) so rapid taps can't race
  // each other's read-modify-write of the episodes map.
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const pendingWrites = useRef(0);
  const season = pickedSeason ?? currentSeasonFor(media?.seasonsInfo, seasonWatchedCounts) ?? 1;
  const { data: episodes = [] } = useEpisodes(id, season);
  const { data: seriesWatchedCount = 0 } = useSeriesWatchedEpisodeCount(id);
  const { data: similar = [] } = useRecommendations(id);
  const { data: favorites = [] } = useFavorites();
  const setWatchStatus = useSetWatchStatus();
  const toggleFavorite = useToggleFavorite();
  const setUserRating = useSetUserRating();
  const showToast = useToastStore((s) => s.show);

  if (!media) return <LoadingScreen />;
  const userRating = media.userRating ?? 0;

  const favorited = favorites.some((m) => m.id === media.id);

  const isReleased = isAired;

  const seasonCount = media.seasons ?? 1;
  const seasonNumbers = Array.from({ length: seasonCount }, (_, i) => i + 1);
  const seasonOverview = media.seasonsInfo?.find((s) => s.number === season)?.overview;

  const watchedCount = episodes.filter((e) => e.watched).length;
  const totalCount = episodes.length;
  const percent = totalCount > 0 ? Math.round((watchedCount / totalCount) * 100) : 0;
  const nextEpisode = episodes.find((e) => !e.watched);

  const invalidateWatchedData = () => {
    qc.invalidateQueries({ queryKey: ["episodes", id] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["watchedMediaIds"] });
    qc.invalidateQueries({ queryKey: ["history"] });
    qc.invalidateQueries({ queryKey: ["seriesWatchedEpisodeCount", id] });
    qc.invalidateQueries({ queryKey: ["seasonWatchedCounts", id] });
    qc.invalidateQueries({ queryKey: ["media", "continue-watching"] });
    qc.invalidateQueries({ queryKey: ["library"] });
    // Up Next + Home's progress/next-episode depend on the same watched set.
    qc.invalidateQueries({ queryKey: ["upcoming"] });
    qc.invalidateQueries({ queryKey: ["continueWatchingProgress"] });
    qc.invalidateQueries({ queryKey: ["nextEpisode"] });
  };

  // Released episodes for the current season — the denominator for "did this
  // season just get fully completed".
  const releasedEpisodes = episodes.filter((e) => isReleased(e.airDate));

  // Marking watch progress should actually flip the series' own status —
  // otherwise listContinueWatching() (which filters on status === "watching")
  // stays permanently empty no matter how many episodes get watched. This
  // runs after EVERY toggle, mark or unmark, and re-reads the real watched
  // count straight from Firestore (not the seriesWatchedCount React Query
  // hook, which stays stale across a burst of rapid taps — two unmarks
  // fired before the first one's invalidation+refetch lands would both
  // compute their "next count" off the SAME pre-burst number, under-
  // decrementing and permanently leaving the series stuck on "watching"
  // even after every episode was unmarked) — so it's correct regardless of
  // how fast the user taps.
  const syncSeriesStatusToProgress = async () => {
    if (!media || media.status === "watched") return;
    const newWatchedCount = await mediaRepository.getSeriesWatchedEpisodeCount(media.id);
    const isFullyWatched = !!media.totalEpisodes && newWatchedCount >= media.totalEpisodes;
    const nextStatus = isFullyWatched ? "watched" : newWatchedCount > 0 ? "watching" : media.status === "watching" ? null : media.status;
    if (media.status === nextStatus) return;
    await mediaRepository.setWatchStatus(media.id, nextStatus ?? null);
    // Broad "media" prefix, not just ["media", media.id] — otherwise any
    // poster card showing this series elsewhere (Discover, trending,
    // search results) keeps its stale status badge cached indefinitely,
    // since those lists are separate query keys this write never touched.
    qc.invalidateQueries({ queryKey: ["media"] });
    qc.invalidateQueries({ queryKey: ["library"] });
  };

  const runInBackground = (task: () => Promise<void>) => {
    pendingWrites.current += 1;
    writeQueue.current = writeQueue.current
      .then(task)
      .catch(() => showToast("Couldn't save — check your connection"))
      .finally(() => {
        pendingWrites.current -= 1;
        // Refetch once the last queued save lands (not after each one, which
        // would briefly flip back episodes whose save is still queued).
        if (pendingWrites.current === 0) invalidateWatchedData();
      });
  };

  const setWatchedLocally = (ids: string[], watched: boolean) =>
    qc.setQueryData<Episode[]>(["episodes", id, season], (old) =>
      old?.map((e) => (ids.includes(e.id) ? { ...e, watched } : e))
    );

  const toggleEpisode = (episodeId: string) => {
    const episode = episodes.find((e) => e.id === episodeId);
    const wasWatched = !!episode?.watched;
    if (!wasWatched && episode && !isReleased(episode.airDate)) {
      showToast("This episode hasn't aired yet");
      return;
    }
    setWatchedLocally([episodeId], !wasWatched);
    runInBackground(async () => {
      await mediaRepository.toggleEpisodeWatched(episodeId);
      if (episode && media) {
        const label = episodeHistoryLabel(media.title, episode);
        const ref = { mediaId: media.id, episodeIds: [episodeId] };
        if (wasWatched) await trackingRepository.removeWatch(ref, [label]);
        else await trackingRepository.logWatch(label, ref);
      }
      await syncSeriesStatusToProgress();
    });
    if (!wasWatched) {
      const nowAllWatched =
        releasedEpisodes.length > 0 && releasedEpisodes.every((e) => e.watched || e.id === episodeId);
      if (nowAllWatched) {
        // Same as "Mark all watched": move on to the next season so coming
        // back from the completion screen shows what's next.
        const nextSeason = seasonNumbers.find((n) => n > season);
        if (nextSeason) {
          setSeason(nextSeason);
          setSeasonOverviewOpen(false);
        }
        router.push(`/complete/${media?.id}?kind=season&season=${season}`);
        return;
      }
      showToast("Episode marked as watched", {
        actionLabel: "Undo",
        onAction: () => {
          setWatchedLocally([episodeId], false);
          runInBackground(async () => {
            await mediaRepository.toggleEpisodeWatched(episodeId);
            if (episode && media) {
              await trackingRepository.removeWatch({ mediaId: media.id, episodeIds: [episodeId] }, [
                episodeHistoryLabel(media.title, episode),
              ]);
            }
            await syncSeriesStatusToProgress();
          });
        },
      });
    }
  };

  const markSeasonWatched = () => {
    const unwatched = episodes.filter((e) => !e.watched && isReleased(e.airDate));
    if (unwatched.length === 0) return;
    const ids = unwatched.map((e) => e.id);
    const markedSeason = season;
    setWatchedLocally(ids, true);
    // One atomic bulk write, not N parallel toggleEpisodeWatched() calls —
    // those race (each does its own read-modify-write of the whole
    // episodesWatched map from a stale snapshot).
    runInBackground(async () => {
      await mediaRepository.setEpisodesWatched(ids, true);
      if (media) {
        await trackingRepository.logWatch(seasonHistoryLabel(media.title, markedSeason), {
          mediaId: media.id,
          episodeIds: ids,
        });
      }
      await syncSeriesStatusToProgress();
    });
    // Move on to the next season, so coming back from the completion screen
    // shows what's next rather than the season just finished.
    const nextSeason = seasonNumbers.find((s) => s > markedSeason);
    if (nextSeason) {
      setSeason(nextSeason);
      setSeasonOverviewOpen(false);
    }
    if (releasedEpisodes.length > 0) {
      router.push(`/complete/${media?.id}?kind=season&season=${markedSeason}`);
      return;
    }
    showToast(`Season ${markedSeason} marked as watched`);
  };

  const unmarkSeasonWatched = () => {
    const watchedEpisodes = episodes.filter((e) => e.watched);
    if (watchedEpisodes.length === 0) return;
    const ids = watchedEpisodes.map((e) => e.id);
    const unmarkedSeason = season;
    setWatchedLocally(ids, false);
    runInBackground(async () => {
      await mediaRepository.setEpisodesWatched(ids, false);
      if (media) {
        await trackingRepository.removeWatch({ mediaId: media.id, episodeIds: ids }, [
          seasonHistoryLabel(media.title, unmarkedSeason),
          ...watchedEpisodes.map((e) => episodeHistoryLabel(media.title, e)),
        ]);
      }
      await syncSeriesStatusToProgress();
    });
    showToast(`Season ${unmarkedSeason} marked as unwatched`);
  };

  return (
    <Screen scroll edges={["bottom"]} contentStyle={{ padding: 0, paddingBottom: 110, gap: 0 }}>
      <View style={styles.backdrop}>
        <MediaArtwork path={media.backdropPath} size="w780" color={media.artworkColor} style={{ width: "100%", height: "100%" }} />
        <LinearGradient
          colors={["rgba(0,0,0,0.1)", "transparent", theme.bgPrimary]}
          locations={[0, 0.35, 1]}
          style={StyleSheet.absoluteFill}
        />
        {/* Below the status bar (safe-area inset), smaller so they sit on the
            backdrop instead of crowding the top edge. */}
        <Pressable
          onPress={() => goBack(router)}
          style={[styles.backBtn, { top: insets.top + 10 }]}
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={16} color={theme.textPrimary} />
        </Pressable>
        {media.trailerKey ? (
          <Pressable
            style={[styles.trailer, { top: insets.top + 10 }]}
            onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${media.trailerKey}`)}
          >
            <Text style={styles.trailerLabel}>▶ Trailer</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <MediaArtwork path={media.posterPath} size="w342" color={media.artworkColor} radius={radius.md} style={styles.poster} />
          <View style={styles.headerText}>
            <Text style={styles.title}>{media.title}</Text>
            <Text style={styles.meta}>
              {media.year} · {media.genres.join(", ")} · ★ {media.communityRating?.toFixed(1) ?? "—"} ·{" "}
              {media.seasons} seasons
            </Text>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <SectionLabel>Your Progress</SectionLabel>
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressCount}>
                {watchedCount} / {totalCount} episodes
              </Text>
              <Text style={styles.progressPercent}>{percent}%</Text>
            </View>
            <ProgressBar percent={percent} />
          </View>
          {media.totalEpisodes ? (
            <Text style={styles.overallProgress}>
              {media.totalEpisodes} total · {seriesWatchedCount} watched ·{" "}
              {Math.round((seriesWatchedCount / media.totalEpisodes) * 100)}% overall
            </Text>
          ) : null}
        </View>

        {nextEpisode ? (
          <View style={styles.continueCard}>
            <SectionLabel>Continue Watching</SectionLabel>
            <Text style={styles.continueTitle}>
              S{String(nextEpisode.season).padStart(2, "0")} E{String(nextEpisode.number).padStart(2, "0")} —{" "}
              {nextEpisode.title}
            </Text>
            <Text style={styles.meta}>{nextEpisode.runtimeMinutes} min</Text>
            <Pressable onPress={() => toggleEpisode(nextEpisode.id)} style={{ marginTop: 8 }}>
              <View style={styles.markWatched}>
                <Text style={{ color: theme.textInverse, fontWeight: "700", fontSize: 13 }}>Mark as Watched</Text>
              </View>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable
            onPress={() => {
              const next = media.status === "watchlist" ? null : "watchlist";
              setWatchStatus.mutate({ mediaId: media.id, status: next });
              showToast(next ? "Added to watchlist" : "Removed from watchlist");
            }}
            style={[styles.actionBtn, media.status === "watchlist" && styles.actionBtnActive]}
          >
            <Text style={[styles.actionBtnLabel, media.status === "watchlist" && styles.actionBtnLabelActive]}>
              {media.status === "watchlist" ? "✓ In Watchlist" : "+ Watchlist"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              toggleFavorite.mutate(media.id);
              showToast(favorited ? "Removed from favorites" : "Added to favorites");
            }}
            style={[styles.actionBtn, favorited && styles.actionBtnActive]}
          >
            <Text style={[styles.actionBtnLabel, favorited && styles.actionBtnLabelActive]}>
              {favorited ? "♥ Favorite" : "♡ Favorite"}
            </Text>
          </Pressable>
        </View>

        {/* Stop watching = "dropped": leaves Watching, Continue Watching and
            Up Next; watched episodes stay in history. Resume undoes it. */}
        {media.status === "watching" ? (
          <Pressable
            style={styles.dropBtn}
            onPress={() => {
              setWatchStatus.mutate({ mediaId: media.id, status: "dropped" });
              showToast("Stopped watching — moved to Dropped", {
                actionLabel: "Undo",
                onAction: () => setWatchStatus.mutate({ mediaId: media.id, status: "watching" }),
              });
            }}
          >
            <Ionicons name="stop-circle-outline" size={16} color={theme.textTertiary} />
            <Text style={styles.dropLabel}>Stop watching</Text>
          </Pressable>
        ) : media.status === "dropped" ? (
          <View style={styles.droppedBanner}>
            <Text style={styles.droppedText}>You stopped watching this series.</Text>
            <Pressable
              onPress={() => {
                setWatchStatus.mutate({ mediaId: media.id, status: seriesWatchedCount > 0 ? "watching" : null });
                showToast("Back in Watching");
              }}
              hitSlop={8}
            >
              <Text style={styles.resumeLabel}>Resume</Text>
            </Pressable>
          </View>
        ) : null}

        {seasonNumbers.length > 0 ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>Seasons</SectionLabel>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {seasonNumbers.map((s) => (
                <Chip
                  key={s}
                  label={`Season ${s}`}
                  selected={s === season}
                  onPress={() => {
                    setSeason(s);
                    setSeasonOverviewOpen(false);
                  }}
                />
              ))}
            </View>
            {seasonOverview ? (
              <Pressable onPress={() => setSeasonOverviewOpen((o) => !o)}>
                <Text style={styles.seasonOverview} numberOfLines={seasonOverviewOpen ? undefined : 3}>
                  {seasonOverview}
                </Text>
                <Text style={styles.moreLabel}>{seasonOverviewOpen ? "Show less" : "Read more"}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {episodes.length > 0 ? (
          <View style={{ gap: 4 }}>
            <View style={styles.episodesHeader}>
              <SectionLabel>Episodes</SectionLabel>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {episodes.some((e) => e.watched) ? (
                  <Pressable onPress={unmarkSeasonWatched}>
                    <Text style={styles.unmarkAllLabel}>Unmark all</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            {/* Prominent season action (was a small text link). */}
            {episodes.some((e) => !e.watched && isReleased(e.airDate)) ? (
              <Pressable style={styles.markSeasonBtn} onPress={markSeasonWatched} accessibilityRole="button">
                <Ionicons name="checkmark-done" size={18} color={theme.textInverse} />
                <Text style={styles.markSeasonLabel}>Mark Season {season} as watched</Text>
              </Pressable>
            ) : null}
            {episodes.map((e) => (
              <Pressable key={e.id} onPress={() => router.push(`/episode/${e.id}`)}>
                <EpisodeRow
                  number={e.number}
                  title={e.title}
                  runtime={e.runtimeMinutes}
                  rating={e.rating}
                  ratingCount={e.ratingCount}
                  airDate={e.airDate}
                  watched={e.watched}
                  isNext={e.id === nextEpisode?.id}
                  onToggle={() => toggleEpisode(e.id)}
                />
              </Pressable>
            ))}
          </View>
        ) : null}

        {episodes.length > 0 ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>{`Rating Trend — Season ${season}`}</SectionLabel>
            {/* Not the shared <Chart> here on purpose: Chart always highlights
                only the last bar (right convention for Statistics' "today"
                weekly chart), but here every episode that actually has a
                rating should be highlighted, regardless of position. */}
            {(() => {
              const rated = episodes.filter((e) => (e.rating ?? 0) > 0);
              const showMarkers = rated.length >= 2;
              const best = showMarkers ? rated.reduce((a, b) => ((b.rating ?? 0) > (a.rating ?? 0) ? b : a)) : undefined;
              const worst = showMarkers ? rated.reduce((a, b) => ((b.rating ?? 0) < (a.rating ?? 0) ? b : a)) : undefined;
              return (
                <View style={styles.ratingTrendCard}>
                  <View style={styles.ratingTrendScale}>
                    <Text style={styles.ratingTrendScaleLabel}>5</Text>
                    <Text style={styles.ratingTrendScaleLabel}>0</Text>
                  </View>
                  <View style={styles.ratingTrendRow}>
                    {episodes.map((e) => {
                      const rating = e.rating ?? 0;
                      const isRated = rating > 0;
                      return (
                        <View key={e.id} style={styles.ratingTrendBarWrap}>
                          <View
                            style={[
                              styles.ratingTrendBar,
                              {
                                height: `${Math.max((rating / 5) * 100, 4)}%`,
                                backgroundColor: isRated ? theme.brandPrimary : theme.surfaceInteractive,
                              },
                            ]}
                          />
                        </View>
                      );
                    })}
                  </View>
                  <View style={styles.ratingTrendLegendRow}>
                    <View style={styles.ratingTrendLegendDot} />
                    <Text style={styles.ratingTrendLegendText}>Rated</Text>
                    <View style={[styles.ratingTrendLegendDot, { backgroundColor: theme.surfaceInteractive }]} />
                    <Text style={styles.ratingTrendLegendText}>Not yet rated</Text>
                  </View>
                  {best && worst && best.id !== worst.id ? (
                    <View style={{ gap: 4 }}>
                      <Text style={styles.ratingTrendSummary}>
                        <Text style={{ color: theme.brandPrimary }}>▲ Best</Text> — E{best.number} · {best.rating}/5
                      </Text>
                      <Text style={styles.ratingTrendSummary}>
                        <Text style={{ color: theme.textTertiary }}>▼ Worst</Text> — E{worst.number} · {worst.rating}/5
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })()}
          </View>
        ) : null}

        {(media.watchProviders ?? []).length > 0 ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>Where to watch</SectionLabel>
            {(media.watchProviders ?? []).map((p) => {
              const platformUrl = watchProviderTitleUrl(p.providerName, media.title, media.watchProvidersLink, platformIds, "tv");
              return (
              <Pressable
                key={p.providerName}
                style={styles.watchRow}
                disabled={!platformUrl}
                onPress={() => platformUrl && Linking.openURL(platformUrl)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  {p.logoPath ? (
                    <Image
                      source={{ uri: tmdbImageUrl(p.logoPath, "w92") }}
                      style={{ width: 28, height: 28, borderRadius: 6 }}
                    />
                  ) : null}
                  <Text style={styles.watchProvider}>{p.providerName}</Text>
                </View>
                <Ionicons name="open-outline" size={16} color={theme.textTertiary} />
              </Pressable>
              );
            })}
          </View>
        ) : null}

        {(media.cast ?? []).length > 0 ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>Cast</SectionLabel>
            <HScroll>
              {(media.cast ?? []).map((c) => (
                <View key={c.id} style={{ alignItems: "center", gap: 6 }}>
                  <Avatar name={c.name} size={48} imageUrl={tmdbImageUrl(c.profilePath, "w185")} />
                  <Text style={styles.castName}>{c.name}</Text>
                </View>
              ))}
            </HScroll>
          </View>
        ) : null}

        <View style={styles.ratingRow}>
          <View style={styles.ratingCard}>
            <Rating
              mode="community"
              value={communityScore(media).value}
              count={communityScore(media).count}
              footnote={rewindRatingFootnote(media)}
            />
          </View>
          <View style={styles.ratingCard}>
            <Rating
              mode="user"
              value={userRating}
              interactive
              onChange={(rating) => {
                setUserRating.mutate({ mediaId: media.id, rating });
                showToast(rating ? "Rating saved" : "Rating removed");
              }}
            />
          </View>
        </View>

        {media.synopsis ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>Synopsis</SectionLabel>
            <Text style={styles.synopsis}>{media.synopsis}</Text>
          </View>
        ) : null}

        <CommentsSection targetId={media.id} />

        <View style={{ gap: 10 }}>
          <SectionLabel>Similar Content</SectionLabel>
          <HScroll>
            {similar
              .filter((m) => m.id !== media.id)
              .map((m) => (
                <Pressable key={m.id} onPress={() => router.push(`/series/${m.id}`)}>
                  <PosterCard artworkColor={m.artworkColor} posterPath={m.posterPath} width={110} />
                </Pressable>
              ))}
          </HScroll>
        </View>
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
  seasonOverview: { color: theme.textSecondary, fontSize: 13, lineHeight: 20 },
  moreLabel: { color: theme.brandPrimary, fontSize: 12, fontWeight: "700", marginTop: 4 },
  body: { padding: 20, gap: 20 },
  headerRow: { flexDirection: "row", gap: 12, marginTop: -46, alignItems: "flex-start" },
  poster: { width: 100, height: 148, borderWidth: 2, borderColor: theme.bgPrimary },
  headerText: { paddingTop: 56, gap: 2, flex: 1, flexShrink: 1 },
  title: { color: theme.textPrimary, fontSize: 20, fontWeight: "800" },
  meta: { color: theme.textTertiary, fontSize: 12 },
  progressCard: {
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.sm,
    padding: 12,
    gap: 8,
  },
  progressHeader: { flexDirection: "row", justifyContent: "space-between" },
  progressCount: { color: theme.textPrimary, fontSize: 15, fontWeight: "700" },
  progressPercent: { color: theme.brandPrimary, fontSize: 15, fontWeight: "700" },
  overallProgress: { color: theme.textTertiary, fontSize: 12 },
  continueCard: {
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.sm,
    padding: 14,
    gap: 4,
  },
  continueTitle: { color: theme.textPrimary, fontSize: 15, fontWeight: "700" },
  markWatched: {
    backgroundColor: theme.brandPrimary,
    borderRadius: radius.full,
    paddingVertical: 10,
    alignItems: "center",
  },
  ratingTrendCard: {
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.sm,
    padding: 14,
    gap: 10,
  },
  ratingTrendScale: { flexDirection: "row", justifyContent: "space-between" },
  ratingTrendScaleLabel: { color: theme.textTertiary, fontSize: 10 },
  ratingTrendRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 60 },
  ratingTrendBarWrap: { flex: 1, height: 60, justifyContent: "flex-end" },
  ratingTrendBar: { width: "100%", borderRadius: 3 },
  ratingTrendLegendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ratingTrendLegendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.brandPrimary },
  ratingTrendLegendText: { color: theme.textTertiary, fontSize: 11, marginRight: 10 },
  ratingTrendSummary: { color: theme.textSecondary, fontSize: 12, fontWeight: "600" },
  watchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.sm,
    padding: 14,
  },
  watchProvider: { color: theme.textPrimary, fontSize: 13, fontWeight: "600" },
  watchAction: { color: theme.brandPrimary, fontSize: 12, fontWeight: "700" },
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
  castName: { color: theme.textTertiary, fontSize: 10 },
  episodesHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  markAllLabel: { color: theme.brandPrimary, fontSize: 12, fontWeight: "700" },
  unmarkAllLabel: { color: theme.textTertiary, fontSize: 12, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 8 },
  markSeasonBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.brandPrimary,
    borderRadius: radius.full,
    paddingVertical: 12,
    marginVertical: 6,
  },
  markSeasonLabel: { color: theme.textInverse, fontSize: 14, fontWeight: "800" },
  dropBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 4 },
  dropLabel: { color: theme.textTertiary, fontSize: 13, fontWeight: "600" },
  droppedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  droppedText: { color: theme.textSecondary, fontSize: 13 },
  resumeLabel: { color: theme.brandPrimary, fontSize: 13, fontWeight: "800" },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: radius.full,
    backgroundColor: theme.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
  },
  actionBtnActive: { backgroundColor: theme.brandPrimary, borderWidth: 0 },
  actionBtnLabel: { color: theme.textSecondary, fontSize: 13, fontWeight: "700" },
  actionBtnLabelActive: { color: theme.textInverse },
});
