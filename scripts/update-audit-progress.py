#!/usr/bin/env python3
"""Update only the 126 Suivi cells of the preserved PR #3 workbook.

The source assertions, formats, other worksheets, tables and formulas remain
byte-for-byte unchanged. A completed criterion requires explicitly reviewed,
hash-pinned local evidence; adding a catalogue label is not acceptance evidence.
"""
import argparse
import hashlib
import html
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parent.parent
AUDIT = ROOT / 'docs/audits/2026-10-26'
FILENAME = 'Yautja_Hive_Warriors_Audit_Dynasty_Warriors_2026-10-26.xlsx'
SOURCE_FILENAME = FILENAME.replace('.xlsx', '.source.xlsx')
SHEET = 'xl/worksheets/sheet3.xml'
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
STATUSES = {'À faire', 'En cours', 'À valider', 'Terminé', 'Bloqué'}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def archive(path):
    with zipfile.ZipFile(path) as workbook:
        return {entry.filename: workbook.read(entry.filename) for entry in workbook.infolist()}


def source_rows():
    data = json.loads((AUDIT / 'audit-data.json').read_text())
    return next(sheet['rows'] for sheet in data['sheets'] if sheet['name'] == 'Manquants')


def cells(xml):
    output = {}
    for cell in ET.fromstring(xml).findall('s:sheetData/s:row/s:c', NS):
        value = cell.find('s:v', NS)
        output[cell.attrib['r']] = value.text if value is not None else ''
    return output


def cell_pattern(reference):
    return re.compile(r'(<(?:[A-Za-z_][\w.-]*:)?c\b[^>]*\br="' + re.escape(reference)
                      + r'"[^>]*>)(.*?)(</(?:[A-Za-z_][\w.-]*:)?c>)', re.S)


def replace_value(xml, reference, value):
    pattern = cell_pattern(reference)
    matches = list(pattern.finditer(xml))
    if len(matches) != 1:
        raise ValueError(f'{reference}: exactly one original cell is required')
    match = matches[0]
    if 't="str"' not in match.group(1) or '<x:f' in match.group(2):
        raise ValueError(f'{reference}: source must retain its calibrated string-cell representation')
    content, changed = re.subn(r'(<(?:[A-Za-z_][\w.-]*:)?v>).*?(</(?:[A-Za-z_][\w.-]*:)?v>)',
                               lambda item: item.group(1) + html.escape(value, quote=False) + item.group(2),
                               match.group(2), flags=re.S)
    if changed != 1:
        raise ValueError(f'{reference}: source value is missing or ambiguous')
    return xml[:match.start()] + match.group(1) + content + match.group(3) + xml[match.end():]


def normalize_followups(xml, mapping):
    text = xml.decode('utf-8')
    for reference in mapping.values():
        text = replace_value(text, reference, '__FOLLOWUP_ONLY__')
    return text


def compare_preserved(source, working, mapping):
    if set(source) != set(working):
        raise ValueError('Workbook members changed; refusing to discard unrelated edits')
    for name in source:
        if name == SHEET:
            if normalize_followups(source[name], mapping) != normalize_followups(working[name], mapping):
                raise ValueError('Non-Suivi cells or sheet formatting changed; refusing to overwrite them')
        elif source[name] != working[name]:
            raise ValueError(f'Unrelated workbook member changed: {name}')


def validate_progress(progress, rows):
    records = progress.get('actions')
    expected = {row['id'] for row in rows}
    if not isinstance(records, dict) or set(records) != expected:
        raise ValueError('Progress must contain each of the 126 source action IDs exactly once')
    evidence_checks = []
    for row in rows:
        record = records[row['id']]
        if record.get('status') not in STATUSES:
            raise ValueError(f"{row['id']}: unsupported follow-up status")
        if record.get('acceptance') != row['acceptance']:
            raise ValueError(f"{row['id']}: original acceptance criterion must remain intact")
        if record.get('status') == 'Bloqué' and not record.get('notes'):
            raise ValueError(f"{row['id']}: a blocked action needs a concrete reason")
        if record.get('status') != 'Terminé':
            continue
        if record.get('acceptanceVerified') is not True or not record.get('evidence'):
            raise ValueError(f"{row['id']}: completion needs explicit acceptance verification and evidence")
        for proof in record['evidence']:
            if proof.get('kind') not in {'test', 'runtime', 'review'} or not proof.get('scope'):
                raise ValueError(f"{row['id']}: evidence must state its test/runtime/review coverage")
            relative = Path(proof.get('path', ''))
            if relative.is_absolute() or '..' in relative.parts:
                raise ValueError(f"{row['id']}: evidence must be a local repository artifact")
            path = (ROOT / relative).resolve()
            if not path.is_relative_to(ROOT) or not path.is_file():
                raise ValueError(f"{row['id']}: evidence artifact is missing")
            digest = sha(path.read_bytes())
            if proof.get('sha256') != digest:
                raise ValueError(f"{row['id']}: evidence hash changed or is not pinned")
            evidence_checks.append({'action': row['id'], 'path': str(relative), 'sha256': digest})
    return evidence_checks


