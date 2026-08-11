import React, { useEffect, useRef } from "react";
import { Animated, DimensionValue, Easing } from "react-native";
import { theme } from "../tokens";

export function Skeleton({
  width = "100%",
  height = 16,
  radius = 8,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
}) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 650, easing: Easing.ease, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: theme.surfaceSecondary,
        opacity,
      }}
    />
  );
}
