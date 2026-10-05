// Well-known streaming platforms offered during onboarding — no logos (no
// stable local asset source for these), just the recognizable names.
export const KNOWN_PLATFORMS = [
  "Netflix",
  "Prime Video",
  "Disney+",
  "Max",
  "Apple TV+",
  "Hulu",
  "Paramount+",
  "Peacock",
  "Crunchyroll",
  "Canal+",
  "OCS",
  "YouTube",
];

// TMDB watch-provider ids for each platform above (from
// /watch/providers/{movie,tv}). Some platforms have a different id per
// region (Prime Video is 119 in FR, 9 in US), so every known id is listed —
// TMDB just ignores the ones that don't exist in the requested region.
export const PLATFORM_PROVIDER_IDS: Record<string, number[]> = {
  Netflix: [8],
  "Prime Video": [119, 9],
  "Disney+": [337],
  Max: [1899],
  "Apple TV+": [350],
  Hulu: [15],
  "Paramount+": [531],
  Peacock: [386],
  Crunchyroll: [283],
  "Canal+": [381],
  OCS: [56],
  YouTube: [192, 188],
};

/** Two-letter region for TMDB watch-provider lookups, from the device
 * locale (e.g. "fr-FR" → "FR"). Falls back to FR when the locale carries no
 * region. */
export function watchRegion(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const region = locale.split("-").find((part, i) => i > 0 && /^[A-Z]{2}$/.test(part));
    if (region) return region;
  } catch {}
  return "FR";
}
