import React from "react";
import { Text, View } from "react-native";
import { theme } from "../tokens";
import { Avatar } from "./Avatar";

export function AvatarGroup({
  names = [],
  size = 36,
  max = 5,
}: {
  names?: string[];
  size?: number;
  max?: number;
}) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <View style={{ flexDirection: "row" }}>
      {shown.map((n, i) => (
        <View
          key={i}
          style={{
            marginLeft: i === 0 ? 0 : -size * 0.3,
            borderWidth: 2,
            borderColor: theme.bgPrimary,
            borderRadius: size / 2,
          }}
        >
          <Avatar name={n} size={size} />
        </View>
      ))}
      {rest > 0 ? (
        <View
          style={{
            marginLeft: -size * 0.3,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.surfaceSecondary,
            borderWidth: 2,
            borderColor: theme.bgPrimary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: theme.textSecondary, fontSize: size * 0.32, fontWeight: "700" }}>+{rest}</Text>
        </View>
      ) : null}
    </View>
  );
}
