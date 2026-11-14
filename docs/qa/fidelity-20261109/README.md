# Fidelity inspection — 2026-11-09

This pass compares actual model factories and actual cooperative gameplay, with reproducible source/build pins. It uses automated browser and CPU inspection. **Human testers: 0. Hardware FPS measurements: 0. Certified film/prop likeness or 1:1 fidelity: false.**

## Final visual result

[Open the offline before/after comparator](comparison.html): **15 pairs of original captures**, with each PNG re-read and verified against its recorded SHA-256 before the HTML is generated. The common studio fixture, neutral lights and model camera frames are identical. [visual-comparison.json](visual-comparison.json) records the numerical comparison and its limits.

[final-r1/report.json](final-r1/report.json) **passes on the clean committed production build** `1a6eeb84445d5b01b13db7f4165f4d17499377e3`, source fingerprint `3d32ced7f9ed824653c77a03ec10505c3ae44e44a8beec6603f70889510b2cb2`. It contains **16 screenshots**: 12 common studio views, the separate new wood sample, and three genuine gameplay views. No console/page/HTTP/request errors or external HTTP requests were recorded. Source, fixture and production build remain unchanged through the run.

The capsule is complete in both closed/open front and quarter views; the thicker doors, seats, fittings, seals and actuators remain readable under the same light. The reviewed body corrections remain visible. Wood is recorded as an added surface, without inventing a matching baseline.

The formerly blocking decorative roof/beam hits disappear from both player views: **all six foot/chest/head probes are clear at exiting and after3s**. At opening, hits come only from moving capsule leaves, with no decorative-world hits. Native gameplay captures show the physically cleared insertion area, complete players and the same genuine cameras. This is a measured improvement for these views; it does not claim every possible view is unobstructed.

The final pilot retains the same **132 finite IDs**, **8 active actors / cap32**, HP1000/1150 after3s, and an empty player/simulation/bridge/horde after ordinary return-menu cleanup. [final-model-buffers.json](final-model-buffers.json) measures the exact final197-input source, including morph and instance buffers.

[regression-v70-r1/report.json](regression-v70-r1/report.json) also **passes all three canonical regression cases in one clean run on the same source/build pins**: source menus/co-op insertion/command/pause/checkpoint resume; autonomous Carrier acquisition and flight through real Game.update; and Ravager phase checkpoint/reprojection/recovery/fire cleanup. Browser errors, failed/external requests are zero; source, dist and helper snapshots remain unchanged; Chromium closes after all three cases. These are the disclosed assisted scenarios, not a claim of natural mission victory or exhaustive AI behavior.

| Model | Triangles before → after | Mesh objects before → after | CPU geometry/morph/instance bytes before → after |
| --- | --- | --- | --- |
| Original clan guard | 42,680 → 46,616 | 7 → 9 | 4,097,280 → 2,403,676 |
| Rifle Marine | 40,812 → 40,928 | 11 → 7 | 3,917,952 → 4,033,920 |
| Original capsule | 43,504 → 63,808 | 11 → 14 | 4,176,384 → 6,139,392 |

The guard's final9 mesh objects include39 mesh instances. The buffer values include deduplicated static/morph/instance ArrayBuffers, excluding textures, renderer/GPU allocations and JS objects. More detail has a cost: the actual after3s renderer snapshot increases from732 to898 calls and from4,475,414 to5,150,486 rendered triangles across its views/passes; these are not hardware performance results. After cleanup, memory counters settle at96 geometries/43 textures; one sequence does not establish a long-run memory plateau.

## Preserved baseline

The baseline is the intact `Yautja-continue-20261109` checkout at `a8f9c759a30bc97c5400ce48709f6ad10856003d`. That commit adds documentation only after the production build source `4ecac297e82a84c18e8b968ffbcea0c3693d29ba`; the two source/build identities are recorded separately.

| Pin | SHA-256 |
| --- | --- |
| Baseline production index | `70067415028edf40bac7085f72b56a43037f55deae2de7b332524e8f7012795a` |
| Baseline build-info | `14d4e808f5252c27667699aa220ed60afd1c2422c38579d44cc4ad819b5d02ba` |
| Baseline 193 source inputs | `a214c05a3ad459495d24cd3028e058106b57632aad6a24811b3b8456053f92f5` |
| Shared studio scene fixture | `e272d30a756f6bebe9798e9bcabb01e0c565469f9a5c8768d7c781a8b2e021ae` |

[baseline-r2/report.json](baseline-r2/report.json) passes with **15 native screenshots**, no browser/console/HTTP/request errors, no external HTTP requests, and unchanged production build/source/fixture before and after inspection. Model sheets and individual front/quarter views are captured under the same Three r160, orthographic camera, neutral RoomEnvironment, fixed lights, exposure and resolution. The studio loads the factories from the selected repository through a read-only virtual Vite module; it is separate from production gameplay.

The production scenario selects real menus: co-op → fronts → pilot → Val Verde → layout seed1 → standard. It records the genuine cameras at insertion elapsed1.8 (opening), elapsed3.25 (exiting), then three simulated seconds after the normal insertion completes. It advances actual `Game.update(1/60)` while freezing global gameplay between DOM inputs and observations. It assigns no actor position/HP, strategic time, save, capsule phase, world visibility or camera pose. Both players remain hidden during arrival, then emerge through the normal sequence. The run retains **132 finite unit IDs**, **8 active actors / cap32**, HP1000/1150 after3s, and clears players/simulation/bridge/horde through the ordinary return-menu path.

