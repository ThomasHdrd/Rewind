import React from "react";
import { Ionicons } from "@expo/vector-icons";

export type NavIconName = "home" | "discover" | "upcoming" | "friends" | "profile";

// Outline icons matching each tab's meaning, switched from hand-drawn SVG
// paths to @expo/vector-icons (Ionicons) — active uses the filled variant,
// inactive the outline variant, giving a clear active/inactive distinction
// beyond just color (a common pattern in the reference nav-bar style).
const navIconNames: Record<NavIconName, { outline: keyof typeof Ionicons.glyphMap; filled: keyof typeof Ionicons.glyphMap }> = {
  home: { outline: "home-outline", filled: "home" },
  discover: { outline: "compass-outline", filled: "compass" },
  upcoming: { outline: "calendar-outline", filled: "calendar" },
  friends: { outline: "people-outline", filled: "people" },
  profile: { outline: "person-outline", filled: "person" },
};

export const AVATAR_ICONS = [
  { key: "person", emoji: "👤" },
  { key: "ghost", emoji: "👻" },
  { key: "cat", emoji: "🐱" },
  { key: "flame", emoji: "🔥" },
  { key: "star", emoji: "⭐" },
  { key: "moon", emoji: "🌙" },
  { key: "sun", emoji: "☀️" },
  { key: "heart", emoji: "❤️" },
  { key: "tag", emoji: "🏷️" },
  { key: "trash", emoji: "🗑️" },
  { key: "clapper", emoji: "🎬" },
  { key: "tv", emoji: "📺" },
] as const;

export type AvatarIconKey = (typeof AVATAR_ICONS)[number]["key"];

export function avatarIconEmoji(key?: string | null): string | undefined {
  return AVATAR_ICONS.find((i) => i.key === key)?.emoji;
}

export function NavIcon({
  name,
  active,
  color,
  size = 22,
}: {
  name: NavIconName;
  active?: boolean;
  color: string;
  size?: number;
}) {
  const icon = navIconNames[name];
  return <Ionicons name={active ? icon.filled : icon.outline} size={size} color={color} />;
}
