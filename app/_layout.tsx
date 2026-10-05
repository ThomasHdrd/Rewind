import { useEffect } from "react";
import { View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useFonts as useArchivoBlack, ArchivoBlack_400Regular } from "@expo-google-fonts/archivo-black";
import {
  useFonts as useManrope,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { persistOptions, queryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/state/authStore";
import { BottomNav, NavIconName, theme } from "@/design-system";
import { ToastHost } from "@/components/ToastHost";

SplashScreen.preventAutoHideAsync().catch(() => {});

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { isHydrating, isAuthenticated, hasOnboarded, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isHydrating) return;
    const inOnboarding = segments[0] === "onboarding";
    if (!isAuthenticated || !hasOnboarded) {
      if (!inOnboarding) router.replace("/onboarding/welcome");
    } else if (inOnboarding) {
      router.replace("/(tabs)");
    }
  }, [isHydrating, isAuthenticated, hasOnboarded, segments, router]);

  if (isHydrating) return null;
  return <>{children}</>;
}

// Maps the current route's top-level segment to which of the 5 tabs
// "conceptually owns" it, so screens reached from e.g. Profile (settings,
// statistics, history, lists, rewards) keep the Profile tab highlighted
// instead of showing no active tab. Screens where a bottom nav would be
// visually wrong (onboarding, modals, the completion celebration screen)
// return null and the nav is hidden entirely.
function activeTabFor(segments: string[]): NavIconName | null {
  const first = segments[0] ?? "";
  if (first === "onboarding" || first === "quick-log" || first === "complete") return null;
  if (first === "rate" || first === "rewind") return null;
  if (first === "(tabs)") {
    const second = segments[1];
    if (second === "discover") return "discover";
    if (second === "upcoming") return "upcoming";
    if (second === "friends") return "friends";
    if (second === "profile") return "profile";
    return "home";
  }
  if (["settings", "statistics", "history", "lists", "rewards"].includes(first)) return "profile";
  if (first === "add" || first === "profile-setup") return "friends";
  if (first === "game") return "discover";
  // movie/series/episode detail screens, search, etc. are reached from
  // multiple tabs (Home, Discover, Search) with no single owner — default to
  // Home so the nav still shows (per "visible on every existing page")
  // without falsely highlighting Discover/Upcoming/Friends/Profile.
  return "home";
}

function GlobalBottomNav() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, hasOnboarded } = useAuthStore();
  const active = activeTabFor(segments as string[]);

  if (!isAuthenticated || !hasOnboarded || !active) return null;

  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
      <BottomNav
        activeKey={active}
        onPress={(key) => {
          const tab = key === "home" ? "" : `/${key}`;
          router.push(`/(tabs)${tab}` as any);
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  const [archivoLoaded] = useArchivoBlack({ ArchivoBlack_400Regular });
  const [manropeLoaded] = useManrope({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  const fontsLoaded = archivoLoaded && manropeLoaded;

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <StatusBar style="light" />
          <AuthGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.bgPrimary },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding/welcome" />
              <Stack.Screen name="onboarding/profile" />
              <Stack.Screen name="onboarding/preferences" />
              <Stack.Screen name="quick-log" options={{ presentation: "modal" }} />
              <Stack.Screen name="rate/[id]" options={{ presentation: "modal" }} />
              <Stack.Screen name="rewind" options={{ presentation: "fullScreenModal", animation: "fade" }} />
            </Stack>
            <GlobalBottomNav />
            <ToastHost />
          </AuthGate>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
