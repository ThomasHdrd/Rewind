import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AvatarGroup, EmptyState, FriendActivityCard, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { useActivityFeed, useAddFriend, useFriends } from "@/hooks/useMedia";
import { useToastStore } from "@/state/toastStore";

export default function Friends() {
  const { data: friends = [] } = useFriends();
  const { data: activity = [] } = useActivityFeed();
  const addFriend = useAddFriend();
  const showToast = useToastStore((s) => s.show);

  const onAddFriend = async () => {
    const friend = await addFriend.mutateAsync();
    showToast(`${friend.name} added to your friends`);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Friends</Text>
        <Pressable style={styles.addBtn} onPress={onAddFriend}>
          <Text style={{ color: theme.textSecondary }}>+</Text>
        </Pressable>
      </View>

      {friends.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="people-outline" size={22} color={theme.textTertiary} />}
          title="No friends yet"
          subtitle="Add friends to compare your watchlist and earn XP together."
          actionLabel="Add a friend"
          onAction={onAddFriend}
        />
      ) : (
        <View style={{ flexDirection: "row", gap: 14 }}>
          {friends.map((f) => (
            <View key={f.id} style={{ alignItems: "center", gap: 6 }}>
              <AvatarGroup names={[f.name]} size={48} max={1} />
              <Text style={styles.friendName}>{f.name}</Text>
            </View>
          ))}
        </View>
      )}

      {friends.length > 0 ? (
        <View style={{ gap: 12 }}>
          {activity.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="time-outline" size={22} color={theme.textTertiary} />}
              title="No activity yet"
              subtitle="What your friends watch and rate will show up here."
            />
          ) : (
            activity.map((a) => (
              <FriendActivityCard
                key={a.id}
                name={a.friendName}
                action={a.action}
                timeAgo={a.timeAgo}
                mediaTitle={a.mediaTitle}
                artworkColor={a.artworkColor}
                rating={a.rating}
                likeCount={a.likeCount}
              />
            ))
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontFamily: "ArchivoBlack_400Regular", color: theme.textPrimary, fontSize: 20 },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    alignItems: "center",
    justifyContent: "center",
  },
  friendName: { color: theme.textTertiary, fontSize: 10 },
});
