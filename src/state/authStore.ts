import { create } from "zustand";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  deleteUser,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { onlineManager } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { storage } from "@/lib/storage";
import { useToastStore } from "@/state/toastStore";
import { getGoogleIdToken, signOutGoogle } from "@/lib/googleSignIn";
import { deleteUserDoc, getUserDoc, isOnboarded, markOnboarded } from "@/data/repositories/firestoreUser";
import { deleteSocialData } from "@/data/repositories/social";
import { deleteAllCommentsBy } from "@/data/repositories/comments";

interface AuthState {
  isHydrating: boolean;
  /** True once Firebase has actually confirmed (or rejected) the session —
   * the UI may already be showing from the stored hint before that. */
  authConfirmed: boolean;
  isAuthenticated: boolean;
  hasOnboarded: boolean;
  userId: string | null;
  hydrate: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  /** Try sign-in first, auto-create the account on first use — same
   * convenience UX as the old prototype's email flow. */
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /** Exchanges a Google ID token (from @react-native-google-signin/google-signin's
   * GoogleSignin.signIn()) for a Firebase credential. */
  signInWithGoogleIdToken: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  /** How this account can confirm its identity for a sensitive action. */
  reauthMethod: () => "password" | "google" | "none";
  /** True when Firebase will demand a fresh sign-in before deleting. */
  needsReauth: () => boolean;
  /** Confirms identity in place (password, or Google account picker). */
  reauthenticate: (password?: string) => Promise<void>;
  /** Deletes the Firestore user doc, then the Firebase Auth account itself.
   * Throws auth/requires-recent-login if the session is too old. */
  deleteAccount: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

// "Onboarded" lives on the account (Firestore), so a returning user signing
// back in skips the preferences step while a brand-new account gets it.
// On a read failure, assume onboarded rather than trapping an existing user
// in onboarding (which would also overwrite their saved preferences).
async function accountState(user: User) {
  // Whatever was cached before this account signed in (queries that ran
  // while signed out return empty defaults — e.g. preferences with no
  // "tracks", which hid the games UI right after login) must not be reused.
  if (lastAccountUid !== user.uid) {
    queryClient.clear();
    lastAccountUid = user.uid;
  }
  const hasOnboarded = await isOnboarded(user.uid).catch(() => true);
  saveAuthHint(user.uid, hasOnboarded);
  return { isAuthenticated: true, userId: user.uid, hasOnboarded };
}

// Firebase only lets a recently signed-in session delete itself (~5 min).
const RECENT_LOGIN_MS = 5 * 60 * 1000;
let lastReauthAt = 0;
function isRecentLogin(user: User): boolean {
  if (Date.now() - lastReauthAt < RECENT_LOGIN_MS) return true;
  const lastSignIn = Date.parse(user.metadata.lastSignInTime ?? "");
  return isNaN(lastSignIn) || Date.now() - lastSignIn < RECENT_LOGIN_MS;
}
function providerOf(user: User | null): "password" | "google" | "none" {
  const ids = user?.providerData.map((p) => p.providerId) ?? [];
  if (ids.includes("google.com")) return "google";
  if (ids.includes("password")) return "password";
  return "none";
}

// Bumped whenever the user signs out or deletes their account. Async auth
// work that started before (e.g. the startup onboarding check) compares its
// captured value afterwards and drops its result if a sign-out happened in
// between — otherwise a late result flipped the app back to "signed in"
// right after "Delete account".
let authGeneration = 0;

// The account whose data the query cache currently holds.
let lastAccountUid: string | null = null;

// Cached queries belong to the previous account.
function resetLocalSession() {
  lastAccountUid = null;
  queryClient.clear();
  storage.removeItem(AUTH_HINT_KEY).catch(() => {});
}

// "Was signed in last time" hint, so a returning user's app paints at once
// (from the persisted query cache) instead of waiting ~1 s for Firebase to
// re-confirm the session over the network.
const AUTH_HINT_KEY = "rewind.authHint";
function saveAuthHint(uid: string, hasOnboarded: boolean) {
  storage.setItem(AUTH_HINT_KEY, JSON.stringify({ uid, hasOnboarded })).catch(() => {});
}

export const useAuthStore = create<AuthState>((set) => ({
  isHydrating: true,
  authConfirmed: false,
  isAuthenticated: false,
  hasOnboarded: false,
  userId: null,

  hydrate: async () => {
    // Firebase Auth's own persistence (getReactNativePersistence(AsyncStorage)
    // on native, browser persistence on web — see src/lib/firebase.native.ts /
    // src/lib/firebase.web.ts) restores the session; onAuthStateChanged fires
    // once with the restored user (or null) instead of us manually checking a
    // stored token.
    // Until Firebase confirms the session, no query may fetch: their
    // queryFns read auth.currentUser, which is still null, and would
    // overwrite the cached data with empty results. Paused queries keep
    // showing cached data and resume right after confirmation.
    onlineManager.setOnline(false);
    let hint: { uid: string; hasOnboarded: boolean } | null = null;
    try {
      hint = JSON.parse((await storage.getItem(AUTH_HINT_KEY)) ?? "null");
    } catch {}
    if (hint?.uid) {
      // The persisted cache is this account's: keep it (instant start).
      lastAccountUid = hint.uid;
      set({ isHydrating: false, isAuthenticated: true, hasOnboarded: hint.hasOnboarded, userId: hint.uid });
    }
    onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) {
        if (hint) resetLocalSession(); // session expired: drop the old account's cache
        set({ isHydrating: false, authConfirmed: true, isAuthenticated: false, hasOnboarded: false, userId: null });
        onlineManager.setOnline(true);
        return;
      }
      const generation = authGeneration;
      if (hint?.uid === user.uid) {
        // Already showing this account: unpause now, re-check onboarding after.
        set({ isHydrating: false, authConfirmed: true, isAuthenticated: true, userId: user.uid });
        onlineManager.setOnline(true);
        const state = await accountState(user);
        if (generation === authGeneration && auth.currentUser?.uid === user.uid) set(state);
        return;
      }
      if (hint) queryClient.clear(); // a different account than last time
      const state = await accountState(user);
      const stale = generation !== authGeneration || auth.currentUser?.uid !== user.uid;
      // A stale result must not sign the app back in, but startup must still
      // finish (un-hide the UI, un-pause queries).
      set({ isHydrating: false, authConfirmed: true, ...(stale ? {} : state) });
      onlineManager.setOnline(true);
    });
  },

