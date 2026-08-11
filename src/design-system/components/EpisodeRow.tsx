import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../tokens";

function formatAirDate(airDate?: string): string | null {
  if (!airDate) return null;
  const d = new Date(airDate);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// An episode with a real, parseable airDate strictly in the future hasn't
// aired yet — it can't have been watched, so the toggle is locked.
function isUnreleased(airDate?: string): boolean {
  if (!airDate) return false;
  const d = new Date(airDate);
  if (isNaN(d.getTime())) return false;
  return d.getTime() > Date.now();
}

export function EpisodeRow({
  number,
  title,
  runtime,
  rating,
  ratingCount,
  airDate,
  watched = false,
  isNext = false,
  onToggle,
}: {
  number: number;
  title: string;
  runtime: number;
  rating?: number;
  ratingCount?: number;
  airDate?: string;
  watched?: boolean;
  isNext?: boolean;
  onToggle?: () => void;
}) {
  const formattedAirDate = formatAirDate(airDate);
  const unreleased = isUnreleased(airDate);
  return (
    <View style={[styles.row, unreleased && styles.rowUnreleased]}>
      <Pressable
        onPress={unreleased ? undefined : onToggle}
        disabled={unreleased}
        style={[
          styles.toggle,
          {
            backgroundColor: watched ? "rgba(253,115,109,0.15)" : "transparent",
            borderColor: watched ? theme.brandPrimary : theme.borderDefault,
            opacity: unreleased ? 0.4 : 1,
          },
        ]}
      >
        {watched ? <Text style={styles.check}>✓</Text> : null}
      </Pressable>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>
          E{number} · {title} {isNext && !unreleased ? <Text style={styles.next}>NEXT</Text> : null}
        </Text>
        <Text style={styles.meta}>
          {unreleased ? `Not yet released · ${formattedAirDate}` : `${runtime} min${formattedAirDate ? ` · ${formattedAirDate}` : ""}`}
          {!unreleased && rating ? ` · ★ ${rating}/5${ratingCount ? ` (${ratingCount})` : ""}` : ""}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  rowUnreleased: { opacity: 0.55 },
  toggle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  check: { color: theme.brandPrimary, fontSize: 13 },
  title: { fontSize: 15, fontWeight: "700", color: theme.textPrimary },
  next: { color: theme.brandPrimary, fontSize: 11, fontWeight: "700" },
  meta: { fontSize: 12, color: theme.textTertiary },
  chevron: { color: theme.textTertiary },
});
