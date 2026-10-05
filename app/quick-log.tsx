import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { goBack } from "@/lib/navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QuickLogSheet } from "@/design-system";
import { useMediaSearch, useHistory } from "@/hooks/useMedia";
import { trackingRepository } from "@/data/repositories";
import { formatRelativeTime } from "@/lib/history";
import { useQueryClient } from "@tanstack/react-query";

export default function QuickLog() {
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const { data: results = [] } = useMediaSearch(query);
  const { data: history = [] } = useHistory();

  const recent = useMemo(() => {
    const source = query.trim() ? results.map((r) => ({ title: r.title, meta: r.kind })) : history.slice(0, 2).map((h) => ({ title: h.label, meta: formatRelativeTime(h) }));
    return source.map((r) => ({ ...r, logged: false }));
  }, [query, results, history]);

  const onToggle = async (index: number) => {
    const item = recent[index];
    if (!item) return;
    await trackingRepository.logWatch(item.title);
    qc.invalidateQueries({ queryKey: ["history"] });
    goBack(router);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "rgba(4,7,12,0.7)", justifyContent: "flex-end" }}>
      <View style={{ paddingBottom: insets.bottom }}>
        <QuickLogSheet query={query} onChangeQuery={setQuery} recent={recent} onToggle={onToggle} />
      </View>
    </View>
  );
}
