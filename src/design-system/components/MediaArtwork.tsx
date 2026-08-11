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
  size = "w500",
  color,
  radius = 0,
  style,
}: {
  path?: string | null;
  size?: TmdbImageSize;
  color?: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [loaded, setLoaded] = useState(false);
  const url = tmdbImageUrl(path, size);

  if (!url) return <Artwork color={color} radius={radius} style={style} />;

  return (
    <View style={[{ borderRadius: radius, overflow: "hidden" }, style]}>
      {!loaded ? <Artwork color={color} style={StyleSheet.absoluteFill} /> : null}
      <Image
        source={{ uri: url }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        onLoad={() => setLoaded(true)}
      />
    </View>
  );
}
