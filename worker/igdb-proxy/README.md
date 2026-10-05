# Rewind IGDB proxy

Small Cloudflare Worker that lets the app query IGDB (video games) without
shipping the Twitch client secret. Free tier: 100,000 requests/day.

## One-time setup

1. Create a Twitch application at https://dev.twitch.tv/console/apps
   (Category "Application Integration", Client Type "Confidential",
   OAuth redirect `http://localhost`). Note the Client ID and generate a
   Client Secret.
2. In this folder:
   ```
   npx wrangler login
   npx wrangler secret put IGDB_CLIENT_ID
   npx wrangler secret put IGDB_CLIENT_SECRET
   npx wrangler deploy
   ```
3. Copy the deployed URL (e.g. `https://rewind-igdb.<you>.workers.dev`) into
   the app's `EXPO_PUBLIC_GAMES_API_URL` — in `.env` for local/web builds and
   in EAS environment variables for Android builds.

The Games section of the app stays hidden until that variable is set.
