from pathlib import Path
from collections import Counter
import json,hashlib
base=Path('/workspace/qa/pr3-20261028/memory-residency/cache-release-corrected')
def summarize(path):
 data=json.loads(path.read_text()); meta=data['snapshot']['meta']; nodes=data['nodes'];edges=data['edges'];strings=data['strings'];nf=meta['node_fields'];ef=meta['edge_fields'];ns=len(nf);es=len(ef);types=meta['node_types'][0];etypes=meta['edge_types'][0]; ni={k:i for i,k in enumerate(nf)};ei={k:i for i,k in enumerate(ef)};bytype=Counter();size=Counter();byclass=Counter();classbytes=Counter();players=[];cursor=0
 for at in range(0,len(nodes),ns):
  typ=types[nodes[at+ni['type']]];name=strings[nodes[at+ni['name']]];byt=nodes[at+ni['self_size']];bytype[typ]+=1;size[typ]+=byt;key=(typ,name);byclass[key]+=1;classbytes[key]+=byt
  if typ=='object':
   props={}
   for p in range(cursor,cursor+nodes[at+ni['edge_count']]*es,es):
    if etypes[edges[p+ei['type']]]!='property':continue
    label=strings[edges[p+ei['name_or_index']]]
    if label in ['generatedVisualState','_disposed']:
     target=edges[p+ei['to_node']];props[label]=strings[nodes[target+ni['name']]]
   if 'generatedVisualState' in props:players.append({'constructor':name,'properties':props})
  cursor+=nodes[at+ni['edge_count']]*es
 return {'file':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'types':dict(bytype),'bytesByType':dict(size),'playerLikeObjects':players,'_classCounts':byclass,'_classBytes':classbytes}
a=summarize(base/'cycle-20.heapsnapshot');b=summarize(base/'cycle-30.heapsnapshot')
keys=set(a['_classCounts'])|set(b['_classCounts']);rows=[]
for key in keys:
 count=b['_classCounts'][key]-a['_classCounts'][key];byt=b['_classBytes'][key]-a['_classBytes'][key]
 if count or byt:rows.append({'type':key[0],'name':key[1][:100],'deltaCount':count,'deltaBytes':byt})
rows.sort(key=lambda x:x['deltaBytes'],reverse=True)
for v in [a,b]:v.pop('_classCounts');v.pop('_classBytes')
out={'scope':'V8 snapshot summaries of two post-cleanup points of an isolated 48b5 runtime with only Horde cached-player release, corrected timer lifecycle and fixed-camera fixtures; not VRAM or hardware certification','before':a,'after':b,'countDeltaByType':{k:b['types'].get(k,0)-a['types'].get(k,0)for k in set(a['types'])|set(b['types'])},'bytesDeltaByType':{k:b['bytesByType'].get(k,0)-a['bytesByType'].get(k,0)for k in set(a['bytesByType'])|set(b['bytesByType'])},'largestGrowingClasses':rows[:20],'largestShrinkingClasses':sorted(rows,key=lambda x:x['deltaBytes'])[:10]}
path=Path('/workspace/Yautja-next-20261028/docs/qa/memory-residency-20261028/heap-summary.json');path.write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'beforePlayers':a['playerLikeObjects'],'afterPlayers':b['playerLikeObjects'],'bytesDeltaByType':out['bytesDeltaByType'],'largestGrowingClasses':rows[:10]},indent=2))
