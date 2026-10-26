import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

// The clock defaults to the source commit time so rebuilding one source tree
// produces the same metadata. SOURCE_DATE_EPOCH can pin an explicit release.
function buildIdentity() {
  const git = args => { try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };
  const root = resolve(import.meta.dirname), files = [];
  const walk = directory => { for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) walk(path); else if (/\.(?:js|css)$/.test(entry.name)) files.push(path);
  } };
  walk(resolve(root, 'js')); walk(resolve(root, 'css'));
  for (const name of ['index.html', 'package.json', 'package-lock.json', 'vite.config.js']) files.push(resolve(root, name));
  const hash = createHash('sha256');
  for (const path of files.sort()) hash.update(relative(root, path) + '\0').update(readFileSync(path)).update('\0');
  const epoch = Number(process.env.SOURCE_DATE_EPOCH ?? git(['show', '-s', '--format=%ct', 'HEAD']));
  return { schemaVersion: 1, contentVersion: 'v67-pr3-integration', sourceCommit: git(['rev-parse', 'HEAD']),
    sourceBranch: git(['branch', '--show-current']), sourceFingerprint: hash.digest('hex'), sourceFiles: files.length,
    sourceTreeDirty: Boolean(git(['status', '--porcelain', '--untracked-files=all', '--', 'js', 'css', 'index.html', 'package.json', 'package-lock.json', 'vite.config.js'])),
    buildEpoch: Number.isFinite(epoch) && epoch > 0 ? epoch : null,
    reproducibleBuildDate: Number.isFinite(epoch) && epoch > 0 ? new Date(epoch * 1000).toISOString() : null,
    deploymentProof: 'https://github.com/darknigthmare/Yautja-hive-warriors/blob/codex/complete-pr3-20261026/docs/qa/pr3-validation.json' };
}

export default defineConfig({
  plugins: [{ name: 'verified-build-identity', generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify(buildIdentity(), null, 2) + '\n' });
  } }],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            { name: 'visual-effects', test: /node_modules[\\/]three[\\/]examples/ },
            { name: 'engine', test: /node_modules[\\/]three[\\/](?:build|src)/ },
            { name: 'confetti', test: /node_modules[\\/]canvas-confetti/ }
          ]
        }
      }
    }
  }
});
