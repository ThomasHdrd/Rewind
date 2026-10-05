import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Input, color, radius, theme } from "@/design-system";
import { Artwork } from "@/design-system/components/Artwork";
import { Screen } from "@/components/Screen";
import { useAuthStore } from "@/state/authStore";
import { useToastStore } from "@/state/toastStore";
import { getGoogleIdToken } from "@/lib/googleSignIn";

export default function Welcome() {
  const router = useRouter();
  const signInAsGuest = useAuthStore((s) => s.signInAsGuest);
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail);
  const signInWithGoogleIdToken = useAuthStore((s) => s.signInWithGoogleIdToken);
  const sendPasswordReset = useAuthStore((s) => s.sendPasswordReset);
  const showToast = useToastStore((s) => s.show);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Brand-new accounts continue to profile setup, then preferences; returning ones
  // (onboarded flag on their account, set by the sign-in call) go straight in.
  const proceed = () => {
    if (useAuthStore.getState().hasOnboarded) router.replace("/(tabs)");
    else router.push("/onboarding/profile");
  };

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
      showToast(emailErrorMessage(err?.code));
    } finally {
      setSubmitting(false);
    }
  };

  const continueWithGoogle = async () => {
    // Native: requires a custom dev client (not Expo Go) plus a real
    // webClientId — see @/lib/googleSignIn.ts. Web: Firebase popup — see
    // @/lib/googleSignIn.web.ts. Statically imported: Metro's lazy web bundle
    // for a dynamic import() 404s on Windows (backslash in the module path).
    try {
      const idToken = await getGoogleIdToken();
      await signInWithGoogleIdToken(idToken);
      proceed();
    } catch (err: any) {
      showToast(err?.message ?? "Google Sign-In isn't set up yet");
    }
  };

  const forgotPassword = async () => {
    if (!email.trim()) {
      showToast("Enter your email first, then tap “Forgot password?”");
      return;
    }
    try {
      await sendPasswordReset(email.trim());
      showToast("If an account exists for this email, a reset link is on its way");
    } catch (err: any) {
      showToast(emailErrorMessage(err?.code));
    }
  };

  // Apple sign-in isn't offered yet: it needs a paid Apple Developer account
  // and only makes sense once there's an iOS build (Android/web would need
  // Apple's web flow). The button used to show and just toast "not
  // implemented", so it's hidden until it's real.

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

        {showEmailForm ? (
          <View style={{ gap: 8 }}>
            <Input placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
            <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
            <Text style={styles.emailHint}>New here? The same form creates your account.</Text>
            <Button fullWidth onPress={submitEmail} disabled={submitting}>
              {submitting ? "Signing in..." : "Continue"}
            </Button>
            <Text style={styles.forgot} onPress={forgotPassword}>
              Forgot password?
            </Text>
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
  emailHint: { color: theme.textTertiary, fontSize: 12, paddingHorizontal: 4 },
  forgot: { textAlign: "center", color: theme.brandPrimary, fontSize: 12, fontWeight: "700", paddingVertical: 4 },
  skip: { textAlign: "center", color: theme.textTertiary, fontSize: 12, paddingTop: 4 },
});

// Firebase auth codes → what the user can actually do about it.
function emailErrorMessage(code?: string): string {
  switch (code) {
    case "auth/wrong-password":
      return "Wrong password for this email — try again or tap “Forgot password?”";
    case "auth/invalid-email":
      return "That email address doesn't look right";
    case "auth/weak-password":
      return "Choose a password with at least 6 characters";
    case "auth/too-many-requests":
      return "Too many attempts — wait a minute and try again";
    case "auth/network-request-failed":
      return "No connection — check your internet and try again";
    case "auth/operation-not-allowed":
      return "Email sign-in is turned off for this app";
    default:
      return "Couldn't sign in — check your details and try again";
  }
}
