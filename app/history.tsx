import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { EmptyState, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useHistory } from "@/hooks/useMedia";

export default function History() {
  const { data: history = [] } = useHistory();

  return (
    <Screen>
      <ScreenHeader title="Watching History" />
      {history.length === 0 ? (
        <EmptyState title="No watch history yet" subtitle="Titles you mark as watched will show up here." />
      ) : null}
      <View>
        {history.map((h) => (
          <View key={h.id} style={styles.row}>
            <Text style={styles.label}>{h.label}</Text>
            <Text style={styles.time}>{h.timeLabel}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  label: { color: theme.textPrimary, fontSize: 14 },
  time: { color: theme.textTertiary, fontSize: 12 },
});
