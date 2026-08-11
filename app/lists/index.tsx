import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { EmptyState, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useCreateList, useLists } from "@/hooks/useMedia";

export default function Lists() {
  const router = useRouter();
  const { data: lists = [] } = useLists();
  const createList = useCreateList();

  const addList = async () => {
    const list = await createList.mutateAsync(`New List ${lists.length + 1}`);
    router.push(`/lists/${list.id}`);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <ScreenHeader title="My Lists" />
        <Pressable style={styles.addBtn} onPress={addList}>
          <Text style={{ color: theme.textSecondary }}>+</Text>
        </Pressable>
      </View>
      {lists.length === 0 ? (
        <EmptyState
          title="No lists yet"
          subtitle='Tap the + button to create your first list, like "Halloween" or "Must-Watch Movies".'
          actionLabel="Create a list"
          onAction={addList}
        />
      ) : (
        <View>
          {lists.map((l) => (
            <Pressable key={l.id} style={styles.row} onPress={() => router.push(`/lists/${l.id}`)}>
              <Text style={styles.name}>{l.name}</Text>
              <Text style={styles.count}>{l.mediaIds.length} titles</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.borderDefault,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  name: { color: theme.textPrimary, fontSize: 14, fontWeight: "600" },
  count: { color: theme.textTertiary, fontSize: 12 },
});
