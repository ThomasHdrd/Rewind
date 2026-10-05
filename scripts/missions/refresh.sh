#!/usr/bin/env sh
# Weekly refresh of the games' mission summaries (see .github/workflows/missions.yml).
# Re-reads every listed item's fan-wiki page so wiki edits reach the app, then
# rebuilds public/missions/*.json and src/data/games/missions.ts.
# The lists themselves (data/games/*.json, each with its wiki), the curated
# easter eggs (data/eggs/final.json) and the hand-checked rejections stay as
# reviewed.
set -e
cd "$(dirname "$0")/data"
GAMES=$(python -c "import json,glob,os;print(' '.join(os.path.basename(f)[:-5]+':'+json.load(open(f,encoding='utf-8'))['wiki'] for f in sorted(glob.glob('games/*.json'))))")
for g in $GAMES; do
  key=${g%%:*}; domain=${g#*:}
  python ../describe.py "$key" "$domain" || echo "skip $key"
  python ../describe.py "$key" "$domain" collectible,easter-egg "$key.x" || echo "skip $key.x"
done
python ../build_public.py
for g in $GAMES; do
  key=${g%%:*}; domain=${g#*:}
  python ../retry.py "$key" "$domain" "$key" || echo "skip retry $key"
done
python ../build_public.py
python ../gen.py
