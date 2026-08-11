import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, theme } from "../tokens";
import { Avatar } from "./Avatar";
import { Reaction } from "./Reaction";

export function FriendActivityCard({
  name,
  action,
  timeAgo,
  mediaTitle,
  artworkColor = "#3D5A6C",
  rating,
  likeCount,
}: {
  name: string;
  action: string;
  timeAgo: string;
  mediaTitle: string;
  artworkColor?: string;
  rating?: number;
  likeCount?: number;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar name={name} size={34} />
        <View>
          <Text style={styles.headline}>
            <Text style={styles.bold}>{name}</Text> {action}
          </Text>
          <Text style={styles.time}>{timeAgo}</Text>
        </View>
      </View>
      <View style={styles.mediaRow}>
        <View style={[styles.artwork, { backgroundColor: artworkColor }]} />
        <View style={{ gap: 4 }}>
          <Text style={styles.mediaTitle}>{mediaTitle}</Text>
          {rating ? <Text style={styles.stars}>{"★".repeat(Math.round(rating))}</Text> : null}
        </View>
      </View>
      <View style={styles.footer}>
        <Reaction icon="♡" count={likeCount} />
        <Reaction icon="💬" count={0} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.md,
    padding: 14,
    gap: 10,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  headline: { fontSize: 13, color: theme.textPrimary },
  bold: { fontWeight: "700" },
  time: { fontSize: 11, color: theme.textTertiary },
  mediaRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  artwork: { width: 44, height: 64, borderRadius: radius.xs },
  mediaTitle: { fontSize: 14, fontWeight: "700", color: theme.textPrimary },
  stars: { color: theme.rating, fontSize: 12 },
  footer: {
    flexDirection: "row",
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
    paddingTop: 8,
  },
});
