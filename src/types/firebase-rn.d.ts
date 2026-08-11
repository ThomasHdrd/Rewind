// The installed firebase package's public TypeScript declarations
// (auth-public.d.ts) don't include getReactNativePersistence, even though
// the function genuinely exists at runtime: Metro resolves "firebase/auth"
// through @firebase/auth's "react-native" export condition on native
// platforms, which does export it (see node_modules/@firebase/auth/dist/rn).
// This is a known gap in firebase's package.json "exports" map (its "types"
// condition is unconditioned and always points at the generic build). This
// augmentation just tells TypeScript about the function that's actually
// there — see https://github.com/firebase/firebase-js-sdk/issues/6716.
import type { Persistence } from "firebase/auth";

declare module "firebase/auth" {
  export function getReactNativePersistence(storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
