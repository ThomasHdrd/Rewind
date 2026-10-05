// Direct "open this exact title" links on streaming platforms.
//
// TMDB says WHICH platforms carry a title but not the platform's own id for
// it. Wikidata (free, community-maintained) stores those ids — Netflix,
// Prime Video, Disney+, Apple TV, Hulu, Max, Crunchyroll — keyed by the TMDB
// id, so one query gives real product-page links. Titles Wikidata doesn't
// cover fall back to the platform's own search (see watchProviders.ts).

export type PlatformIds = Partial<Record<PlatformKey, string>>;
type PlatformKey = "netflix" | "prime" | "disney" | "apple" | "hulu" | "max" | "crunchyroll";

// Wikidata property per platform (movie / series variants where they differ).
const PROPS: Record<string, { key: PlatformKey; kind?: "movie" | "tv" }> = {
  P1874: { key: "netflix" },
  P8055: { key: "prime" },
  P7595: { key: "disney", kind: "movie" },
  P7596: { key: "disney", kind: "tv" },
  P9586: { key: "apple", kind: "movie" },
  P9751: { key: "apple", kind: "tv" },
  P6466: { key: "hulu", kind: "movie" },
  P6467: { key: "hulu", kind: "tv" },
  P8298: { key: "max" },
  P11330: { key: "crunchyroll", kind: "tv" },
};

export async function fetchPlatformIds(kind: "movie" | "tv", tmdbId: number): Promise<PlatformIds> {
  const tmdbProp = kind === "movie" ? "P4947" : "P4983";
  const props = Object.keys(PROPS)
    .map((p) => `wdt:${p}`)
    .join(" ");
  const query = `SELECT ?p ?v WHERE { ?item wdt:${tmdbProp} "${tmdbId}" . VALUES ?p { ${props} } ?item ?p ?v }`;
  const res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, {
    headers: { Accept: "application/sparql-results+json" },
  });
  if (!res.ok) throw new Error(`Wikidata ${res.status}`);
  const json = (await res.json()) as { results: { bindings: { p: { value: string }; v: { value: string } }[] } };
  const ids: PlatformIds = {};
  for (const b of json.results.bindings) {
    const prop = PROPS[b.p.value.split("/").pop() ?? ""];
    if (!prop || (prop.kind && prop.kind !== kind)) continue;
    ids[prop.key] ??= b.v.value;
  }
  return ids;
}

const PRODUCT_URLS: Record<PlatformKey, (id: string, kind: "movie" | "tv") => string> = {
  netflix: (id) => `https://www.netflix.com/title/${id}`,
  prime: (id) => `https://www.primevideo.com/detail/${id}`,
  disney: (id, kind) => `https://www.disneyplus.com/${kind === "movie" ? "movies/wd" : "series/wp"}/${id}`,
  apple: (id, kind) => `https://tv.apple.com/${kind === "movie" ? "movie" : "show"}/${id}`,
  hulu: (id, kind) => `https://www.hulu.com/${kind === "movie" ? "movie" : "series"}/${id}`,
  max: (id) => `https://play.hbomax.com/${id}`,
  crunchyroll: (id) => `https://www.crunchyroll.com/series/${id}`,
};

// TMDB provider names → platform.
const PROVIDER_PLATFORM: Record<string, PlatformKey> = {
  Netflix: "netflix",
  "Netflix Standard with Ads": "netflix",
  "Netflix basic with Ads": "netflix",
  "Amazon Prime Video": "prime",
  "Prime Video": "prime",
  "Amazon Prime Video with Ads": "prime",
  "Disney Plus": "disney",
  "Disney+": "disney",
  "Apple TV": "apple",
  "Apple TV Plus": "apple",
  "Apple TV+": "apple",
  Hulu: "hulu",
  "HBO Max": "max",
  Max: "max",
  Crunchyroll: "crunchyroll",
};

/** The title's own page on that platform, when Wikidata knows its id. */
export function productPageUrl(providerName: string, ids: PlatformIds | undefined, kind: "movie" | "tv"): string | undefined {
  const platform = PROVIDER_PLATFORM[providerName];
  const id = platform ? ids?.[platform] : undefined;
  return platform && id ? PRODUCT_URLS[platform](id, kind) : undefined;
}
