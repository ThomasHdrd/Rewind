import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Input, color, radius, theme } from "@/design-system";
import { Artwork } from "@/design-system/components/Artwork";
import { Screen } from "@/components/Screen";
import { useAuthStore } from "@/state/authStore";
import { useToastStore } from "@/state/toastStore";

export default function Welcome() {
  const router = useRouter();
  const signInAsGuest = useAuthStore((s) => s.signInAsGuest);
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail);
  const signInWithGoogleIdToken = useAuthStore((s) => s.signInWithGoogleIdToken);
  const showToast = useToastStore((s) => s.show);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const proceed = () => router.push("/onboarding/preferences");

  const continueAsGuest = async () => {
    await signInAsGuest();
    proceed();
  };

  const submitEmail = async () => {
    if (!email.trim() || password.length < 6) {
      showToast("Enter a valid email and a password with at least 6 characters");
      return;
    }
    setSubmitting(true);
    try {
      await signInWithEmail(email.trim(), password);
      proceed();
    } catch (err: any) {
      showToast(err?.message ?? "Couldn't sign in — check your details and try again");
    } finally {
      setSubmitting(false);
    }
  };

  const continueWithGoogle = async () => {
    // Requires a custom dev client (not Expo Go) plus GoogleSignin.configure()
    // with a real webClientId — see @/lib/googleSignIn.ts. Until those are
    // set up this surfaces a clear message instead of silently failing.
    try {
      const { getGoogleIdToken } = await import("@/lib/googleSignIn");
      const idToken = await getGoogleIdToken();
      await signInWithGoogleIdToken(idToken);
      proceed();
    } catch (err: any) {
      showToast(err?.message ?? "Google Sign-In isn't set up yet");
    }
  };

  // Facebook/Apple sign-in from the old prototype were not requested here —
  // Apple's button below is left as a visible-but-not-implemented affordance
  // (matches the rest of onboarding's visual design); Facebook is omitted
  // entirely.
  const continueWithApple = () => showToast("Apple sign-in isn't implemented yet");

  return (
    <Screen edges={["top", "bottom"]}>
      <Artwork color={theme.surfaceSecondary} radius={radius.lg} style={styles.hero} />
      <View style={{ gap: 10 }}>
        <Text style={styles.headline}>Everything you watch, in one place.</Text>
        <Text style={styles.body}>
          Movies, series, anime, docs — tracked across every platform. Rewind isn't where you stream. It's where you
          keep score.
        </Text>
      </View>
      <View style={styles.dots}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
      <View style={{ gap: 10 }}>
        <Button variant="secondary" fullWidth onPress={continueWithGoogle}>
          Continue with Google
        </Button>
        <Button variant="secondary" fullWidth onPress={continueWithApple}>
          Continue with Apple
        </Button>

        {showEmailForm ? (
          <View style={{ gap: 8 }}>
            <Input placeholder="Email" value={email} onChangeText={setEmail} />
            <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
            <Button fullWidth onPress={submitEmail} disabled={submitting}>
              {submitting ? "Signing in..." : "Continue"}
            </Button>
          </View>
        ) : (
          <Button fullWidth onPress={() => setShowEmailForm(true)}>
            Continue with email
          </Button>
        )}

        <Text style={styles.skip} onPress={continueAsGuest}>
          Continue without an account
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { height: 360, marginHorizontal: -20, marginTop: -20 },
  headline: { fontFamily: "ArchivoBlack_400Regular", color: theme.textPrimary, fontSize: 24, lineHeight: 30 },
  body: { color: theme.textSecondary, fontSize: 14, lineHeight: 21 },
  dots: { flexDirection: "row", gap: 6, justifyContent: "center" },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: color.ink600 },
  dotActive: { width: 16, backgroundColor: theme.brandPrimary },
  skip: { textAlign: "center", color: theme.textTertiary, fontSize: 12, paddingTop: 4 },
});
