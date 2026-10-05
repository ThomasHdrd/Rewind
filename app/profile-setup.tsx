import React from "react";
import { StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { goBack } from "@/lib/navigation";
import { theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ProfileSetupForm } from "@/components/ProfileSetupForm";
import { useProfile } from "@/hooks/useMedia";

// For accounts created before usernames existed: same identity form as
// onboarding's step 1, reached from Friends ("Choose a username").
export default function ProfileSetup() {
  const router = useRouter();
  const { data: profile, isLoading } = useProfile();
  if (isLoading) return null;
  return (
    <Screen>
      <ScreenHeader title="Your profile" />
      <Text style={styles.subtitle}>Pick a username so friends can find and add you.</Text>
      <ProfileSetupForm initial={profile} submitLabel="Save" onDone={() => goBack(router)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { color: theme.textTertiary, fontSize: 13 },
});
