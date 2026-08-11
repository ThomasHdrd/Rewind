import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NavIcon, NavIconName } from "../icons";
import { theme } from "../tokens";

export const NAV_TABS: { key: NavIconName; label: string; root: string }[] = [
  { key: "home", label: "Home", root: "/(tabs)" },
  { key: "discover", label: "Discover", root: "/discover" },
  { key: "upcoming", label: "Upcoming", root: "/upcoming" },
  { key: "friends", label: "Friends", root: "/friends" },
  { key: "profile", label: "Profile", root: "/profile" },
];

// Generic, standalone bottom nav — takes the active tab key and a press
// handler so it can be driven either by Expo Router's Tabs navigator
// (app/(tabs)/_layout.tsx, now disabled — see app/_layout.tsx) or, as of the
// "persistent nav everywhere" change, by a single global instance in
// app/_layout.tsx that stays mounted across every route in the app.
export function BottomNav({
  activeKey,
  onPress,
}: {
  activeKey: NavIconName;
  onPress: (key: NavIconName) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: 10 + insets.bottom }]}>
      {NAV_TABS.map((tab) => {
        const focused = tab.key === activeKey;
        const color = focused ? theme.brandPrimary : theme.textTertiary;
        return (
          <Pressable key={tab.key} onPress={() => onPress(tab.key)} style={styles.item}>
            <NavIcon name={tab.key} active={focused} color={color} />
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: theme.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  item: { flex: 1, alignItems: "center", gap: 4 },
  label: { fontSize: 11, fontWeight: "600" },
});
