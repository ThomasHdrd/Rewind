import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MediaArtwork, radius, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { useListItems, useLists, useRemoveFromList, useRenameList } from "@/hooks/useMedia";

export default function ListDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: lists = [] } = useLists();
  const removeFromList = useRemoveFromList();
  const renameList = useRenameList();
  const list = lists.find((l) => l.id === id);
  const { data: items = [] } = useListItems(list?.mediaIds ?? []);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");

  if (!list) return null;

  const startRenaming = () => {
    setDraftName(list.name);
    setIsRenaming(true);
  };

  const saveRename = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== list.name) {
      renameList.mutate({ listId: list.id, name: trimmed });
    }
    setIsRenaming(false);
  };

  return (
    <Screen>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ My Lists</Text>
      </Pressable>
      <View>
        {isRenaming ? (
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            onSubmitEditing={saveRename}
            onBlur={saveRename}
            autoFocus
            style={styles.titleInput}
          />
        ) : (
          <Pressable onPress={startRenaming} style={styles.titleRow}>
            <Text style={styles.title}>{list.name}</Text>
            <Text style={styles.editHint}>✎</Text>
          </Pressable>
        )}
        <Text style={styles.subtitle}>{list.mediaIds.length} titles</Text>
      </View>
      <View>
        {items.map((m) => (
          <Pressable
            key={m.id}
            style={styles.row}
            onPress={() => router.push(m.kind === "movie" ? `/movie/${m.id}` : `/series/${m.id}`)}
          >
            <MediaArtwork path={m.posterPath} color={m.artworkColor} radius={radius.sm} style={{ width: 44, height: 64 }} />
            <Text style={styles.name}>{m.title}</Text>
            <Pressable hitSlop={10} onPress={() => removeFromList.mutate({ listId: list.id, mediaId: m.id })}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </Pressable>
        ))}
      </View>
      <Pressable style={styles.addRow} onPress={() => router.push(`/search?addToList=${list.id}`)}>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>+ Add content</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: theme.textTertiary, fontSize: 12 },
  title: { fontFamily: "ArchivoBlack_400Regular", color: theme.textPrimary, fontSize: 20 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  editHint: { color: theme.textTertiary, fontSize: 14 },
  titleInput: {
    fontFamily: "ArchivoBlack_400Regular",
    color: theme.textPrimary,
    fontSize: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.brandPrimary,
    paddingVertical: 2,
  },
  subtitle: { color: theme.textTertiary, fontSize: 12, marginTop: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  name: { flex: 1, color: theme.textPrimary, fontSize: 14, fontWeight: "600" },
  remove: { color: theme.textTertiary },
  addRow: {
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.borderDefault,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
});
