import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { EmptyState, IconButton, Input, MediaListItem, radius, theme } from "@/design-system";
import { Screen } from "@/components/Screen";
import { SectionLabel } from "@/components/SectionLabel";
import { useAddToList, useMediaSearch } from "@/hooks/useMedia";
import { useToastStore } from "@/state/toastStore";

const TABS = ["All", "Movies", "Series", "Anime", "TV"];

export default function Search() {
  const router = useRouter();
  const { addToList: addToListId } = useLocalSearchParams<{ addToList?: string }>();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("All");
  const { data: results = [] } = useMediaSearch(query);
  const addToList = useAddToList();
  const showToast = useToastStore((s) => s.show);

  const handleResultPress = (m: { id: string; kind: string; title: string }) => {
    if (addToListId) {
      addToList.mutate({ listId: addToListId, mediaId: m.id });
      showToast(`${m.title} added to list`);
      return;
    }
    router.push(m.kind === "movie" ? `/movie/${m.id}` : `/series/${m.id}`);
  };

  const filtered = useMemo(() => {
    if (tab === "All") return results;
    const kindMap: Record<string, string> = { Movies: "movie", Series: "series", Anime: "anime", TV: "tv" };
    return results.filter((r) => r.kind === kindMap[tab]);
  }, [results, tab]);

  const grouped = useMemo(() => {
    const bySeries = filtered.filter((m) => m.kind === "series");
    const byMovie = filtered.filter((m) => m.kind === "movie");
    return { bySeries, byMovie };
  }, [filtered]);

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="‹" size={36} onPress={() => router.back()} />
        <Text style={styles.headerTitle}>{addToListId ? "Add to List" : "Search"}</Text>
      </View>

      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search a title..."
        icon={<Text style={styles.searchIcon}>⌕</Text>}
      />

      {query.trim().length > 0 ? <Text style={styles.count}>{filtered.length} results</Text> : null}

      <View style={{ flexDirection: "row", gap: 8 }}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={styles.tab}>
            <Text style={{ color: tab === t ? theme.textPrimary : theme.textTertiary, fontSize: 11 }}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {query.trim().length === 0 ? null : filtered.length === 0 ? (
        <EmptyState title={`No results for "${query}"`} subtitle="Check the spelling, or explore trending titles instead." />
      ) : (
        <View>
          {grouped.bySeries.length > 0 ? (
            <View style={{ gap: 4, marginBottom: 12 }}>
              <SectionLabel>Series</SectionLabel>
              {grouped.bySeries.map((m) => (
                <Pressable key={m.id} onPress={() => handleResultPress(m)}>
                  <MediaListItem
                    title={m.title}
                    meta={`${m.year} · Series${addToListId ? " · tap to add" : ""}`}
                    artworkColor={m.artworkColor}
                    posterPath={m.posterPath}
                  />
                </Pressable>
              ))}
            </View>
          ) : null}
          {grouped.byMovie.length > 0 ? (
            <View style={{ gap: 4 }}>
              <SectionLabel>Movies</SectionLabel>
              {grouped.byMovie.map((m) => (
                <Pressable key={m.id} onPress={() => handleResultPress(m)}>
                  <MediaListItem
                    title={m.title}
                    meta={`${m.year} · Movie${addToListId ? " · tap to add" : ""}`}
                    artworkColor={m.artworkColor}
                    posterPath={m.posterPath}
                  />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { color: theme.textPrimary, fontSize: 17, fontWeight: "700" },
  searchIcon: { color: theme.textTertiary, fontSize: 14 },
  count: { color: theme.textTertiary, fontSize: 11 },
  tab: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: radius.full },
});
