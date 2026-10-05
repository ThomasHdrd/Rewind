import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { PreferencesForm } from "@/components/PreferencesForm";
import { useAuthStore } from "@/state/authStore";
import { useToastStore } from "@/state/toastStore";
import { useSavePreferences } from "@/hooks/useMedia";
import { useQueryClient } from "@tanstack/react-query";
import { mediaRepository } from "@/data/repositories";
import { UserPreferences } from "@/data/repositories/firestoreUser";

export default function Preferences() {
  const router = useRouter();
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const savePreferences = useSavePreferences();
  const showToast = useToastStore((s) => s.show);
  const qc = useQueryClient();
  // Warm Discover (where this step lands) while genres are being picked.
  useEffect(() => {
    qc.prefetchInfiniteQuery({
      queryKey: ["media", "catalog", "all", [], [], "trending"],
      queryFn: ({ pageParam }) =>
        mediaRepository.browseCatalog({ kind: "all", genres: [], platforms: [], sort: "trending" }, pageParam),
      initialPageParam: 1,
    });
  }, [qc]);

  const finish = async (preferences: UserPreferences) => {
    try {
      // Saved on the user's own Firestore doc, so every account gets its own
      // "For You" row on Discover. Always starts blank here (no preselection);
      // existing answers are edited from Settings → Preferences instead.
      await savePreferences.mutateAsync(preferences);
    } catch {
      showToast("Couldn't save your preferences — check your connection and try again");
      return;
    }
    await completeOnboarding();
    // First-time completion lands on Discover (not Home) — a brand-new user
    // has nothing followed/watched yet, so Discover is where they'd start.
    // Returning sessions still land on Home via AuthGate in app/_layout.tsx.
    router.replace("/discover");
  };

  return (
    <Screen>
      <PreferencesForm
        genresSubtitle="Pick at least 3 · step 2 of 2"
        submitLabel="Continue"
        submitting={savePreferences.isPending}
        onSubmit={finish}
      />
    </Screen>
  );
}
