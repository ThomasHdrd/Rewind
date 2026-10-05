import React, { useState } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { tmdbImageUrl, TmdbImageSize } from "@/lib/tmdb";
import { Artwork } from "./Artwork";

// Renders a real TMDB poster/backdrop/still image when a path is available,
// falling back to the existing color Artwork placeholder while the image
// loads or when there's no TMDB match — used by the movie/series/episode
// detail screens in place of a bare <Artwork color=... />.
export function MediaArtwork({
  path,
  uri,
  size = "w500",
  color,
  radius = 0,
  style,
}: {
  path?: string | null;
  /** A full image URL (e.g. IGDB game cover) — takes precedence over `path`. */
  uri?: string;
  size?: TmdbImageSize;
  color?: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [loaded, setLoaded] = useState(false);
  const url = uri ?? tmdbImageUrl(path, size);

  if (!url) return <Artwork color={color} radius={radius} style={style} />;

  return (
    <View style={[{ borderRadius: radius, overflow: "hidden" }, style]}>
      {!loaded ? <Artwork color={color} style={StyleSheet.absoluteFill} /> : null}
      <Image
        source={{ uri: url }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        // Same poster appears on many screens: keep decoded images in memory
        // and on disk so revisits are instant instead of re-downloading.
        cachePolicy="memory-disk"
        transition={150}
        onLoad={() => setLoaded(true)}
      />
    </View>
  );
}
