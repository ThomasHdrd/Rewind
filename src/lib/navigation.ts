import type { Router } from "expo-router";

/**
 * Back that always goes somewhere. router.back() alone does nothing when
 * there's no previous screen — a page opened from a link, after a reload,
 * or in the iPhone home-screen web app (no browser back button) — which
 * left users stuck on a screen. Falls back to Home.
 */
export function goBack(router: Pick<Router, "back" | "canGoBack" | "replace">) {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)");
}
