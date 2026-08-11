import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../tokens";
import { Button } from "./Button";

export function EmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
  variant = "default",
  icon,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "default" | "square";
  icon?: React.ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.badge,
          { borderRadius: variant === "square" ? 12 : 28 },
        ]}
      >
        {icon}
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel ? (
        <Button size="sm" onPress={onAction} style={{ marginTop: 8 }}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
  badge: {
    width: 56,
    height: 56,
    borderWidth: 2,
    borderColor: theme.borderDefault,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 17, fontWeight: "700", color: theme.textPrimary, textAlign: "center" },
  subtitle: { fontSize: 13, color: theme.textTertiary, textAlign: "center", maxWidth: 240 },
});
