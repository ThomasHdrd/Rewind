import React from "react";
import { View } from "react-native";
import { theme } from "../tokens";

export function Chart({ values = [], height = 90 }: { values?: number[]; height?: number }) {
  const max = Math.max(...values, 1);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height }}>
      {values.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: `${(v / max) * 100}%`,
            borderRadius: 3,
            backgroundColor: i === values.length - 1 ? theme.brandPrimary : theme.surfaceInteractive,
          }}
        />
      ))}
    </View>
  );
}
