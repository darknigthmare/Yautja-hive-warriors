from pathlib import Path
import json
base=Path('/workspace/qa/pr3-20261028/memory-residency/cache-release-corrected')
flags=['isObject3D','isMesh','isBone','isMaterial','isTexture','isBufferGeometry','isBufferAttribute']
def scan(path):
 x=json.loads(path.read_text());m=x['snapshot']['meta'];nf=m['node_fields'];ef=m['edge_fields'];nt=m['node_types'][0];et=m['edge_types'][0];n=x['nodes'];e=x['edges'];s=x['strings'];ns=len(nf);es=len(ef);ni={a:i for i,a in enumerate(nf)};ei={a:i for i,a in enumerate(ef)};counts={k:0 for k in flags};counts.update(skeletonLike=0,playerLike=0);cursor=0
 for at in range(0,len(n),ns):
  if nt[n[at+ni['type']]]=='object':
   keys=set()
   for p in range(cursor,cursor+n[at+ni['edge_count']]*es,es):
    if et[e[p+ei['type']]]=='property':keys.add(s[e[p+ei['name_or_index']]])
   for flag in flags:
    if flag in keys:counts[flag]+=1
   if 'bones'in keys and 'boneInverses'in keys:counts['skeletonLike']+=1
   if 'generatedVisualState'in keys:counts['playerLike']+=1
  cursor+=n[at+ni['edge_count']]*es
 return counts
before=scan(base/'cycle-20.heapsnapshot');after=scan(base/'cycle-30.heapsnapshot');out={'method':'Count reachable V8 object nodes with own Three identity flags or required skeleton/player properties; not driver memory. Raw snapshots remain outside the repository.','before':before,'after':after,'delta':{k:after[k]-before[k]for k in before}}
p=Path('/workspace/Yautja-next-20261028/docs/qa/memory-residency-20261028/structural-heap-counts.json');p.write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
