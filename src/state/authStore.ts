import { create } from "zustand";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { storage } from "@/lib/storage";

const ONBOARDED_KEY = "rewind.onboarded";

interface AuthState {
  isHydrating: boolean;
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
  completeOnboarding: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isHydrating: true,
  isAuthenticated: false,
  hasOnboarded: false,
  userId: null,

  hydrate: async () => {
    const onboarded = await storage.getItem(ONBOARDED_KEY);
    set({ hasOnboarded: onboarded === "1" });
    // Firebase Auth's own persistence (getReactNativePersistence(AsyncStorage)
    // on native, browser persistence on web — see src/lib/firebase.native.ts /
    // src/lib/firebase.web.ts) restores the session; onAuthStateChanged fires
    // once with the restored user (or null) instead of us manually checking a
    // stored token.
    onAuthStateChanged(auth, (user: User | null) => {
      set({
        isHydrating: false,
        isAuthenticated: !!user,
        userId: user?.uid ?? null,
      });
    });
  },

  signInAsGuest: async () => {
    // Firebase Anonymous Auth: gives a real uid (so the Firestore-backed
    // repositories work exactly like a real account — profile/friends/lists
    // are no longer stuck empty) without asking for credentials. Firebase
    // can later "upgrade" this same uid to email/Google via account linking
    // if the guest decides to create a real account.
    const cred = await signInAnonymously(auth);
    set({ isAuthenticated: true, userId: cred.user.uid });
  },

  signInWithEmail: async (email: string, password: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      set({ isAuthenticated: true, userId: cred.user.uid });
    } catch (err: any) {
      if (err?.code === "auth/user-not-found") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        set({ isAuthenticated: true, userId: cred.user.uid });
      } else {
        throw err;
      }
    }
  },

  signInWithGoogleIdToken: async (idToken: string) => {
    const credential = GoogleAuthProvider.credential(idToken);
    const cred = await signInWithCredential(auth, credential);
    set({ isAuthenticated: true, userId: cred.user.uid });
  },

  signOut: async () => {
    if (auth.currentUser) await firebaseSignOut(auth);
    set({ isAuthenticated: false, userId: null });
  },

  completeOnboarding: async () => {
    await storage.setItem(ONBOARDED_KEY, "1");
    set({ hasOnboarded: true });
  },
}));
