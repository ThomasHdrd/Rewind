import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../tokens";
import { Avatar } from "./Avatar";

export function Comment({ name, text }: { name: string; text: string }) {
  return (
    <View style={styles.row}>
      <Avatar name={name} size={32} />
      <View style={{ gap: 2, flexShrink: 1 }}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, paddingVertical: 10 },
  name: { fontSize: 13, fontWeight: "700", color: theme.textPrimary },
  text: { fontSize: 13, color: theme.textSecondary },
});
