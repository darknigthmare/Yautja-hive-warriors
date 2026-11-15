#!/usr/bin/env python3
"""Classical cutout gate before a paid reference upload (Pillow + numpy).

Preserves the source pixel grid and foreground RGB. Protected landmarks catch
lost feet, fingers, dread tips or opaque mask eyes. Three image-specific visual
reviews are still mandatory: pixel checks cannot identify a character or infer
an occluded body part. No network or Meshy requests are performed.
"""
import argparse
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

import numpy as np
from PIL import Image


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def audit(manifest):
    errors = []
    paths = {key: Path(manifest[key]) for key in ('source', 'cutout', 'composite')}
    images = {key: Image.open(path) for key, path in paths.items()}
    hashes = {key: sha(path) for key, path in paths.items()}
    sizes = {key: list(image.size) for key, image in images.items()}
    for key, expected in manifest.get('expected_sha256', {}).items():
        if key not in hashes or hashes[key] != expected:
            errors.append(f'{key}: file changed since selection')
    if set(manifest.get('expected_sha256', {})) != set(paths):
        errors.append('source, cutout and composite checksums must be frozen before review')
    if len({image.size for image in images.values()}) != 1:
        return {'pixel_checks_passed': False, 'eligible_for_paid_submission': False,
                'errors': [*errors, 'source pixel grid changed: no resizing or recropping'],
                'sha256': hashes, 'sizes': sizes}
    if images['source'].getexif().get(274, 1) != 1:
        errors.append('source orientation needs a separately recorded lossless normalization')
    if images['cutout'].mode != 'RGBA':
        errors.append('cutout must be RGBA with explicit isolation alpha')
    source = np.asarray(images['source'].convert('RGB'), dtype=np.uint8)
    cutout = np.asarray(images['cutout'].convert('RGBA'), dtype=np.uint8)
    composite = np.asarray(images['composite'].convert('RGB'), dtype=np.uint8)
    alpha = cutout[:, :, 3]
    foreground = alpha > 0
    changed = np.any(source != cutout[:, :, :3], axis=2) & foreground
    if changed.any():
        errors.append(f'{int(changed.sum())} foreground pixels have reconstructed or changed RGB')
    if not foreground.any() or foreground.all():
        errors.append('isolation must contain both subject and removed background')
    if foreground[0].any() or foreground[-1].any() or foreground[:, 0].any() or foreground[:, -1].any():
        errors.append('isolated subject touches canvas edge; review possible clipping')
    background = manifest.get('background_rgb', [128, 128, 128])
    if (not isinstance(background, list) or len(background) != 3 or
            any(not isinstance(v, int) or not 0 <= v <= 255 for v in background)):
        raise ValueError('background_rgb must contain three byte values')
    factor = alpha.astype(np.float64)[:, :, None] / 255
    expected = np.rint(source * factor + np.array(background) * (1 - factor)).astype(np.uint8)
    composite_delta = np.abs(composite.astype(np.int16) - expected.astype(np.int16))
    if composite_delta.max() > 1:
        errors.append('composite does not match source RGB + declared isolation alpha/background')
    eye_structure = manifest.get('eye_structure')
    if manifest.get('component') == 'biomask' and eye_structure not in ('opaque_filters', 'open_apertures', 'continuous_bone'):
        errors.append('declare the actual reference eye structure: opaque_filters, open_apertures or continuous_bone')
    landmarks = []
    for point in manifest.get('protected_points', []):
        name, x, y, radius = point['name'], point['x'], point['y'], point.get('radius', 1)
        valid = (all(isinstance(v, int) and not isinstance(v, bool) for v in (x, y, radius))
                 and radius >= 0 and 0 <= x - radius <= x + radius < alpha.shape[1]
                 and 0 <= y - radius <= y + radius < alpha.shape[0])
        expected_alpha = point.get('expected_alpha', 0 if manifest.get('component') == 'biomask' and eye_structure == 'open_apertures' and name in ('left-eye', 'right-eye') else 255)
        if expected_alpha not in (0, 255):
            errors.append(f'{name}: expected_alpha must be zero or 255')
            valid = False
        passed = bool(valid and np.all(alpha[y-radius:y+radius+1, x-radius:x+radius+1] == expected_alpha))
        landmarks.append({'name': name, 'passed': passed})
        if not passed:
            errors.append(f'protected landmark differs from its declared surface/aperture: {name}')
    component = manifest.get('component')
    required = ({'left-foot', 'right-foot', 'left-hand', 'right-hand', 'head', 'dread-tip'}
                if component == 'body' else ({'left-bone-panel', 'right-bone-panel', 'bone-bridge', 'lower-opening'} if eye_structure == 'continuous_bone' else {'left-eye', 'right-eye'}) if component == 'biomask'
                else {'proximal-end', 'distal-end'})
    if not required.issubset({p['name'] for p in manifest.get('protected_points', [])}):
        errors.append('required anatomy landmarks have not been reviewed for this component')
    visual = []
    required_checks = {'identity', 'complete_silhouette', 'cutout_edges', 'component_readability'}
    for review in manifest.get('visual_reviews', []):
        if (isinstance(review.get('reviewer'), str) and review['reviewer'].strip()
                and review.get('passed') is True and review.get('sha256') == hashes
                and required_checks.issubset(set(review.get('checks', [])))
                and isinstance(review.get('evidence'), list) and review['evidence']):
            visual.append(review['reviewer'])
    reviewed = len(set(visual)) >= 3
    return {'schemaVersion': 1, 'asset_id': manifest.get('asset_id'),
            'pixel_checks_passed': not errors, 'eligible_for_paid_submission': not errors and reviewed,
            'errors': errors, 'sha256': hashes, 'sizes': sizes,
            'changed_foreground_pixels': int(changed.sum()),
            'foreground_pixels': int(foreground.sum()),
            'composite_max_channel_delta': int(composite_delta.max()),
            'protected_landmarks': landmarks, 'independent_visual_reviewers': sorted(set(visual)),
            'visual_review_pending': not reviewed, 'new_paid_requests': 0,
            'note': 'Passing is necessary, not proof of 1:1 likeness, hidden surfaces or 3D topology.'}


class CutoutGateTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='reference-audit-')
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.source = np.zeros((32, 32, 3), dtype=np.uint8)
        self.source[:] = [80, 140, 170]
        self.source[5:27, 7:25] = [30, 40, 50]
        self.alpha = np.zeros((32, 32), dtype=np.uint8)
        self.alpha[5:27, 7:25] = 255
        self.manifest = {'asset_id': 'synthetic-test-only', 'component': 'biomask', 'eye_structure': 'opaque_filters',
                         'protected_points': [{'name': 'left-eye', 'x': 10, 'y': 10},
                                              {'name': 'right-eye', 'x': 20, 'y': 10}]}
        self.write()

    def write(self, foreground=None):
        rgba = np.dstack([self.source if foreground is None else foreground, self.alpha])
        Image.fromarray(self.source).save(self.root / 'source.png')
        Image.fromarray(rgba).save(self.root / 'cutout.png')
        a = self.alpha[:, :, None].astype(float) / 255
        rgb = np.rint(self.source * a + 128 * (1-a)).astype(np.uint8)
        Image.fromarray(rgb).save(self.root / 'composite.png')
        for key in ('source', 'cutout', 'composite'):
            self.manifest[key] = str(self.root / f'{key}.png')
        self.manifest['expected_sha256'] = {k: sha(self.manifest[k]) for k in ('source', 'cutout', 'composite')}

    def reviews(self):
        hashes = self.manifest['expected_sha256']
        self.manifest['visual_reviews'] = [
            {'reviewer': name, 'passed': True, 'sha256': hashes.copy(),
             'checks': ['identity', 'complete_silhouette', 'cutout_edges', 'component_readability'],
             'evidence': ['synthetic fixture inspected for software test only']}
            for name in ('author-test', 'reviewer-test', 'final-test')]

    def test_no_visual_review_cannot_release_even_lossless_pixels(self):
        result = audit(self.manifest)
        self.assertTrue(result['pixel_checks_passed'])
        self.assertFalse(result['eligible_for_paid_submission'])

    def test_current_three_reviews_release(self):
        self.reviews()
        self.assertTrue(audit(self.manifest)['eligible_for_paid_submission'])

    def test_missing_eye_is_rejected_despite_unchanged_remaining_pixels(self):
        self.alpha[9:12, 9:12] = 0
        self.write()
        self.reviews()
        result = audit(self.manifest)
        self.assertFalse(result['pixel_checks_passed'])
        self.assertTrue(any('left-eye' in e for e in result['errors']))

    def test_real_open_eye_apertures_are_preserved_when_declared(self):
        self.manifest['eye_structure'] = 'open_apertures'
        self.alpha[9:12, 9:12] = 0
        self.alpha[9:12, 19:22] = 0
        self.write()
        self.reviews()
        self.assertTrue(audit(self.manifest)['eligible_for_paid_submission'])

    def test_continuous_bone_cover_does_not_get_fake_eye_holes(self):
        self.manifest['eye_structure'] = 'continuous_bone'
        self.manifest['protected_points'] = [
            {'name': 'left-bone-panel', 'x': 10, 'y': 10},
            {'name': 'right-bone-panel', 'x': 20, 'y': 10},
            {'name': 'bone-bridge', 'x': 15, 'y': 10},
            {'name': 'lower-opening', 'x': 15, 'y': 29, 'expected_alpha': 0}]
        self.reviews()
        self.assertTrue(audit(self.manifest)['eligible_for_paid_submission'])
        self.alpha[9:12, 9:12] = 0
        self.write()
        self.reviews()
        self.assertFalse(audit(self.manifest)['eligible_for_paid_submission'])

    def test_reconstructed_subject_is_rejected(self):
        altered = self.source.copy()
        altered[8, 9] = [31, 40, 50]
        self.write(altered)
        self.assertEqual(audit(self.manifest)['changed_foreground_pixels'], 1)

    def test_edit_invalidates_previous_visual_approvals(self):
        self.reviews()
        self.alpha[20, 20] = 0
        self.write()
        self.assertFalse(audit(self.manifest)['eligible_for_paid_submission'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', nargs='?', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(CutoutGateTests))
        raise SystemExit(0 if result.wasSuccessful() else 1)
    if not args.manifest:
        parser.error('a manifest or --self-test is required')
    result = audit(json.loads(args.manifest.read_text()))
    content = json.dumps(result, indent=2, ensure_ascii=False) + '\n'
    if args.output:
        args.output.write_text(content)
    print(content, end='')
    raise SystemExit(0 if result['eligible_for_paid_submission'] else 2)


if __name__ == '__main__':
    main()
