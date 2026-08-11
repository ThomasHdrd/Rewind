import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, theme } from "../tokens";

export function StreakBadge({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.icon}>{icon}</View>
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
    alignItems: "center",
    flex: 1,
  },
  icon: { height: 22, alignItems: "center", justifyContent: "center" },
  value: { fontWeight: "800", fontSize: 20, color: theme.textPrimary, marginTop: 4 },
  label: { fontSize: 11, color: theme.textTertiary },
});
