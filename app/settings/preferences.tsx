import React from "react";
import { useRouter } from "expo-router";
import { goBack } from "@/lib/navigation";
import { Skeleton } from "@/design-system";
import { Screen } from "@/components/Screen";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PreferencesForm } from "@/components/PreferencesForm";
import { usePreferences, useSavePreferences } from "@/hooks/useMedia";
import { useToastStore } from "@/state/toastStore";
import { UserPreferences } from "@/data/repositories/firestoreUser";

export default function EditPreferences() {
  const router = useRouter();
  const { data: preferences, isLoading } = usePreferences();
  const savePreferences = useSavePreferences();
  const showToast = useToastStore((s) => s.show);

  const save = async (next: UserPreferences) => {
    try {
      await savePreferences.mutateAsync(next);
      showToast("Preferences saved");
      goBack(router);
    } catch {
      showToast("Couldn't save your preferences — try again");
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Preferences" />
      {isLoading ? (
        <Skeleton width="100%" height={240} radius={12} />
      ) : (
        <PreferencesForm
          initial={preferences}
          genresSubtitle="Pick at least 3 · shapes your For You picks on Discover"
          submitLabel="Save"
          submitting={savePreferences.isPending}
          onSubmit={save}
        />
      )}
    </Screen>
  );
}
