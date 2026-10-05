# describe.py key domain [cats] — resolve each item's wiki page and extract a short summary
import json,re,sys,html,urllib.request,urllib.parse
from concurrent.futures import ThreadPoolExecutor
key,domain=sys.argv[1],sys.argv[2]
cats=(sys.argv[3] if len(sys.argv)>3 else "main,side,boss").split(",")
OUT=sys.argv[4] if len(sys.argv)>4 else key
g=json.load(open(f"games/{key}.json",encoding="utf-8"))
GAMEWORDS=re.compile(r"mission|quest|chapter|act\b|boss|level|storyline|stage|contract|job|tale|favor|campaign|encounter",re.I)
def api(params):
    u=f"https://{domain}/api.php?"+urllib.parse.urlencode({**params,"format":"json"})
    return json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"RewindBot/1.0 (rewind.expo.app)"}),timeout=40))
def paragraphs(page):
    try: d=api({"action":"parse","page":page,"prop":"text","redirects":1})["parse"]
    except Exception: return None,[]
    h=d["text"]["*"]
    if "disambig" in h.lower()[:3000] or "may refer to" in h.lower(): return d["title"],None
    h=re.sub(r"<(aside|table|figure|style|script|blockquote|div class=\"(?:toc|quote|navbox|notice)[^\"]*\")[\s\S]*?</\1>","",h)
    h=re.sub(r"<(aside|table|figure|style|script|blockquote)[\s\S]*?</\1>","",h)
    out=[]
    for p in re.findall(r"<p>([\s\S]*?)</p>",h):
        t=html.unescape(re.sub(r"<[^>]+>","",p)).strip()
        t=re.sub(r"\[\d+\]|\[citation needed\]","",t).strip()
        if len(t)>50 and not t.startswith(("\"","“")): out.append(t)
    return d["title"],out
def summarize(paras):
    text=" ".join(paras[:3])
    if len(text)<=420: return text
    cut=text[:420]; i=max(cut.rfind(". "),cut.rfind("! "),cut.rfind("? "))
    return cut[:i+1] if i>150 else cut.rsplit(" ",1)[0]+"…"
LOOSE=False
def resolve(title,hint=None):
    if hint:
        page,paras=paragraphs(hint)
        if paras: return {"page":page,"text":summarize(paras)}
    t=re.sub(r"^(Boss|Treasure): ","",title)
    t=re.sub(r"\s*\((\d+|Geoglyphs|The Last One|[A-Z][a-z]+ [a-z]+)\)$","",t).strip()
    if re.match(r"^(Final choice|Finale|Lifepath|Final mission|Final faction quest)",title): return None
    cands=[t+" (mission)",t+" (quest)",t+" (Quest)",t+" (chapter)",t]
    for c in cands:
        page,paras=paragraphs(c)
        if paras and GAMEWORDS.search(" ".join(paras[:2])): return {"page":page,"text":summarize(paras)}
    try:
        hits=api({"action":"query","list":"search","srsearch":t,"srlimit":3})["query"]["search"]
    except Exception: hits=[]
    for h in hits:
        if t.lower()[:12] in h["title"].lower() or (LOOSE and set(re.findall(r"[a-z]{4,}",t.lower())) & set(re.findall(r"[a-z]{4,}",h["title"].lower()))):
            page,paras=paragraphs(h["title"])
            if paras: return {"page":page,"text":summarize(paras)}
    return None
LOOSE=any(c in ("collectible","easter-egg") for c in cats)
jobs=[]
for cat in cats:
    for n,title in enumerate(g.get("missions" if cat=="main" else cat,[]) or []):
        jobs.append((f"{cat}:{n+1}",title,(g.get("pages") or [None]*9999)[n] if cat=="main" else None))
res={}
with ThreadPoolExecutor(6) as ex:
    for (k,title,_),r in zip(jobs,ex.map(lambda j:resolve(j[1],j[2]),jobs)):
        if r: res[k]=r
json.dump({"wiki":domain,"items":res},open(f"desc/{OUT}.json","w",encoding="utf-8"),ensure_ascii=False,indent=0)
print(key,f"{len(res)}/{len(jobs)} described")
