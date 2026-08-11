import React from "react";
import { RefreshControl, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/design-system";

export function Screen({
  children,
  scroll = true,
  edges,
  contentStyle,
  refreshing,
  onRefresh,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: ("top" | "bottom" | "left" | "right")[];
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  if (!scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={edges ?? ["top"]}>
        <View style={[styles.content, contentStyle]}>{children}</View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.safe} edges={edges ?? ["top"]}>
      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.brandPrimary} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bgPrimary },
  // Bumped from 40 to clear the persistent global bottom nav (~70-80px tall
  // incl. safe-area) rendered as an absolute footer in app/_layout.tsx, so
  // the last item on any scrollable screen isn't visually clipped under it.
  content: { padding: 20, paddingBottom: 110, gap: 20 },
});
