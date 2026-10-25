# Independent QA review — fidelity pass

Automated checks and an independent agent's visual/code review across five axes. Human testers: **0**. Certified 1:1 fidelity: **false**. Real hardware FPS certification: **none**.

## Build provenance and decision

- Frozen production baseline: index SHA-256 `8683a627c08e1c2647913aa29dc375df8cdde08c69da18895981de2b5c5fae6f`, commit `8e343fa36cb8f536dfa80ee2c8a7869a670afb12`; 18 broad +21 close frames.
- Integrated geometry pass: index SHA-256 `397cdbf1276d3c1ef45312b5431083d11e4e94452846f7b04ed47a21bb72e5c3`; `final-v1/report.json`, **passed**, 26 captures.
- Final APC target-selection fix: index SHA-256 `cb19eded36c19e20a5c50b94daad56d1d8550cf1c9ddff08df6d0167d7a03910`; `final-v2/report.json`, **passed**. This second build changes the APC controller, leaving the model geometry unchanged. The coordinator confirmed APCModel SHA-256 remains `0ba2c4158a7af99e354ca6e4f6ceaa37168ab2371be87d91c3d420c10da7b067`. Geometry comparison images retain their original v1 provenance; they are not relabelled as v2 captures.
- Source GLB paths, sizes, digests and public/dist equality: `source-provenance.json`.
- Both integrated browser passes: zero JavaScript errors, zero failed asset requests, zero external HTTP requests; only one Chromium running at a time. Browsers and their own preview servers closed after each pass.

Decision: **GO for these source-preserving improvements and the corrected gameplay controller**, subject to the coordinator's final regression/deployment checks. This does not mean all remaining source-art or 1:1 limitations have been solved.

## 1. Shape, surfaces and mechanisms

**City Hunter right housing:** inspected native close front/rear views and read the rigid conversion. The housing now follows the calibrated forearm instead of blending arm/hand deformation. Source positions at rest, UVs, triangle indices and borrowed actor PBR materials remain intact; original source surfaces are hidden only while the private replacement is enabled and restored on disposal. This is **not** separate retractable native wristblades. Fused blade geometry remains a documented source limitation; no guessed separation was enabled.

**City mane:** integrated browser reports 12 chains/38 simulated segments, adding ten actual distal regions to the two previous chains. The rest silhouette is retained and collars are fixed. Pilot and final close views show no new scalp tear or detached shoulder/neck surface. The added movement is modest, measured in the centimetre range at the game's scale. Broad side bundles remain welded; this is not ten full independent dreadlocks or a reconstruction of missing hair topology. The development pilot's four Vite HMR errors are retained in its failed report; the production-preview candidate has none.

**Big Chap:** reviewed 26 paired pilot frames and six foot close-ups. Separate ankle/toe motion is visible in walk/run; calf/foot seams remain continuous, with no new stretched strips. At idle, comparison outside captions has zero pixels changing by more than 8/255 in either profile (mean absolute RGB difference below 0.000004), supporting the unchanged rest silhouette. Real loaded gameplay asset has 37 bones, including four new ankle/toe joints and the existing nine-joint tail. Foot topology still resembles a simplified boot with weak/missing claw anatomy; the method cannot recover missing source anatomy or textures. It is not a planted-foot IK/anti-slide solver.

**Wolf:** inspected before/after portraits and the original Prime 1 b191/b195/b196 reference photographs. The V-shaped brow, smaller lowered mesh lenses, more compact muzzle, crown studs and rougher metal improve the fallback's identity. Crown contour, muzzle proportions, dense hammering/pitting and deep scars remain approximations. The body and hair remain procedural. Licensed statue photographs under artistic lighting provide reference direction, not orthographic measurements or a 1:1 certificate.

**APC:** reviewed rear-stowed, corner, flank and elevated images against NECA miniature front/side/elevation photographs. Rectangular running strips, rear rail return, moving shoe and independent complete gun elevation are visible. The service flank differs from the access-door flank as in the reference. Travel dimensions and motion reconstruction are local interpretations. Paint wear, markings and several prop proportions remain approximate.

## 2. Gameplay and state transitions

