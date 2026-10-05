import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, ChallengeProgress, Chip, StreakBadge, theme } from "@/design-system";
import { avatarIconEmoji } from "@/design-system/icons";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionLabel } from "@/components/SectionLabel";
import { useFriends, useProfile } from "@/hooks/useMedia";

// "Friends" used to be a third tab listing the same people as Ranking, just
// unsorted — removed; the Friends tab of the app is where friends live.
const TABS = ["Rewards", "Ranking"] as const;
type Tab = (typeof TABS)[number];

export default function Rewards() {
  const [tab, setTab] = useState<Tab>("Rewards");
  const { data: profile } = useProfile();
  const { data: friends = [] } = useFriends();

  if (!profile) return null;

  const allAchievements = (profile.achievementGroups ?? []).flatMap((g) => g.items);
  const unlocked = allAchievements.filter((a) => a.achieved).length;
  const achievementTotal = allAchievements.length;

  const leaderboard = [
    ...friends.map((f) => ({ ...f, isYou: false })),
    {
      id: "you",
      name: profile.firstName || "You",
      username: profile.username,
      xp: profile.xp,
      avatarColor: profile.avatarColor,
      avatarIcon: profile.avatarIcon,
      avatarImage: profile.avatarImage,
      isYou: true,
    },
  ].sort((a, b) => b.xp - a.xp);

  return (
    <Screen>
      <ScreenHeader title="Rewards" />

      <View style={styles.toggleRow}>
        {TABS.map((t) => (
          <Chip key={t} label={t} selected={tab === t} onPress={() => setTab(t)} />
        ))}
      </View>

      {tab === "Rewards" ? (
        <>
          <View style={styles.levelCard}>
            <Text style={styles.levelLabel}>
              LEVEL {profile.level} · {profile.levelName.toUpperCase()}
            </Text>
            <View style={styles.levelTrack}>
              <View
                style={[
                  styles.levelFill,
                  { width: `${Math.min(100, (profile.xp / (profile.xp + profile.xpToNext)) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.levelMeta}>
              {profile.xp} XP · {profile.xpToNext} XP to next level
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <StreakBadge
              icon={<Ionicons name="flame" size={20} color={theme.brandPrimary} />}
              value={profile.dayStreak}
              label="Day streak"
            />
            <StreakBadge
              icon={<Ionicons name="trophy" size={20} color={theme.brandPrimary} />}
              value={profile.bestStreak}
              label="Best streak"
            />
          </View>

          <ChallengeList
            title="Daily Challenges"
            hint="Resets every day at midnight."
            items={profile.dailyChallenges ?? []}
            icon="sunny-outline"
          />
          <ChallengeList
            title="Weekly Challenges"
            hint="Resets every Monday at midnight."
            items={profile.weeklyChallenges ?? []}
            icon="gift-outline"
          />

          <View style={{ gap: 4 }}>
            <SectionLabel>Achievements</SectionLabel>
            <Text style={styles.emptyHint}>
              One-time milestones — earned once, never reset. {unlocked}/{achievementTotal} unlocked.
            </Text>
          </View>
          {(profile.achievementGroups ?? []).map((group) => (
            <View key={group.category} style={{ gap: 2 }}>
              <Text style={styles.groupLabel}>{group.category}</Text>
              {group.items.map((a) => (
                <ChallengeProgress
                  key={a.id}
                  icon={
                    <Ionicons name={a.achieved ? "trophy" : "trophy-outline"} size={16} color={theme.brandPrimary} />
                  }
                  label={a.label}
                  current={a.current}
                  total={a.total}
                  xpReward={a.xpReward}
                />
              ))}
            </View>
          ))}
        </>
      ) : tab === "Ranking" ? (
        <View style={{ gap: 4 }}>
          <SectionLabel>XP Ranking</SectionLabel>
          {friends.length === 0 ? (
            <Text style={styles.emptyHint}>
              Community rankings need more players — invite friends to compete.
            </Text>
          ) : null}
          {leaderboard.map((f, i) => {
            const isYou = f.isYou;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
            return (
              <View key={f.id} style={[styles.rankRow, isYou && styles.rankRowYou]}>
                <Text style={[styles.rankIndex, isYou && { color: theme.brandPrimary }]}>
                  {medal ?? i + 1}
                </Text>
                <Avatar
                  name={f.name}
                  size={36}
                  color={f.avatarColor}
                  icon={avatarIconEmoji(f.avatarIcon)}
                  imageUrl={f.avatarImage}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rankName, isYou && { fontWeight: "700" }]}>
                    {f.name}
                    {isYou ? " (you)" : ""}
                  </Text>
                  {f.username ? <Text style={styles.rankHandle}>@{f.username}</Text> : null}
                </View>
                <Text style={[styles.rankXp, isYou && { color: theme.brandPrimary, fontWeight: "700" }]}>
                  {f.xp.toLocaleString()} XP
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyHint: { color: theme.textTertiary, fontSize: 12 },
  groupLabel: {
    color: theme.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 6,
  },
  toggleRow: { flexDirection: "row", gap: 8 },
  levelCard: {
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  levelLabel: { color: theme.textTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  levelTrack: { height: 6, borderRadius: 3, backgroundColor: theme.ratingTrack, overflow: "hidden" },
  levelFill: { height: "100%", backgroundColor: theme.brandPrimary },
  levelMeta: { color: theme.textTertiary, fontSize: 11 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.divider },
  rankRowYou: { backgroundColor: theme.brandPrimarySubtle, borderRadius: 8, paddingHorizontal: 8 },
  rankIndex: { color: theme.textTertiary, fontSize: 14, fontWeight: "800", width: 18 },
  rankName: { color: theme.textPrimary, fontSize: 14, fontWeight: "600" },
  rankHandle: { color: theme.textTertiary, fontSize: 11 },
  rankXp: { color: theme.textSecondary, fontSize: 13 },
});

function ChallengeList({
  title,
  hint,
  items,
  icon,
}: {
  title: string;
  hint: string;
  items: { id: string; label: string; current: number; total: number; xpReward: number }[];
  icon: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <View style={{ gap: 4 }}>
      <SectionLabel>{title}</SectionLabel>
      <Text style={styles.emptyHint}>{hint}</Text>
      {items.map((c) => (
        <ChallengeProgress
          key={c.id}
          icon={
            <Ionicons
              name={c.current >= c.total ? "checkmark-circle" : icon}
              size={16}
              color={theme.brandPrimary}
            />
          }
          label={c.label}
          current={c.current}
          total={c.total}
          xpReward={c.xpReward}
        />
      ))}
    </View>
  );
}
