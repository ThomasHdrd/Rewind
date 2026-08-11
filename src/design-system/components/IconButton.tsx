import React from "react";
import { Pressable, StyleProp, Text, ViewStyle } from "react-native";
import { theme } from "../tokens";

export function IconButton({
  icon,
  active = false,
  filled = false,
  size = 40,
  onPress,
  style,
}: {
  icon: string;
  active?: boolean;
  filled?: boolean;
  size?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = filled ? theme.brandPrimary : active ? theme.surfaceInteractive : theme.surfaceSecondary;
  const color = filled ? theme.textInverse : active ? theme.brandPrimary : theme.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          borderWidth: filled ? 0 : 1,
          borderColor: theme.borderDefault,
        },
        style,
      ]}
    >
      <Text
        style={{
          color,
          fontSize: size * 0.4,
          lineHeight: size * 0.4,
          textAlign: "center",
          marginTop: -1,
        }}
      >
        {icon}
      </Text>
    </Pressable>
  );
}
