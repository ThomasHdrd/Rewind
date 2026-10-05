import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Chip, theme } from "@/design-system";
import { ALL_GENRES } from "@/lib/genres";
import { KNOWN_PLATFORMS } from "@/lib/platforms";
import { ALL_GAME_GENRES, KNOWN_CONSOLES, isGamesConfigured } from "@/lib/games";
import { UserPreferences } from "@/data/repositories/firestoreUser";

const MIN_GENRES = 3;
type Tracks = "watch" | "play" | "both";
const TRACK_OPTIONS: { value: Tracks; label: string }[] = [
  { value: "watch", label: "🎬 Movies & series" },
  { value: "play", label: "🎮 Video games" },
  { value: "both", label: "✨ Both" },
];

// Genre + platform picker shared by onboarding (step 2) and Settings →
// Preferences. Nothing is preselected for a new account: `initial` is only
// the user's own previously saved answers.
export function PreferencesForm({
  initial,
  genresSubtitle,
  submitLabel,
  submitting,
  onSubmit,
}: {
  initial?: UserPreferences;
  genresSubtitle: string;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (preferences: UserPreferences) => void;
}) {
  const [genres, setGenres] = useState(() => new Set(initial?.genres ?? []));
  const [platforms, setPlatforms] = useState(() => new Set(initial?.platforms ?? []));
  // Games are opt-in, and only offered once the games API is live.
  const [tracks, setTracks] = useState<Tracks>(initial?.tracks ?? "watch");
  const [gameGenres, setGameGenres] = useState(() => new Set(initial?.gameGenres ?? []));
  const [consoles, setConsoles] = useState(() => new Set(initial?.consoles ?? []));
  const wantsWatch = tracks !== "play";
  const wantsPlay = tracks !== "watch";

  const toggleIn = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (value: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  const toggleGenre = toggleIn(setGenres);
  const togglePlatform = toggleIn(setPlatforms);
  const toggleGameGenre = toggleIn(setGameGenres);
  const toggleConsole = toggleIn(setConsoles);
  // Movie genres are only required when movies/series are tracked.
  const missing = wantsWatch ? Math.max(0, MIN_GENRES - genres.size) : 0;

  return (
    <>
      {isGamesConfigured ? (
        <>
          <View>
            <Text style={styles.title}>What do you want to track?</Text>
            <Text style={styles.subtitle}>You can change this anytime in Settings</Text>
          </View>
          <View style={styles.wrap}>
            {TRACK_OPTIONS.map((o) => (
              <Chip key={o.value} label={o.label} selected={tracks === o.value} onPress={() => setTracks(o.value)} />
            ))}
          </View>
        </>
      ) : null}
      {wantsWatch ? (
        <>
          <View>
            <Text style={styles.title}>Your favorite genres</Text>
            <Text style={styles.subtitle}>{genresSubtitle}</Text>
          </View>
          <View style={styles.wrap}>
            {ALL_GENRES.map((g) => (
              <Chip key={g} label={g} selected={genres.has(g)} onPress={() => toggleGenre(g)} />
            ))}
          </View>
          <View>
            <Text style={styles.title}>Your platforms</Text>
            <Text style={styles.subtitle}>Optional · your recommendations will only show what's on them</Text>
          </View>
          <View style={styles.wrap}>
            {KNOWN_PLATFORMS.map((p) => (
              <Chip key={p} label={p} selected={platforms.has(p)} onPress={() => togglePlatform(p)} />
            ))}
          </View>
        </>
      ) : null}
      {wantsPlay && isGamesConfigured ? (
        <>
          <View>
            <Text style={styles.title}>Games you like</Text>
            <Text style={styles.subtitle}>Optional · shapes your game picks</Text>
          </View>
          <View style={styles.wrap}>
            {ALL_GAME_GENRES.map((g) => (
              <Chip key={g} label={g} selected={gameGenres.has(g)} onPress={() => toggleGameGenre(g)} />
            ))}
          </View>
          <View>
            <Text style={styles.title}>Where you play</Text>
            <Text style={styles.subtitle}>Optional · your consoles</Text>
          </View>
          <View style={styles.wrap}>
            {KNOWN_CONSOLES.map((c) => (
              <Chip key={c} label={c} selected={consoles.has(c)} onPress={() => toggleConsole(c)} />
            ))}
          </View>
        </>
      ) : null}
      <Button
        fullWidth
        disabled={missing > 0}
        loading={submitting}
        onPress={() =>
          onSubmit({
            genres: Array.from(genres),
            platforms: Array.from(platforms),
            tracks,
            gameGenres: Array.from(gameGenres),
            consoles: Array.from(consoles),
          })
        }
      >
        {missing > 0 ? `Pick ${missing} more genre${missing > 1 ? "s" : ""}` : submitLabel}
      </Button>
    </>
  );
}

const styles = StyleSheet.create({
  title: { color: theme.textPrimary, fontSize: 20, fontWeight: "700" },
  subtitle: { color: theme.textTertiary, fontSize: 12, marginTop: 4 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
