import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../tokens";
import { ProgressBar } from "./ProgressBar";

export function GenreDistribution({ data = [] }: { data?: { label: string; percent: number }[] }) {
  return (
    <View style={{ gap: 12 }}>
      {data.map((d, i) => (
        <View key={i} style={{ gap: 4 }}>
          <View style={styles.row}>
            <Text style={styles.label}>{d.label}</Text>
            <Text style={styles.percent}>{d.percent}%</Text>
          </View>
          <ProgressBar percent={d.percent} height={6} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 13, color: theme.textPrimary, fontWeight: "600" },
  percent: { fontSize: 13, color: theme.textTertiary },
});
