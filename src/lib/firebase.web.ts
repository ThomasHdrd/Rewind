// Web Firebase init. `firebase/auth/react-native` doesn't exist on web, so
// this file (picked automatically by Metro for web builds via the .web.ts
// extension) uses plain getAuth() with browser persistence instead.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { FIREBASE_CONFIG } from "./firebaseConfig";

const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
