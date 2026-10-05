import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { goBack } from "@/lib/navigation";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MediaArtwork, Rating, radius, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { LoadingScreen } from "@/components/LoadingScreen";
import { SectionLabel } from "@/components/SectionLabel";
import { CommentsSection } from "@/components/CommentsSection";
import { isAired } from "@/domain/watchStatus";
import { episodeHistoryLabel } from "@/lib/history";
import { useEpisodeDetail, useMediaDetail, useSetUserRating } from "@/hooks/useMedia";
import { mediaRepository, trackingRepository } from "@/data/repositories";
import { useQueryClient } from "@tanstack/react-query";
import { Episode } from "@/types/media";
import { useToastStore } from "@/state/toastStore";
import { communityScore } from "@/lib/statistics";

export default function EpisodeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data: episode } = useEpisodeDetail(id);
  const { data: series } = useMediaDetail(episode?.seriesId ?? "");
  const setUserRating = useSetUserRating();
  const showToast = useToastStore((s) => s.show);

  if (!episode || !series) return <LoadingScreen />;
  const userRating = episode.userRating ?? 0;

  const airDateObj = episode.airDate ? new Date(episode.airDate) : null;
  const formattedAirDate =
    airDateObj && !isNaN(airDateObj.getTime())
      ? airDateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : null;

  const toggleWatched = async () => {
    const wasWatched = episode.watched;
    // Same guard as series/[id].tsx's episode-list toggle — this screen's
    // own checkmark button had no such check, so an unreleased episode could
    // still be marked watched by opening its detail page directly.
    if (!wasWatched && !isAired(episode.airDate)) {
      showToast("This episode hasn't aired yet");
      return;
    }
    // Instant: flip the checkmark now, save in the background (rolled back
    // by the refetch at the end if the save fails).
    qc.setQueryData<Episode | undefined>(["episode", id], (old) => (old ? { ...old, watched: !wasWatched } : old));
    showToast(wasWatched ? "Marked as unwatched" : "Episode marked as watched");
    try {
      await mediaRepository.toggleEpisodeWatched(episode.id);
      const label = episodeHistoryLabel(series.title, episode);
      const ref = { mediaId: series.id, episodeIds: [episode.id] };
      if (wasWatched) await trackingRepository.removeWatch(ref, [label]);
      else await trackingRepository.logWatch(label, ref);
      // Same "sync status to real progress" fix as series/[id].tsx's
      // syncSeriesStatusToProgress — runs both ways (mark and unmark), and
      // re-reads the real count from Firestore instead of trusting the
      // seriesWatchedCount hook (stale across rapid taps), so unchecking
      // here can't leave the series permanently stuck on "watching" with
      // zero real progress.
      if (series.status !== "watched") {
        const newWatchedCount = await mediaRepository.getSeriesWatchedEpisodeCount(series.id);
        const isFullyWatched = !!series.totalEpisodes && newWatchedCount >= series.totalEpisodes;
        const nextStatus = isFullyWatched
          ? "watched"
          : newWatchedCount > 0
            ? "watching"
            : series.status === "watching"
              ? null
              : series.status;
        if (series.status !== nextStatus) {
          await mediaRepository.setWatchStatus(series.id, nextStatus ?? null);
          // Broad "media" prefix — same fix as series/[id].tsx's
          // syncSeriesStatusToProgress, so poster cards elsewhere (Discover,
          // trending, search) don't keep a stale status badge cached.
          qc.invalidateQueries({ queryKey: ["media"] });
        }
      }
    } catch {
      showToast("Couldn't save — check your connection");
    }
    qc.invalidateQueries({ queryKey: ["episode", id] });
    qc.invalidateQueries({ queryKey: ["episodes", episode.seriesId] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["watchedMediaIds"] });
    qc.invalidateQueries({ queryKey: ["history"] });
    qc.invalidateQueries({ queryKey: ["seriesWatchedEpisodeCount", episode.seriesId] });
    qc.invalidateQueries({ queryKey: ["media", "continue-watching"] });
    qc.invalidateQueries({ queryKey: ["library"] });
    qc.invalidateQueries({ queryKey: ["upcoming"] });
    qc.invalidateQueries({ queryKey: ["continueWatchingProgress"] });
    qc.invalidateQueries({ queryKey: ["nextEpisode"] });
  };


  return (
    <Screen scroll edges={["bottom"]} contentStyle={{ padding: 0, paddingBottom: 110, gap: 0 }}>
      <View style={styles.backdrop}>
        <MediaArtwork
          path={episode.stillPath ?? series.backdropPath}
          size="w780"
          color={series.artworkColor}
          style={{ width: "100%", height: "100%" }}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.15)", "transparent", "rgba(5,8,16,0.55)", theme.bgPrimary]}
          locations={[0, 0.3, 0.75, 1]}
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          onPress={() => goBack(router)}
          style={[styles.roundBtnLeft, { top: insets.top + 10 }]}
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={16} color={theme.textPrimary} />
        </Pressable>
        <Pressable
          onPress={toggleWatched}
          accessibilityLabel={episode.watched ? "Mark as unwatched" : "Mark as watched"}
          hitSlop={8}
          style={[
            styles.roundBtnRight,
            {
              top: insets.top + 10,
              backgroundColor: episode.watched ? theme.brandPrimary : "#0007",
              opacity: !episode.watched && airDateObj && airDateObj.getTime() > Date.now() ? 0.4 : 1,
            },
          ]}
        >
          <Text style={{ color: theme.textPrimary, fontSize: 14 }}>✓</Text>
        </Pressable>
        <View style={styles.overlayText}>
          <Text style={styles.overlayTitle}>{series.title}</Text>
          <Text style={styles.overlaySubtitle}>
            S{String(episode.season).padStart(2, "0")} E{String(episode.number).padStart(2, "0")} · {episode.title}
            {formattedAirDate ? ` · ${formattedAirDate}` : ""}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.ratingRow}>
          <View style={styles.ratingCard}>
            <Rating
              mode="community"
              value={communityScore({
                communityRating: episode.rating,
                ratingCount: episode.ratingCount,
                rewindRating: episode.rewindRating,
                rewindRatingCount: episode.rewindRatingCount,
              }).value}
              count={communityScore({
                communityRating: episode.rating,
                ratingCount: episode.ratingCount,
                rewindRating: episode.rewindRating,
                rewindRatingCount: episode.rewindRatingCount,
              }).count}
            />
          </View>
          <View style={styles.ratingCard}>
            <Rating
              mode="user"
              value={userRating}
              interactive
              onChange={(rating) => {
                setUserRating.mutate({ mediaId: episode.id, rating });
                showToast(rating ? "Rating saved" : "Rating removed");
              }}
            />
          </View>
        </View>

        {/* This episode's own overview (TMDB) — this used to show the whole
            series' synopsis, which is already on the series page. */}
        <View style={{ gap: 10 }}>
          <SectionLabel>Synopsis</SectionLabel>
          <Text style={episode.synopsis ? styles.synopsis : styles.noSynopsis}>
            {episode.synopsis ?? "No synopsis for this episode yet."}
          </Text>
        </View>

        <CommentsSection targetId={episode.id} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backdrop: { height: 260, position: "relative" },
  roundBtnLeft: {
    position: "absolute",
    left: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0007",
    alignItems: "center",
    justifyContent: "center",
  },
  roundBtnRight: {
    position: "absolute",
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0007",
    alignItems: "center",
    justifyContent: "center",
  },
  overlayText: { position: "absolute", bottom: 14, left: 20, right: 20, gap: 2 },
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
});
