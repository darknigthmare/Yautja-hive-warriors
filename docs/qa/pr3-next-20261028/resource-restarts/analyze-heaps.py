"""Summarize two external V8 snapshots; never edit runtime or start a browser."""
from argparse import ArgumentParser
from collections import Counter
from pathlib import Path
import hashlib
import json

parser = ArgumentParser()
parser.add_argument('--directory', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
flags = ['isObject3D', 'isMesh', 'isBone', 'isMaterial', 'isTexture', 'isBufferGeometry', 'isBufferAttribute']


def scan(path):
    body = path.read_bytes()
    data = json.loads(body)
    meta = data['snapshot']['meta']
    nodes, edges, strings = data['nodes'], data['edges'], data['strings']
    nf, ef = meta['node_fields'], meta['edge_fields']
    ns, es = len(nf), len(ef)
    ni, ei = {key: i for i, key in enumerate(nf)}, {key: i for i, key in enumerate(ef)}
    node_types, edge_types = meta['node_types'][0], meta['edge_types'][0]
    types, sizes, classes, class_sizes = Counter(), Counter(), Counter(), Counter()
    identity = {key: 0 for key in flags}
    identity.update(skeletonLike=0, playerLike=0)
    player_details = []
    cursor = 0
    for offset in range(0, len(nodes), ns):
        kind = node_types[nodes[offset + ni['type']]]
        name = strings[nodes[offset + ni['name']]]
        size = nodes[offset + ni['self_size']]
        types[kind] += 1
        sizes[kind] += size
        classes[(kind, name)] += 1
        class_sizes[(kind, name)] += size
        count = nodes[offset + ni['edge_count']]
        if kind == 'object':
            keys = set()
            details = {}
            for edge in range(cursor, cursor + count * es, es):
                if edge_types[edges[edge + ei['type']]] != 'property':
                    continue
                key = strings[edges[edge + ei['name_or_index']]]
                keys.add(key)
                if key in ['generatedVisualState', '_disposed']:
                    target = edges[edge + ei['to_node']]
                    details[key] = strings[nodes[target + ni['name']]]
            for flag in flags:
                identity[flag] += flag in keys
            identity['skeletonLike'] += 'bones' in keys and 'boneInverses' in keys
            if 'generatedVisualState' in keys:
                identity['playerLike'] += 1
                player_details.append({'constructor': name, 'properties': details})
        cursor += count * es
    return {'path': str(path), 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest(),
            'types': dict(types), 'bytesByType': dict(sizes), 'identityCounts': identity,
            'playerLikeObjects': player_details, '_classes': classes, '_classSizes': class_sizes}


before = scan(args.directory / 'cycle-20.heapsnapshot')
after = scan(args.directory / 'cycle-30.heapsnapshot')
growth = []
for key in set(before['_classes']) | set(after['_classes']):
    count = after['_classes'][key] - before['_classes'][key]
    size = after['_classSizes'][key] - before['_classSizes'][key]
    if count or size:
        growth.append({'type': key[0], 'name': key[1][:100], 'deltaCount': count, 'deltaBytes': size})
for item in [before, after]:
    del item['_classes']
    del item['_classSizes']
result = {
    'scope': 'Protocol B, fixed warmups20/measurements21-30 on the unchanged final 5089228 build. '
             'Post-menu V8 snapshot nodes counted by own identity properties; not driver memory or general leak certification.',
    'before': before, 'after': after,
    'identityDelta': {key: after['identityCounts'][key] - value for key, value in before['identityCounts'].items()},
    'bytesDeltaByType': {key: after['bytesByType'].get(key, 0) - before['bytesByType'].get(key, 0)
                         for key in set(before['bytesByType']) | set(after['bytesByType'])},
    'largestGrowingClasses': sorted(growth, key=lambda row: row['deltaBytes'], reverse=True)[:15],
    'largestShrinkingClasses': sorted(growth, key=lambda row: row['deltaBytes'])[:10],
    'limits': ['Class self-size does not measure retained-size ownership, RSS, VRAM or hardware performance.',
               'No constructor-name assumption is needed for Three/Player structural identity counts.',
               'The draw observer keeps scalar geometry metadata, so snapshot overhead belongs to this diagnostic fixture.']
}
args.output.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'beforeIdentity': before['identityCounts'], 'afterIdentity': after['identityCounts'],
                  'identityDelta': result['identityDelta'], 'bytesDeltaByType': result['bytesDeltaByType']}))
