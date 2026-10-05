import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, theme } from "../tokens";
import { WatchStatus } from "@/types/media";
import { MediaArtwork } from "./MediaArtwork";
import { WatchStatusBadge } from "./WatchStatusBadge";

export function PosterCard({
  title,
  status,
  artworkColor = "#8B4A43",
  posterPath,
  imageUrl,
  width = 110,
  dateLabel,
}: {
  title?: string;
  status?: WatchStatus | "wishlist" | "backlog" | "playing" | "completed";
  artworkColor?: string;
  posterPath?: string | null;
  /** Full image URL (game covers from IGDB) instead of a TMDB path. */
  imageUrl?: string;
  width?: number;
  /** Small pill badge (e.g. "Nov 12") shown in the opposite corner from the
   * watch-status badge — used by Discover's Coming Soon section. */
  dateLabel?: string;
}) {
  return (
    <View style={{ width, gap: 8 }}>
      <View style={[styles.poster, { width, height: width * 1.5 }]}>
        <MediaArtwork
          path={posterPath}
          uri={imageUrl}
          size="w342"
          color={artworkColor}
          radius={radius.poster}
          style={{ width: "100%", height: "100%" }}
        />
        {status ? (
          <View style={styles.badgeWrap}>
            <WatchStatusBadge status={status} />
          </View>
        ) : null}
        {dateLabel ? (
          <View style={styles.dateBadgeWrap}>
            <Text style={styles.dateBadgeLabel}>{dateLabel}</Text>
          </View>
        ) : null}
      </View>
      {title ? (
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  poster: {
    position: "relative",
    borderRadius: radius.poster,
    borderWidth: 1,
    borderColor: theme.borderSubtle,
    overflow: "hidden",
  },
  badgeWrap: { position: "absolute", top: 8, left: 8 },
  // Bottom-left, not top-right: the status badge (WatchStatusBadge, e.g.
  // "● WATCHLIST") can be wide enough on a narrow poster to run into a
  // top-right date badge — putting the date at the opposite edge (bottom)
  // avoids any collision regardless of poster width or badge text length.
  dateBadgeWrap: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radius.xs,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  dateBadgeLabel: { color: theme.textPrimary, fontWeight: "700", fontSize: 11, letterSpacing: 0.4 },
  title: { fontSize: 13, fontWeight: "600", color: theme.textPrimary },
});
