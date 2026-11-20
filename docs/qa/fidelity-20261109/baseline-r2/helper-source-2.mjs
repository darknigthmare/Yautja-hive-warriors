// Coordinator launches this read-only virtual fixture. It writes no source/build files.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2), options = {};
if (args.length === 1 && args[0] === '--help') {
  console.log('node serve-fidelity-studio.mjs --source-root ABSOLUTE_REPOSITORY --port 4351|4353 --root-server-go'); process.exit(0);
}
for (let i = 0; i < args.length; i++) {
  const flag = args[i]; assert.ok(!options[flag], 'Duplicate option');
  if (flag === '--root-server-go') options[flag] = true;
  else { assert.ok(['--source-root', '--port'].includes(flag) && args[i + 1], 'Invalid option'); options[flag] = args[++i]; }
}
assert.equal(options['--root-server-go'], true, 'Coordinator must explicitly launch the server');
const sourceRoot = resolve(options['--source-root'] ?? ''), port = Number(options['--port']);
assert.ok(['/workspace/Yautja-continue-20261109', '/workspace/Yautja-fidelity-20261109'].includes(sourceRoot));
assert.ok([4351, 4353].includes(port));
const fixture = resolve(dirname(fileURLToPath(import.meta.url)), 'studio-scene.mjs');
async function fingerprint() {
  const files = [];
  const walk = async directory => { for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name); if (entry.isDirectory()) await walk(path);
    else if (/\.(?:js|css)$/.test(entry.name)) files.push(path);
  } };
  await walk(resolve(sourceRoot, 'js')); await walk(resolve(sourceRoot, 'css'));
  for (const name of ['index.html', 'package.json', 'package-lock.json', 'vite.config.js']) files.push(resolve(sourceRoot, name));
  const digest = createHash('sha256'); for (const file of files.sort()) digest.update(relative(sourceRoot, file) + '\0').update(await readFile(file)).update('\0');
  return { sha256: digest.digest('hex'), files: files.length };
}
const git = args => execFileSync('git', args, { cwd: sourceRoot, encoding: 'utf8' }).trim();
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Fidelity inspection fixture</title><style>
*{box-sizing:border-box}html,body{margin:0;width:1280px;height:960px;overflow:hidden;background:#303840;color:#f0f3f4;font-family:Arial,sans-serif}#viewport,#cells{position:absolute;inset:0}canvas{display:block}#caption{position:absolute;left:12px;bottom:10px;background:#121c24d9;padding:6px 10px;font-size:15px;pointer-events:none}#cells{pointer-events:none}#cells span{position:absolute;text-align:center;padding:8px;background:#111c2499;font-size:15px}
</style></head><body><div id="viewport"></div><div id="cells"></div><div id="caption"></div><script type="module" src="/__fidelity_scene.mjs"></script></body></html>`;
const { createServer } = await import(pathToFileURL(resolve(sourceRoot, 'node_modules/vite/dist/node/index.js')).href);
let server;
server = await createServer({ root: sourceRoot, configFile: false, server: { host: '127.0.0.1', port, strictPort: true, hmr: false },
  plugins: [{ name: 'fidelity-readonly-inspection',
    resolveId(id) { if (id === '/__fidelity_scene.mjs') return '\0fidelity-scene'; },
    async load(id) { if (id === '\0fidelity-scene') return readFile(fixture, 'utf8'); },
    configureServer(instance) {
      instance.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0];
        try {
          if (path === '/__fidelity_meta') {
            const source = await fingerprint(); const data = { sourceRoot, sourceCommit: git(['rev-parse', 'HEAD']), source,
              sourceTreeDirty: Boolean(git(['status', '--porcelain', '--untracked-files=all', '--', 'js', 'css', 'index.html', 'package.json', 'package-lock.json', 'vite.config.js'])),
              fixtureSha256: createHash('sha256').update(await readFile(fixture)).digest('hex') };
            res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return;
          }
          if (path === '/__fidelity_studio') {
            res.setHeader('Content-Type', 'text/html'); res.end(await instance.transformIndexHtml(path, html)); return;
          }
          next();
        } catch (error) { res.statusCode = 500; res.end(error.message); }
      });
    }
  }] });
await server.listen(); console.log(JSON.stringify({ status: 'studio_ready', sourceRoot, origin: `http://127.0.0.1:${port}`, source: await fingerprint(), writesSourceFiles: false }));
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { await server.close(); process.exit(0); });
