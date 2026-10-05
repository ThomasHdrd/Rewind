import React from "react";
import { Tabs } from "expo-router";
import { useSocialRealtime } from "@/hooks/useMedia";

// The 5-tab bottom bar is now rendered once, globally, in app/_layout.tsx so
// it persists across every screen in the app (not just these 5 tab
// screens). Expo Router's Tabs navigator still owns routing/state for these
// screens, but its own native tab bar is hidden here to avoid a double
// bottom bar — the global <BottomNav> in app/_layout.tsx is the single
// source of truth for tab UI everywhere, including these screens.
export default function TabsLayout() {
  // Live friend requests / friendships for the whole signed-in session (an
  // accepted request clears from "Sent requests" without a refresh).
  useSocialRealtime();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }} tabBar={() => null}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="upcoming" />
      <Tabs.Screen name="friends" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
