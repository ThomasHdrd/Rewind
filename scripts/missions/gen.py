import json,glob,os
extra={"tlou":[204350],"sm1":[138949,122095],"hzd":[317103],"skyrim":[19457,165192],"fo4":[54612],"rdr2":[103206],"cp2077":[277807],"tw3":[119402],"hogwarts":[214440],"gowr":[209806],"detroit":[136651,118902],"u4":[168670]}
names={"gta5":"Grand Theft Auto V","gtasa":"GTA: San Andreas","gta4":"Grand Theft Auto IV","gtavc":"GTA: Vice City","rdr2":"Red Dead Redemption 2","rdr1":"Red Dead Redemption","tlou":"The Last of Us","tlou2":"The Last of Us Part II","gow":"God of War (2018)","gowr":"God of War Ragnarök","u4":"Uncharted 4","sm1":"Marvel's Spider-Man","sm2":"Marvel's Spider-Man 2","cp2077":"Cyberpunk 2077","tw3":"The Witcher 3","hzd":"Horizon Zero Dawn","hfw":"Horizon Forbidden West","mafia":"Mafia: Definitive Edition","skyrim":"Skyrim","fo4":"Fallout 4","botw":"Zelda: Breath of the Wild","totk":"Zelda: Tears of the Kingdom","halo":"Halo: Combat Evolved","mw2":"Call of Duty: Modern Warfare 2 (2009)","got":"Ghost of Tsushima","hogwarts":"Hogwarts Legacy","detroit":"Detroit: Become Human","eldenring":"Elden Ring","sekiro":"Sekiro","re4r":"Resident Evil 4 (2023)"}
games={}
for f in sorted(glob.glob("games/*.json")):
    k=os.path.basename(f)[:-5]; g=json.load(open(f,encoding="utf-8"))
    games[k]={"ids":sorted(set(g["ids"]+extra.get(k,[]))),"missions":g["missions"]}
    for cat in ["side","boss","collectible","easter-egg"]:
        if g.get(cat): games[k][cat]=g[cat]
ids={}
for k,g in games.items():
    for i in g["ids"]:
        assert i not in ids,(i,k,ids.get(i)); ids[i]=k
import hashlib
h=hashlib.sha1()
for pf in sorted(glob.glob("../../../public/missions/*.json")): h.update(open(pf,"rb").read())
version=h.hexdigest()[:10]
out=["// Main-story missions shipped with Rewind, so the most played games come",
"// ready to tick like a series' episodes. No API lists missions: each list",
"// was taken from the game's fan wiki (story order, titles checked against",
"// it). An ending choice is a single item. Side missions, bosses,",
"// collectibles and easter eggs are listed where the game has them",
"// (collectibles as sets: \"Spaceship Parts (50)\"). Other games use main",
"// mission lists shared by players (communityMissions.ts).",
"// Keyed by every IGDB id of the game (original + remasters/editions).",
"",
"import type { MissionLists } from \"@/lib/gameMissions\";","","const LISTS: Record<string, MissionLists> = {"]
for k,g in games.items():
    out.append(f"  // {names[k]}")
    parts=[f"main: {json.dumps(g['missions'],ensure_ascii=False)}"]+[f"{json.dumps(c)}: {json.dumps(g[c],ensure_ascii=False)}" for c in ["side","boss","collectible","easter-egg"] if c in g]
    out.append(f"  {k}: {{ " + ", ".join(parts) + " },")
out+=["};","","const BY_IGDB_ID: Record<number, string> = {"]
for k,g in games.items():
    out.append("  "+", ".join(f'{i}: "{k}"' for i in g["ids"])+",")
out+=["};","","export function bundledMissions(igdbId: number): MissionLists | undefined {","  const key = BY_IGDB_ID[igdbId];","  return key ? LISTS[key] : undefined;","}","","/** Changes whenever public/missions changes, so apps refetch summaries at once. */",f"export const MISSION_INFO_VERSION = \"{version}\";","","/** The shipped game's key — also names its descriptions file (public/missions/<key>.json). */","export function bundledKey(igdbId: number): string | undefined {","  return BY_IGDB_ID[igdbId];","}",""]
open("../../../src/data/games/missions.ts","w",encoding="utf-8").write("\n".join(out))
for c in ["missions","side","boss","collectible","easter-egg"]:
    print(c, sum(1 for g in games.values() if c in g),"games", sum(len(g.get(c,[])) for g in games.values()),"items")
