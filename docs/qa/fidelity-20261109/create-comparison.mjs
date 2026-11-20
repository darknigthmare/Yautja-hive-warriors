// Creates an offline comparison of already recorded, unmodified screenshots.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
const args = process.argv.slice(2), option = key => args[args.indexOf(key) + 1];
assert.ok(args.length === 6 && ['--before', '--after', '--output'].every(key => args.includes(key)));
const beforePath = resolve(option('--before')), afterPath = resolve(option('--after')), output = resolve(option('--output'));
assert.ok([beforePath, afterPath, output].every(path => path.startsWith('/workspace/Yautja-fidelity-20261109/docs/qa/fidelity-20261109/')));
const before = JSON.parse(await readFile(beforePath, 'utf8')), after = JSON.parse(await readFile(afterPath, 'utf8'));
assert.equal(before.status, 'passed'); assert.equal(after.status, 'passed');
assert.equal(before.studioBefore.fixtureSha256, after.studioBefore.fixtureSha256);
assert.deepEqual(before.studioTechnicalFrame, after.studioTechnicalFrame);
const relativeToOutput = path => relative(dirname(output), path).replaceAll('\\', '/');
const cases = before.screenshots.map(row => {
  const result = after.screenshots.find(candidate => candidate.path === row.path); assert.ok(result, 'Missing final counterpart ' + row.path);
  assert.match(row.path, /^[a-zA-Z0-9:-]+\.png$/);
  const pre = before.studio.find(asset => asset.capture.path === row.path), post = after.studio.find(asset => asset.capture.path === row.path);
  if (pre?.framing) assert.deepEqual(pre.framing, post.framing, 'Controlled camera changed');
  if (pre?.assets) assert.deepEqual(pre.assets.map(asset => asset.framing), post.assets.map(asset => asset.framing), 'Sheet cameras changed');
  return { name: row.path.replace('.png', '').replaceAll('-', ' '), path: row.path,
    before: relativeToOutput(resolve(dirname(beforePath), row.path)), after: relativeToOutput(resolve(dirname(afterPath), row.path)),
    beforeSha256: row.sha256, afterSha256: result.sha256 };
});
for (const item of cases) for (const side of ['before', 'after']) {
  const bytes = await readFile(resolve(dirname(output), item[side]));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), item[side + 'Sha256'], 'Missing or changed ' + side + ' image: ' + item.path);
}
const data = { cases, before: { source: before.sourceBuildCommit, fingerprint: before.sourceFingerprint }, after: { source: after.sourceBuildCommit, fingerprint: after.sourceFingerprint },
  beforeReport: relativeToOutput(beforePath), afterReport: relativeToOutput(afterPath) };
const embedded = JSON.stringify(data).replaceAll('<', '\\u003c');
const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comparaison visuelle — 9 novembre 2026</title><style>
*{box-sizing:border-box}body{margin:0;padding:20px;background:#111820;color:#e6edf4;font:16px system-ui,sans-serif;max-width:1400px;margin:auto}h1{font-size:24px;margin:0 0 10px}p{line-height:1.5;max-width:1000px}label{display:block;margin:14px 0 5px}select,input{font:inherit;max-width:100%;width:100%;padding:9px;background:#223140;color:#e6edf4;border:1px solid #7194ac;border-radius:4px}input{padding:0;accent-color:#58c7cb}#frame{position:relative;width:100%;background:#303840;margin-top:18px;overflow:hidden}#frame img{display:block;width:100%;height:auto}#after{position:absolute;inset:0;width:100%;height:100%;clip-path:inset(0 0 0 50%)}#after img{width:100%;height:100%;object-fit:contain}.tag{position:absolute;top:12px;padding:6px 10px;background:#111820dd;border:1px solid #7e95a3}.left{left:12px}.right{right:12px}#edge{position:absolute;top:0;bottom:0;left:50%;border-left:2px solid #65dce1;pointer-events:none}a{color:#85d9ef}code{overflow-wrap:anywhere;font-size:12px}details{margin:18px 0}summary{cursor:pointer}#hashes{font-size:12px}nav{display:flex;gap:20px;margin:14px 0}footer{margin-top:16px;font-size:14px;color:#a9bdcb}
</style><h1>Comparaison des captures avant / après</h1><p>Mêmes scènes de contrôle, caméras, lumières et cadrages pour les modèles. La séquence Val Verde conserve les vraies caméras de jeu. Faites glisser la séparation ou utilisez les flèches du curseur. Les images originales restent intactes.</p>
<label for="view">Vue enregistrée</label><select id="view"></select><label for="split">Séparation avant / après : <output id="amount">50 %</output></label><input id="split" type="range" min="0" max="100" value="50" aria-label="Position de la séparation avant après">
<div id="frame"><img id="beforeImage" alt="Capture avant amélioration"><div id="after"><img id="afterImage" alt="Capture après amélioration"></div><span class="tag left">Avant</span><span class="tag right">Après</span><div id="edge"></div></div>
<nav><a id="beforeOriginal">Ouvrir l’original avant</a><a id="afterOriginal">Ouvrir l’original après</a></nav>
<details><summary>Sources et empreintes</summary><div id="sources"></div><p id="hashes"></p></details>
<footer>Contrôles automatisés. Testeurs humains : 0. Mesure FPS matériel : aucune. La ressemblance à une référence de cinéma et la fidélité 1:1 ne sont pas certifiées. Les rapports détaillent les aides de test et leurs limites.</footer>
<script>const data=${embedded};const byId=id=>document.getElementById(id),view=byId('view'),split=byId('split');for(const item of data.cases){const option=document.createElement('option');option.textContent=item.name;option.value=item.path;view.append(option)}
function select(){const item=data.cases.find(item=>item.path===view.value);byId('beforeImage').src=item.before;byId('afterImage').src=item.after;byId('beforeOriginal').href=item.before;byId('afterOriginal').href=item.after;byId('hashes').textContent='SHA-256 avant : '+item.beforeSha256+' · après : '+item.afterSha256;byId('frame').style.aspectRatio=item.path.startsWith('studio-')?'4 / 3':'16 / 9'}
function slide(){byId('after').style.clipPath='inset(0 0 0 '+split.value+'%)';byId('edge').style.left=split.value+'%';byId('amount').textContent=split.value+' %'}
view.value='studio-honor-guard-quarter.png';view.addEventListener('change',select);split.addEventListener('input',slide);select();slide();
for(const [name,info,report] of [['Avant',data.before,data.beforeReport],['Après',data.after,data.afterReport]]){const p=document.createElement('p'),a=document.createElement('a'),code=document.createElement('code');a.href=report;a.textContent=name+' — rapport';code.textContent=' · build '+info.source+' · source '+info.fingerprint;p.append(a,code);byId('sources').append(p)}
</script></html>`;
await writeFile(output, html, { flag: 'wx' }); console.log(JSON.stringify({ status: 'comparison_created', output, pairs: cases.length, originalsModified: false }));
