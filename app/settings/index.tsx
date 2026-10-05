import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Input, Modal, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuthStore } from "@/state/authStore";
import { useToastStore } from "@/state/toastStore";

const ROWS = [
  { label: "Edit Profile", href: "/settings/edit-profile" },
  { label: "Preferences", href: "/settings/preferences" },
  { label: "Notifications", href: "/settings/notifications" },
  { label: "Privacy", href: "/settings/privacy" },
] as const;

export default function Settings() {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const needsReauth = useAuthStore((s) => s.needsReauth);
  const reauthMethod = useAuthStore((s) => s.reauthMethod);
  const reauthenticate = useAuthStore((s) => s.reauthenticate);
  // Old session: confirm identity right here (password / Google), then the
  // delete continues — instead of "log out, sign back in, try again".
  const [reauthStep, setReauthStep] = useState(false);
  const [password, setPassword] = useState("");
  const showToast = useToastStore((s) => s.show);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const logOut = async () => {
    await signOut();
    router.replace("/onboarding/welcome");
  };

  const closeDelete = () => {
    setConfirmDelete(false);
    setReauthStep(false);
    setPassword("");
  };

  const runDelete = async () => {
    await deleteAccount();
    closeDelete();
    router.replace("/onboarding/welcome");
  };

  const confirmDeleteAccount = async () => {
    if (needsReauth() && !reauthStep) {
      setReauthStep(true);
      return;
    }
    setDeleting(true);
    try {
      if (reauthStep) await reauthenticate(password);
      await runDelete();
    } catch (err: any) {
      const code = err?.code as string | undefined;
      showToast(
        code === "auth/wrong-password" || code === "auth/invalid-credential"
          ? "Wrong password — try again"
          : code === "auth/missing-password"
            ? "Enter your password to confirm"
            : code === "auth/user-mismatch"
              ? "That's a different Google account — pick the one you use for Rewind"
              : code === "auth/requires-recent-login"
                ? "Please confirm it's you to delete your account"
                : "Couldn't delete your account — try again"
      );
      if (code === "auth/requires-recent-login") setReauthStep(true);
    } finally {
      setDeleting(false);
    }
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
      <Pressable onPress={() => setConfirmDelete(true)}>
        <Text style={styles.delete}>Delete Account</Text>
        <Text style={styles.deleteSubtitle}>Permanently deletes your account and all your data.</Text>
      </Pressable>

      <Modal visible={confirmDelete} title="Delete account?" onClose={() => !deleting && closeDelete()}>
        <Text style={styles.modalBody}>
          This permanently deletes your account, library, ratings, lists and history. This can't be undone.
        </Text>
        {reauthStep ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.modalBody}>
              {reauthMethod() === "password"
                ? "For your security, enter your password to confirm."
                : "For your security, confirm with the Google account you use for Rewind."}
            </Text>
            {reauthMethod() === "password" ? (
              <Input
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                onSubmitEditing={confirmDeleteAccount}
              />
            ) : null}
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button variant="secondary" style={{ flex: 1 }} onPress={closeDelete} disabled={deleting}>
            Cancel
          </Button>
          <Button style={{ flex: 1 }} onPress={confirmDeleteAccount} loading={deleting}>
            {reauthStep && reauthMethod() === "google" ? "Confirm with Google" : reauthStep ? "Confirm & delete" : "Delete"}
          </Button>
        </View>
      </Modal>
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
  modalBody: { color: theme.textSecondary, fontSize: 13, lineHeight: 19 },
  deleteSubtitle: { color: theme.textTertiary, fontSize: 11, textAlign: "center", lineHeight: 16, marginTop: 4 },
});
