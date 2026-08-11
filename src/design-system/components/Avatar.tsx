import React from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { theme } from "../tokens";

const palette = ["#E2574C", "#C9932F", "#2DD9A6", "#9B6BD9", "#4EA1F5"];

export function Avatar({
  name = "",
  size = 40,
  color,
  icon,
  imageUrl,
}: {
  name?: string;
  size?: number;
  color?: string;
  /** Emoji glyph (e.g. from avatarIconEmoji()) shown instead of initials. */
  icon?: string;
  /** When present, renders a real photo instead of the initials/icon fallback. */
  imageUrl?: string;
}) {
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.surfaceSecondary }}
        contentFit="cover"
      />
    );
  }
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const bg = color || palette[name.length % palette.length];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icon ? (
        <Text style={{ fontSize: size * 0.5 }}>{icon}</Text>
      ) : (
        <Text style={{ color: theme.textInverse, fontWeight: "700", fontSize: size * 0.4 }}>{initial}</Text>
      )}
    </View>
  );
}
