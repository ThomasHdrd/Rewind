// Native (iOS/Android) Firebase init. Metro picks this file automatically
// for native platforms because of the .native.ts extension; src/lib/firebase.web.ts
// is picked for web. Both export the same shape so callers just do
// `import { auth, db } from "@/lib/firebase"`.
import { initializeApp, getApps, getApp } from "firebase/app";
// getReactNativePersistence genuinely exists at runtime here (Metro resolves
// "firebase/auth" through @firebase/auth's "react-native" export condition
// on native platforms) but isn't in firebase's public .d.ts — see
// src/types/firebase-rn.d.ts for the type augmentation that adds it back.
// Plain getAuth() doesn't persist sessions in React Native (no
// window.localStorage), hence initializeAuth + this persistence adapter.
import { initializeAuth, getReactNativePersistence, getAuth, type Auth } from "firebase/auth";
import "@/types/firebase-rn";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { FIREBASE_CONFIG } from "./firebaseConfig";

const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);

let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // initializeAuth throws if called more than once for the same app (e.g.
  // during Fast Refresh) — fall back to the already-initialized instance.
  auth = getAuth(app);
}

const db = getFirestore(app);

export { app, auth, db };
