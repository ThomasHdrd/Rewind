# chaincat.py domain "Category:Name" — order a category's pages by their
# infobox previous/next links (chapters, missions, levels).
import json,re,sys,urllib.request,urllib.parse
from concurrent.futures import ThreadPoolExecutor
d,cat=sys.argv[1],sys.argv[2]
def api(p):
    u=f"https://{d}/api.php?"+urllib.parse.urlencode({**p,"format":"json"})
    return json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"RewindBot/1.0"}),timeout=40))
members=[];cont={}
while True:
    r=api({"action":"query","list":"categorymembers","cmtitle":cat,"cmlimit":500,"cmnamespace":0,**cont})
    members+=[m["title"] for m in r["query"]["categorymembers"]]
    if "continue" not in r: break
    cont=r["continue"]
PREV=r"(?:prev|previous|preceded[ _]by|before|prev_mission|previous mission|prevmission|last)"
NEXT=r"(?:next|followed[ _]by|after|next_mission|next mission|nextmission)"
def link(field,t):
    m=re.search(r"\|\s*"+field+r"\s*=\s*([^\n]*)",t,re.I)
    if not m: return None
    l=re.search(r"\[\[([^\]|#]+)",m.group(1))
    return l.group(1).strip() if l else None
def info(title):
    try: t=api({"action":"parse","page":title,"prop":"wikitext","section":0})["parse"]["wikitext"]["*"]
    except Exception: return title,(None,None)
    return title,(link(PREV,t),link(NEXT,t))
with ThreadPoolExecutor(8) as ex: links=dict(ex.map(info,members))
norm=lambda s:(s or "").replace("_"," ").strip().lower()
byname={norm(m):m for m in members}
heads=[m for m,(p,n) in links.items() if not p or norm(p) not in byname]
best=[]
for h in heads:
    seq=[h];seen={h}
    while True:
        n=links.get(seq[-1],(None,None))[1]
        nm=byname.get(norm(n))
        if not nm or nm in seen: break
        seq.append(nm);seen.add(nm)
    if len(seq)>len(best): best=seq
print(json.dumps({"members":len(members),"chain":best},ensure_ascii=False))
