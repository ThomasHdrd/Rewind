import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ChallengeProgress, Chip, StreakBadge, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionLabel } from "@/components/SectionLabel";
import { useChallenges, useFriends, useProfile } from "@/hooks/useMedia";
import { computeAchievements } from "@/lib/rewards";

const TABS = ["Rewards", "Ranking", "Friends"] as const;
type Tab = (typeof TABS)[number];

export default function Rewards() {
  const [tab, setTab] = useState<Tab>("Rewards");
  const { data: profile } = useProfile();
  const { data: challenges = [] } = useChallenges();
  const { data: friends = [] } = useFriends();

  const achievements = useMemo(
    () => (profile ? computeAchievements(friends.length, profile.episodesCount) : []),
    [friends.length, profile]
  );

  if (!profile) return null;

  const leaderboard = [...friends, { id: "you", name: `You — ${profile.firstName}`, xp: profile.xp }].sort(
    (a, b) => b.xp - a.xp
  );

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

          <View style={{ gap: 4 }}>
            <SectionLabel>Weekly Challenges</SectionLabel>
            {challenges.length === 0 ? (
              <Text style={styles.emptyHint}>Watch something this week to start a challenge.</Text>
            ) : (
              challenges.map((c) => (
                <ChallengeProgress
                  key={c.id}
                  icon={<Ionicons name="gift-outline" size={16} color={theme.brandPrimary} />}
                  label={c.label}
                  current={c.current}
                  total={c.total}
                  xpReward={c.xpReward}
                />
              ))
            )}
          </View>

          <View style={{ gap: 4 }}>
            <SectionLabel>Achievements</SectionLabel>
            <Text style={styles.emptyHint}>One-time milestones — earned once, never reset.</Text>
            {achievements.map((a) => (
              <ChallengeProgress
                key={a.id}
                icon={
                  <Ionicons
                    name={a.achieved ? "trophy" : "trophy-outline"}
                    size={16}
                    color={theme.brandPrimary}
                  />
                }
                label={a.label}
                current={a.achieved ? 1 : 0}
                total={1}
                xpReward={a.xpReward}
              />
            ))}
          </View>
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
            const isYou = f.id === "you";
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
            return (
              <View key={f.id} style={[styles.rankRow, isYou && styles.rankRowYou]}>
                <Text style={[styles.rankIndex, isYou && { color: theme.brandPrimary }]}>
                  {medal ?? i + 1}
                </Text>
                <View style={styles.rankAvatar} />
                <Text style={[styles.rankName, isYou && { fontWeight: "700" }]}>{f.name}</Text>
                <Text style={[styles.rankXp, isYou && { color: theme.brandPrimary, fontWeight: "700" }]}>
                  {f.xp.toLocaleString()} XP
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={{ gap: 4 }}>
          <SectionLabel>Friends</SectionLabel>
          {friends.length === 0 ? (
            <Text style={styles.emptyHint}>You haven't added any friends yet.</Text>
          ) : null}
          {[{ id: "you", name: `You — ${profile.firstName}`, xp: profile.xp }, ...friends].map((f) => {
            const isYou = f.id === "you";
            return (
              <View key={f.id} style={[styles.rankRow, isYou && styles.rankRowYou]}>
                <View style={styles.rankAvatar} />
                <Text style={[styles.rankName, isYou && { fontWeight: "700" }]}>{f.name}</Text>
                <Text style={[styles.rankXp, isYou && { color: theme.brandPrimary, fontWeight: "700" }]}>
                  {f.xp.toLocaleString()} XP
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyHint: { color: theme.textTertiary, fontSize: 12 },
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
  rankAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.surfaceSecondary },
  rankName: { flex: 1, color: theme.textPrimary, fontSize: 14, fontWeight: "600" },
  rankXp: { color: theme.textSecondary, fontSize: 13 },
});
