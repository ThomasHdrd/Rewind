import React from "react";
import { Text, View } from "react-native";
import { theme, type } from "../tokens";
import { BottomSheet } from "./BottomSheet";
import { Input } from "./Input";
import { SearchResultRow } from "./SearchResultRow";

export function QuickLogSheet({
  query,
  onChangeQuery,
  recent = [],
  onToggle,
}: {
  query: string;
  onChangeQuery: (v: string) => void;
  recent?: { title: string; meta?: string; logged?: boolean }[];
  onToggle?: (index: number) => void;
}) {
  return (
    <BottomSheet>
      <Text style={{ fontFamily: type.h2.fontFamily, fontWeight: "800", fontSize: 20, color: theme.textPrimary }}>
        What did you watch?
      </Text>
      <Input placeholder="Search a title..." value={query} onChangeText={onChangeQuery} />
      <View>
        <Text style={{ fontSize: 11, color: theme.textTertiary, letterSpacing: 0.7, marginBottom: 4 }}>RECENT</Text>
        {recent.map((r, i) => (
          <SearchResultRow key={i} title={r.title} meta={r.meta} logged={r.logged} onToggle={() => onToggle?.(i)} />
        ))}
      </View>
    </BottomSheet>
  );
}
