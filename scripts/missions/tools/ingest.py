# ingest.py — turns chains/*.json (+ hand-ordered lists) into data/games/<key>.json
# with clean titles, the exact wiki page of each item, the wiki domain and IGDB ids.
import json,re,glob,os,urllib.request
U="https://rewind-igdb.rewind-dynamx.workers.dev/games"
ACCEPT=["u1","u2","u3","ull","halo3","halo4","codmw3","codwaw","ds1","ds2","ds3","tf2","dish1","apt2","lis1","lis2","lisbts","ff7r","ff7reb","control","oblivion","doom16","doometernal","fc3","heavyrain"]
MANUAL={
 "ds":["Prologue: Porter","Episode 1: Bridget","Episode 2: Amelie","Episode 3: Fragile","Episode 4: Unger","Episode 5: Mama","Episode 6: Deadman","Episode 7: Clifford","Episode 8: Heartman","Episode 9: Higgs","Episode 10: Die-Hardman","Episode 11: Clifford Unger","Episode 12: Bridges","Episode 13: Sam Strand","Episode 14: Lou","Episode 15: Tomorrow is in your hands"],
 "halo2":["The Heretic","The Armory (level)","Cairo Station (level)","Outskirts","Metropolis","The Arbiter","The Oracle","Delta Halo (level)","Regret (level)","Sacred Icon","Quarantine Zone (level)","Gravemind (level)","Uprising","High Charity (level)","The Great Journey"],
 "haloreach":["Noble Actual","Winter Contingency (level)","ONI: Sword Base (level)","Nightfall","Tip of the Spear","Long Night of Solace (level)","Exodus","New Alexandria (level)","The Package (level)","The Pillar of Autumn (Halo: Reach level)","Lone Wolf"],
 "odst":["Prepare to Drop","Mombasa Streets","Tayari Plaza (level)","Uplift Reserve","Kizingo Boulevard (level)","ONI Alpha Site (level)","NMPD HQ (level)","Kikowani Station (level)","Data Hive","Coastal Highway"],
 "cod4":["F.N.G.","Crew Expendable","The Coup","Blackout (Call of Duty 4)","Charlie Don't Surf","The Bog","Hunted (Call of Duty 4)","Death From Above","War Pig (mission)","Shock and Awe","Aftermath (Call of Duty 4)","Safehouse (level)","All Ghillied Up","One Shot, One Kill","Heat (level)","The Sins of the Father","Ultimatum","All In","No Fighting In The War Room","Game Over","Mile High Club"],
 "codbo":["Operation 40","Vorkuta (level)","U.S.D.D.","Executive Order","S.O.G.","The Defector","Numbers","Project Nova","Victor Charlie","Crash Site (Black Ops)","WMD (mission)","Payback","Rebirth","Revelations (mission)","Redemption"],
 "codbo2":["Pyrrhic Victory","Celerium (mission)","Old Wounds","Time and Fate","Fallen Angel","Karma","Suffer With Me","Achilles' Veil","Odysseus","Cordis Die (mission)","Judgment Day"],
 "dish2":["A Long Day in Dunwall","Edge of the World","The Good Doctor","The Clockwork Mansion","The Royal Conservatory","Dust District (Mission)","A Crack in the Slab","The Grand Palace","Death to the Empress"],
 "untildawn":["One Year Ago","Chapter 1","Chapter 2","Chapter 3","Chapter 4","Chapter 5","Chapter 6","Chapter 7","Chapter 8","Chapter 9","Chapter 10"],
 "dai":["The Wrath of Heaven","The Threat Remains","Final choice: In Hushed Whispers or Champions of the Just","In Your Heart Shall Burn","From the Ashes","Wicked Eyes and Wicked Hearts","Here Lies the Abyss","What Pride Had Wrought","Doom Upon All the World"],
}
def clean(t):
    t=re.sub(r"\s*\((level|chapter|mission|Mission|campaign|Quest|quest|Level|Halo 3 level|Halo 4|Halo: Reach level|Doom Eternal level|Lost Legacy|Modern Warfare 3|Call of Duty 4|Black Ops|VII Remake|VII Rebirth|Oblivion|Far Cry 3)\)$","",t)
    return t.strip()
def igdb(title):
    body=f'search "{title}"; fields name,total_rating_count,version_parent; where version_parent = null; limit 10;'
    rows=json.load(urllib.request.urlopen(urllib.request.Request(U,data=body.encode(),method="POST",headers={"User-Agent":"Mozilla/5.0"})))
    exact=[r for r in rows if r["name"].lower()==title.lower()] or rows
    exact.sort(key=lambda r:-(r.get("total_rating_count") or 0))
    return exact[0]["id"] if exact else None, exact[0]["name"] if exact else None
for k in ACCEPT+list(MANUAL):
    c=json.load(open(f"chains/{k}.json",encoding="utf-8"))
    pages=MANUAL.get(k) or c["chain"]
    titles=[clean(p) for p in pages]
    gid,gname=igdb(c["title"])
    json.dump({"ids":[gid],"wiki":c["wiki"],"missions":titles,"pages":pages},open(f"../data/games/{k}.json","w",encoding="utf-8"),ensure_ascii=False,indent=0)
    print(k,gid,gname,"|",c["title"],len(titles))
