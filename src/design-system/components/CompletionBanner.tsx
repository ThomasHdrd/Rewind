import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, theme } from "../tokens";
import { Button } from "./Button";

export function CompletionBanner({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <Button onPress={onAction}>{actionLabel}</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.md,
    padding: 20,
    alignItems: "center",
    gap: 10,
  },
  title: { fontSize: 17, fontWeight: "700", color: theme.textPrimary },
  subtitle: { fontSize: 13, color: theme.textTertiary },
});
