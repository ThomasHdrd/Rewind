import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../tokens";
import { Avatar } from "./Avatar";

export function UserRow({
  name,
  subtitle,
  action,
  avatarColor,
  avatarIcon,
  avatarImage,
}: {
  name: string;
  subtitle?: string;
  action?: React.ReactNode;
  avatarColor?: string;
  /** Emoji glyph (see avatarIconEmoji). */
  avatarIcon?: string;
  avatarImage?: string;
}) {
  return (
    <View style={styles.row}>
      <Avatar name={name} color={avatarColor} icon={avatarIcon} imageUrl={avatarImage} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{name}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  name: { fontSize: 14, fontWeight: "700", color: theme.textPrimary },
  subtitle: { fontSize: 12, color: theme.textTertiary },
});
