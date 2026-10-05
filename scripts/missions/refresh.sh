#!/usr/bin/env sh
# Weekly refresh of the games' mission summaries (see .github/workflows/missions.yml).
# Re-reads every listed item's fan-wiki page so wiki edits reach the app, then
# rebuilds public/missions/*.json and src/data/games/missions.ts.
# The lists themselves (data/games/*.json), the curated easter eggs
# (data/eggs/final.json) and the hand-checked rejections stay as reviewed.
set -e
cd "$(dirname "$0")/data"
GAMES="gta5:gta.fandom.com gtasa:gta.fandom.com gta4:gta.fandom.com gtavc:gta.fandom.com rdr2:reddead.fandom.com rdr1:reddead.fandom.com
portal:half-life.fandom.com portal2:half-life.fandom.com
tlou:thelastofus.fandom.com tlou2:thelastofus.fandom.com gow:godofwar.fandom.com gowr:godofwar.fandom.com u4:uncharted.fandom.com
sm1:marvelsspiderman.fandom.com sm2:marvelsspiderman.fandom.com cp2077:cyberpunk.fandom.com tw3:witcher.fandom.com hzd:horizon.fandom.com
hfw:horizon.fandom.com mafia:mafiagame.fandom.com skyrim:elderscrolls.fandom.com fo4:fallout.fandom.com botw:zelda.fandom.com
totk:zelda.fandom.com halo:halo.fandom.com mw2:callofduty.fandom.com got:ghostoftsushima.fandom.com hogwarts:hogwartslegacy.fandom.com
detroit:detroit-become-human.fandom.com eldenring:eldenring.fandom.com sekiro:sekiro.fandom.com re4r:residentevil.fandom.com"
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
