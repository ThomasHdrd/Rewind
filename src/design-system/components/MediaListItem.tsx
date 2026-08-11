import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, theme } from "../tokens";
import { MediaArtwork } from "./MediaArtwork";
import { ProgressBar } from "./ProgressBar";

export function MediaListItem({
  title,
  meta,
  progress,
  artworkColor = "#3D5A6C",
  posterPath,
  action,
}: {
  title: string;
  meta?: string;
  progress?: number;
  artworkColor?: string;
  posterPath?: string | null;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <MediaArtwork path={posterPath} color={artworkColor} radius={radius.sm} style={styles.artwork} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.title}>{title}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        {progress != null ? (
          <View style={{ marginTop: 2 }}>
            <ProgressBar percent={progress} height={4} />
          </View>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10 },
  artwork: { width: 52, height: 78 },
  title: { fontSize: 15, fontWeight: "700", color: theme.textPrimary },
  meta: { fontSize: 12, color: theme.textTertiary },
});
