import React from "react";
import { ScrollView, StyleProp, ViewStyle } from "react-native";

// Horizontal row for small, fixed-size datasets (chip rows, carousels).
// Avoids nesting a VirtualizedList inside the screen's vertical ScrollView.
export function HScroll({
  children,
  gap = 10,
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ marginHorizontal: -20 }, style]}
      contentContainerStyle={{ gap, paddingHorizontal: 20 }}
    >
      {children}
    </ScrollView>
  );
}