- Real City insertion hides the imported body before opening/exit, then hands off visible with full HP. Integrated states: body imported, mask attached, right housing ready, original City grounding applied, 12 mane chains/38 segments.
- Actual keyboard `I` toggles first-person for City and Wolf. City imported head surfaces and mane hide, hair simulation suspends; Wolf's fallback head hides. Third-person head visibility restores. HP remains 850/1150 respectively in the controlled checks.
- Paired creature fixtures use actual GLTFLoader textures and source clips; final integrated request uses the production Horde API and same-origin model assets.
- APC waits for full deployment before firing. In v2, three real Horde actors demonstrate that a nearer target outside the depression stop cannot block a farther reachable live target. A closer dead actor is ignored; when all candidates are dead no additional shot fires. Damage 240, radius 3.5 and cooldown 1.1 remain intact.
- Full combat pacing, co-op, gates and mission regression are owned by the coordinator's existing browser suite; this focused pass does not claim a complete new playthrough of every map.

## 3. Contacts, collision and navigation

- QA identified a real defect in the proposed APC implementation: slicing only at the actor's foot plane allowed the standing torso through the rear stowed housing. The agent corrected it to intersect a vertical actor slab, then project a convex XZ outline.
- Production runtime validates rear standing contact: displacement 0.5176 in the stowed pose, zero at the same point after deployment, and zero when the actor's feet are above the stowed assembly. The navigation owner appears once and is removed on cleanup. Navigation bounds are half-width 2.52, half-depth 5.8, height 2.48; physical collision follows actual moving pieces.
- Big Chap uses exact compact supports for all 8,138 reviewed foot-region vertices. Integrated source run phase 0.5890 reports minimum foot height 0.005, bounded visual offset 0.0111, non-limited contact, and continuous tail clearance. Source-backed CPU evidence covers 66 walk/run phases; screenshots do not establish planted-foot anti-slide or movie-accurate sole anatomy.

## 4. Runtime budget

Same controlled views, baseline → candidate:

| View | Draw calls | Rendered triangles |
| --- | ---: | ---: |
| City wrist/mane | 35 → 35 | 323,381 → 323,381 |
| Jungle mane | 16 → 16 | 270,905 → 270,905 |
| Big Chap full profile | 16 → 16 | 232,283 → 232,283 |
| APC stowed/deployed | 22 → 22 | 40,122 → 48,398 |

These totals include the controlled presentation scene. Full data: `render-budget-comparison.json`. Joint count increases support articulation without increasing character triangle counts. APC detail adds 8,276 visible triangles in the fixed scene while keeping calls unchanged. No actual device FPS target has been measured or certified.

The Node harness is capped at 2 GiB. Browser evaluate returns only primitive snapshots, selected IDs or short plain data; no Three.js graph serialization. Final cleanup retains cached assets (54 geometries/63 textures/12 programs after v1) while leaving no live player, Horde actors, pods, APC or navigation owner. One retained-cache snapshot is not a proof of indefinite memory stability; ownership/disposal tests provide complementary coverage.

## 5. Ownership, failures and reproducibility

Read source validation and source-backed tests: mane and ankles require exact source digests, geometry fingerprints, measured regions and bounded motion; malformed descriptors fail instead of guessing. Preparations are cached, mutable actor bones/controller state are private, and the gauntlet borrows the actor's PBR materials without disposing them. The actor-private housing geometry is disposed once; source visibility is restored. Creature ankle disposal runs before skeleton cleanup; existing source loading/cancellation/fallback lifecycle remains in use.

Both integrated browser passes confirm return-to-menu removes player, aliens, pods, carrier and its navigation owner. The first baseline harness wrongly expected a public player `skeletons` property; the first v2 harness used the wrong APC.update argument signature. Those fixture failures are retained separately; corrected reruns passed. Neither fixture error required a production change.

Reproducible harnesses: `capture-baseline.mjs`, `capture-close-baseline.mjs`, `capture-candidate.mjs`, and `check-final-workflow.mjs`. Future public HTTPS verification is prepared in `smoke-public-final.mjs`, expects `FIDELITY_INDEX_SHA256`, and is not run until the coordinator gives the deployment/GPU go-ahead.
