import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { elevation, radius, theme } from "../tokens";

export function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <View style={[styles.wrap, elevation[2]]}>
      <Text style={styles.message}>{message}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {actionLabel ? (
          <Pressable onPress={onAction}>
            <Text style={styles.action}>{actionLabel}</Text>
          </Pressable>
        ) : null}
        {onDismiss ? (
          <Pressable onPress={onDismiss} hitSlop={8}>
            <Text style={styles.dismiss}>×</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    backgroundColor: theme.textInverse,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  message: { color: theme.textPrimary, fontSize: 14, flexShrink: 1 },
  action: { color: theme.brandPrimary, fontWeight: "700", fontSize: 13, textDecorationLine: "underline" },
  dismiss: { color: theme.textTertiary, fontWeight: "700", fontSize: 18, lineHeight: 18 },
});
