import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Skeleton, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingRow } from "@/components/SettingRow";
import { useSaveUserSettings, useUserSettings } from "@/hooks/useMedia";

export default function NotificationSettings() {
  const { data: settings } = useUserSettings();
  const save = useSaveUserSettings();

  return (
    <Screen>
      <ScreenHeader title="Notifications" />
      {!settings ? (
        <Skeleton height={200} radius={12} />
      ) : (
        <>
          <View>
            <SettingRow
              label="New episodes"
              description="When a new episode of a series you're watching comes out."
              value={settings.notifyNewEpisodes}
              onChange={(v) => save.mutate({ notifyNewEpisodes: v })}
            />
            <SettingRow
              label="Friend requests"
              description="When someone sends you a request or accepts yours."
              value={settings.notifyFriendRequests}
              onChange={(v) => save.mutate({ notifyFriendRequests: v })}
            />
            <SettingRow
              label="Your yearly Rewind"
              description="When your Rewind of the year is ready, in December."
              value={settings.notifyRewind}
              onChange={(v) => save.mutate({ notifyRewind: v })}
            />
          </View>
          <Text style={styles.hint}>
            Your choices are saved to your account. Phone notifications are delivered by the Rewind mobile app.
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { color: theme.textTertiary, fontSize: 12, lineHeight: 18 },
});
