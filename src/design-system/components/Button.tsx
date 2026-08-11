import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { radius, theme, type } from "../tokens";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, { bg: string; color: string; borderColor?: string }> = {
  primary: { bg: theme.brandPrimary, color: theme.textInverse },
  secondary: { bg: "transparent", color: theme.textPrimary, borderColor: theme.borderDefault },
  tertiary: { bg: theme.surfaceSecondary, color: theme.textPrimary },
  ghost: { bg: "transparent", color: theme.brandPrimary },
  destructive: { bg: "transparent", color: theme.stateError, borderColor: theme.stateError },
};

const sizes: Record<ButtonSize, { paddingVertical: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { paddingVertical: 8, paddingHorizontal: 14, fontSize: 14 },
  md: { paddingVertical: 14, paddingHorizontal: 20, fontSize: 15 },
  lg: { paddingVertical: 16, paddingHorizontal: 24, fontSize: 16 },
};

export function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  children,
  onPress,
  style,
  fullWidth,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  children: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}) {
  const v = variants[variant];
  const s = sizes[size];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.borderColor,
          borderWidth: v.borderColor ? 1 : 0,
          paddingVertical: s.paddingVertical,
          paddingHorizontal: s.paddingHorizontal,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
          width: fullWidth ? "100%" : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.color} size="small" />
      ) : (
        <Text style={[styles.label, { color: v.color, fontSize: s.fontSize }]}>{children}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: {
    fontFamily: type.title.fontFamily,
    fontWeight: "700",
  },
});
