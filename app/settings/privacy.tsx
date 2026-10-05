import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Chip, Skeleton, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionLabel } from "@/components/SectionLabel";
import { SettingRow } from "@/components/SettingRow";
import { useSaveUserSettings, useUserSettings } from "@/hooks/useMedia";

export default function PrivacySettings() {
  const { data: settings } = useUserSettings();
  const save = useSaveUserSettings();

  return (
    <Screen>
      <ScreenHeader title="Privacy" />
      {!settings ? (
        <Skeleton height={160} radius={12} />
      ) : (
        <>
          <View style={{ gap: 8 }}>
            <SectionLabel>Who sees what you watch</SectionLabel>
            <View style={styles.chips}>
              <Chip
                label="My friends"
                selected={settings.activityVisibility === "friends"}
                onPress={() => save.mutate({ activityVisibility: "friends" })}
              />
              <Chip
                label="Only me"
                selected={settings.activityVisibility === "private"}
                onPress={() => save.mutate({ activityVisibility: "private" })}
              />
            </View>
            <Text style={styles.hint}>
              {settings.activityVisibility === "friends"
                ? "Friends see the episodes and movies you mark as watched in their Activity feed."
                : "Nothing you watch appears in your friends' feed. Your existing activity was cleared."}
            </Text>
          </View>

          <View>
            <SectionLabel>Profile</SectionLabel>
            <SettingRow
              label="Findable by username"
              description="Let people find you by searching your @username. Your current friends keep seeing you either way."
              value={settings.discoverable}
              onChange={(v) => save.mutate({ discoverable: v })}
            />
          </View>

          <View style={{ gap: 6 }}>
            <SectionLabel>What others can see</SectionLabel>
            <Text style={styles.hint}>
              Anyone signed in to Rewind: your name, @username, avatar, bio, XP and level, and comments you post on titles.{"\n"}
              Friends only: what you watch — if allowed above.{"\n"}
              Nobody else: your library, ratings, lists, history and preferences stay private.
            </Text>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", gap: 8 },
  hint: { color: theme.textTertiary, fontSize: 12, lineHeight: 18 },
});
