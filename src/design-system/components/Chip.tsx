import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { radius, theme, type } from "../tokens";

export function Chip({
  label,
  selected = false,
  disabled = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: radius.full,
        backgroundColor: selected ? theme.brandPrimary : theme.surfaceSecondary,
        borderWidth: selected ? 0 : 1,
        borderColor: theme.borderDefault,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text
        style={[
          styles.label,
          { color: selected ? theme.textInverse : theme.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: type.body.fontFamily,
    fontWeight: "600",
    fontSize: 14,
  },
});
