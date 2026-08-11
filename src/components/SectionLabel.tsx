import React from "react";
import { StyleSheet, Text } from "react-native";
import { theme } from "@/design-system";

// `large` is an opt-in size bump for screens that want slightly bigger
// section headers (e.g. Profile) without affecting every other screen that
// already uses this shared label at its default size.
export function SectionLabel({ children, large = false }: { children: React.ReactNode; large?: boolean }) {
  return <Text style={[styles.label, large && styles.labelLarge]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    color: theme.brandPrimary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  labelLarge: {
    fontSize: 12,
  },
});
