import React from "react";
import { Modal as RNModal, Pressable, StyleSheet, Text, View } from "react-native";
import { radius, theme } from "../tokens";

export function Modal({
  visible,
  title,
  children,
  onClose,
}: {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(4,7,12,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: theme.surfaceElevated,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.lg,
    padding: 24,
    width: 320,
    gap: 14,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 17, fontWeight: "700", color: theme.textPrimary },
  close: { color: theme.textTertiary, fontSize: 20 },
});
