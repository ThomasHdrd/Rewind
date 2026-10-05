# retry.py key domain "Game name" "(Suffix)|(Suffix2)" — second pass on items without a synopsis
import json,re,sys,html,urllib.request,urllib.parse
from concurrent.futures import ThreadPoolExecutor
key,domain,gamename=sys.argv[1],sys.argv[2],sys.argv[3]
suffixes=[s for s in (sys.argv[4] if len(sys.argv)>4 else "").split("|") if s]
g=json.load(open(f"games/{key}.json",encoding="utf-8"))
have=json.load(open(f"../../../public/missions/{key}.json",encoding="utf-8"))["items"]
WORDS=re.compile(r"mission|quest|chapter|act\b|boss|level|storyline|stage|contract|job|tale|favor|campaign|collectible|easter egg|reference",re.I)
def api(params):
    u=f"https://{domain}/api.php?"+urllib.parse.urlencode({**params,"format":"json"})
    return json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"RewindBot/1.0 (rewind.expo.app)"}),timeout=40))
def page(title):
    try: d=api({"action":"parse","page":title,"prop":"text","redirects":1})["parse"]
    except Exception: return None
    h=d["text"]["*"]; low=h.lower()
    if "disambiguation" in d["title"].lower() or "may refer to" in low[:6000] or "disambig" in low[:2500]: return None
    head=html.unescape(re.sub(r"<[^>]+>"," ",h[:6000]))
    h=re.sub(r"<(aside|table|figure|style|script)[\s\S]*?</\1>","",h)
    prose,quotes=[],[]
    for p in re.findall(r"<p>([\s\S]*?)</p>",h):
        t=re.sub(r"\[\d+\]|\[citation needed\]","",html.unescape(re.sub(r"<[^>]+>","",p))).strip()
        t=re.sub(r"\s+"," ",t)
        if len(t)<50 or t.lower().startswith(("note:","this article","spoiler")): continue
        (quotes if t[:1] in "\"“" else prose).append(t.strip("\"“” "))
    return {"title":d["title"],"head":head,"paras":prose or quotes}
def summarize(paras):
    text=" ".join(paras[:3])
    if len(text)<=420: return text
    c=text[:420]; i=max(c.rfind(". "),c.rfind("! "),c.rfind("? "))
    return c[:i+1] if i>150 else c.rsplit(" ",1)[0]+"…"
def ok(p,core,exact):
    if not p or not p["paras"]: return False
    # A page under the item's own name (or a redirect from it) is the item;
    # otherwise it must at least read like a game page.
    return exact or bool(WORDS.search(p["head"]+" ".join(p["paras"][:2])))
def resolve(title):
    if re.match(r"^(Final choice|Finale|Lifepath|Final mission|Final faction quest)",title) or "questline" in title: return None
    core=re.sub(r"^(Boss|Treasure|Contract): ","",title) if not title.startswith("Contract:") else title
    core=re.sub(r"\s*\((\d+|Geoglyphs)\)$","",core).strip()
    for c in [core+" "+s for s in suffixes]+[core+" (mission)",core+" (quest)",core+" (Quest)",core+" (chapter)",core+" (boss)",core]:
        p=page(c)
        if ok(p,core,c==core and p and p["title"].lower().startswith(core.lower()[:6])) or (p and c!=core and p["paras"]):
            return {"page":p["title"],"text":summarize(p["paras"])}
    try: hits=api({"action":"query","list":"search","srsearch":f"{core} {gamename}","srlimit":5})["query"]["search"]
    except Exception: hits=[]
    for h in hits:
        if core.lower()[:10] in h["title"].lower():
            p=page(h["title"])
            if ok(p,core,True): return {"page":p["title"],"text":summarize(p["paras"])}
    # Pages renamed since (exact redirect)
    p=page(core)
    if p and p["paras"] and WORDS.search(p["head"]): return {"page":p["title"],"text":summarize(p["paras"])}
    return None
jobs=[]
for cat,k2 in [("missions","main"),("side","side"),("boss","boss"),("collectible","collectible"),("easter-egg","easter-egg")]:
    for n,t in enumerate(g.get(cat,[]) or []):
        if f"{k2}:{n+1}" not in have: jobs.append((f"{k2}:{n+1}",t))
res={}
with ThreadPoolExecutor(6) as ex:
    for (k,t),r in zip(jobs,ex.map(lambda j:resolve(j[1]),jobs)):
        if r: res[k]=r
json.dump(res,open(f"desc/{key}.retry.json","w",encoding="utf-8"),ensure_ascii=False,indent=0)
print(key,f"{len(res)}/{len(jobs)} recovered")
