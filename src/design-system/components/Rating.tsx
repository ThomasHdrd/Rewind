import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { theme } from "../tokens";

function Star({ filled }: { filled: boolean }) {
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill={filled ? theme.rating : "none"}
    >
      <Path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z"
        stroke={theme.rating}
        strokeWidth={1.5}
      />
    </Svg>
  );
}

export function Rating({
  mode = "community",
  value = 0,
  max = 5,
  count,
  footnote,
  emptyLabel = "No ratings yet",
  interactive = false,
  onChange,
}: {
  mode?: "community" | "user";
  value?: number;
  max?: number;
  count?: number;
  /** Extra line under the community score (e.g. Rewind members' average). */
  footnote?: string;
  /** Shown instead of a score when nobody has rated yet. */
  emptyLabel?: string;
  interactive?: boolean;
  onChange?: (v: number) => void;
}) {
  if (mode === "community") {
    return (
      <View style={{ gap: 6 }}>
        <Text style={styles.label}>Community</Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {Array.from({ length: max }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 22,
                height: 6,
                borderRadius: 3,
                backgroundColor:
                  i < Math.round(value) ? theme.rating : theme.ratingTrack,
              }}
            />
          ))}
        </View>
        <Text style={styles.value}>
          {value ? `${value.toFixed(1)}/${max}` : emptyLabel}{" "}
          {count ? (
            <Text style={styles.count}>
              · {count.toLocaleString("en-US")} votes
            </Text>
          ) : null}
        </Text>
        {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
      </View>
    );
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>Your Rating</Text>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {Array.from({ length: max }).map((_, i) => (
          // Tapping the star that's already your rating removes it (0).
          <Pressable
            key={i}
            disabled={!interactive}
            onPress={() => onChange?.(value === i + 1 ? 0 : i + 1)}
          >
            <Star filled={i < value} />
          </Pressable>
        ))}
      </View>
      <Text
        style={[
          styles.value,
          { color: value ? theme.textPrimary : theme.brandPrimary },
        ]}
      >
        {value ? `${value}/${max}` : "Tap to rate"}
        {value && interactive ? (
          <Text style={styles.removeHint}> · tap again to remove</Text>
        ) : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.7,
    color: theme.textTertiary,
    textTransform: "uppercase",
  },
  value: { fontSize: 14, fontWeight: "700", color: theme.textPrimary },
  count: { color: theme.textTertiary, fontWeight: "400" },
  footnote: { color: theme.textTertiary, fontSize: 11 },
  removeHint: { color: theme.textTertiary, fontSize: 10, fontWeight: "400" },
});
