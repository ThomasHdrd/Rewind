import { PlatformIds, productPageUrl } from "@/lib/streamingLinks";

// TMDB's /watch/providers only gives one aggregate JustWatch link per
// title/region — no per-provider deep link. The user wants each row to open
// the actual streaming platform, not a JustWatch redirect, so this maps
// common provider names to their real platform site instead. This lands on
// the platform's homepage/app, not the specific title (TMDB doesn't expose
// that), which is the closest honest approximation without a JustWatch
// affiliate integration.
const PROVIDER_URLS: Record<string, string> = {
  "Netflix": "https://www.netflix.com",
  "Netflix Standard with Ads": "https://www.netflix.com",
  "Netflix basic with Ads": "https://www.netflix.com",
  "Amazon Prime Video": "https://www.primevideo.com",
  "Prime Video": "https://www.primevideo.com",
  "Disney Plus": "https://www.disneyplus.com",
  "Disney+": "https://www.disneyplus.com",
  "Apple TV": "https://tv.apple.com",
  "Apple TV Plus": "https://tv.apple.com",
  "Apple TV+": "https://tv.apple.com",
  "Apple TV Amazon Channel": "https://tv.apple.com",
  "HBO Max": "https://www.max.com",
  "Max": "https://www.max.com",
  "Hulu": "https://www.hulu.com",
  "Paramount Plus": "https://www.paramountplus.com",
  "Paramount+": "https://www.paramountplus.com",
  "Peacock": "https://www.peacocktv.com",
  "Canal+": "https://www.canalplus.com",
  "MyCanal": "https://www.canalplus.com",
  "OCS": "https://www.ocs.fr",
  "Crunchyroll": "https://www.crunchyroll.com",
  "YouTube": "https://www.youtube.com",
};

/** Real platform URL for a TMDB provider name, or undefined when there's no known mapping. */
export function watchProviderUrl(providerName: string): string | undefined {
  return PROVIDER_URLS[providerName];
}

// TMDB gives no per-provider id for a title (no Netflix/Prime ids), so the
// closest thing to "open this title" is the platform's own search for it —
// one tap from the right page. Only platforms whose search URL format is
// known and stable are listed; others fall back to TMDB's watch page for the
// title (each provider there links straight to the title), then the homepage.
const PROVIDER_SEARCH_URLS: Record<string, (q: string) => string> = {
  "Netflix": (q) => `https://www.netflix.com/search?q=${q}`,
  "Netflix Standard with Ads": (q) => `https://www.netflix.com/search?q=${q}`,
  "Netflix basic with Ads": (q) => `https://www.netflix.com/search?q=${q}`,
  "Amazon Prime Video": (q) => `https://www.primevideo.com/search?phrase=${q}`,
  "Prime Video": (q) => `https://www.primevideo.com/search?phrase=${q}`,
  "Apple TV": (q) => `https://tv.apple.com/search?term=${q}`,
  "Apple TV Plus": (q) => `https://tv.apple.com/search?term=${q}`,
  "Apple TV+": (q) => `https://tv.apple.com/search?term=${q}`,
  "Hulu": (q) => `https://www.hulu.com/search?q=${q}`,
  "Crunchyroll": (q) => `https://www.crunchyroll.com/search?q=${q}`,
  "YouTube": (q) => `https://www.youtube.com/results?search_query=${q}`,
};

/** Best link to open `title` on a provider: its own product page for the
 * title (Wikidata id), else its search for the title, else TMDB's per-title
 * watch page, else the provider's homepage. */
export function watchProviderTitleUrl(
  providerName: string,
  title: string,
  tmdbWatchLink?: string,
  platformIds?: PlatformIds,
  kind: "movie" | "tv" = "movie"
): string | undefined {
  // Best: the exact product page (id from Wikidata).
  const product = productPageUrl(providerName, platformIds, kind);
  if (product) return product;
  const search = PROVIDER_SEARCH_URLS[providerName];
  if (search) return search(encodeURIComponent(title));
  return tmdbWatchLink ?? PROVIDER_URLS[providerName];
}

/** Cinema showtimes for a film currently in theaters (AlloCiné lists every
 * French cinema showing it, chains included). */
export function showtimesUrl(title: string): string {
  return `https://www.allocine.fr/rechercher/?q=${encodeURIComponent(title)}`;
}
