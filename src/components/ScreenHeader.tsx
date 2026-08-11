import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { theme } from "@/design-system";

export function ScreenHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <View style={styles.row}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.chevron}>‹</Text>
      </Pressable>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    alignItems: "center",
    justifyContent: "center",
  },
  chevron: { color: theme.textPrimary, fontSize: 16, lineHeight: 16, textAlign: "center", marginTop: -1 },
  title: { fontFamily: "ArchivoBlack_400Regular", color: theme.textPrimary, fontSize: 20 },
});
