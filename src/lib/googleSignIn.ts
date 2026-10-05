// Native Google Sign-In via @react-native-google-signin/google-signin.
//
// NOT USABLE UNTIL:
//   1. This app is built as a custom Expo dev client (`npx expo run:android`
//      or an EAS dev build) — the package needs native code, so it will not
//      work inside plain Expo Go.
//   2. EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env is set to a real Web client
//      ID from Google Cloud Console for the `nowatch-2e458` Firebase
//      project, and an Android OAuth client ID has been generated there too
//      (tied to this app's package name + release/debug SHA-1).
// Until then, getGoogleIdToken() throws a clear error instead of silently
// failing.
import { Platform } from "react-native";

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

function isConfigured() {
  return Boolean(WEB_CLIENT_ID && !WEB_CLIENT_ID.includes("REPLACE_ME"));
}

let configured = false;

async function ensureConfigured() {
  if (configured) return;
  if (!isConfigured()) {
    throw new Error(
      "Google Sign-In needs EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID set in .env (Web client ID from Google Cloud Console for the nowatch-2e458 Firebase project)."
    );
  }
  if (Platform.OS === "web") {
    throw new Error("Native Google Sign-In isn't available on web — use Firebase's web Google provider there instead.");
  }
  const { GoogleSignin } = await import("@react-native-google-signin/google-signin");
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  configured = true;
}

/** Forgets the Google account the native SDK cached, so the next sign-in
 * shows the account chooser instead of silently reusing the last account. */
export async function signOutGoogle(): Promise<void> {
  if (Platform.OS === "web" || !isConfigured()) return;
  // configure() first: after an app restart `configured` is false again
  // but the SDK still remembers the last account.
  await ensureConfigured();
  const { GoogleSignin } = await import("@react-native-google-signin/google-signin");
  await GoogleSignin.signOut();
}

/** Runs the native Google account picker and returns a Google ID token,
 * ready to hand to Firebase's GoogleAuthProvider.credential(). */
export async function getGoogleIdToken(): Promise<string> {
  await ensureConfigured();
  const { GoogleSignin } = await import("@react-native-google-signin/google-signin");
  await GoogleSignin.hasPlayServices();
  // Always show the account chooser: without this the SDK silently reuses
  // the last-used Google account (no picker at all), so there was no way to
  // sign in with a different one.
  if (GoogleSignin.hasPreviousSignIn()) await GoogleSignin.signOut().catch(() => null);
  const result = await GoogleSignin.signIn();
  const idToken = (result as any)?.data?.idToken ?? (result as any)?.idToken;
  if (!idToken) throw new Error("Google Sign-In did not return an ID token.");
  return idToken;
}
