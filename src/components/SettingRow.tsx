import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { theme } from "@/design-system";

// One labelled on/off setting with a short explanation.
export function SettingRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: theme.surfaceInteractive, true: theme.brandPrimary }}
        thumbColor={theme.textPrimary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  label: { color: theme.textPrimary, fontSize: 14, fontWeight: "600" },
  description: { color: theme.textTertiary, fontSize: 12, lineHeight: 17 },
});