def initialize(progress_path, working):
    original = AUDIT / SOURCE_FILENAME
    if progress_path.exists():
        raise ValueError('Progress already exists; initialization never overwrites reviewed work')
    if not original.exists():
        original.write_bytes(working.read_bytes())
    rows = source_rows()
    progress = {
        'auditCommit': '0435827e41eae19472179e8116d9eb4105647664',
        'codeSnapshot': '0f37cc52f9d83a4abecc17b80f7bfc67701677cf',
        'latestMainAtStart': '9c18c196c794b77f6bcfa02045c960080d955cfa',
        'sourceWorkbook': SOURCE_FILENAME, 'sourceWorkbookSha256': sha(original.read_bytes()),
        'workingWorkbook': FILENAME, 'humanTesters': 0, 'fidelity1to1Verified': False,
        'scope': 'Implementation follow-up. Original findings and acceptance criteria remain historical source records.',
        'actions': {row['id']: {'status': 'À faire', 'priority': row['priority'], 'domain': row['domain'],
            'item': row['item'], 'acceptance': row['acceptance'], 'acceptanceVerified': False,
            'evidence': [], 'notes': ''} for row in rows},
    }
    progress_path.write_text(json.dumps(progress, indent=2, ensure_ascii=False) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--progress', type=Path, default=AUDIT / 'implementation-progress.json')
    parser.add_argument('--workbook', type=Path, default=AUDIT / FILENAME)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--init', action='store_true')
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.init:
        initialize(args.progress, args.workbook)
    progress = json.loads(args.progress.read_text())
    original = AUDIT / progress['sourceWorkbook']
    if sha(original.read_bytes()) != progress['sourceWorkbookSha256']:
        raise ValueError('The immutable source workbook changed')
    rows = source_rows()
    evidence = validate_progress(progress, rows)
    source = archive(original)
    original_cells = cells(source[SHEET])
    mapping = {row['id']: f'N{index + 7}' for index, row in enumerate(rows)}
    for index, row in enumerate(rows):
        if original_cells.get(f'A{index + 7}') != row['id']:
            raise ValueError('Excel action order differs from the original audit')
    compare_preserved(source, archive(args.workbook), mapping)
    desired = source[SHEET].decode('utf-8')
    for action, reference in mapping.items():
        desired = replace_value(desired, reference, progress['actions'][action]['status'])
    if args.write:
        temporary = args.workbook.with_suffix('.pending.xlsx')
        try:
            with zipfile.ZipFile(original) as baseline, zipfile.ZipFile(temporary, 'w') as output:
                for entry in baseline.infolist():
                    output.writestr(entry, desired.encode('utf-8') if entry.filename == SHEET else source[entry.filename])
            compare_preserved(source, archive(temporary), mapping)
            temporary.replace(args.workbook)
        finally:
            temporary.unlink(missing_ok=True)
    current = archive(args.workbook)
    if current[SHEET] != desired.encode('utf-8'):
        raise ValueError('Follow-up cells differ from progress; run --write after reviewing evidence')
    counts = {status: sum(record['status'] == status for record in progress['actions'].values()) for status in sorted(STATUSES)}
    report = {'status': 'passed', 'actions': len(rows), 'followupColumn': 'N', 'counts': counts,
        'changedMembers': [name for name in source if source[name] != current[name]],
        'allNonFollowupContentPreserved': True, 'evidenceChecks': evidence,
        'sourceWorkbookSha256': sha(original.read_bytes()), 'workingWorkbookSha256': sha(args.workbook.read_bytes()),
        'remainingP0': [row['id'] for row in rows if row['priority'] == 'P0' and progress['actions'][row['id']]['status'] != 'Terminé'],
        'humanTesters': progress.get('humanTesters', 0), 'fidelity1to1Verified': progress.get('fidelity1to1Verified', False)}
    if args.report:
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, OSError, zipfile.BadZipFile) as error:
        print(json.dumps({'status': 'failed', 'error': str(error)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
