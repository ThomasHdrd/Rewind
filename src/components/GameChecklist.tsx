import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Chip, Input, radius, theme } from "@/design-system";
import { SectionLabel } from "@/components/SectionLabel";
import { useRouter } from "expo-router";
import { missionLabel } from "@/lib/gameMissions";
import {
  useMissionList,
  useMissionRatings,
  usePublishMissions,
  useSaveChecklist,
} from "@/hooks/useGames";
import { ChecklistCategory, ChecklistItem, Game } from "@/data/games/types";
import { useToastStore } from "@/state/toastStore";

// The games' answer to a series' episode list. Main missions come pre-filled
// when Rewind ships a list for the game or another player shared one; they
// are then ticked/unticked like episodes — no typing, no deleting. Tabs
// without a list (side missions, bosses…) let the player add their own.
const CATEGORIES: {
  value: ChecklistCategory;
  label: string;
  icon: string;
  one: string;
  many: string;
}[] = [
  {
    value: "main",
    label: "Main missions",
    icon: "📖",
    one: "main mission",
    many: "main missions",
  },
  {
    value: "side",
    label: "Side missions",
    icon: "🧭",
    one: "side mission",
    many: "side missions",
  },
  { value: "boss", label: "Bosses", icon: "⚔️", one: "boss", many: "bosses" },
  {
    value: "collectible",
    label: "Collectibles",
    icon: "⭐",
    one: "collectible",
    many: "collectibles",
  },
  {
    value: "easter-egg",
    label: "Easter eggs",
    icon: "🥚",
    one: "easter egg",
    many: "easter eggs",
  },
];

const COLLAPSED = 10;
const BOSS_GENRES = /Role-playing|Hack and slash|Platform/;

/** Items the player typed (ids "c-…") can be deleted; provided ones can't. */
const isOwn = (item: ChecklistItem) => item.id.startsWith("c-");

