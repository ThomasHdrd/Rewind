// Rewind — IGDB proxy (Cloudflare Worker).
//
// IGDB (Twitch's game database) needs a Client ID + Client SECRET to mint an
// app access token. A secret can't ship inside the app, so the app calls
// this Worker instead; the Worker holds the secret (Worker secrets, never in
// the repo), keeps the token cached, and forwards only read queries to a
// small allowlist of IGDB endpoints.
//
// Deploy: see ../README.md. Secrets: IGDB_CLIENT_ID, IGDB_CLIENT_SECRET.

const ALLOWED_ENDPOINTS = new Set(["games", "game_time_to_beats", "genres", "platforms", "external_games"]);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

let cachedToken = null; // { value, expiresAt } — per Worker isolate

async function getToken(env) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const url =
    "https://id.twitch.tv/oauth2/token" +
    `?client_id=${encodeURIComponent(env.IGDB_CLIENT_ID)}` +
    `&client_secret=${encodeURIComponent(env.IGDB_CLIENT_SECRET)}` +
    "&grant_type=client_credentials";
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(`Twitch token ${res.status}`);
  const json = await res.json();
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

// Steam achievements of a game (GET /steam/achievements/<appid>): name,
// description and the share of players who unlocked each, read from the
// public Steam Community stats page (no Steam key needed). They give every
// Steam game a checklist — story beats, collectibles, secrets — with a real
// "how many players did this" figure. Cached at the edge for a day.
async function steamAchievements(appid, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(`https://steam-cache/achievements/${appid}`);
  const hit = await cache.match(cacheKey);
  if (hit) return new Response(hit.body, { headers: { ...CORS, "Content-Type": "application/json", "X-Cache": "HIT" } });
  const res = await fetch(`https://steamcommunity.com/stats/${appid}/achievements/?l=english`, {
    headers: { "User-Agent": "Mozilla/5.0 (Rewind)", "Accept-Language": "en" },
  });
  const html = res.ok ? await res.text() : "";
  const decode = (s) =>
    s
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
  const items = [];
  const re = /<div class="achieveRow[\s\S]*?<img src="([^"]+)"[\s\S]*?achievePercent">([\d.]+)%<\/div>[\s\S]*?<h3>([\s\S]*?)<\/h3>\s*<h5>([\s\S]*?)<\/h5>/g;
  let m;
  while ((m = re.exec(html)) && items.length < 500) {
    items.push({ name: decode(m[3]), description: decode(m[4]), percent: Number(m[2]), icon: m[1] });
  }
  const response = new Response(JSON.stringify(items), {
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" },
  });
  if (res.ok) ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const steam = new URL(request.url).pathname.match(/^\/steam\/achievements\/(\d{1,9})\/?$/);
    if (steam && request.method === "GET") return steamAchievements(steam[1], ctx);
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

    const endpoint = new URL(request.url).pathname.replace(/^\/+|\/+$/g, "");
    if (!ALLOWED_ENDPOINTS.has(endpoint)) return new Response("Unknown endpoint", { status: 404, headers: CORS });

    const body = await request.text();
    if (body.length > 4000) return new Response("Query too long", { status: 413, headers: CORS });

    // Identical queries are cached at Cloudflare's edge for an hour — game
    // metadata changes slowly, and it keeps us far under IGDB's 4 req/s.
    const cache = caches.default;
    const cacheKey = new Request(`https://igdb-cache/${endpoint}?q=${encodeURIComponent(body)}`);
    const hit = await cache.match(cacheKey);
    if (hit) return new Response(hit.body, { headers: { ...CORS, "Content-Type": "application/json", "X-Cache": "HIT" } });

    let token;
    try {
      token = await getToken(env);
    } catch (e) {
      return new Response(JSON.stringify({ error: "auth", message: String(e) }), { status: 502, headers: CORS });
    }
    const upstream = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: "POST",
      headers: { "Client-ID": env.IGDB_CLIENT_ID, Authorization: `Bearer ${token}`, Accept: "application/json" },
      body,
    });
    const text = await upstream.text();
    if (upstream.status === 401) cachedToken = null; // token revoked/expired: refresh next time
    const response = new Response(text, {
      status: upstream.status,
      headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
    });
    if (upstream.ok) ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};
