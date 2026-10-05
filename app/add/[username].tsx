import React from "react";
import { StyleSheet, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Skeleton, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { UserResultRow } from "@/components/UserResultRow";
import { useUserLookup } from "@/hooks/useMedia";

// Target of invite links: rewind://add/<username> (shared from Friends).
export default function AddFromInvite() {
  const { username = "" } = useLocalSearchParams<{ username: string }>();
  const { data, isLoading } = useUserLookup(username);
  return (
    <Screen>
      <ScreenHeader title="Add a friend" />
      {isLoading ? (
        <Skeleton width="100%" height={56} radius={12} />
      ) : data ? (
        <UserResultRow profile={data.profile} status={data.status} />
      ) : (
        <Text style={styles.hint}>This invite link doesn't match any account (@{username}).</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { color: theme.textTertiary, fontSize: 13 },
});
