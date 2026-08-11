import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { radius, theme } from "../tokens";
import { MediaArtwork } from "./MediaArtwork";
import { ProgressBar } from "./ProgressBar";

export function ContinueWatchingCard({
  title,
  episodeMeta,
  ratio,
  percent,
  artworkColor = "#274257",
  posterPath,
  variant = "featured",
  badgeLabel,
  onPress,
  onMarkWatched,
}: {
  title: string;
  episodeMeta: string;
  ratio: string;
  percent: number;
  artworkColor?: string;
  posterPath?: string | null;
  variant?: "featured" | "compact";
  badgeLabel?: string;
  onPress?: () => void;
  onMarkWatched?: () => void;
}) {
  const compact = variant === "compact";
  return (
    <Pressable onPress={onPress} style={[styles.card, { height: compact ? 150 : 210 }]}>
      <MediaArtwork path={posterPath} color={artworkColor} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["transparent", "rgba(4,7,12,0.9)"]}
        locations={[0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      {badgeLabel ? (
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>{badgeLabel}</Text>
        </View>
      ) : null}
      <Pressable onPress={onMarkWatched} style={styles.check} hitSlop={8}>
        <Text style={styles.checkGlyph}>✓</Text>
      </Pressable>
      <View style={styles.content}>
        <Text style={[styles.title, { fontSize: compact ? 16 : 20 }]}>{title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{episodeMeta}</Text>
          <Text style={styles.ratio}>
            {ratio} · {percent}%
          </Text>
        </View>
        <ProgressBar percent={percent} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: 16,
  },
  check: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(8,10,15,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkGlyph: { color: theme.textPrimary },
  badge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: theme.brandPrimary,
    borderRadius: radius.full,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  badgeLabel: { color: theme.textInverse, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  content: { gap: 8 },
  title: { fontWeight: "800", color: theme.textPrimary },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  meta: { fontSize: 13, color: theme.textSecondary },
  ratio: { fontSize: 13, fontWeight: "700", color: theme.brandPrimary },
});
