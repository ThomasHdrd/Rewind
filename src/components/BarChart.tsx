import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/design-system";

// Single-series activity bars (one hue — the title names the series, so no
// legend). Tap a bar to read its exact value; the whole column is the hit
// target, not just the (possibly tiny) bar.
export function BarChart({
  buckets,
  height = 110,
  unit,
  labelEvery = 1,
  describe = (label) => label,
}: {
  buckets: { label: string; value: number }[];
  height?: number;
  /** e.g. "episodes & movies" — used in the readout. */
  unit: string;
  /** Show every Nth axis label (31 days would collide otherwise). */
  labelEvery?: number;
  /** Turns a bucket label into the readout's date text. */
  describe?: (label: string) => string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const peak = buckets.reduce((best, b, i) => (b.value > buckets[best].value ? i : best), 0);
  const shown = selected ?? peak;
  const total = buckets.reduce((s, b) => s + b.value, 0);

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.readout}>
        {total === 0
          ? "No activity in this period"
          : `${describe(buckets[shown].label)}: ${buckets[shown].value} ${unit}${selected === null ? " (busiest)" : ""}`}
      </Text>
      <View style={[styles.plot, { height }]}>
        {buckets.map((b, i) => (
          <Pressable
            key={b.label + i}
            style={styles.column}
            onPress={() => setSelected(selected === i ? null : i)}
            accessibilityLabel={`${describe(b.label)}: ${b.value} ${unit}`}
          >
            <View
              style={[
                styles.bar,
                {
                  height: b.value > 0 ? `${Math.max(4, (b.value / max) * 100)}%` : 2,
                  backgroundColor: b.value > 0 ? theme.brandPrimary : theme.surfaceInteractive,
                  opacity: selected === null || selected === i ? 1 : 0.45,
                },
              ]}
            />
          </Pressable>
        ))}
      </View>
      <View style={styles.axis}>
        {buckets.map((b, i) => (
          <Text key={b.label + i} style={styles.axisLabel} numberOfLines={1}>
            {i % labelEvery === 0 ? b.label : ""}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { color: theme.textSecondary, fontSize: 12 },
  plot: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  column: { flex: 1, height: "100%", justifyContent: "flex-end" },
  bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  axis: { flexDirection: "row", gap: 2 },
  axisLabel: { flex: 1, color: theme.textTertiary, fontSize: 9, textAlign: "center" },
});
