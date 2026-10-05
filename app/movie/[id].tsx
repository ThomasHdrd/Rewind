import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { goBack } from "@/lib/navigation";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Button, MediaArtwork, PosterCard, Rating, radius, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { LoadingScreen } from "@/components/LoadingScreen";
import { SectionLabel } from "@/components/SectionLabel";
import { HScroll } from "@/components/HScroll";
import { CommentsSection } from "@/components/CommentsSection";
import { isAired } from "@/domain/watchStatus";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFavorites, useMediaDetail, usePlatformIds, useRecommendations, useSetUserRating, useSetWatchStatus, useToggleFavorite } from "@/hooks/useMedia";
import { trackingRepository } from "@/data/repositories";
import { useQueryClient } from "@tanstack/react-query";
import { useToastStore } from "@/state/toastStore";
import { communityScore, rewindRatingFootnote } from "@/lib/statistics";
import { tmdbImageUrl } from "@/lib/tmdb";
import { showtimesUrl, watchProviderTitleUrl } from "@/lib/watchProviders";

function formatExactDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function MovieDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: media } = useMediaDetail(id);
  // Direct product-page links (Netflix/Prime/… title pages) for Where to watch.
  const { data: platformIds } = usePlatformIds(media);
  const { data: similar = [] } = useRecommendations(id);
  const { data: favorites = [] } = useFavorites();
  const qc = useQueryClient();
  const setWatchStatus = useSetWatchStatus();
  const toggleFavorite = useToggleFavorite();
  const setUserRating = useSetUserRating();
  const showToast = useToastStore((s) => s.show);

  if (!media) return <LoadingScreen />;
  const userRating = media.userRating ?? 0;

  const favorited = favorites.some((m) => m.id === media.id);

  return (
    <Screen scroll edges={["bottom"]} contentStyle={{ padding: 0, paddingBottom: 110, gap: 0 }}>
      <View style={styles.backdrop}>
        <MediaArtwork path={media.backdropPath} size="w780" color={media.artworkColor} style={{ width: "100%", height: "100%" }} />
        <LinearGradient
          colors={["rgba(0,0,0,0.1)", "transparent", theme.bgPrimary]}
          locations={[0, 0.35, 1]}
          style={StyleSheet.absoluteFill}
        />
        {/* Below the status bar (safe-area inset), smaller so they sit on the
            backdrop instead of crowding the top edge. */}
        <Pressable
          onPress={() => goBack(router)}
          style={[styles.backBtn, { top: insets.top + 10 }]}
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={16} color={theme.textPrimary} />
        </Pressable>
        {media.trailerKey ? (
          <Pressable
            style={[styles.trailer, { top: insets.top + 10 }]}
            onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${media.trailerKey}`)}
          >
            <Text style={styles.trailerLabel}>▶ Trailer</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <MediaArtwork path={media.posterPath} size="w342" color={media.artworkColor} radius={radius.md} style={styles.poster} />
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
              if (next && !isAired(media.releaseDate)) {
                showToast("This movie isn't out yet");
                return;
              }
              // Status flips instantly (optimistic mutation); the history
              // entry is written in the background — no waiting on it.
              setWatchStatus.mutate({ mediaId: media.id, status: next });
              const refresh = () => {
                qc.invalidateQueries({ queryKey: ["history"] });
                qc.invalidateQueries({ queryKey: ["profile"] });
              };
              if (next) {
                showToast("Movie completed", {
                  actionLabel: "Rate",
                  onAction: () => router.push(`/rate/${media.id}`),
                });
                trackingRepository.logWatch(media.title, { mediaId: media.id }).then(refresh, refresh);
                return;
              }
              showToast("Removed from watched");
              trackingRepository.removeWatch({ mediaId: media.id }, [media.title]).then(refresh, refresh);
            }}
          >
            {media.status === "watched" ? "✓ Watched" : "Mark Watched"}
          </Button>
          {/* Outline when not a favorite, filled coral pill when it is — the
              old always-filled glyph only changed tint and read the same both ways. */}
          <Pressable
            style={[styles.heart, favorited && styles.heartActive]}
            accessibilityRole="button"
            accessibilityLabel={favorited ? "Remove from favorites" : "Add to favorites"}
            accessibilityState={{ selected: favorited }}
            onPress={() => {
              toggleFavorite.mutate(media.id);
              showToast(favorited ? "Removed from favorites" : "Added to favorites");
            }}
          >
            <Ionicons
              name={favorited ? "heart" : "heart-outline"}
              size={20}
              color={favorited ? theme.textInverse : theme.textSecondary}
            />
          </Pressable>
        </View>

        {media.synopsis ? <Text style={styles.synopsis}>{media.synopsis}</Text> : null}

        <View style={{ gap: 10 }}>
          <SectionLabel>Where to watch</SectionLabel>
          {(media.watchProviders ?? []).map((p) => {
            const platformUrl = watchProviderTitleUrl(p.providerName, media.title, media.watchProvidersLink, platformIds, "movie");
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
          {/* Only while actually showing in cinemas (TMDB FR theatrical date
              within the last 8 weeks) — previously two hardcoded, unclickable
              chain rows showed on every movie. */}
          {media.inTheaters ? (
            <Pressable style={styles.watchRow} onPress={() => Linking.openURL(showtimesUrl(media.title))}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name="film-outline" size={22} color={theme.textSecondary} />
                <Text style={styles.watchProvider}>In cinemas now</Text>
              </View>
              <Text style={styles.watchAction}>Showtimes ↗</Text>
            </Pressable>
          ) : null}
          {/* inTheaters is only set by the full detail fetch — undefined
              means the instant placeholder is showing, so don't claim
              "not available" before providers have actually loaded. */}
          {media.inTheaters !== undefined && (media.watchProviders ?? []).length === 0 && !media.inTheaters ? (
            <Text style={styles.watchEmpty}>Not on any streaming subscription right now.</Text>
          ) : null}
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
            <Rating
              mode="community"
              value={communityScore(media).value}
              count={communityScore(media).count}
              footnote={rewindRatingFootnote(media)}
            />
          </View>
          <View style={styles.ratingCard}>
            <Rating
              mode="user"
              value={userRating}
              interactive
              onChange={(rating) => {
                setUserRating.mutate({ mediaId: media.id, rating });
                showToast(rating ? "Rating saved" : "Rating removed");
              }}
            />
          </View>
        </View>

        <CommentsSection targetId={media.id} />

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
    left: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0008",
    alignItems: "center",
    justifyContent: "center",
  },
  trailer: {
    position: "absolute",
    right: 14,
    backgroundColor: "#000a",
    borderRadius: radius.full,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  trailerLabel: { color: theme.textPrimary, fontSize: 11, fontWeight: "700" },
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
  heartActive: { backgroundColor: theme.brandPrimary, borderColor: theme.brandPrimary },
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
  watchEmpty: { color: theme.textTertiary, fontSize: 13 },
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
