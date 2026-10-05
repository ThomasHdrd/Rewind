import { ChecklistCategory, ChecklistItem } from "@/data/games/types";

export const CHECKLIST_CATEGORIES: ChecklistCategory[] = [
  "main",
  "side",
  "boss",
  "collectible",
  "easter-egg",
  "achievement",
];

/** Provided lists for a game, per tab (Rewind's shipped data or a player's). */
export type MissionLists = Partial<Record<ChecklistCategory, string[]>>;

/**
 * A game's checklist with every provided list filled in, like a series'
 * episodes: the provided titles always make up the tab (the player can't
 * lose one), the player's ticks are carried over by title, and anything the
 * player typed themselves (ids "c-…") is kept after them. Tabs without a
 * provided list are just the player's own items. Saving any tick stores the
 * whole list on the player's entry.
 */
export function withMissionSeed(
  checklist: ChecklistItem[] | undefined,
  lists: MissionLists | undefined,
): ChecklistItem[] {
  const stored = checklist ?? [];
  const out: ChecklistItem[] = [];
  for (const category of CHECKLIST_CATEGORIES) {
    const mine = stored.filter((i) => i.category === category);
    const titles = lists?.[category];
    if (!titles?.length) {
      out.push(...mine);
      continue;
    }
    const done = new Set(mine.filter((i) => i.done).map((i) => i.title));
    titles.forEach((title, n) =>
      out.push({
        id: `${category}:${n + 1}`,
        title,
        category,
        done: done.has(title),
      }),
    );
    out.push(
      ...mine.filter((i) => i.id.startsWith("c-") && !titles.includes(i.title)),
    );
  }
  return out;
}

/** The first unticked main mission, with progress over main missions. */
export function nextMainMission(items: ChecklistItem[]): {
  next?: ChecklistItem;
  done: number;
  total: number;
} {
  const main = items.filter((i) => i.category === "main");
  return {
    next: main.find((i) => !i.done),
    done: main.filter((i) => i.done).length,
    total: main.length,
  };
}

const PREFIX: Record<ChecklistCategory, string> = {
  main: "M",
  side: "S",
  boss: "B",
  collectible: "C",
  "easter-egg": "E",
  achievement: "A",
};

/** "M5", "S12"… — the games' "E5" in a list. */
export const missionLabel = (category: ChecklistCategory, n: number) =>
  `${PREFIX[category]}${n}`;
