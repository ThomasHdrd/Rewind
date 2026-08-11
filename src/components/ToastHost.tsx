import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Toast } from "@/design-system";
import { useToastStore } from "@/state/toastStore";

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const { message, actionLabel, onAction, hide } = useToastStore();

  if (!message) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: 20 + insets.bottom }]}>
      <Toast
        message={message}
        actionLabel={actionLabel}
        onAction={() => {
          onAction?.();
          hide();
        }}
        onDismiss={hide}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 14, right: 14 },
});
