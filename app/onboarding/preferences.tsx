import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Chip, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { useAuthStore } from "@/state/authStore";
import { ALL_GENRES } from "@/lib/genres";
import { KNOWN_PLATFORMS } from "@/lib/platforms";

export default function Preferences() {
  const router = useRouter();
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const [genres, setGenres] = useState(new Set(["Action", "Sci-Fi", "Comedy"]));
  const [platforms, setPlatforms] = useState(new Set<string>());

  const toggle = (g: string) => {
    setGenres((prev) => {
      const next = new Set(prev);
      if (next.has(g)) {
        next.delete(g);
      } else {
        next.add(g);
      }
      return next;
    });
  };

  const togglePlatform = (p: string) => {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const finish = async () => {
    await completeOnboarding();
    // First-time completion lands on Discover (not Home) — a brand-new user
    // has nothing followed/watched yet, so Discover is where they'd start.
    // Returning sessions still land on Home via AuthGate in app/_layout.tsx.
    router.replace("/discover");
  };

  return (
    <Screen>
      <View>
        <Text style={styles.title}>Your favorite genres</Text>
        <Text style={styles.subtitle}>Pick at least 3 · step 2 of 3</Text>
      </View>
      <View style={styles.wrap}>
        {ALL_GENRES.map((g) => (
          <Chip key={g} label={g} selected={genres.has(g)} onPress={() => toggle(g)} />
        ))}
      </View>
      <View>
        <Text style={styles.title}>Your platforms</Text>
        <Text style={styles.subtitle}>To sharpen your recommendations</Text>
      </View>
      <View style={styles.wrap}>
        {KNOWN_PLATFORMS.map((p) => (
          <Chip key={p} label={p} selected={platforms.has(p)} onPress={() => togglePlatform(p)} />
        ))}
      </View>
      <Button fullWidth disabled={genres.size < 3} onPress={finish}>
        Continue
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: theme.textPrimary, fontSize: 20, fontWeight: "700" },
  subtitle: { color: theme.textTertiary, fontSize: 12, marginTop: 4 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
