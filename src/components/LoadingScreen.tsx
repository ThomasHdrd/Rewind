import React from "react";
import { View } from "react-native";
import { Skeleton } from "@/design-system";
import { Screen } from "@/components/Screen";

// Placeholder while a screen's main data loads — these screens used to
// render nothing at all, which read as a frozen blank page.
export function LoadingScreen({ variant = "detail" }: { variant?: "detail" | "profile" }) {
  if (variant === "profile") {
    return (
      <Screen>
        <View style={{ alignItems: "center", gap: 12, paddingTop: 40 }}>
          <Skeleton width={64} height={64} radius={32} />
          <Skeleton width={140} height={18} radius={9} />
        </View>
        <Skeleton height={70} radius={12} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Skeleton width="48%" height={64} radius={12} />
          <Skeleton width="48%" height={64} radius={12} />
        </View>
        <Skeleton height={160} radius={12} />
      </Screen>
    );
  }
  return (
    <Screen scroll={false} edges={["bottom"]} contentStyle={{ padding: 0, gap: 0 }}>
      <Skeleton height={200} radius={0} />
      <View style={{ padding: 20, gap: 14 }}>
        <View style={{ flexDirection: "row", gap: 12, marginTop: -46 }}>
          <Skeleton width={100} height={148} radius={12} />
          <View style={{ flex: 1, gap: 8, paddingTop: 56 }}>
            <Skeleton width="80%" height={20} radius={6} />
            <Skeleton width="50%" height={12} radius={6} />
          </View>
        </View>
        <Skeleton height={44} radius={22} />
        <Skeleton height={12} radius={6} />
        <Skeleton width="90%" height={12} radius={6} />
        <Skeleton width="70%" height={12} radius={6} />
      </View>
    </Screen>
  );
}
