import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, theme } from "../tokens";

export function StatisticCard({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
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
    gap: 4,
    minWidth: 90,
  },
  value: { fontWeight: "800", fontSize: 22, color: theme.textPrimary },
  label: { fontSize: 11, color: theme.textTertiary, textTransform: "uppercase", letterSpacing: 0.4 },
});
