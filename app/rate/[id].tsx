import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { goBack } from "@/lib/navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet, Button, Chip, Input, MediaArtwork, radius, theme } from "@/design-system";
import { useMediaDetail, useSetWatchStatus } from "@/hooks/useMedia";
import { mediaRepository, trackingRepository } from "@/data/repositories";
import { useQueryClient } from "@tanstack/react-query";

const REACTIONS = ["Loved it", "It was fine", "Disappointed"];

export default function PostWatchRating() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { data: media } = useMediaDetail(id);
  const setWatchStatus = useSetWatchStatus();
  const [rating, setRating] = useState(0);
  const [reaction, setReaction] = useState(REACTIONS[0]);
  const [note, setNote] = useState("");

  if (!media) return null;

  // Marking watched from here must also log the watch — otherwise the movie
  // never reached history, so weekly "2 movies" challenges didn't count it.
  const markWatched = () => {
    const alreadyWatched = media.status === "watched";
    setWatchStatus.mutate({ mediaId: media.id, status: "watched" });
    if (!alreadyWatched && media.kind === "movie") {
      trackingRepository
        .logWatch(media.title, { mediaId: media.id })
        .finally(() => {
          qc.invalidateQueries({ queryKey: ["history"] });
          qc.invalidateQueries({ queryKey: ["profile"] });
        });
    }
  };

  const save = async () => {
    if (rating > 0) await mediaRepository.setUserRating(media.id, rating);
    markWatched();
    qc.invalidateQueries({ queryKey: ["media"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
    goBack(router);
  };

  // "Skip" explicitly saves the watched status without touching the rating
  // at all — distinct from tapping Save with no stars selected, which the
  // old flow made indistinguishable from "rated 0".
  const skip = () => {
    markWatched();
    qc.invalidateQueries({ queryKey: ["media"] });
    goBack(router);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "rgba(4,7,12,0.7)", justifyContent: "flex-end" }}>
      <View style={{ paddingBottom: insets.bottom }}>
        <BottomSheet>
          <View style={styles.header}>
            <MediaArtwork path={media.posterPath} size="w185" color={media.artworkColor} radius={radius.sm} style={styles.artwork} />
            <View>
              <Text style={styles.title}>{media.title}</Text>
              <Text style={styles.subtitle}>Marked as watched</Text>
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={styles.label}>Your Rating</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Pressable
                  key={i}
                  onPress={() => setRating(i + 1)}
                  style={[
                    styles.box,
                    { backgroundColor: i < rating ? theme.brandPrimary : "transparent" },
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={styles.label}>Quick Reaction</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {REACTIONS.map((r) => (
                <Chip key={r} label={r} selected={reaction === r} onPress={() => setReaction(r)} />
              ))}
            </View>
          </View>

          <Input placeholder="Add a personal note..." value={note} onChangeText={setNote} />

          <Button fullWidth onPress={save}>
            Save
          </Button>
          <Pressable onPress={skip} style={{ alignItems: "center", paddingVertical: 4 }}>
            <Text style={styles.skip}>Skip rating</Text>
          </Pressable>
        </BottomSheet>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skip: { color: theme.textTertiary, fontSize: 13, fontWeight: "600" },
  header: { flexDirection: "row", gap: 12, alignItems: "center" },
  artwork: { width: 56, height: 80 },
  title: { color: theme.textPrimary, fontSize: 16, fontWeight: "700" },
  subtitle: { color: theme.brandPrimary, fontSize: 12, fontWeight: "600" },
  label: { fontSize: 10, letterSpacing: 0.7, fontWeight: "700", color: theme.textTertiary, textTransform: "uppercase" },
  box: { width: 34, height: 34, borderRadius: 6, borderWidth: 1.5, borderColor: theme.rating },
});
