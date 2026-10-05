import json,glob,os,re
eggs=json.load(open("eggs/final.json",encoding="utf-8"))
for k,v in eggs.items():
    for e in v: e["text"]=re.sub(r"^\]\]\s*","",e["text"])
# wrong matches from the collectible/easter-egg pass (checked by hand)
DROP={"cp2077":["collectible:3"],"gow":["collectible:1","collectible:8"],"gta5":["collectible:8"],"hogwarts":["collectible:4"],
      "rdr2":["easter-egg:2","easter-egg:3","easter-egg:8","easter-egg:9"],"re4r":["collectible:2"],"skyrim":["collectible:3","collectible:4"],"tlou2":["collectible:4"]}
# second pass (looser search), wrong matches checked by hand
REJECT={"cp2077":["main:18","side:16","collectible:2"],"eldenring":["main:1"],"gow":["side:4"],"gta4":["main:46"],"gta5":["main:52"],
        "gtasa":["main:20"],"gtavc":["collectible:2"],"hogwarts":["collectible:4"],"mw2":["main:5"],"sm1":["main:1","side:18","side:22"],
        "totk":["boss:7"],"tw3":["main:48","side:31","main:39"]}
MANUAL=json.load(open("desc/manual.json",encoding="utf-8"))
# spoilers (a boss's real identity) or too generic
MANUAL_REJECT={("gow","The Stranger"),("tlou2","Abby vs. Ellie (theater)"),("re4r","Treasures"),("sm1","Backpacks (55)")}
tot=0
for f in sorted(glob.glob("games/*.json")):
    k=os.path.basename(f)[:-5]
    g=json.load(open(f,encoding="utf-8"))
    if k in eggs:
        g["easter-egg"]=[e["title"] for e in eggs[k]]
        json.dump(g,open(f,"w",encoding="utf-8"),ensure_ascii=False,indent=0)
    base=json.load(open(f"desc/{k}.json",encoding="utf-8"))
    out={}
    for key,v in base["items"].items():
        cat,n=key.split(":"); title=(g["missions"] if cat=="main" else g[cat])[int(n)-1]
        core=re.sub(r"^(Boss|Contract): ","",title).lower()
        page=v["page"]; text=re.sub(r"^←.*?→\s*","",v["text"]).strip(); text=re.sub(r"^Note:[^.]*\.\s*","",text)
        if ("/" in page and "/" not in title) or "questline" in title.lower(): continue
        # The page must be the item's own ("Chapter 1: Forsaken City" for
        # "Forsaken City" is fine; a whole-game "storyline" page is not).
        pl=page.lower().replace("contract: ","")
        if not (pl.startswith(core[:6]) or core in pl) or "storyline" in pl: continue
        if len(text)>=60: out[key]={"page":page,"text":text}
    xf=f"desc/{k}.x.json"
    if os.path.exists(xf):
        for key,v in json.load(open(xf,encoding="utf-8"))["items"].items():
            if key in DROP.get(k,[]) or (key.startswith("easter-egg") and k in eggs): continue
            text=re.sub(r"^Note:[^.]*\.\s*","",v["text"]).strip()
            if len(text)>=40: out[key]={"page":v["page"],"text":text}
    rf=f"desc/{k}.retry.json"
    if os.path.exists(rf):
        for key,v in json.load(open(rf,encoding="utf-8")).items():
            if key in REJECT.get(k,[]) or key in out: continue
            out[key]={"page":v["page"],"text":v["text"]}
    for cat,key2 in [("boss","boss"),("collectible","collectible"),("easter-egg","easter-egg")]:
        for n,t in enumerate(g.get(cat,[]) or []):
            v=MANUAL.get(k,{}).get(t)
            if v and f"{key2}:{n+1}" not in out and (k,t) not in MANUAL_REJECT: out[f"{key2}:{n+1}"]=v
    for n,e in enumerate(eggs.get(k,[])):
        out[f"easter-egg:{n+1}"]={"page":e["page"],"text":e["text"]}
    tot+=len(out)
    json.dump({"wiki":base["wiki"],"items":out},open(f"../../../public/missions/{k}.json","w",encoding="utf-8"),ensure_ascii=False,separators=(",",":"))
print("described items:",tot)
