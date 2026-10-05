// Web Google Sign-In (picked automatically by Metro for web builds via the
// .web.ts extension). The native @react-native-google-signin package doesn't
// exist on web, so this uses Firebase's own Google popup instead and hands
// back the Google ID token — same contract as ./googleSignIn.ts, so the
// caller's signInWithGoogleIdToken() path is identical on every platform.
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";

export async function getGoogleIdToken(): Promise<string> {
  const provider = new GoogleAuthProvider();
  // Always show the account chooser, even if the browser has one Google
  // session — otherwise signing out then back in silently reuses it.
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth, provider);
  const idToken = GoogleAuthProvider.credentialFromResult(result)?.idToken;
  if (!idToken) throw new Error("Google Sign-In did not return an ID token.");
  return idToken;
}

/** Web has no cached SDK account to forget (the popup always prompts). */
export async function signOutGoogle(): Promise<void> {}
