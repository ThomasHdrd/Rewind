import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../tokens";

export function UpNextRow({
  title,
  meta,
  actionLabel = "VIEW",
  onAction,
}: {
  title: string;
  meta: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ gap: 2 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>
      <Pressable onPress={onAction}>
        <Text style={styles.action}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  title: { fontSize: 15, fontWeight: "700", color: theme.textPrimary },
  meta: { fontSize: 12, color: theme.textTertiary },
  action: { color: theme.brandPrimary, fontWeight: "700", fontSize: 13, letterSpacing: 0.3 },
});
