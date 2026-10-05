// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  // worker/ is a Cloudflare Worker (its own runtime, deployed with wrangler).
  ignorePatterns: ['worker/**', 'dist/**'],
};
