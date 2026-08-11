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
