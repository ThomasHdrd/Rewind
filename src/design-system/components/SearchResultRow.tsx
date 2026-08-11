import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../tokens";

export function SearchResultRow({
  title,
  meta,
  logged = false,
  onToggle,
}: {
  title: string;
  meta?: string;
  logged?: boolean;
  onToggle?: () => void;
}) {
  return (
    <View style={styles.row}>
      <View>
        <Text style={styles.title}>{title}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      <Pressable
        onPress={onToggle}
        style={[styles.toggle, { backgroundColor: logged ? theme.brandPrimary : theme.surfaceSecondary }]}
      >
        <Text style={{ color: logged ? theme.textInverse : theme.textTertiary }}>{logged ? "✓" : "+"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  title: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
  meta: { fontSize: 12, color: theme.textTertiary },
  toggle: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
});
