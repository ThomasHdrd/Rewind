import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, theme } from "@/design-system";

export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Text style={styles.mark}>!</Text>
      </View>
      <Text style={styles.title}>Can't connect</Text>
      <Text style={styles.subtitle}>Check your connection and try again.</Text>
      <Button variant="secondary" size="sm" onPress={onRetry} style={{ marginTop: 8 }}>
        Retry
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 8, paddingVertical: 64, paddingHorizontal: 24 },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: theme.textSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  mark: { color: theme.textSecondary, fontSize: 22 },
  title: { color: theme.textPrimary, fontSize: 16, fontWeight: "700" },
  subtitle: { color: theme.textTertiary, fontSize: 13, textAlign: "center", lineHeight: 19 },
});
