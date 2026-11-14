"""Run only the two explicitly prepared local clones, never the original build."""
import concurrent.futures
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

REPO = Path('/workspace/Yautja-hive-warriors')
EVIDENCE = REPO / 'docs/qa/pr3/reproducibility'
STAGE = Path('/workspace/qa/pr3-20261026/vercel-static-prebuilt/.vercel/output/static')
COMMIT = '48b5bd5aa9d35fd3919ade38cf2aef55389bec5b'
BRANCH = 'codex/complete-pr3-20261026'
CACHE = '/tmp/pr3-npm-repro-cache'
CLONES = [Path('/tmp/pr3-repro-a'), Path('/tmp/pr3-repro-b')]


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def snapshot(directory):
    return {str(path.relative_to(directory)): {'bytes': path.stat().st_size, 'sha256': digest(path)}
            for path in sorted(directory.rglob('*')) if path.is_file()}


def differences(reference, candidate):
    return [{'file': name, 'reference': reference.get(name), 'candidate': candidate.get(name)}
            for name in sorted(set(reference) | set(candidate)) if reference.get(name) != candidate.get(name)]


def local(command, root):
    return subprocess.check_output(command, cwd=root, text=True).strip()


def reproduce(root):
    assert root in CLONES and root != REPO
    label = root.name[-1]
    head = local(['git', 'rev-parse', 'HEAD'], root)
    branch = local(['git', 'branch', '--show-current'], root)
    clean = local(['git', 'status', '--porcelain', '--untracked-files=all'], root)
    assert head == COMMIT and branch == BRANCH and clean == '', (root, head, branch, clean)
    env = dict(os.environ)
    env.pop('SOURCE_DATE_EPOCH', None)  # The build uses the exact source commit timestamp.
    result = {'clone': str(root), 'sourceCommit': head, 'sourceBranch': branch, 'cleanBefore': True,
              'commitEpoch': int(local(['git', 'show', '-s', '--format=%ct', 'HEAD'], root)),
              'sourceDateEpochOverride': None, 'startedAt': now(), 'commands': []}
    for key, command in [('install', ['npm', 'ci', '--cache', CACHE, '--no-audit', '--no-fund']),
                         ('build', ['npm', 'run', 'build'])]:
        started = time.monotonic()
        log = EVIDENCE / f'{key}-{label}.txt'
        with log.open('w') as output:
            completed = subprocess.run(command, cwd=root, env=env, stdout=output, stderr=subprocess.STDOUT)
        result['commands'].append({'name': key, 'argv': command, 'cwd': str(root), 'exitCode': completed.returncode,
                                   'durationSeconds': round(time.monotonic() - started, 3),
                                   'log': str(log.relative_to(REPO)), 'logSha256': digest(log)})
        if completed.returncode != 0:
            result['status'] = f'{key}_failed'
            return result
    result['cleanAfter'] = local(['git', 'status', '--porcelain', '--untracked-files=all'], root) == ''
    result['files'] = snapshot(root / 'dist')
    result['buildInfo'] = json.loads((root / 'dist/build-info.json').read_text())
    result['packageLockSha256'] = digest(root / 'package-lock.json')
    result['status'] = 'built'; result['completedAt'] = now()
    return result


def main():
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    reference = snapshot(STAGE)
    original_before = snapshot(REPO / 'dist')
    report = {'schemaVersion': 1, 'criterion': 'AUD-114', 'status': 'running', 'startedAt': now(),
              'sourceCommit': COMMIT, 'sourceBranch': BRANCH, 'stage': str(STAGE),
              'node': local(['node', '--version'], REPO), 'npm': local(['npm', '--version'], REPO),
              'installCache': CACHE, 'remoteGitActions': False, 'deployments': 0, 'browserSessions': 0,
              'reference': reference, 'referenceFiles': len(reference),
              'referenceModels': sum(name.endswith('.glb') for name in reference),
              'originalDistMatchedReferenceBefore': original_before == reference}
    assert len(reference) == 30 and report['referenceModels'] == 12
    assert original_before == reference, 'The original build no longer matches its frozen stage'
    assert json.loads((STAGE / 'build-info.json').read_text())['sourceCommit'] == COMMIT
    (EVIDENCE / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        runs = list(pool.map(reproduce, CLONES))
    report['runs'] = runs
    passed = True
    for run in runs:
        if run['status'] != 'built':
            passed = False
            continue
        run['differencesFromStage'] = differences(reference, run['files'])
        run['exactFiles'] = len(reference) - len(run['differencesFromStage'])
        run['exactModels'] = sum(name.endswith('.glb') and value == run['files'].get(name) for name, value in reference.items())
        run['buildInfoExact'] = run['files'].get('build-info.json') == reference['build-info.json']
        run['status'] = 'passed' if run['cleanAfter'] and not run['differencesFromStage'] else 'failed_comparison'
        passed = passed and run['status'] == 'passed'
    report['originalDistUnchanged'] = snapshot(REPO / 'dist') == original_before
    report['stageUnchanged'] = snapshot(STAGE) == reference
    report['cloneBuildsMutuallyIdentical'] = len(runs) == 2 and all('files' in run for run in runs) and runs[0]['files'] == runs[1]['files']
    report['status'] = 'passed' if passed and report['originalDistUnchanged'] and report['stageUnchanged'] and report['cloneBuildsMutuallyIdentical'] else 'failed'
    report['completedAt'] = now()
    report['scope'] = 'Two clean installs and independent production builds on the same Linux host, source commit and branch. Every output byte, including all GLBs and build-info, is compared; no cross-OS claim.'
    (EVIDENCE / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: report[key] for key in ['status', 'referenceFiles', 'referenceModels', 'originalDistUnchanged', 'stageUnchanged', 'cloneBuildsMutuallyIdentical']}, indent=2))
    raise SystemExit(0 if report['status'] == 'passed' else 1)


if __name__ == '__main__':
    main()
