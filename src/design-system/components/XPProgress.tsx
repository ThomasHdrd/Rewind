import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, theme } from "../tokens";
import { ProgressBar } from "./ProgressBar";

export function XPProgress({
  level,
  levelName,
  xp,
  xpToNext,
}: {
  level: number;
  levelName: string;
  xp: number;
  xpToNext: number;
}) {
  const pct = Math.min(100, (xp / (xp + xpToNext)) * 100);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.level}>Level {level}</Text>
          <Text style={styles.levelName}>{levelName}</Text>
        </View>
        <View style={styles.plus}>
          <Text style={{ color: theme.textInverse, fontWeight: "800" }}>+</Text>
        </View>
      </View>
      <ProgressBar percent={pct} />
      <Text style={styles.footer}>
        {xp} XP · {xpToNext} XP to next level
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.md,
    padding: 16,
    gap: 10,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  level: { fontSize: 11, color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 0.5 },
  levelName: { fontSize: 17, fontWeight: "700", color: theme.textPrimary },
  plus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: { fontSize: 12, color: theme.textTertiary },
});
