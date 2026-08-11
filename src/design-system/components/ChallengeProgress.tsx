import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, theme } from "../tokens";
import { ProgressBar } from "./ProgressBar";

export function ChallengeProgress({
  icon,
  label,
  current,
  total,
  xpReward,
}: {
  icon?: React.ReactNode;
  label: string;
  current: number;
  total: number;
  xpReward: number;
}) {
  const pct = total ? (current / total) * 100 : 0;
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>{icon}</View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.headerRow}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.reward}>+{xpReward} XP</Text>
        </View>
        <ProgressBar percent={pct} height={5} />
        <Text style={styles.count}>
          {current}/{total}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: theme.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between" },
  label: { color: theme.textPrimary, fontWeight: "600", fontSize: 13 },
  reward: { color: theme.brandPrimary, fontWeight: "700", fontSize: 13 },
  count: { fontSize: 11, color: theme.textTertiary },
});
