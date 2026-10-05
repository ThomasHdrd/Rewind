import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MediaListItem, theme } from "@/design-system";
import { SectionLabel } from "@/components/SectionLabel";
import { igdbImageUrl } from "@/lib/games";
import { nextMainMission } from "@/lib/gameMissions";
import {
  useMissionList,
  useMyGames,
  useSetGameStatus,
  useSaveChecklist,
} from "@/hooks/useGames";
import { useToastStore } from "@/state/toastStore";
import { Game } from "@/data/games/types";

// Home's games block — its own section under the series, never mixed into
// that list. Works like "next episode ✓": each game shows its next main
// mission, and the tick checks it off and moves to the following one.
/** `hideWhenEmpty`: for "Both" accounts, an empty games block would just
 * take space above/below the series — only games-only accounts get the hint. */
export function ContinuePlaying({
  hideWhenEmpty = false,
}: {
  hideWhenEmpty?: boolean;
}) {
  const router = useRouter();
  const { data: games = [], isLoading } = useMyGames();
  const playing = games.filter((g) => g.status === "playing");

  if (isLoading || (hideWhenEmpty && playing.length === 0)) return null;
  return (
    <View style={{ gap: 8 }}>
      <SectionLabel>Continue Playing</SectionLabel>
      {playing.length === 0 ? (
        <Pressable onPress={() => router.push("/discover")}>
          <Text style={styles.empty}>
            No game in progress — find one in Discover → Games.
          </Text>
        </Pressable>
      ) : (
        playing.map((g) => <GameMissionRow key={g.id} game={g} />)
      )}
    </View>
  );
}

function GameMissionRow({ game }: { game: Game }) {
  const router = useRouter();
  const { items } = useMissionList(game);
  const saveChecklist = useSaveChecklist();
  const setStatus = useSetGameStatus();
  const showToast = useToastStore((s) => s.show);
  const { next, done, total } = nextMainMission(items);
  const open = () => router.push(`/game/${game.id}`);

  const meta =
    total === 0
      ? "No missions yet — tap to add them"
      : next
        ? `Next · ${next.title} · ${done}/${total}`
        : `All ${total} main missions done`;

  const action =
    total === 0 ? (
      <Pressable
        onPress={open}
        style={styles.check}
        hitSlop={8}
        accessibilityLabel={`Add missions to ${game.title}`}
      >
        <Ionicons name="add" size={18} color={theme.textPrimary} />
      </Pressable>
    ) : next ? (
      <Pressable
        onPress={() => {
          const status = saveChecklist(
            game,
            items.map((i) => (i.id === next.id ? { ...i, done: true } : i)),
          );
          showToast(
            status === "completed"
              ? `${game.title} completed 🎉`
              : `✓ ${next.title}`,
          );
        }}
        style={styles.check}
        hitSlop={8}
        accessibilityLabel={`Mark ${next.title} done`}
      >
        <Text style={styles.checkGlyph}>✓</Text>
      </Pressable>
    ) : (
      // Story finished: one tap files the game under Completed, like a series
      // leaving Continue Watching once its last episode is ticked.
      <Pressable
        onPress={() => {
          setStatus.mutate({ game, status: "completed" });
          showToast(`${game.title} completed 🎉`);
        }}
        style={[styles.check, styles.checkDone]}
        hitSlop={8}
        accessibilityLabel={`Mark ${game.title} completed`}
      >
        <Ionicons name="trophy" size={16} color={theme.textInverse} />
      </Pressable>
    );

  return (
    <Pressable onPress={open}>
      <MediaListItem
        title={game.title}
        meta={meta}
        progress={total ? Math.round((done / total) * 100) : undefined}
        imageUrl={igdbImageUrl(game.coverImageId, "t_cover_small")}
        action={action}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: { color: theme.textTertiary, fontSize: 13 },
  check: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.surfaceInteractive,
    alignItems: "center",
    justifyContent: "center",
  },
  checkDone: { backgroundColor: theme.brandPrimary },
  checkGlyph: { color: theme.textPrimary },
});