## What the baseline proves and reveals

The old honor guard is smooth and symmetric, with a narrow oval biomask, open hands and nearly vertical locks. The old Marine has a detached helmet-cap appearance, oval boots, a largely uniform torso and hands that do not convincingly hold the weapon. The old capsule reflects broad bright patches and leaves its interior difficult to read.

The Val Verde screenshots also show decorative roofs/beams across the insertion view. Collider traces alone return no hit. The supplemental **visible mesh raycasts** do find `reference-shared-instances-5` beneath `reference-landmarks-val_verde_jungle` in P2's foot/chest/head sightlines at both opening and exiting. P1's exiting rays are clear. This is recorded as an existing defect, not suppressed to make the baseline pass. A ray hitting an opening capsule leaf is distinguished by its actual object/ancestor names from a decorative-world hit.

Raycasts use an inspection-only Three r160 Raycaster loaded from the local studio. They query the actual visible scene meshes and exclude the players' own meshes. They do not alter rendering, material sides, geometry, collision or visibility. Three center-line body probes are evidence for those sightlines; they do not prove every silhouette pixel or every possible camera is unobstructed.

Renderer counts in the report are descriptive snapshots, not timing measurements. EngineRenderer may count shadow passes and both cooperative views in `info.render`; `worldTriangles` counts source scene mesh instances once. These quantities must not be compared as if both were single-view draw budgets.

## Budgets and buffer scope

[baseline-model-budgets.json](baseline-model-budgets.json) inventories the old factories. [baseline-model-buffers.json](baseline-model-buffers.json) supplements this with unique ArrayBuffer accounting, including morph and instance data. The latter is produced by [measure-model-budgets.mjs](measure-model-budgets.mjs), without a browser or renderer.

The studio's frozen `uniqueGeometryBytes` field counts **static geometry attributes/index buffers only**. It excludes morph attributes, instance matrices/colors, textures, JS objects and GPU allocations. Use the supplemental CPU report's `buffers.totalUniqueBytes` for retained geometry/morph/instance attribute bytes. Geometry buffers are deduplicated by ArrayBuffer; instance triangle/vertex counts multiply by `InstancedMesh.count`; object/material counts remain unique object counts.

[prefinal-model-buffers-r2.json](prefinal-model-buffers-r2.json) records the reviewed body/capsule source at fingerprint `8251e83d…` before the final world stair fix. It is explicitly a prefinal inventory, not evidence for a different final source fingerprint. It includes the guard's morph and lock-instance buffers, which the frozen studio static-byte field omits.

The common material sheet compares 12 existing surface types under identical light. Wood is absent in the baseline; its explicit unavailable record receives no substitute material and no before/after claim. A final wood sample can be recorded separately as a new surface.

## Sources and history

[reference-sources.json](reference-sources.json) records official NECA/Prime1 URLs, original image SHA-256 values, dimensions, observations and limits. Full commercial reference photographs remain outside Git. These miniature photos guide proportions, silhouette and equipment; they are not calibrated scans of production props. The original clan guard and original capsule keep their identities.

The first baseline run completed the same model/gameplay captures but **failed** on a studio favicon404. [history/baseline-r1/report.json](history/baseline-r1/report.json) preserves that failure, the helper snapshots and failure screenshot. Its manifest describes the full external archive at `/workspace/qa/fidelity-20261109/baseline-r1`; only the failure evidence is copied here. The fixture server was corrected with a `data:,` favicon; no game code or scene/camera/light changed. Baseline R2 is the clean rerun. [history/exploratory-r1/report.json](history/exploratory-r1/report.json) records an early, unfrozen source inspection used to request better Marine grips/eyes/collar and smoother guard anatomy; it grants no final pass.

[history/exploratory-r2/report.json](history/exploratory-r2/report.json) records the subsequent review with native face crops and an unchanged source fingerprint during that exploratory run. The targeted corrections are visible: held weapons across the eight roles, reduced white/eye prominence, a higher collar and flatter shoulder plates; continuous guard chest/abdomen, flatter knee plates and less abrupt limb attachments. It grants no production release pass.

## Reproduction

The coordinator owns preview/studio servers and grants exclusive Chromium. `serve-fidelity-studio.mjs --help` and `capture-fidelity.mjs --help` explain their explicit local inputs; `--check-config` performs no network/browser access and writes no files. The capture helper validates expected index/build-info/source hashes, snapshots its helpers, writes screenshots with their hashes, records exact errors, verifies frozen source/builds and returns a nonzero exit code on failure. New attempts always use fresh output directories.

Final candidate evidence above was recorded only after its source and production build were frozen and the same scenario completed.

The additional [verify-regression-v70.mjs](verify-regression-v70.mjs) driver reuses the previous three canonical scenarios: actual source menus/co-op insertion/command/checkpoint, natural Carrier acquisition/flight through full Game.update, and Ravager phase checkpoint/reprojection/recovery/fire. [regression-driver-provenance.json](regression-driver-provenance.json) pins the historical helpers that were copied; the historical files remain unchanged. The new driver requires a clean build and the same exact final source/index/build-info/fingerprint pins as the visual pass. The PASS above applies only to the three recorded cases and their disclosed assistance.
