# Source-measured Big Chap ankles and toes

`ImportedAnkleRig.js` is an optional, source-specific correction. It adds four
real weighted joints to `char1`: one ankle and one toe hinge per foot. The
previous correction deliberately bound both feet to the calves because the
provider's native pivots and skin produced stretched strips. This module uses
new pivots within the actual source surface and keeps the original clips for
the rest of the body.

## Source and measurements

- Rig GLB SHA256: `202b5d7d635cdb14fcf8af430faba3207d5668f43f85d9d9dca1f81cc0d8a97e`.
- Walk SHA256: `ae87707f9fa53e246d629c44c454ec6b58b98e0396330e9561476f43bc0e43da`.
- Run SHA256: `7944bc681cef08d822905b099a79963710517dd14898e0c526dcced2cf7b827d`.
- Source: 211,185 vertices, 205,259 triangles, 24 native bones.
- The existing nine-joint tail can be prepared first; the resulting skeleton
  contains 37 bones after adding the four ankle/toe joints.
- Only the previously reviewed 4,611 left and 3,527 right calf/foot vertices
  receive the new weights. 5,081 receive nonzero ankle/toe influence; the calf
  collars remain rigid. No position, triangle, normal, tangent, UV or material
  is added, removed or rewritten.

The native left foot joint is at source position `[.1999,.2608,.5669]`, while
the entire reviewed left region ends at `z=.2718`. The new source-space ankle
pivots are `[.187,.235,.014]` and `[-.084,.235,-.661]`; the toe hinges are
`[.234,.065,.159]` and `[-.13,.075,-.591]`. These positions were measured from
calf/foot cross-sections. Both feet point towards positive source z, although
their calves have different rest directions. Mirroring the left calibration
onto the right is incorrect.

New inverse binds preserve the complete original skin matrix, including the
provider's unusual 100x inverse-bind scale. World-space pivot conversion must
use the refreshed mesh/bind transforms. Treating the raw bone-local coordinates
as source positions introduces large errors.

## Motion and contact

The actual native `Foot` and `ToeBase` quaternions drive the measured joints.
Signed rotation around the measured lateral axis is extracted relative to the
first frame of the selected source clip. Gain is .5, bounded at .18 radians
for the ankle and .12 for the toe. Source translations/scales are deliberately
not transferred to the new pivots. Unknown clips and idle use the exact new
joint rest pose. There is no accumulated simulation state or frame-rate
dependent spring.

Weights have sixteen blend steps per joint transition. Each distinct blend
has its own source convex hull. There are 1,953 support vertices in 66 groups,
covering all 8,138 reviewed vertices exactly under linear blend skinning. The
runtime transforms six skin matrices and scans only those compact supports;
it does not scan the complete feet or source model. No arrays, matrices or
support sets are allocated per update.

Contact uses a bounded vertical correction of the visual orientation, with
the same .005 clearance and .18 maximum as the previous rigid-foot helper.
It fades out in airborne frames and bypasses wall-climbing orientations. The
physics actor is untouched. This is real ankle/toe articulation plus visual
height compensation; it is **not** a planted-foot IK solver. The tail must be
updated afterwards to account for the resulting visual height.

## Integration

Prepare after the calibrated skin repair and optional tail, before actor
cloning and size normalization:

```js
const ankled = prepareImportedAnkleTemplate(tailed.template, config.ankleRig, {
  sourceSha256: entry.sha256,
});
const template = ankled.template;
// Clone and normalize template as usual.
const ankleRig = createImportedAnkleController(root, orientation, model, ankled.ankles);
```

After updating the original animation mixer and removing planar root motion:

```js
ankleRig?.update(activeClip?.name, moving);
tailRig?.update(phase, moving);
```

Use the old `footGrounding` helper only if `ankled.ankles` is null: its rigid
support assumption does not apply to articulated feet. Forward LOD changes to
`ankleRig.setDetailLevel(level)` and call `ankleRig.dispose()` before disposing
the adapter. Hidden roots and nonzero LOD levels skip all ankle work. Pause
uses the caller's existing stopped simulation phase. Actors share prepared
geometry/materials and own their bones and diagnostic state.

## CPU evidence and visual limitation

Run:

```sh
node --max-old-space-size=2048 --test --test-concurrency=1 tests/imported-ankle-rig.test.js
```

The source hash-checked offline generator is
`scripts/calibrate-big-chap-ankles.mjs`. It requires Python 3, NumPy and SciPy
only during calibration. `node scripts/calibrate-big-chap-ankles.mjs --check`
recomputes the weights/hulls and verifies the checked-in descriptor byte for
byte; omitting `--check` regenerates it.

The six source-backed tests verify complete rest preservation, exact support
against every actual calf/foot vertex in 33 walk and 33 run phases, unchanged
non-foot weights/body clip poses, tail clearance, explicit airborne frames,
independent instances, live parent scale, LOD, idle, deterministic replay,
disposal and rejected source/calibration mismatches.

Values below use game units, without a certified physical size. At standing
height 3.9537, measured results are:

| Measurement | Walk | Run |
| --- | ---: | ---: |
| Distinct articulated poses / 33 | 31 | 32 |
| Maximum real foot-surface displacement | .1023 | .1135 |
| Maximum visual contact correction | .0895 | .1159 |
| Minimum actual foot height | .005 | .005 |
| Exact support error | < 3e-16 | < 7e-16 |
| Preserved airborne frames | 6 | 15 |

All 526 region boundary edges keep their original rigid calf influences;
5,048 coincident source foot positions keep identical weights across UV
splits. Across all 18,299 touching triangle edges and all 66 poses, the maximum
edge-length change is .01277. No new hole or detached strip is introduced.

These measurements establish actual source articulation and continuity. They
do not establish a film-accurate 1:1 Big Chap. The source still has simplified
claws/toes and jaw anatomy, and the module cannot reconstruct missing forms or
texture detail.

## Rendered source review, 2026-10-25

The private comparison fixture loaded the actual GLBs through `GLTFLoader`
and the real gameplay adapter. It captured 26 controlled before/after views
and six further close-ups of both feet in idle, walk and run. Chromium reported
zero rendering errors. The full creature remains 205,259 triangles; only the
four joints and skin influences change.

The actual source base color and normal textures are 4096 by 4096, and the
shared roughness/metalness texture is 2048 by 2048. Their identities are
unchanged between variants. The two idle comparisons have less than 9e-6
changed-pixel fraction outside the label, with a maximum difference of one
8-bit level. The source rest silhouette therefore remains visually stable as
well as numerically preserved.

Visual review shows modest, real ankle flexion, continuous calf/foot surfaces
and an intact independent tail. The closer views also clearly expose the
remaining boot-like source feet: individual digits, claws and sole anatomy
are still simplified. The running left foot approaches its thigh in the
original clip. These images support continuity and actual joint motion; they
do not certify film anatomy or a planted, anti-sliding contact solution.

Artifacts for this session are under
`/workspace/qa/creature-fidelity-20261025/pilot/` and `close/`, including exact
source/module hashes, real PBR identities, camera settings and pose diagnostics
in each `report.json`. These are automated captures, with zero human testers.

An isolated fixed-pose CPU benchmark on the shared cloud Node 24 environment
measured 2,500 controller updates: median .0255 ms and p95 .0303 ms for both
articulated feet. The old rigid support helper measured .0144/.0201 ms with
the same actor. Rendering and the original mixer/tail are separate work.