  signInAsGuest: async () => {
    // Firebase Anonymous Auth: gives a real uid (so the Firestore-backed
    // repositories work exactly like a real account — profile/friends/lists
    // are no longer stuck empty) without asking for credentials. Firebase
    // can later "upgrade" this same uid to email/Google via account linking
    // if the guest decides to create a real account.
    const cred = await signInAnonymously(auth);
    set(await accountState(cred.user));
  },

  signInWithEmail: async (email: string, password: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      set(await accountState(cred.user));
    } catch (err: any) {
      // With Firebase's email-enumeration protection (on by default for
      // projects since 2023), an unknown email AND a wrong password both
      // come back as auth/invalid-credential — user-not-found never fires,
      // so the old "create on user-not-found" never created anyone. Try
      // creating the account instead; if the email already exists, the
      // password was simply wrong.
      if (err?.code !== "auth/invalid-credential" && err?.code !== "auth/user-not-found") throw err;
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        set(await accountState(cred.user));
      } catch (createErr: any) {
        if (createErr?.code === "auth/email-already-in-use") {
          throw Object.assign(new Error("wrong-password"), { code: "auth/wrong-password" });
        }
        throw createErr;
      }
    }
  },

  sendPasswordReset: async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  },

  signInWithGoogleIdToken: async (idToken: string) => {
    const credential = GoogleAuthProvider.credential(idToken);
    const cred = await signInWithCredential(auth, credential);
    set(await accountState(cred.user));
  },

  signOut: async () => {
    // Also forget the device's cached Google account so the next "Continue
    // with Google" lets the user pick an account again.
    authGeneration += 1;
    await auth.authStateReady();
    await signOutGoogle().catch(() => {});
    if (auth.currentUser) await firebaseSignOut(auth);
    resetLocalSession();
    set({ isAuthenticated: false, hasOnboarded: false, userId: null });
  },

  reauthMethod: () => providerOf(auth.currentUser),

  needsReauth: () => {
    const user = auth.currentUser;
    // Guest (anonymous) accounts have nothing to re-enter: just try.
    return !!user && providerOf(user) !== "none" && !isRecentLogin(user);
  },

  reauthenticate: async (password?: string) => {
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user) throw new Error("No signed-in user");
    const method = providerOf(user);
    if (method === "password") {
      if (!user.email || !password) throw Object.assign(new Error("missing-password"), { code: "auth/missing-password" });
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    } else if (method === "google") {
      // Same account picker as sign-in; picking a different account fails
      // with auth/user-mismatch.
      const idToken = await getGoogleIdToken();
      await reauthenticateWithCredential(user, GoogleAuthProvider.credential(idToken));
    }
    lastReauthAt = Date.now();
  },

  deleteAccount: async () => {
    // The UI can be up before Firebase finished restoring the session
    // (instant start); without this, auth.currentUser could still be null
    // and the delete silently did nothing.
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user) return;
    // Firebase only lets a recent session delete itself (~5 min). Check up
    // front so we never wipe the data and then fail on deleteUser(), leaving
    // a live account with nothing in it.
    if (providerOf(user) !== "none" && !isRecentLogin(user)) {
      throw Object.assign(new Error("requires-recent-login"), { code: "auth/requires-recent-login" });
    }
    // Instant for the user: the app returns to the welcome screen right away
    // (the recent-login check above is the only failure we can't recover
    // from silently), and the actual wiping finishes in the background.
    const cachedUsername = queryClient.getQueryData<{ username?: string }>(["profile"])?.username;
    authGeneration += 1;
    resetLocalSession();
    set({ isAuthenticated: false, hasOnboarded: false, userId: null });
    void (async () => {
      try {
        // Data first: once the auth user is gone, security rules no longer
        // let us touch nowatchUsers/{uid} or the user's comments. Rating
        // aggregates (mediaRatings) are anonymous sums and are left as-is.
        // Social/comment cleanup is best-effort and must not block deleting
        // the account. All independent, so in parallel.
        const username = cachedUsername ?? (await getUserDoc(user.uid).catch(() => null))?.profile.username;
        await Promise.all([
          deleteSocialData(user.uid, username).catch((e) => console.warn("Social cleanup failed", e)),
          deleteAllCommentsBy(user.uid).catch((e) => console.warn("Comment cleanup failed", e)),
          deleteUserDoc(user.uid),
        ]);
        await deleteUser(user);
      } catch (err) {
        console.warn("Account deletion failed", err);
        useToastStore.getState().show("Your account couldn't be fully deleted — sign in and try again");
      }
    })();
  },

  completeOnboarding: async () => {
    const uid = auth.currentUser?.uid;
    if (uid) {
      await markOnboarded(uid);
      saveAuthHint(uid, true);
    }
    set({ hasOnboarded: true });
  },
}));
