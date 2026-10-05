import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { ProfileSetupForm } from "@/components/ProfileSetupForm";

// Sign-up step 1 of 2 (before genres/platforms): who you are to your friends.
export default function OnboardingProfile() {
  const router = useRouter();
  return (
    <Screen>
      <View>
        <Text style={styles.title}>Set up your profile</Text>
        <Text style={styles.subtitle}>Step 1 of 2 · your friends find you by your username</Text>
      </View>
      <ProfileSetupForm submitLabel="Continue" onDone={() => router.push("/onboarding/preferences")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: theme.textPrimary, fontSize: 20, fontWeight: "700" },
  subtitle: { color: theme.textTertiary, fontSize: 12, marginTop: 4 },
});
