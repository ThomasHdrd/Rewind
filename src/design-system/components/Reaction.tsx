import React from "react";
import { Pressable, Text } from "react-native";
import { theme } from "../tokens";

export function Reaction({
  icon = "♡",
  count,
  active = false,
  onPress,
}: {
  icon?: string;
  count?: number;
  active?: boolean;
  onPress?: () => void;
}) {
  const color = active ? theme.brandPrimary : theme.textTertiary;
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Text style={{ color, fontSize: 13 }}>{icon}</Text>
      {count != null ? <Text style={{ color, fontSize: 13 }}>{count}</Text> : null}
    </Pressable>
  );
}
