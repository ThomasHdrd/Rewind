import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Chip, EmptyState, MediaArtwork, radius, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { useUpcoming } from "@/hooks/useMedia";
import { useMyGames, useTracks } from "@/hooks/useGames";
import { igdbImageUrl } from "@/lib/games";
import { UpcomingEpisode } from "@/types/media";

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Best-effort parse of UpcomingEpisode.airDate into a Date so we can bucket
// entries onto real calendar days / real week-strip dates. The field is a
// free-form display string (e.g. "Tue 11", an ISO date, etc.) depending on
// where it was produced, so we try a couple of formats and fall back to
// null (meaning: don't show a dot for that entry rather than guess wrong).
function parseAirDate(airDate: string, referenceYear: number): Date | null {
  const iso = new Date(airDate);
  if (!isNaN(iso.getTime()) && /\d{4}/.test(airDate)) return iso;
  const match = airDate.match(/(\d{1,2})\s*$/);
  if (match) {
    const day = Number(match[1]);
    const now = new Date();
    const candidate = new Date(referenceYear, now.getMonth(), day);
    if (!isNaN(candidate.getTime())) return candidate;
  }
  return null;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildWeekDates(today: Date): Date[] {
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const firstOfMonth = new Date(year, month, 1);
  // Grid starts Monday — shift so Sunday (0) becomes the last column.
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array(leadingBlanks).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// One date-header-grouped section: "Thursday, August 20" followed by that
// date's episode row(s). Shared between List view and Month view (per date
// selection) so both stay visually consistent.
function DateGroups({
  groups,
  router,
}: {
  groups: { date: Date; items: UpcomingEpisode[] }[];
  router: ReturnType<typeof useRouter>;
}) {
  if (groups.length === 0) {
    return <EmptyState title="Nothing upcoming" subtitle="Nothing airs on this day." />;
  }
  return (
    <View style={{ gap: 18 }}>
      {groups.map(({ date, items }) => (
        <View key={date.toISOString()} style={{ gap: 10 }}>
          <Text style={styles.dateHeader}>
            {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </Text>
          {items.map((u) => {
            const isMovie = u.kind === "movie";
            const isGame = u.kind === "game";
            return (
              <Pressable
                key={u.id}
                style={styles.card}
                onPress={() =>
                  router.push(isGame ? `/game/${u.id}` : isMovie ? `/movie/${u.id}` : `/series/${u.id}`)
                }
              >
                <MediaArtwork
                  path={u.posterPath}
                  uri={u.imageUrl}
                  size="w185"
                  color={u.artworkColor}
                  radius={radius.sm}
                  style={{ width: 48, height: 68 }}
                />
                <View>
                  <Text style={styles.cardTitle}>{u.seriesTitle}</Text>
                  <Text style={styles.cardMeta}>
                    {isGame
                      ? "🎮 Game release"
                      : isMovie
                      ? "Movie release"
                      : `S${String(u.season).padStart(2, "0")}E${String(u.episode).padStart(2, "0")}`}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export default function Upcoming() {
  const router = useRouter();
  const { data: watchUpcoming = [] } = useUpcoming();
  // Followed games with a future release join the same calendar (🎮).
  const tracks = useTracks();
  const [kindFilter, setKindFilter] = useState<"all" | "watch" | "play">("all");
  const { data: myGames = [] } = useMyGames(tracks.play);
  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const games: UpcomingEpisode[] = myGames
      .filter((g) => g.releaseDate && g.releaseDate > today && g.status)
      .map((g) => ({
        id: g.id,
        seriesTitle: g.title,
        kind: "game",
        airDate: g.releaseDate!,
        artworkColor: theme.surfaceSecondary,
        imageUrl: igdbImageUrl(g.coverImageId, "t_cover_small"),
      }));
    // "Both" accounts can narrow the shared calendar to one world.
    const showWatch = tracks.watch && kindFilter !== "play";
    const showPlay = kindFilter !== "watch";
    return [...(showWatch ? watchUpcoming : []), ...(showPlay ? games : [])].sort((a, b) =>
      a.airDate.localeCompare(b.airDate)
    );
  }, [watchUpcoming, myGames, tracks.watch, kindFilter]);
  const [viewMode, setViewMode] = useState<"list" | "month">("list");
  const today = useMemo(() => new Date(), []);
  const [monthCursor, setMonthCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  // Shared across List and Month views — tapping a date/day in either view
  // filters the visible upcoming list to just that date's release(s).
  // Tapping the same date again (or "Show all") clears it.
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const upcomingDates = useMemo(
    () =>
      upcoming
        .map((u) => ({ u, date: parseAirDate(u.airDate, monthCursor.year) }))
        .filter((x): x is { u: UpcomingEpisode; date: Date } => !!x.date),
    [upcoming, monthCursor.year]
  );

  const weekDates = useMemo(() => buildWeekDates(today), [today]);
  const monthGrid = useMemo(() => buildMonthGrid(monthCursor.year, monthCursor.month), [monthCursor]);

  const hasEntryOn = (d: Date) => upcomingDates.some(({ date }) => sameDay(date, d));

  const toggleSelectedDate = (d: Date) => {
    setSelectedDate((prev) => (prev && sameDay(prev, d) ? null : d));
  };

  // Real-date grouping of upcomingDates (parsed via UpcomingEpisode.airDate),
  // filtered to selectedDate when one is set, sorted chronologically. Entries
  // that couldn't be confidently parsed to a real date (see parseAirDate) are
  // simply not shown grouped — there's no calendar day to attach them to.
  const groupedByDate = useMemo(() => {
    const filtered = selectedDate
      ? upcomingDates.filter(({ date }) => sameDay(date, selectedDate))
      : upcomingDates;
    const map = new Map<string, { date: Date; items: UpcomingEpisode[] }>();
    for (const { u, date } of filtered) {
      const key = date.toDateString();
      const existing = map.get(key);
      if (existing) existing.items.push(u);
      else map.set(key, { date, items: [u] });
    }
    return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [upcomingDates, selectedDate]);

  const goPrevMonth = () =>
    setMonthCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }));
  const goNextMonth = () =>
    setMonthCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }));

  // The old subtitle printed the total count as "N episodes in the next 7
  // days", counting movie releases and anything months away.
  const weekAhead = Date.now() + 7 * 86400000;
  const thisWeek = upcoming.filter((u) => {
    const t = new Date(u.airDate).getTime();
    return !isNaN(t) && t <= weekAhead;
  }).length;
  const subtitle =
    upcoming.length === 0
      ? "Nothing scheduled yet"
      : `${thisWeek} in the next 7 days · ${upcoming.length} coming up`;

  return (
    <Screen>
      <View>
        <Text style={styles.title}>Upcoming</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.toggleRow}>
        <Chip label="List" selected={viewMode === "list"} onPress={() => setViewMode("list")} />
        <Chip label="Month" selected={viewMode === "month"} onPress={() => setViewMode("month")} />
      </View>

      {tracks.play && tracks.watch ? (
        <View style={styles.toggleRow}>
          <Chip label="All" selected={kindFilter === "all"} onPress={() => setKindFilter("all")} />
          <Chip label="🎬 Episodes & movies" selected={kindFilter === "watch"} onPress={() => setKindFilter("watch")} />
          <Chip label="🎮 Games" selected={kindFilter === "play"} onPress={() => setKindFilter("play")} />
        </View>
      ) : null}

      {viewMode === "list" ? (
        <>
          <View style={styles.dayStrip}>
            {weekDates.map((d) => {
              const active = selectedDate ? sameDay(d, selectedDate) : sameDay(d, today);
              return (
                <Pressable key={d.toISOString()} style={styles.day} onPress={() => toggleSelectedDate(d)}>
                  <Text style={[styles.dayLabel, active && styles.dayLabelSelected]}>{WEEKDAY_LABELS[d.getDay()]}</Text>
                  {/* Selected day: red circle (was a red rounded square). */}
                  <View style={[styles.dayCircle, active && styles.dayActive]}>
                    <Text style={[styles.dayNum, active && styles.dayLabelActive]}>{d.getDate()}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {selectedDate ? (
            <Pressable onPress={() => setSelectedDate(null)}>
              <Text style={styles.showAll}>Show all</Text>
            </Pressable>
          ) : null}

          {upcoming.length === 0 ? (
            <EmptyState title="Nothing upcoming" subtitle="Everything you follow is up to date." />
          ) : (
            <DateGroups groups={groupedByDate} router={router} />
          )}
        </>
      ) : (
        <View style={{ gap: 12 }}>
          <View style={styles.monthHeader}>
            <Pressable onPress={goPrevMonth} style={styles.monthNavBtn}>
              <Text style={styles.monthNavLabel}>‹</Text>
            </Pressable>
            <Text style={styles.monthLabel}>
              {MONTH_NAMES[monthCursor.month]} {monthCursor.year}
            </Text>
            <Pressable onPress={goNextMonth} style={styles.monthNavBtn}>
              <Text style={styles.monthNavLabel}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekHeaderRow}>
            {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((w) => (
              <Text key={w} style={styles.weekHeaderLabel}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.monthGrid}>
            {monthGrid.map((d, i) => {
              if (!d) return <View key={i} style={styles.monthCell} />;
              const hasDot = hasEntryOn(d);
              const active = selectedDate ? sameDay(d, selectedDate) : sameDay(d, today);
              return (
                <Pressable
                  key={i}
                  style={styles.monthCell}
                  onPress={() => {
                    if (hasDot) toggleSelectedDate(d);
                  }}
                >
                  <View style={[styles.monthCellInner, active && styles.monthCellActive]}>
                    <Text style={[styles.monthCellLabel, active && styles.monthCellLabelActive]}>{d.getDate()}</Text>
                    {hasDot ? <View style={[styles.monthDot, active && styles.monthDotActive]} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {selectedDate ? (
            <>
              <Pressable onPress={() => setSelectedDate(null)}>
                <Text style={styles.showAll}>Show all</Text>
              </Pressable>
              <DateGroups groups={groupedByDate} router={router} />
            </>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: "ArchivoBlack_400Regular", color: theme.textPrimary, fontSize: 20 },
  subtitle: { color: theme.textTertiary, fontSize: 12, marginTop: 2 },
  toggleRow: { flexDirection: "row", gap: 8 },
  // Seven equal columns so the whole week fits any phone width (fixed 44px
  // cells used to overflow and cut off Saturday on narrow screens).
  dayStrip: { flexDirection: "row" },
  day: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 4 },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  dayActive: { backgroundColor: theme.brandPrimary },
  dayLabelSelected: { color: theme.brandPrimary, fontWeight: "700" },
  dayLabel: { fontSize: 10, color: theme.textSecondary },
  dayNum: { fontSize: 15, fontWeight: "700", color: theme.textSecondary },
  dayLabelActive: { color: theme.textInverse },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.md,
    padding: 12,
  },
  cardTitle: { color: theme.textPrimary, fontSize: 14, fontWeight: "700" },
  cardMeta: { color: theme.textTertiary, fontSize: 12 },
  dateHeader: { color: theme.textSecondary, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  showAll: { color: theme.brandPrimary, fontSize: 13, fontWeight: "700" },
  monthHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surfaceSecondary,
  },
  monthNavLabel: { color: theme.textPrimary, fontSize: 16, lineHeight: 16, textAlign: "center", marginTop: -1 },
  monthLabel: { color: theme.textPrimary, fontSize: 15, fontWeight: "700" },
  weekHeaderRow: { flexDirection: "row" },
  weekHeaderLabel: { flex: 1, textAlign: "center", color: theme.textTertiary, fontSize: 10, fontWeight: "700" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap" },
  monthCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  monthCellInner: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 2 },
  monthCellActive: { backgroundColor: theme.brandPrimary },
  monthCellLabel: { color: theme.textSecondary, fontSize: 12 },
  monthCellLabelActive: { color: theme.textInverse, fontWeight: "700" },
  monthDot: { position: "absolute", bottom: 2, width: 4, height: 4, borderRadius: 2, backgroundColor: theme.brandPrimary },
  monthDotActive: { backgroundColor: theme.textInverse },
});
