import React from "react";
import { View } from "react-native";
import { radius, theme } from "../tokens";

export function ProgressBar({
  percent = 0,
  height = 6,
  color = theme.brandPrimary,
  track = theme.ratingTrack,
}: {
  percent?: number;
  height?: number;
  color?: string;
  track?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <View style={{ width: "100%", height, borderRadius: radius.full, backgroundColor: track, overflow: "hidden" }}>
      <View style={{ width: `${clamped}%`, height: "100%", backgroundColor: color, borderRadius: radius.full }} />
    </View>
  );
}