export function GameChecklist({ game }: { game: Game }) {
  const router = useRouter();
  const saveChecklist = useSaveChecklist();
  const showToast = useToastStore((s) => s.show);
  const { data: ratings = {} } = useMissionRatings(game);
  const { items, lists, seed, mine } = useMissionList(game);
  const publish = usePublishMissions();
  const [tab, setTab] = useState<ChecklistCategory>("main");
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const visible = items.filter((i) => i.category === tab);
  const done = visible.filter((i) => i.done).length;
  const allDone = visible.length > 0 && done === visible.length;
  const current = CATEGORIES.find((c) => c.value === tab)!;
  // No Bosses tab for games without bosses (GTA, Detroit…): listed games
  // say so through their data, others through their genre.
  const hasBosses =
    items.some((i) => i.category === "boss") ||
    (lists
      ? !!lists.boss?.length
      : game.genres.some((g) => BOSS_GENRES.test(g)));
  const tabs = CATEGORIES.filter((c) => c.value !== "boss" || hasBosses);
  // This tab is already listed (by Rewind or a player): tick only, no typing.
  const provided = !!lists?.[tab]?.length;
  // Collapsed: the next few unticked items (plus the last ticked one, to
  // untick it quickly) — like a series opening on the next episode.
  const firstOpen = visible.findIndex((i) => !i.done);
  const start = firstOpen <= 0 ? 0 : firstOpen - 1;
  const shown =
    expanded || visible.length <= COLLAPSED
      ? visible
      : visible.slice(
          Math.min(start, Math.max(0, visible.length - COLLAPSED)),
          start + COLLAPSED,
        );

  const save = (checklist: ChecklistItem[]) => {
    const status = saveChecklist(game, checklist);
    if (status === "completed") showToast(`${game.title} completed 🎉`);
    // Nobody published this game's missions yet (or I did): share my main
    // missions so the next player gets them pre-filled.
    if (seed && !mine) return;
    const titles = checklist
      .filter((i) => i.category === "main")
      .map((i) => i.title);
    const published = seed?.lists.main;
    if (titles.length && JSON.stringify(titles) !== JSON.stringify(published))
      publish.mutate({ game, titles });
  };
  const toggle = (id: string) =>
    save(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  const setAll = (value: boolean) =>
    save(items.map((i) => (i.category === tab ? { ...i, done: value } : i)));
  const nextId = visible.find((i) => !i.done)?.id;
  const add = () => {
    const title = draft.trim();
    if (!title) return;
    save([
      ...items,
      { id: `c-${Date.now()}`, title, category: tab, done: false },
    ]);
    setDraft("");
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.header}>
        <SectionLabel>Missions</SectionLabel>
        {visible.length > 0 ? (
          <Text style={styles.count}>
            {done}/{visible.length}
          </Text>
        ) : null}
      </View>

      <View style={styles.wrap}>
        {tabs.map((c) => (
          <Chip
            key={c.value}
            label={`${c.icon} ${c.label}`}
            selected={tab === c.value}
            onPress={() => setTab(c.value)}
          />
        ))}
      </View>

      {visible.length > 0 ? (
        <>
          <View style={styles.header}>
            <Text style={styles.hint}>
              {provided
                ? seed?.source === "rewind"
                  ? "Listed by Rewind"
                  : "Shared by a Rewind player"
                : `Your ${current.many}`}
            </Text>
            {done > 0 ? (
              <Pressable
                onPress={() => setAll(false)}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.unmarkAll}>Unmark all</Text>
              </Pressable>
            ) : null}
          </View>
          {/* Same prominent action as "Mark Season 1 as watched". */}
          {!allDone ? (
            <Pressable
              style={styles.markAllBtn}
              onPress={() => setAll(true)}
              accessibilityRole="button"
            >
              <Ionicons
                name="checkmark-done"
                size={18}
                color={theme.textInverse}
              />
              <Text style={styles.markAllBtnLabel}>
                Mark all {current.many} as done
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <Text style={styles.hint}>
          {tab === "main"
            ? "No mission list for this game yet. Add the main missions as you play — they'll be shared so the next players get them ready to tick."
            : `No ${current.many} listed for this game — add the ones you want to track.`}
        </Text>
      )}

      {shown.map((item) => {
        const n = visible.indexOf(item) + 1;
        const rating = ratings[item.id];
        return (
          <Pressable
            key={item.id}
            style={styles.row}
            onPress={() =>
              router.push(
                `/mission?game=${encodeURIComponent(game.id)}&item=${encodeURIComponent(item.id)}`,
              )
            }
          >
            <Pressable
              onPress={() => toggle(item.id)}
              hitSlop={8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.done }}
              accessibilityLabel={item.title}
              style={[styles.toggle, item.done && styles.toggleDone]}
            >
              {item.done ? <Text style={styles.toggleCheck}>✓</Text> : null}
            </Pressable>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.itemTitle}>
                {missionLabel(item.category, n)} · {item.title}{" "}
                {item.id === nextId ? (
                  <Text style={styles.next}>NEXT</Text>
                ) : null}
              </Text>
              <Text style={styles.itemMeta}>
                {rating
                  ? `★ ${rating.average}/5 (${rating.count})`
                  : "Be the first to rate"}
                {game.missionRatings?.[item.id]
                  ? ` · You: ${game.missionRatings[item.id]}/5`
                  : ""}
              </Text>
            </View>
            {isOwn(item) ? (
              <Pressable
                onPress={() => save(items.filter((i) => i.id !== item.id))}
                hitSlop={10}
                accessibilityLabel={`Delete ${item.title}`}
              >
                <Ionicons name="close" size={16} color={theme.textTertiary} />
              </Pressable>
            ) : (
              <Text style={styles.chevron}>›</Text>
            )}
          </Pressable>
        );
      })}

      {visible.length > COLLAPSED ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          hitSlop={6}
          accessibilityRole="button"
        >
          <Text style={styles.markAll}>
            {expanded ? "Show less" : `Show all ${visible.length}`}
          </Text>
        </Pressable>
      ) : null}

      {provided ? null : (
        <Input
          value={draft}
          onChangeText={setDraft}
          placeholder={`Add a ${current.one}`}
          onSubmitEditing={add}
          maxLength={80}
          icon={<Ionicons name="add" size={18} color={theme.textTertiary} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  count: { color: theme.textSecondary, fontSize: 12, fontWeight: "700" },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.ratingTrack,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: theme.brandPrimary },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hint: {
    color: theme.textTertiary,
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 1,
  },
  unmarkAll: { color: theme.textTertiary, fontSize: 13, fontWeight: "700" },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.brandPrimary,
    borderRadius: radius.full,
    paddingVertical: 12,
    marginVertical: 2,
  },
  markAllBtnLabel: {
    color: theme.textInverse,
    fontSize: 14,
    fontWeight: "800",
  },
  toggle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.borderDefault,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleDone: {
    backgroundColor: "rgba(253,115,109,0.15)",
    borderColor: theme.brandPrimary,
  },
  toggleCheck: { color: theme.brandPrimary, fontSize: 13 },
  next: { color: theme.brandPrimary, fontSize: 11, fontWeight: "700" },
  itemMeta: { fontSize: 12, color: theme.textTertiary },
  chevron: { color: theme.textTertiary },
  markAll: { color: theme.brandPrimary, fontSize: 13, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: theme.borderDefault,
    alignItems: "center",
    justifyContent: "center",
  },
  checkDone: {
    backgroundColor: theme.brandPrimary,
    borderColor: theme.brandPrimary,
  },
  itemTitle: { fontSize: 15, fontWeight: "700", color: theme.textPrimary },
  itemDone: { color: theme.textTertiary, textDecorationLine: "line-through" },
});
