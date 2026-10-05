import json,sys,urllib.request,urllib.parse
from concurrent.futures import ThreadPoolExecutor
def q(line):
    d,s=line.split("|",1)
    u=f"https://{d}/api.php?"+urllib.parse.urlencode({"action":"query","list":"search","srsearch":s,"srnamespace":14,"srlimit":6,"format":"json"})
    try: r=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"RewindBot/1.0"}),timeout=30)); return f"{d} | {s} => {[x['title'] for x in r['query']['search']]}"
    except Exception as e: return f"{d} | {s} ERR {e}"
lines=[l.strip() for l in open(sys.argv[1],encoding="utf-8") if l.strip()]
with ThreadPoolExecutor(8) as ex:
    for r in ex.map(q,lines): print(r[:300])
