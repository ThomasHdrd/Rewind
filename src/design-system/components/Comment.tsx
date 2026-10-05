import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../tokens";
import { Avatar } from "./Avatar";

/** `onDelete` is only passed for the viewer's own comments — that's what
 * shows the Delete action. */
export function Comment({ name, text, meta, onDelete }: { name: string; text: string; meta?: string; onDelete?: () => void }) {
  return (
    <View style={styles.row}>
      <Avatar name={name} size={32} />
      <View style={{ gap: 2, flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.name}>{name}</Text>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </View>
        <Text style={styles.text}>{text}</Text>
      </View>
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={10} style={styles.deleteBtn}>
          <Text style={styles.delete}>Delete</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, paddingVertical: 10 },
  header: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  name: { fontSize: 13, fontWeight: "700", color: theme.textPrimary },
  meta: { fontSize: 11, color: theme.textTertiary },
  text: { fontSize: 13, color: theme.textSecondary },
  deleteBtn: { alignSelf: "flex-start", paddingTop: 2 },
  delete: { fontSize: 12, fontWeight: "600", color: theme.stateError },
});
