import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, theme } from "../tokens";
import { WatchStatus } from "@/types/media";

const map: Record<WatchStatus, { color: string; label: string }> = {
  watching: { color: theme.mediaWatching, label: "WATCHING" },
  watchlist: { color: theme.mediaWatchlist, label: "WATCHLIST" },
  watched: { color: theme.mediaWatched, label: "WATCHED" },
  paused: { color: theme.mediaPaused, label: "PAUSED" },
  dropped: { color: theme.mediaDropped, label: "DROPPED" },
};

export function WatchStatusBadge({ status = "watching" }: { status?: WatchStatus }) {
  const s = map[status] ?? map.watching;
  return (
    <View style={styles.badge}>
      <View style={[styles.dot, { backgroundColor: s.color }]} />
      <Text style={[styles.label, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radius.xs,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignSelf: "flex-start",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontWeight: "700", fontSize: 11, letterSpacing: 0.4 },
});
