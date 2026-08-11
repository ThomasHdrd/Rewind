import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuthStore } from "@/state/authStore";

const ROWS = [
  { label: "Edit Profile", href: "/settings/edit-profile" },
  { label: "Notifications", href: "/settings" },
  { label: "Privacy", href: "/settings" },
] as const;

export default function Settings() {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);

  const logOut = async () => {
    await signOut();
    router.replace("/onboarding/welcome");
  };

  return (
    <Screen>
      <ScreenHeader title="Settings" />
      <View>
        {ROWS.map((r) => (
          <Pressable key={r.label} style={styles.row} onPress={() => router.push(r.href)}>
            <Text style={styles.rowLabel}>{r.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>
      <Button variant="secondary" fullWidth onPress={logOut}>
        Log Out
      </Button>
      <View>
        <Text style={styles.delete}>Delete Account</Text>
        <Text style={styles.deleteSubtitle}>Permanently deletes your account and all your data.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  rowLabel: { color: theme.textPrimary, fontSize: 14 },
  chevron: { color: theme.textTertiary },
  delete: { color: theme.stateError, fontSize: 13, fontWeight: "600", textAlign: "center" },
  deleteSubtitle: { color: theme.textTertiary, fontSize: 11, textAlign: "center", lineHeight: 16, marginTop: 4 },
});
