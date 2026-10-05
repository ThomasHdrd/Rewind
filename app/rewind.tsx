import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, MediaArtwork, Skeleton, color, font, theme } from "@/design-system";
import { useRewind } from "@/hooks/useMedia";
import { useToastStore } from "@/state/toastStore";
import { RewindData, RewindTitle } from "@/lib/rewind";

// Full-screen, story-style yearly recap (à la Spotify Wrapped). Tap right /
// left to move between slides, hold to pause; slides auto-advance except the
// last one (the shareable summary).
const SLIDE_MS = 6500;

type Slide = { key: string; colors: [string, string, ...string[]]; render: () => React.ReactNode };

const formatHours = (minutes: number) => Math.round(minutes / 60).toLocaleString("en-US");

export default function RewindScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { year: yearParam } = useLocalSearchParams<{ year?: string }>();
  const year = Number(yearParam) || new Date().getFullYear();
  const { data, isLoading, isError, refetch } = useRewind(year);
  const showToast = useToastStore((s) => s.show);

  const close = useCallback(() => (router.canGoBack() ? router.back() : router.replace("/profile")), [router]);

  const share = useCallback(async () => {
    if (!data) return;
    const lines = [
      `My ${data.year} Rewind 🎬`,
      `${formatHours(data.totalMinutes)}h watched · ${data.episodesCount} episodes · ${data.moviesCount} movies`,
      data.topSeries[0] ? `Top series: ${data.topSeries[0].title}` : null,
      data.topMovies[0] ? `Top movie: ${data.topMovies[0].title}` : null,
      data.topGenres[0] ? `Top genre: ${data.topGenres[0].label}` : null,
      data.persona ? `I'm ${data.persona.name}` : null,
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join("\n") });
    } catch {
      showToast("Sharing isn't available here");
    }
  }, [data, showToast]);

  const slides = useMemo(() => (data ? buildSlides(data, { onShare: share, onDone: close }) : []), [data, share, close]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const progressValue = useRef(0);
  useEffect(() => {
    const id = progress.addListener(({ value }) => (progressValue.current = value));
    return () => progress.removeListener(id);
  }, [progress]);

  const goTo = useCallback(
    (next: number) => {
      progress.stopAnimation();
      progress.setValue(0);
      progressValue.current = 0;
      setIndex(Math.max(0, Math.min(slides.length - 1, next)));
    },
    [progress, slides.length]
  );

  const isLast = index === slides.length - 1;
  useEffect(() => {
    if (paused || slides.length === 0 || isLast) return;
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: SLIDE_MS * (1 - progressValue.current),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => finished && goTo(index + 1));
    return () => anim.stop();
  }, [index, paused, isLast, slides.length, progress, goTo]);

  if (isLoading || isError || !data) {
    return (
      <LinearGradient colors={[color.ink950, color.ink850]} style={[styles.fill, styles.center, { padding: 32 }]}>
        {isError ? (
          <View style={{ gap: 16, alignItems: "center" }}>
            <Text style={styles.body}>Couldn't build your Rewind.</Text>
            <Button onPress={() => refetch()}>Retry</Button>
            <Button variant="secondary" onPress={close}>
              Close
            </Button>
          </View>
        ) : (
          <View style={{ gap: 14, alignItems: "center" }}>
            <Text style={styles.eyebrow}>REWINDING {year}…</Text>
            <Skeleton width={220} height={18} radius={9} />
            <Skeleton width={160} height={18} radius={9} />
          </View>
        )}
      </LinearGradient>
    );
  }

  const slide = slides[index];
  return (
    <LinearGradient colors={slide.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
      <Pressable
        style={[styles.fill, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 32 }]}
        delayLongPress={220}
        onLongPress={() => setPaused(true)}
        onPressOut={() => setPaused(false)}
        onPress={(e) => goTo(e.nativeEvent.pageX < width * 0.3 ? index - 1 : index + 1)}
      >
        <View key={slide.key} style={styles.slide}>
          {slide.render()}
        </View>
      </Pressable>

      <View style={[styles.topBar, { top: insets.top + 12 }]} pointerEvents="box-none">
        <View style={styles.bars}>
          {slides.map((s, i) => (
            <View key={s.key} style={styles.barTrack}>
              <Animated.View
                style={[
                  styles.barFill,
                  {
                    width:
                      i < index
                        ? "100%"
                        : i === index
                          ? isLast
                            ? "100%"
                            : progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] })
                          : "0%",
                  },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={styles.topRow}>
          <Text style={styles.brand}>REWIND {data.year}</Text>
          <Pressable onPress={close} hitSlop={12}>
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

function buildSlides(d: RewindData, actions: { onShare: () => void; onDone: () => void }): Slide[] {
  const slides: Slide[] = [];
  const soFar = d.isFinal ? "" : " so far";

  slides.push({
    key: "intro",
    colors: [color.coral600, color.purple500, color.ink950],
    render: () => (
      <View style={styles.centerBlock}>
        <Text style={styles.eyebrow}>YOUR YEAR IN FILM & TV</Text>
        <Text style={styles.giant}>{d.year}</Text>
        <Text style={styles.headline}>Rewind</Text>
        <Text style={styles.body}>
          {d.isFinal ? "Let's look back at everything you watched." : "Let's look back at your year so far."}
        </Text>
        <Text style={styles.hint}>Tap to continue</Text>
      </View>
    ),
  });

  const games = d.games;
  if (d.moviesCount + d.episodesCount === 0 && !games) {
    slides.push({
      key: "empty",
      colors: [color.ink850, color.ink950],
      render: () => (
        <View style={styles.centerBlock}>
          <Text style={styles.headline}>Nothing to rewind yet</Text>
          <Text style={styles.body}>
            Mark episodes and movies as watched during {d.year} and your Rewind will build itself.
          </Text>
          <Button onPress={actions.onDone}>Got it</Button>
        </View>
      ),
    });
    return slides;
  }

  slides.push({
    key: "time",
    colors: [color.blue500, color.ink850, color.ink950],
    render: () => (
      <View style={styles.block}>
        <Text style={styles.eyebrow}>THIS YEAR{soFar.toUpperCase()}, YOU SPENT</Text>
        <Text style={styles.giant}>{formatHours(d.totalMinutes)}</Text>
        <Text style={styles.headline}>hours watching</Text>
        <Text style={styles.body}>
          That's about {(d.totalMinutes / 1440).toFixed(1)} days of stories, across {d.titlesCount}{" "}
          {d.titlesCount === 1 ? "title" : "titles"}.
        </Text>
        <View style={styles.statRow}>
          <Stat value={d.episodesCount} label="episodes" />
          <Stat value={d.moviesCount} label="movies" />
        </View>
      </View>
    ),
  });

  if (d.topSeries.length > 0) {
    const [top, ...rest] = d.topSeries;
    slides.push({
      key: "series",
      colors: [color.coral500, color.coral700, color.ink950],
      render: () => (
        <View style={styles.block}>
          <Text style={styles.eyebrow}>YOUR #1 SERIES</Text>
          <View style={styles.heroRow}>
            <Poster item={top} width={120} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.titleXL} numberOfLines={3}>
                {top.title}
              </Text>
              <Text style={styles.body}>
                {top.count} {top.count === 1 ? "episode" : "episodes"}
              </Text>
            </View>
          </View>
          {rest.length > 0 ? <RankList items={rest} startAt={2} unit="ep" /> : null}
        </View>
      ),
    });
  }

  if (d.topMovies.length > 0) {
    slides.push({
      key: "movies",
      colors: [color.gold500, color.olive500, color.ink950],
      render: () => (
        <View style={styles.block}>
          <Text style={styles.eyebrow}>AT THE MOVIES</Text>
          <Text style={styles.headline}>
            {d.moviesCount} {d.moviesCount === 1 ? "movie" : "movies"}
            {soFar}
          </Text>
          <View style={styles.posterRow}>
            {d.topMovies.slice(0, 3).map((m) => (
              <View key={m.media?.id ?? m.title} style={{ width: 96, gap: 6 }}>
                <Poster item={m} width={96} />
                <Text style={styles.small} numberOfLines={2}>
                  {m.title}
                </Text>
                {m.userRating ? <Text style={styles.rating}>★ {m.userRating}</Text> : null}
              </View>
            ))}
          </View>
          {d.topMovies[0].userRating ? (
            <Text style={styles.body}>Your favorite: {d.topMovies[0].title}.</Text>
          ) : null}
        </View>
      ),
    });
  }

  if (d.topGenres.length > 0) {
    slides.push({
      key: "genres",
      colors: [color.purple500, color.ink800, color.ink950],
      render: () => (
        <View style={styles.block}>
          <Text style={styles.eyebrow}>YOUR TOP GENRES</Text>
          <Text style={styles.headline}>{d.topGenres[0].label} was your mood.</Text>
          <View style={{ gap: 16, marginTop: 8 }}>
            {d.topGenres.map((g, i) => (
              <View key={g.label} style={{ gap: 6 }}>
                <View style={styles.genreHeader}>
                  <Text style={styles.genreLabel}>
                    {i + 1}. {g.label}
                  </Text>
                  <Text style={styles.genreLabel}>{g.percent}%</Text>
                </View>
                <View style={styles.genreTrack}>
                  <View style={[styles.genreFill, { width: `${Math.max(4, g.percent)}%` }]} />
                </View>
              </View>
            ))}
          </View>
          {d.genresCount > 3 ? <Text style={styles.body}>…out of {d.genresCount} genres explored.</Text> : null}
        </View>
      ),
    });
  }

  slides.push({
    key: "rhythm",
    colors: [color.green500, color.ink800, color.ink950],
    render: () => (
      <View style={styles.block}>
        <Text style={styles.eyebrow}>YOUR WATCHING RHYTHM</Text>
        <View style={{ gap: 22 }}>
          {d.busiestMonth ? <Fact label="Busiest month" value={d.busiestMonth.name} /> : null}
          {d.favoriteDay ? <Fact label="Favorite day" value={`${d.favoriteDay}s`} /> : null}
          <Fact label="Longest streak" value={`${d.bestStreak} ${d.bestStreak === 1 ? "day" : "days"} in a row`} />
          {d.biggestBinge ? (
            <Fact
              label="Biggest binge"
              value={`${d.biggestBinge.episodes} episodes on ${d.biggestBinge.dateLabel}`}
              detail={d.biggestBinge.title}
            />
          ) : null}
        </View>
      </View>
    ),
  });

  // Games get their own slide (only when the user played that year).
  if (games) {
    slides.push({
      key: "games",
      colors: [color.purple500, color.blue500, color.ink950],
      render: () => (
        <View style={styles.block}>
          <Text style={styles.eyebrow}>🎮 YOUR YEAR IN GAMES</Text>
          <Text style={styles.giant}>{games.hours}</Text>
          <Text style={styles.headline}>hours played</Text>
          <Text style={styles.body}>
            {games.gamesPlayed} {games.gamesPlayed === 1 ? "game" : "games"} played · {games.finished} finished
          </Text>
          {games.topGame ? (
            <View style={styles.heroRow}>
              <MediaArtwork
                uri={games.topGame.coverUrl}
                color={color.ink700}
                radius={10}
                style={{ width: 90, height: 120 }}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.eyebrow}>GAME OF YOUR YEAR</Text>
                <Text style={styles.titleXL} numberOfLines={3}>
                  {games.topGame.title}
                </Text>
                <Text style={styles.body}>{games.topGame.hours} h</Text>
              </View>
            </View>
          ) : null}
        </View>
      ),
    });
  }

  if (d.persona) {
    const persona = d.persona;
    slides.push({
      key: "persona",
      colors: [color.coral500, color.purple500, color.blue500],
      render: () => (
        <View style={styles.centerBlock}>
          <Text style={styles.eyebrow}>YOUR VIEWER PERSONALITY</Text>
          <Text style={[styles.giant, { fontSize: 44, lineHeight: 50, textAlign: "center" }]}>{persona.name}</Text>
          <Text style={[styles.body, { textAlign: "center" }]}>{persona.tagline}</Text>
        </View>
      ),
    });
  }

  slides.push({
    key: "summary",
    colors: [color.ink800, color.ink950],
    render: () => (
      <View style={styles.block}>
        <View style={styles.card}>
          <LinearGradient
            colors={[color.coral500, color.purple500]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cardBand}
          >
            <Text style={styles.cardBandText}>MY {d.year} REWIND</Text>
          </LinearGradient>
          <View style={styles.cardGrid}>
            <Stat value={formatHours(d.totalMinutes)} label="hours" />
            <Stat value={d.episodesCount} label="episodes" />
            <Stat value={d.moviesCount} label="movies" />
          </View>
          <View style={{ gap: 12, paddingHorizontal: 18 }}>
            {d.topSeries[0] ? <Fact label="Top series" value={d.topSeries[0].title} compact /> : null}
            {d.topMovies[0] ? <Fact label="Top movie" value={d.topMovies[0].title} compact /> : null}
            {d.topGenres[0] ? <Fact label="Top genre" value={d.topGenres[0].label} compact /> : null}
            {d.persona ? <Fact label="Personality" value={d.persona.name} compact /> : null}
            {games ? <Fact label="Hours played" value={`${games.hours} h · ${games.finished} finished`} compact /> : null}
          </View>
        </View>
        <View style={{ gap: 10 }}>
          <Button fullWidth onPress={actions.onShare}>
            Share my Rewind
          </Button>
          <Button fullWidth variant="secondary" onPress={actions.onDone}>
            Done
          </Button>
        </View>
      </View>
    ),
  });

  // Games-only year: drop the watch slides that would just show zeros.
  if (d.moviesCount + d.episodesCount === 0) {
    return slides.filter((sl) => !["time", "rhythm", "persona"].includes(sl.key));
  }
  return slides;
}

function Poster({ item, width }: { item: RewindTitle; width: number }) {
  return (
    <MediaArtwork
      path={item.media?.posterPath}
      size="w342"
      color={item.media?.artworkColor ?? color.ink700}
      radius={10}
      style={{ width, height: width * 1.5 }}
    />
  );
}

function RankList({ items, startAt, unit }: { items: RewindTitle[]; startAt: number; unit: string }) {
  return (
    <View style={{ gap: 10 }}>
      {items.map((t, i) => (
        <View key={t.media?.id ?? t.title} style={styles.rankRow}>
          <Text style={styles.rankNum}>{startAt + i}</Text>
          <Poster item={t} width={34} />
          <Text style={styles.rankTitle} numberOfLines={1}>
            {t.title}
          </Text>
          <Text style={styles.small}>
            {t.count} {unit}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.small}>{label}</Text>
    </View>
  );
}

function Fact({ label, value, detail, compact }: { label: string; value: string; detail?: string; compact?: boolean }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.factLabel}>{label.toUpperCase()}</Text>
      <Text style={compact ? styles.factValueCompact : styles.factValue} numberOfLines={2}>
        {value}
      </Text>
      {detail ? <Text style={styles.small}>{detail}</Text> : null}
    </View>
  );
}

const white = color.white;
const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  slide: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
  block: { gap: 18 },
  centerBlock: { gap: 14, alignItems: "center" },
  topBar: { position: "absolute", left: 12, right: 12, gap: 10 },
  bars: { flexDirection: "row", gap: 4 },
  barTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)", overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: white },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4 },
  brand: { color: white, fontFamily: font.bodyExtraBold, fontSize: 12, letterSpacing: 2 },
  close: { color: white, fontSize: 28, lineHeight: 28 },
  eyebrow: { color: "rgba(255,255,255,0.85)", fontFamily: font.bodyExtraBold, fontSize: 12, letterSpacing: 1.6 },
  giant: { color: white, fontFamily: font.display, fontSize: 88, lineHeight: 92, letterSpacing: -2 },
  headline: { color: white, fontFamily: font.display, fontSize: 30, lineHeight: 36 },
  titleXL: { color: white, fontFamily: font.display, fontSize: 26, lineHeight: 31 },
  body: { color: "rgba(255,255,255,0.9)", fontFamily: font.bodySemiBold, fontSize: 16, lineHeight: 23 },
  hint: { color: "rgba(255,255,255,0.6)", fontFamily: font.bodySemiBold, fontSize: 12, marginTop: 24 },
  small: { color: "rgba(255,255,255,0.75)", fontFamily: font.bodySemiBold, fontSize: 12 },
  rating: { color: white, fontFamily: font.bodyBold, fontSize: 12 },
  statRow: { flexDirection: "row", gap: 16, marginTop: 8 },
  statValue: { color: white, fontFamily: font.display, fontSize: 30, lineHeight: 36 },
  heroRow: { flexDirection: "row", gap: 16, alignItems: "center" },
  posterRow: { flexDirection: "row", gap: 12 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  rankNum: { color: white, fontFamily: font.display, fontSize: 18, width: 20 },
  rankTitle: { flex: 1, color: white, fontFamily: font.bodyBold, fontSize: 14 },
  genreHeader: { flexDirection: "row", justifyContent: "space-between" },
  genreLabel: { color: white, fontFamily: font.bodyBold, fontSize: 16 },
  genreTrack: { height: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden" },
  genreFill: { height: "100%", borderRadius: 5, backgroundColor: white },
  factLabel: { color: "rgba(255,255,255,0.7)", fontFamily: font.bodyExtraBold, fontSize: 11, letterSpacing: 1.2 },
  factValue: { color: white, fontFamily: font.display, fontSize: 24, lineHeight: 30 },
  factValueCompact: { color: white, fontFamily: font.bodyExtraBold, fontSize: 16 },
  card: {
    backgroundColor: theme.surfacePrimary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    overflow: "hidden",
    paddingBottom: 18,
    gap: 14,
  },
  cardBand: { paddingVertical: 14, paddingHorizontal: 18 },
  cardBandText: { color: white, fontFamily: font.bodyExtraBold, fontSize: 13, letterSpacing: 2 },
  cardGrid: { flexDirection: "row", paddingHorizontal: 18 },
});
