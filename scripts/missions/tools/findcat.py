# findcat.py domain "query" — categories matching a query
import json,sys,urllib.request,urllib.parse
d,q=sys.argv[1],sys.argv[2]
u=f"https://{d}/api.php?"+urllib.parse.urlencode({"action":"query","list":"search","srsearch":q,"srnamespace":14,"srlimit":8,"format":"json"})
try: r=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"RewindBot/1.0"}),timeout=30))
except Exception as e: print(d,q,"ERR",e); sys.exit()
print(d,"|",q,"=>",[x["title"] for x in r["query"]["search"]])
