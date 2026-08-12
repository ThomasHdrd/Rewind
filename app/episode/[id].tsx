import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Comment, Input, MediaArtwork, Rating, radius, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { SectionLabel } from "@/components/SectionLabel";
import { useEpisodeDetail, useMediaDetail, useSeriesWatchedEpisodeCount, useSetUserRating } from "@/hooks/useMedia";
import { mediaRepository, trackingRepository } from "@/data/repositories";
import { useQueryClient } from "@tanstack/react-query";
import { useToastStore } from "@/state/toastStore";

export default function EpisodeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: episode } = useEpisodeDetail(id);
  const { data: series } = useMediaDetail(episode?.seriesId ?? "");
  const { data: seriesWatchedCount = 0 } = useSeriesWatchedEpisodeCount(episode?.seriesId ?? "");
  const setUserRating = useSetUserRating();
  const showToast = useToastStore((s) => s.show);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<{ id: string; name: string; text: string }[]>([]);

  if (!episode || !series) return null;
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
    if (!wasWatched && airDateObj && !isNaN(airDateObj.getTime()) && airDateObj.getTime() > Date.now()) return;
    await mediaRepository.toggleEpisodeWatched(episode.id);
    if (!wasWatched) {
      await trackingRepository.logWatch(`${series.title} — E${episode.number} ${episode.title}`);
      // Same "flip the series to watching/watched" fix as series/[id].tsx —
      // without this, listContinueWatching() (status === "watching") never
      // returns anything even though the user has real progress.
      if (series.status !== "watched") {
        const newTotal = seriesWatchedCount + 1;
        const isFullyWatched = !!series.totalEpisodes && newTotal >= series.totalEpisodes;
        const nextStatus = isFullyWatched ? "watched" : "watching";
        if (series.status !== nextStatus) {
          await mediaRepository.setWatchStatus(series.id, nextStatus);
          qc.invalidateQueries({ queryKey: ["media", series.id] });
        }
      }
    }
    qc.invalidateQueries({ queryKey: ["episode", id] });
    qc.invalidateQueries({ queryKey: ["episodes", episode.seriesId] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["watchedMediaIds"] });
    qc.invalidateQueries({ queryKey: ["history"] });
    qc.invalidateQueries({ queryKey: ["seriesWatchedEpisodeCount", episode.seriesId] });
    qc.invalidateQueries({ queryKey: ["media", "continue-watching"] });
    qc.invalidateQueries({ queryKey: ["library"] });
  };

  const submitComment = () => {
    if (!comment.trim()) return;
    setComments((prev) => [{ id: `c-${Date.now()}`, name: "You", text: comment.trim() }, ...prev]);
    setComment("");
  };

  return (
    <Screen scroll edges={["bottom"]} contentStyle={{ padding: 0, paddingBottom: 110, gap: 0 }}>
      <View style={styles.backdrop}>
        <MediaArtwork
          path={episode.stillPath ?? series.backdropPath}
          size="original"
          color={series.artworkColor}
          style={{ width: "100%", height: "100%" }}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.15)", "transparent", "rgba(5,8,16,0.55)", theme.bgPrimary]}
          locations={[0, 0.3, 0.75, 1]}
          style={StyleSheet.absoluteFill}
        />
        <Pressable onPress={() => router.back()} style={styles.roundBtnLeft}>
          <Text style={{ color: theme.textPrimary, fontSize: 16, lineHeight: 16, textAlign: "center", marginTop: -1 }}>‹</Text>
        </Pressable>
        <Pressable
          onPress={toggleWatched}
          style={[
            styles.roundBtnRight,
            {
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
            <Rating mode="community" value={episode.rating ?? 0} count={episode.ratingCount} />
          </View>
          <View style={styles.ratingCard}>
            <Rating
              mode="user"
              value={userRating}
              interactive
              onChange={(rating) => {
                setUserRating.mutate({ mediaId: episode.id, rating });
                showToast("Rating saved");
              }}
            />
          </View>
        </View>

        {series.synopsis ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>Synopsis</SectionLabel>
            <Text style={styles.synopsis}>{series.synopsis}</Text>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          <SectionLabel>Comments</SectionLabel>
          <Input
            placeholder="Add a comment..."
            value={comment}
            onChangeText={setComment}
            onSubmitEditing={submitComment}
          />
          {comments.map((c) => (
            <Comment key={c.id} name={c.name} text={c.text} />
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backdrop: { height: 260, position: "relative" },
  roundBtnLeft: {
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
  roundBtnRight: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
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
});
