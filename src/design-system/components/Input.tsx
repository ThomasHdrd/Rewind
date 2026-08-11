import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { radius, theme, type } from "../tokens";

export function Input({
  placeholder,
  value,
  onChangeText,
  error,
  disabled,
  icon,
  multiline,
  secureTextEntry,
  onSubmitEditing,
}: {
  placeholder?: string;
  value?: string;
  onChangeText?: (v: string) => void;
  error?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  multiline?: boolean;
  secureTextEntry?: boolean;
  onSubmitEditing?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? theme.stateError : focused ? theme.brandPrimary : theme.borderDefault;
  return (
    <View style={{ gap: 6 }}>
      <View
        style={[
          styles.wrap,
          { borderColor, opacity: disabled ? 0.5 : 1, paddingVertical: multiline ? 12 : 12 },
        ]}
      >
        {icon}
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={theme.textTertiary}
          value={value}
          editable={!disabled}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          multiline={multiline}
          numberOfLines={multiline ? 3 : undefined}
          secureTextEntry={secureTextEntry}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={onSubmitEditing ? "send" : undefined}
          style={styles.input}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.surfacePrimary,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    color: theme.textPrimary,
    fontFamily: type.bodyLg.fontFamily,
    fontSize: 15,
    paddingVertical: 0,
  },
  error: {
    color: theme.stateError,
    fontSize: 12,
  },
});
