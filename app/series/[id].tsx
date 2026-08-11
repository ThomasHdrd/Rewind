import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Chip, Comment, EpisodeRow, Input, MediaArtwork, PosterCard, ProgressBar, Rating, radius, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { SectionLabel } from "@/components/SectionLabel";
import { HScroll } from "@/components/HScroll";
import {
  useEpisodes,
  useFavorites,
  useMediaDetail,
  useRecommendations,
  useSeriesWatchedEpisodeCount,
  useSetWatchStatus,
  useToggleFavorite,
} from "@/hooks/useMedia";
import { mediaRepository, trackingRepository } from "@/data/repositories";
import { useQueryClient } from "@tanstack/react-query";
import { useToastStore } from "@/state/toastStore";
import { tmdbImageUrl } from "@/lib/tmdb";
import { watchProviderUrl } from "@/lib/watchProviders";

export default function SeriesDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: media } = useMediaDetail(id);
  const [season, setSeason] = useState(1);
  const { data: episodes = [] } = useEpisodes(id, season);
  const { data: seriesWatchedCount = 0 } = useSeriesWatchedEpisodeCount(id);
  const { data: similar = [] } = useRecommendations(id);
  const { data: favorites = [] } = useFavorites();
  const setWatchStatus = useSetWatchStatus();
  const toggleFavorite = useToggleFavorite();
  const showToast = useToastStore((s) => s.show);
  const [userRating, setUserRating] = useState(0);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<{ id: string; name: string; text: string }[]>([
    { id: "c1", name: "M. Reyes", text: "Loved the tension in the finale." },
    { id: "c2", name: "C. Ibarra", text: "Slow start but worth it." },
  ]);

  const submitComment = () => {
    if (!comment.trim()) return;
    setComments((prev) => [{ id: `c-${Date.now()}`, name: "You", text: comment.trim() }, ...prev]);
    setComment("");
  };

  if (!media) return null;

  const favorited = favorites.some((m) => m.id === media.id);

  const isReleased = (airDate?: string) => {
    if (!airDate) return true;
    const d = new Date(airDate);
    return isNaN(d.getTime()) || d.getTime() <= Date.now();
  };

  const seasonCount = media.seasons ?? 1;
  const seasonNumbers = Array.from({ length: seasonCount }, (_, i) => i + 1);

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
    qc.invalidateQueries({ queryKey: ["media", "continue-watching"] });
    qc.invalidateQueries({ queryKey: ["library"] });
  };

  // Released episodes for the current season — the denominator for "did this
  // season just get fully completed".
  const releasedEpisodes = episodes.filter((e) => isReleased(e.airDate));

  // Marking watch progress should actually flip the series' own status —
  // otherwise listContinueWatching() (which filters on status === "watching")
  // stays permanently empty no matter how many episodes get watched. Don't
  // downgrade an already-"watched" series, and skip redundant writes when the
  // status is already correct. When the newly-watched count reaches the
  // series' total episode count, mark the whole series "watched" instead.
  const updateSeriesStatusAfterWatch = async (newlyWatchedCount: number) => {
    if (!media || media.status === "watched") return;
    const newTotal = seriesWatchedCount + newlyWatchedCount;
    const isFullyWatched = !!media.totalEpisodes && newTotal >= media.totalEpisodes;
    const nextStatus = isFullyWatched ? "watched" : "watching";
    if (media.status === nextStatus) return;
    await mediaRepository.setWatchStatus(media.id, nextStatus);
    qc.invalidateQueries({ queryKey: ["media", media.id] });
    qc.invalidateQueries({ queryKey: ["media", "continue-watching"] });
    qc.invalidateQueries({ queryKey: ["library"] });
  };

  const toggleEpisode = async (episodeId: string) => {
    const episode = episodes.find((e) => e.id === episodeId);
    const wasWatched = episode?.watched;
    if (!wasWatched && episode && !isReleased(episode.airDate)) return;
    await mediaRepository.toggleEpisodeWatched(episodeId);
    if (!wasWatched && episode) {
      await trackingRepository.logWatch(`${media?.title ?? ""} — E${episode.number} ${episode.title}`.trim());
      await updateSeriesStatusAfterWatch(1);
    }
    invalidateWatchedData();
    if (!wasWatched) {
      const nowAllWatched =
        releasedEpisodes.length > 0 && releasedEpisodes.every((e) => e.watched || e.id === episodeId);
      if (nowAllWatched) {
        router.push(`/complete/${media?.id}?kind=season&season=${season}`);
        return;
      }
      showToast("Episode marked as watched", {
        actionLabel: "Undo",
        onAction: async () => {
          await mediaRepository.toggleEpisodeWatched(episodeId);
          invalidateWatchedData();
        },
      });
    }
  };

  const markSeasonWatched = async () => {
    const unwatched = episodes.filter((e) => !e.watched && isReleased(e.airDate));
    if (unwatched.length === 0) return;
    // One atomic bulk write, not N parallel toggleEpisodeWatched() calls —
    // those race (each does its own read-modify-write of the whole
    // episodesWatched map from a stale snapshot), so most of a multi-episode
    // change could get clobbered even though the toast reports success.
    await mediaRepository.setEpisodesWatched(unwatched.map((e) => e.id), true);
    await trackingRepository.logWatch(`${media?.title ?? ""} — Season ${season}`.trim());
    await updateSeriesStatusAfterWatch(unwatched.length);
    invalidateWatchedData();
    if (releasedEpisodes.length > 0) {
      router.push(`/complete/${media?.id}?kind=season&season=${season}`);
      return;
    }
    showToast(`Season ${season} marked as watched`);
  };

  const unmarkSeasonWatched = async () => {
    const watchedEpisodes = episodes.filter((e) => e.watched);
    if (watchedEpisodes.length === 0) return;
    await mediaRepository.setEpisodesWatched(watchedEpisodes.map((e) => e.id), false);
    invalidateWatchedData();
    showToast(`Season ${season} marked as unwatched`);
  };

  return (
    <Screen scroll edges={["bottom"]} contentStyle={{ padding: 0, paddingBottom: 110, gap: 0 }}>
      <View style={styles.backdrop}>
        <MediaArtwork path={media.backdropPath} size="original" color={media.artworkColor} style={{ width: "100%", height: "100%" }} />
        <LinearGradient
          colors={["rgba(0,0,0,0.1)", "transparent", theme.bgPrimary]}
          locations={[0, 0.35, 1]}
          style={StyleSheet.absoluteFill}
        />
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ color: theme.textPrimary, fontSize: 16, lineHeight: 16, textAlign: "center", marginTop: -1 }}>‹</Text>
        </Pressable>
        {media.trailerKey ? (
          <Pressable
            style={styles.trailer}
            onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${media.trailerKey}`)}
          >
            <Text style={{ color: theme.textPrimary, fontSize: 12, fontWeight: "700" }}>▶ Trailer</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <MediaArtwork path={media.posterPath} color={media.artworkColor} radius={radius.md} style={styles.poster} />
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

        {seasonNumbers.length > 0 ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>Seasons</SectionLabel>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {seasonNumbers.map((s) => (
                <Chip key={s} label={`Season ${s}`} selected={s === season} onPress={() => setSeason(s)} />
              ))}
            </View>
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
                {episodes.some((e) => !e.watched && isReleased(e.airDate)) ? (
                  <Pressable onPress={markSeasonWatched}>
                    <Text style={styles.markAllLabel}>Mark all watched</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
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
              const platformUrl = watchProviderUrl(p.providerName) ?? media.watchProvidersLink;
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
            <Rating mode="community" value={media.communityRating ?? 0} count={media.ratingCount} />
          </View>
          <View style={styles.ratingCard}>
            <Rating mode="user" value={userRating} interactive onChange={setUserRating} />
          </View>
        </View>

        {media.synopsis ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>Synopsis</SectionLabel>
            <Text style={styles.synopsis}>{media.synopsis}</Text>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <SectionLabel>Comments</SectionLabel>
          <Input placeholder="Add a comment..." value={comment} onChangeText={setComment} onSubmitEditing={submitComment} />
          {comments.map((c) => (
            <Comment key={c.id} name={c.name} text={c.text} />
          ))}
        </View>

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
    top: 14,
    left: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0007",
    alignItems: "center",
    justifyContent: "center",
  },
  trailer: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#000c",
    borderRadius: radius.full,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
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
