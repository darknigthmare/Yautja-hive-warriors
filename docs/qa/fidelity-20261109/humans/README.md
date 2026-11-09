# Human support anatomy — 2026-11-09

This is a source-informed procedural study of adult support humans. It improves
the shared silhouette used by eight existing weapon roles. It does **not** certify
an actor likeness, measured M3/M10 prop reconstruction, or photographic 1:1 fidelity.
No paid generation was used and no human testers were involved in this work.

## Scope and sources

- Base commit supplied by the main task: `a8f9c75`.
- Runtime scope: `js/graphics/MarineAnatomy.js`; the parent task integrates it into
  the original `createMarineModel` factory, keeping its role equipment afterwards.
- Official visual comparison: [NECA, NY Toy Fair 2013](https://necaonline.com/2013/02/ny-toy-fair-aliens-series-1-marines-vs-aliens-2-packs/),
  [1024 × 768 photograph](https://necaonline.com/wp-content/uploads/2013/02/aliens-and-marines.jpg).
  Download inspected locally at
  `/workspace/qa/fidelity-20261109/references/neca-aliens-and-marines.jpg`;
  SHA-256 `6d297adc0ac1cba9af21608fbb87d7e9a82d008a39e9296e203ab009c9973c8f`.
  The licensed figures show separated shoulder plates, a fitted torso, segmented
  lower protection, soft trousers and fitted boots. Both humans are helmetless;
  this photograph cannot validate helmet construction, skin detail, facial
  likeness or exact dimensions. Prototype collectible photographs are secondary
  visual sources, not measurements of the original costumes.
- Additional official helmet/weapon reference:
  [NECA, Helmeted Hicks, 2013](https://necaonline.com/2013/07/aliens-7-scale-action-figure-helmeted-hicks-vs-battle-damaged-warrior-blue/),
  [590 × 536 photograph](https://necaonline.com/wp-content/uploads/2013/07/51396_Hicks_Blue_Alien_2pack1.jpg).
  Download inspected locally at
  `/workspace/qa/fidelity-20261109/references/neca-helmeted-hicks.jpg`;
  SHA-256 `b239d6577814a882ff3116c0e4b181e7446016a2e8a8d82e0f25a8cea1e50d36`.
  It shows a flared helmet brim, rear/ear protection, a visible face and M41A
  support under its fore-end with the right hand on the pistol grip. The small
  promotional image does not validate exact prop construction or facial likeness.
- Baseline image inspected: `docs/qa/sculpt-marine.png`. It shows a smooth shared
  mannequin body, thick footwear and understated facial features. It is an old
  repository image, not a controlled new before/after render.
- Instructions: repository `AGENTS.md`, canon reference dated 2026-11-08 and the
  `create-game-assets` / `performance-optimization` guides pinned at
  `19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9`, using Three r160.

## Changes

Continuous adult-shaped trousers, sleeves and torso replace the earlier shared
surfaces. Small folds, closed thigh pockets, shaped knee inserts, boot shafts,
heels, soles, seams, laces and individual curved fingers add useful silhouette
detail. The breastplate has a fitted continuous front, separated shoulder pieces,
straps, buckles, a flexible abdomen and belt pouches. The helmet gains a brim,
rear guard, ear fittings and a restrained microphone. Broad shallow shoulder
plates have flat crowns and chamfered sides instead of inflated spherical caps.

The eyes, brows, nostrils and lips are placed against ray intersections with the
actual sculpted head. The previous fixed-depth eyes could be buried beneath the
face. Colored facial details share one vertex-colored material; small fittings use
a single bevel ring instead of the generic three-ring rounded box. This spends
triangles on the silhouette and face while leaving the existing weapon allowance.
The sclera is restrained by the eyelids and a raised collar reduces the exposed
neck. Hands and forearms fit the original weapon meshes by role: under-barrel
support, pistol/MP9 two-hand grips and the SADAR shoulder-launcher grip.

No universal faction badges or character identity were added, because corporate
humans also use this factory. No source IDs, roles, weapon behavior, animation,
physics radius, faction or progression were edited. Existing weapon transforms,
root transform, Y0 feet and the 3.445-unit helmet envelope remain intact. The
visual wrist poses now reach the actual weapons; the original wrist positions
are retained separately in metadata for traceability.

## Verification

`node --test tests/marine-anatomy-fidelity.test.js`: **5/5 pass**.
The existing `tests/source-actor-presentation.test.js` also passed its six tests,
including distinct role geometry, saved source classes and operational headcounts.

The isolated body has **36,920 triangles / 7 material batches**. Its lowest point
is Y0 and its highest point is Y3.444999933. Its UVs, normals and positions are
finite. Twelve front chest rays hit armor; rays at both eyes and the mouth hit
facial details in front of skin. Two separately constructed actors own separate
facial geometry/materials, and disposal releases each owned resource once.

The role baseline was measured with the original body and weapons after the
parent's identical Assembly extraction; it is recorded in `baseline-metrics.json`.
Actual integrated factory buffers were then measured with
`node docs/qa/fidelity-20261109/humans/measure-humans.mjs`; the reproducible JSON,
including source hashes and finite-buffer checks, is `integrated-metrics.json`.

| Role | Before triangles / meshes | After triangles / meshes |
| --- | ---: | ---: |
| Marine | 40,812 / 11 | 40,928 / 7 |
| Smartgunner | 41,004 / 11 | 41,120 / 7 |
| Flametrooper | 40,284 / 11 | 40,400 / 7 |
| Medic | 42,336 / 12 | 42,452 / 8 |
| CommTech | 42,232 / 12 | 42,348 / 8 |
| Sniper | 41,292 / 11 | 41,408 / 7 |
| SADAR | 38,300 / 11 | 38,416 / 7 |
| Exosuit | 43,560 / 11 | 43,676 / 7 |

Each role gains 116 triangles while removing four mesh/material batches. All
remain below the existing 46,000-triangle / 12-mesh allowance. The legacy boolean
factory arguments still select Smartgunner and Flametrooper. The CommTech's
existing antenna still extends above the helmet; the other helmets remain at
Y3.444999933. These counts are not an FPS measurement or a whole-game budget.
The main task's separate AI QA pass supplied controlled native captures at
`/workspace/qa/fidelity-20261109/exploratory-r2/`. The Marine quarter view and
eight-role sheet were inspected: both hands now visibly support their weapons,
including the Medic's two-hand pistol grip and the SADAR's grip/fore-end support.
The reduced sclera, higher collar and flatter shoulder plates are visible in the
same lighting. These are visual checks by AI agents, not human QA or certification
of a measured costume, weapon or portrait. Fidelity flags remain false.
