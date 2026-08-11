import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { theme } from "../tokens";

// Placeholder artwork block standing in for poster/backdrop imagery until
// real media assets are wired up through the media repository / CDN.
export function Artwork({
  color = theme.surfaceSecondary,
  style,
  radius = 0,
}: {
  color?: string;
  style?: StyleProp<ViewStyle>;
  radius?: number;
}) {
  return <View style={[{ backgroundColor: color, borderRadius: radius, overflow: "hidden" }, style]} />;
}
