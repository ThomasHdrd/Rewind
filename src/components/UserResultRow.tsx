import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { UserRow, theme } from "@/design-system";
import { avatarIconEmoji } from "@/design-system/icons";
import { useCancelRequest, useSendFriendRequest } from "@/hooks/useMedia";
import { useToastStore } from "@/state/toastStore";
import { FriendshipStatus, PublicProfile } from "@/data/repositories/social";

// A looked-up user (search or invite link) with the one action that fits
// the current relationship: Add / Requested (tap to cancel) / Accept.
export function UserResultRow({ profile, status }: { profile: PublicProfile; status: FriendshipStatus }) {
  const send = useSendFriendRequest();
  const cancel = useCancelRequest();
  const showToast = useToastStore((s) => s.show);
  const busy = send.isPending || cancel.isPending;

  const add = () =>
    send.mutate(profile.uid, {
      onSuccess: (r) => showToast(r === "accepted" ? `You and ${profile.firstName} are now friends` : "Friend request sent"),
      onError: () => showToast("Couldn't send the request — try again"),
    });

  const action =
    status === "self" ? (
      <Text style={styles.muted}>That's you</Text>
    ) : status === "friends" ? (
      <Text style={styles.muted}>Friends ✓</Text>
    ) : status === "outgoing" ? (
      <Pressable style={styles.ghost} disabled={busy} onPress={() => cancel.mutate(profile.uid)}>
        <Text style={styles.ghostText}>Requested</Text>
      </Pressable>
    ) : (
      <Pressable style={styles.primary} disabled={busy} onPress={add}>
        <Text style={styles.primaryText}>{status === "incoming" ? "Accept" : "Add"}</Text>
      </Pressable>
    );

  return (
    <UserRow
      name={profile.firstName || `@${profile.username}`}
      subtitle={`@${profile.username}${profile.bio ? ` · ${profile.bio}` : ""}`}
      avatarColor={profile.avatarColor}
      avatarIcon={avatarIconEmoji(profile.avatarIcon)}
      avatarImage={profile.avatarImage}
      action={action}
    />
  );
}

const styles = StyleSheet.create({
  muted: { color: theme.textTertiary, fontSize: 12, fontWeight: "700" },
  primary: { backgroundColor: theme.brandPrimary, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  primaryText: { color: theme.textInverse, fontWeight: "800", fontSize: 13 },
  ghost: { borderWidth: 1, borderColor: theme.borderDefault, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  ghostText: { color: theme.textSecondary, fontWeight: "700", fontSize: 13 },
});
