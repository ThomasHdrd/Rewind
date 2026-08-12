import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Button, MediaArtwork, PosterCard, Rating, radius, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { SectionLabel } from "@/components/SectionLabel";
import { HScroll } from "@/components/HScroll";
import { useFavorites, useMediaDetail, useRecommendations, useSetUserRating, useSetWatchStatus, useToggleFavorite } from "@/hooks/useMedia";
import { trackingRepository } from "@/data/repositories";
import { useQueryClient } from "@tanstack/react-query";
import { useToastStore } from "@/state/toastStore";
import { tmdbImageUrl } from "@/lib/tmdb";
import { watchProviderUrl } from "@/lib/watchProviders";

function formatExactDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function MovieDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: media } = useMediaDetail(id);
  const { data: similar = [] } = useRecommendations(id);
  const { data: favorites = [] } = useFavorites();
  const qc = useQueryClient();
  const setWatchStatus = useSetWatchStatus();
  const toggleFavorite = useToggleFavorite();
  const setUserRating = useSetUserRating();
  const showToast = useToastStore((s) => s.show);

  if (!media) return null;
  const userRating = media.userRating ?? 0;

  const favorited = favorites.some((m) => m.id === media.id);

  return (
    <Screen scroll edges={["bottom"]} contentStyle={{ padding: 0, paddingBottom: 110, gap: 0 }}>
      <View style={styles.backdrop}>
        <MediaArtwork path={media.backdropPath} size="original" color={media.artworkColor} style={{ width: "100%", height: "100%" }} />
        <LinearGradient
          colors={["rgba(0,0,0,0.1)", "transparent", theme.bgPrimary]}
          locations={[0, 0.35, 1]}
          style={StyleSheet.absoluteFill}
        />
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ color: theme.textPrimary, fontSize: 16, lineHeight: 16, textAlign: "center", marginTop: -1 }}>‹</Text>
        </Pressable>
        {media.trailerKey ? (
          <Pressable
            style={styles.trailer}
            onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${media.trailerKey}`)}
          >
            <Text style={{ color: theme.textPrimary, fontSize: 12, fontWeight: "700" }}>▶ Trailer</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <MediaArtwork path={media.posterPath} color={media.artworkColor} radius={radius.md} style={styles.poster} />
          <View style={styles.headerText}>
            <Text style={styles.title}>{media.title}</Text>
            <Text style={styles.meta}>
              {formatExactDate(media.releaseDate) ?? media.year} ·{" "}
              {media.runtimeMinutes ? `${Math.floor(media.runtimeMinutes / 60)}h ${media.runtimeMinutes % 60}m · ` : ""}
              {media.genres.join(", ")}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Button
            variant={media.status === "watchlist" ? "primary" : "secondary"}
            style={{ flex: 1 }}
            onPress={() => {
              const next = media.status === "watchlist" ? null : "watchlist";
              setWatchStatus.mutate({ mediaId: media.id, status: next });
              showToast(next ? "Added to watchlist" : "Removed from watchlist");
            }}
          >
            {media.status === "watchlist" ? "✓ In Watchlist" : "+ Watchlist"}
          </Button>
          <Button
            variant={media.status === "watched" ? "primary" : "secondary"}
            style={{ flex: 1 }}
            onPress={async () => {
              const next = media.status === "watched" ? null : "watched";
              setWatchStatus.mutate({ mediaId: media.id, status: next });
              if (next) {
                await trackingRepository.logWatch(media.title);
                qc.invalidateQueries({ queryKey: ["history"] });
                showToast("Movie completed", {
                  actionLabel: "Rate",
                  onAction: () => router.push(`/rate/${media.id}`),
                });
                return;
              }
              showToast(next ? "Marked as watched" : "Removed from watched");
            }}
          >
            {media.status === "watched" ? "✓ Watched" : "Mark Watched"}
          </Button>
          <Pressable
            style={styles.heart}
            onPress={() => {
              toggleFavorite.mutate(media.id);
              showToast(favorited ? "Removed from favorites" : "Added to favorites");
            }}
          >
            <Text style={{ color: favorited ? theme.brandPrimary : theme.textSecondary }}>♥</Text>
          </Pressable>
        </View>

        {media.synopsis ? <Text style={styles.synopsis}>{media.synopsis}</Text> : null}

        <View style={{ gap: 10 }}>
          <SectionLabel>Where to watch</SectionLabel>
          {(media.watchProviders ?? []).map((p) => {
            const platformUrl = watchProviderUrl(p.providerName) ?? media.watchProvidersLink;
            return (
            <Pressable
              key={p.providerName}
              style={styles.watchRow}
              disabled={!platformUrl}
              onPress={() => platformUrl && Linking.openURL(platformUrl)}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                {p.logoPath ? (
                  <Image
                    source={{ uri: tmdbImageUrl(p.logoPath, "w92") }}
                    style={{ width: 28, height: 28, borderRadius: 6 }}
                  />
                ) : null}
                <Text style={styles.watchProvider}>{p.providerName}</Text>
              </View>
              <Ionicons name="open-outline" size={16} color={theme.textTertiary} />
            </Pressable>
            );
          })}
          <View style={styles.watchRow}>
            <Text style={styles.watchProvider}>CGR Cinémas</Text>
            <Text style={styles.watchAction}>Book tickets ↗</Text>
          </View>
          <View style={styles.watchRow}>
            <Text style={styles.watchProvider}>Pathé Gaumont</Text>
            <Text style={styles.watchAction}>Book tickets ↗</Text>
          </View>
        </View>

        {(media.cast ?? []).length > 0 ? (
          <View style={{ gap: 10 }}>
            <SectionLabel>Cast</SectionLabel>
            <HScroll>
              {(media.cast ?? []).map((c) => (
                <View key={c.id} style={{ alignItems: "center", gap: 6 }}>
                  <Avatar name={c.name} size={48} imageUrl={tmdbImageUrl(c.profilePath, "w185")} />
                  <Text style={styles.castName}>{c.name}</Text>
                </View>
              ))}
            </HScroll>
          </View>
        ) : null}

        <View style={styles.ratingRow}>
          <View style={styles.ratingCard}>
            <Rating mode="community" value={media.communityRating ?? 0} count={media.ratingCount} />
          </View>
          <View style={styles.ratingCard}>
            <Rating
              mode="user"
              value={userRating}
              interactive
              onChange={(rating) => {
                setUserRating.mutate({ mediaId: media.id, rating });
                showToast("Rating saved");
              }}
            />
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <SectionLabel>Similar Content</SectionLabel>
          <HScroll>
            {similar
              .filter((m) => m.id !== media.id)
              .map((m) => (
                <Pressable key={m.id} onPress={() => router.push(`/movie/${m.id}`)}>
                  <PosterCard artworkColor={m.artworkColor} posterPath={m.posterPath} width={110} />
                </Pressable>
              ))}
          </HScroll>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backdrop: { height: 200, position: "relative" },
  backBtn: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0007",
    alignItems: "center",
    justifyContent: "center",
  },
  trailer: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#000c",
    borderRadius: radius.full,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  body: { padding: 20, gap: 20 },
  headerRow: { flexDirection: "row", gap: 12, marginTop: -46, alignItems: "flex-start" },
  poster: { width: 100, height: 148, borderWidth: 2, borderColor: theme.bgPrimary },
  headerText: { paddingTop: 56, gap: 2, flex: 1, flexShrink: 1 },
  title: { color: theme.textPrimary, fontSize: 20, fontWeight: "800" },
  meta: { color: theme.textTertiary, fontSize: 12 },
  actionRow: { flexDirection: "row", gap: 8 },
  heart: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    alignItems: "center",
    justifyContent: "center",
  },
  synopsis: { color: theme.textSecondary, fontSize: 13, lineHeight: 21 },
  watchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.sm,
    padding: 14,
  },
  watchProvider: { color: theme.textPrimary, fontSize: 13, fontWeight: "600" },
  watchAction: { color: theme.brandPrimary, fontSize: 12, fontWeight: "700" },
  castName: { color: theme.textTertiary, fontSize: 10 },
  ratingRow: { flexDirection: "row", gap: 10 },
  ratingCard: {
    flex: 1,
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    borderRadius: radius.sm,
    padding: 12,
  },
});
