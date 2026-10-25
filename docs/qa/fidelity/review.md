# Focused independent QA conclusion

**GO for this fidelity pass**, pending the coordinator's final regression and deployment verification. Five automated/agent review axes; **zero human testers, no certified 1:1 fidelity, no certified real-device FPS**.

Geometry build `397cdbf1276d3c1ef45312b5431083d11e4e94452846f7b04ed47a21bb72e5c3`: **26 integrated captures passed**. Final APC controller build `cb19eded36c19e20a5c50b94daad56d1d8550cf1c9ddff08df6d0167d7a03910`: **focused workflow passed**. Models are unchanged between these builds; images retain their original v1 digest.

| Axis | Conclusion | Practical limit |
| --- | --- | --- |
| Shape, surfaces, mechanisms | Native City housing stays rigid; City has 12 mane chains/38 segments; Big Chap has 37 bones including 4 real ankle/toe and 9 tail joints; Wolf mask and APC mechanism follow their references more closely. | City welded bundles/fused blades remain; Big Chap has boot-like feet and simplified claws; Wolf body/hair remain procedural; photographed statue/miniature references do not certify exact form or size. |
| Gameplay/state | Actual City insertion hides then reveals the body with full HP; City/Wolf keyboard first-person hides the head/mane and restores third-person; APC fires at the nearest reachable live target and ignores dead/out-of-arc blockers. | Full combat/mission/co-op regression remains the coordinator's broader suite. |
| Collision/contact/navigation | Standing actor blocks against rear-stowed APC, clears after deployment and above the assembly; navigation ownership cleans up. Big Chap contact at the sampled source phase is Y0+.005, with continuous seams/tail. | No planted-foot IK or anti-slide certification; source anatomy remains simplified. |
| Runtime budget | Same draw calls and triangle counts for City/Jungle/Big Chap fixed views. APC scene grows 40,122→48,398 triangles at the same 22 calls. One Chromium and 2 GiB Node cap. | Software-renderer counters are not real-device FPS. One retained-cache cleanup snapshot does not prove unlimited memory stability. |
| Ownership/failures | Source digests and region fingerprints fail closed; cached geometry and actor-private state reviewed; both integrated runs leave zero actors/pods/APC/navigation owners. | Keep exact source/calibration provenance when replacing assets. |

Both production-preview runs: **zero JS errors, failed asset requests or external HTTP requests**. A real APC standing-torso collision defect found during independent review was corrected before the frozen candidate. The later nearest-target/out-of-arc defect was corrected in v2 and verified with real Horde actors: 0 shots before deployment →1 shot at the reachable farther actor →0 additional shots when all targets are dead; damage240/radius3.5/cooldown1.1 unchanged.

Retained diagnostics are not concealed: the mane development pilot has four raw Vite HMR client/websocket errors, so that report is marked failed; production-preview integrated runs have none. The initial v2 QA fixture called APC.update with the wrong second argument, then was corrected to `(delta,horde)` and rerun successfully without a product change. The baseline fixture's missing public `skeletons` assumption was also corrected and retained separately.

Detailed evidence: `review.json`, `INDEPENDENT-REVIEW.md`, the v1/v2 reports, 39 baseline images, source provenance and render-budget comparison. HTTPS final smoke is prepared and awaits the coordinator's deployment/GPU go-ahead.
