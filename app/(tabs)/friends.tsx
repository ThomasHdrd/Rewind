import React, { useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Button, EmptyState, Input, Modal, Skeleton, UserRow, theme } from "@/design-system";
import { avatarIconEmoji } from "@/design-system/icons";
import { Screen } from "@/components/Screen";
import { SectionLabel } from "@/components/SectionLabel";
import { UserResultRow } from "@/components/UserResultRow";
import {
  useActivityFeed,
  useCancelRequest,
  useFriendRequests,
  useFriends,
  useProfile,
  useRemoveFriend,
  useRespondToRequest,
  useUserLookup,
} from "@/hooks/useMedia";
import { normalizeUsername, validateUsername } from "@/data/repositories/social";
import { useToastStore } from "@/state/toastStore";
import { Friend } from "@/types/media";

// Friends-only social: find people by exact @username or invite link,
// requests must be accepted, and only friends see each other's activity.
export default function Friends() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: friends = [], isLoading: friendsLoading } = useFriends();
  const { data: requests } = useFriendRequests();
  const { data: activity = [], refetch: refetchActivity } = useActivityFeed();
  // Friends' watches aren't streamed live (one listener per friend would add
  // up); refresh the feed each time the tab is opened instead.
  useFocusEffect(
    React.useCallback(() => {
      refetchActivity();
    }, [refetchActivity])
  );
  const respond = useRespondToRequest();
  const cancel = useCancelRequest();
  const removeFriend = useRemoveFriend();
  const showToast = useToastStore((s) => s.show);

  const [search, setSearch] = useState("");
  const [toRemove, setToRemove] = useState<Friend | null>(null);
  const handle = normalizeUsername(search);
  const searchError = handle.length >= 3 ? validateUsername(handle) : null;
  const { data: lookup, isFetching: searching } = useUserLookup(search);

  const incoming = requests?.incoming ?? [];
  const outgoing = requests?.outgoing ?? [];

  const invite = async () => {
    if (!profile?.username) return;
    try {
      await Share.share({
        message: `Add me on Rewind! My username is @${profile.username}\nrewind://add/${profile.username}`,
      });
    } catch {
      showToast(`Your username is @${profile.username}`);
    }
  };

  // Accounts from before usernames existed must pick one first.
  if (profile && !profile.username) {
    return (
      <Screen>
        <Text style={styles.title}>Friends</Text>
        <EmptyState
          icon={<Ionicons name="at-outline" size={22} color={theme.textTertiary} />}
          title="Choose a username"
          subtitle="Friends find and add you by your @username. Pick one to get started."
          actionLabel="Choose my username"
          onAction={() => router.push("/profile-setup")}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Friends</Text>
          {profile?.username ? <Text style={styles.me}>You're @{profile.username}</Text> : null}
        </View>
        <Pressable style={styles.inviteBtn} onPress={invite} accessibilityLabel="Invite friends">
          <Ionicons name="share-outline" size={16} color={theme.textPrimary} />
          <Text style={styles.inviteText}>Invite</Text>
        </Pressable>
      </View>

      <View style={{ gap: 8 }}>
        <Input
          value={search}
          onChangeText={(v) => setSearch(v.replace(/\s/g, "").toLowerCase())}
          placeholder="Add a friend by username"
          autoCapitalize="none"
          icon={<Text style={styles.at}>@</Text>}
          error={searchError ?? undefined}
        />
        {handle.length >= 3 && !searchError ? (
          searching ? (
            <Skeleton width="100%" height={56} radius={12} />
          ) : lookup ? (
            <UserResultRow profile={lookup.profile} status={lookup.status} />
          ) : (
            <Text style={styles.hint}>No one goes by @{handle}. Usernames must match exactly.</Text>
          )
        ) : null}
      </View>

      {incoming.length > 0 ? (
        <View style={{ gap: 4 }}>
          <SectionLabel>Friend requests · {incoming.length}</SectionLabel>
          {incoming.map((p) => (
            <UserRow
              key={p.uid}
              name={p.firstName || `@${p.username}`}
              subtitle={`@${p.username}`}
              avatarColor={p.avatarColor}
              avatarIcon={avatarIconEmoji(p.avatarIcon)}
              avatarImage={p.avatarImage}
              action={
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    style={styles.ghost}
                    disabled={respond.isPending}
                    onPress={() => respond.mutate({ uid: p.uid, accept: false })}
                  >
                    <Text style={styles.ghostText}>Decline</Text>
                  </Pressable>
                  <Pressable
                    style={styles.primary}
                    disabled={respond.isPending}
                    onPress={() =>
                      respond.mutate(
                        { uid: p.uid, accept: true },
                        { onSuccess: () => showToast(`You and ${p.firstName || `@${p.username}`} are now friends`) }
                      )
                    }
                  >
                    <Text style={styles.primaryText}>Accept</Text>
                  </Pressable>
                </View>
              }
            />
          ))}
        </View>
      ) : null}

      <View style={{ gap: 4 }}>
        <SectionLabel>Your friends{friends.length ? ` · ${friends.length}` : ""}</SectionLabel>
        {friendsLoading ? (
          <Skeleton width="100%" height={56} radius={12} />
        ) : friends.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="people-outline" size={22} color={theme.textTertiary} />}
            title="No friends yet"
            subtitle="Search a username above, or send your invite link to the people you watch with."
            actionLabel="Invite friends"
            onAction={invite}
          />
        ) : (
          friends.map((f) => (
            <UserRow
              key={f.id}
              name={f.name}
              subtitle={`@${f.username} · ${f.xp} XP`}
              avatarColor={f.avatarColor}
              avatarIcon={avatarIconEmoji(f.avatarIcon)}
              avatarImage={f.avatarImage}
              action={
                <Pressable onPress={() => setToRemove(f)} hitSlop={10} accessibilityLabel={`Options for ${f.name}`}>
                  <Ionicons name="ellipsis-horizontal" size={18} color={theme.textTertiary} />
                </Pressable>
              }
            />
          ))
        )}
      </View>

      {outgoing.length > 0 ? (
        <View style={{ gap: 4 }}>
          <SectionLabel>Sent requests</SectionLabel>
          {outgoing.map((p) => (
            <UserRow
              key={p.uid}
              name={p.firstName || `@${p.username}`}
              subtitle={`@${p.username} · pending`}
              avatarColor={p.avatarColor}
              avatarIcon={avatarIconEmoji(p.avatarIcon)}
              avatarImage={p.avatarImage}
              action={
                <Pressable style={styles.ghost} disabled={cancel.isPending} onPress={() => cancel.mutate(p.uid)}>
                  <Text style={styles.ghostText}>Cancel</Text>
                </Pressable>
              }
            />
          ))}
        </View>
      ) : null}

      {friends.length > 0 ? (
        <View style={{ gap: 4 }}>
          <SectionLabel>Activity</SectionLabel>
          {activity.length === 0 ? (
            <Text style={styles.hint}>What your friends watch will show up here.</Text>
          ) : (
            activity.map((a) => (
              <Pressable
                key={a.id}
                style={styles.activityRow}
                disabled={!a.mediaId}
                onPress={() =>
                  a.mediaId &&
                  router.push(
                    a.mediaId.startsWith("game:")
                      ? `/game/${a.mediaId}`
                      : a.mediaId.startsWith("movie:")
                        ? `/movie/${a.mediaId}`
                        : `/series/${a.mediaId}`
                  )
                }
              >
                <Avatar
                  name={a.friendName}
                  size={34}
                  color={a.friendAvatarColor}
                  icon={avatarIconEmoji(a.friendAvatarIcon)}
                  imageUrl={a.friendAvatarImage}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.activityText} numberOfLines={2}>
                    <Text style={styles.bold}>{a.friendName}</Text> {a.action} <Text style={styles.bold}>{a.mediaTitle}</Text>
                  </Text>
                  <Text style={styles.time}>{a.timeAgo}</Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      ) : null}

      <Modal visible={!!toRemove} title={toRemove?.name ?? ""} onClose={() => setToRemove(null)}>
        <Text style={styles.modalBody}>
          Remove @{toRemove?.username} from your friends? You'll stop seeing each other's activity.
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button variant="secondary" style={{ flex: 1 }} onPress={() => setToRemove(null)}>
            Cancel
          </Button>
          <Button
            style={{ flex: 1 }}
            loading={removeFriend.isPending}
            onPress={() =>
              toRemove &&
              removeFriend.mutate(toRemove.id, {
                onSuccess: () => {
                  showToast(`${toRemove.name} removed`);
                  setToRemove(null);
                },
              })
            }
          >
            Remove
          </Button>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontFamily: "ArchivoBlack_400Regular", color: theme.textPrimary, fontSize: 20 },
  me: { color: theme.textTertiary, fontSize: 12, marginTop: 2 },
  inviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  inviteText: { color: theme.textPrimary, fontSize: 13, fontWeight: "700" },
  at: { color: theme.textTertiary, fontSize: 15, fontWeight: "700" },
  hint: { color: theme.textTertiary, fontSize: 13, lineHeight: 19 },
  primary: { backgroundColor: theme.brandPrimary, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  primaryText: { color: theme.textInverse, fontWeight: "800", fontSize: 13 },
  ghost: { borderWidth: 1, borderColor: theme.borderDefault, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  ghostText: { color: theme.textSecondary, fontWeight: "700", fontSize: 13 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  activityText: { color: theme.textSecondary, fontSize: 13, lineHeight: 18 },
  bold: { color: theme.textPrimary, fontWeight: "700" },
  time: { color: theme.textTertiary, fontSize: 11 },
  modalBody: { color: theme.textSecondary, fontSize: 13, lineHeight: 19 },
});
