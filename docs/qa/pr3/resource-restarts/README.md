# QA105 — Repeated real mission cleanup

Status: **completed**. Source: 48b5bd5aa9d35fd3919ade38cf2aef55389bec5b. Frozen dist index: 124d7735003c245bc60814e6004c35ace77bd4011b31d448a6aa6c4c41dad185. Dist unchanged: true.

Two warmups followed by ten identical-configuration City Hunter / Los Angeles / one-enemy sandbox missions, each completing the real capsule insertion, rendering the live scene, returning through returnToMenu and rendering cleanup twice. Direct launch and simulation-stepped insertion are assisted fixtures. Native RNG is unchanged. No mission victories, invincibility, damage or actor-cap overrides are claimed.

| Cycle | Phase | GPU geometries | GPU textures | Programs | Scene children | CPU JS heap after explicit GC (bytes) |
|---|---|---:|---:|---:|---:|---:|
| 1 | warmup | 74 | 50 | 17 | 12 | 13395348 |
| 2 | warmup | 84 | 50 | 17 | 12 | 15126896 |
| 3 | measured | 84 | 50 | 17 | 12 | 15537020 |
| 4 | measured | 84 | 50 | 17 | 12 | 15858796 |
| 5 | measured | 84 | 50 | 17 | 12 | 16137180 |
| 6 | measured | 84 | 50 | 17 | 12 | 16189200 |
| 7 | measured | 84 | 50 | 17 | 12 | 16364492 |
| 8 | measured | 84 | 50 | 17 | 12 | 16554372 |
| 9 | measured | 84 | 50 | 17 | 12 | 16993916 |
| 10 | measured | 84 | 50 | 17 | 12 | 17156672 |
| 11 | measured | 84 | 50 | 17 | 12 | 17308604 |
| 12 | measured | 84 | 50 | 17 | 12 | 17736948 |

last-five-post-cleanup GPU/scene counters plateau; retained caches are included, no claim about all gameplay/resource paths

Renderer counters count live WebGL resources, not allocated VRAM bytes. Shared asset/creature caches and the retained level/menu remain present. Manager container counts, scene resources and observed dispose events appear in report.json. Dispose listeners only observe sampled resources; they do not instrument every allocation. Optional CDP forced GC measures CPU JS heap, not GPU memory, process RSS or normal-play usage. SwiftShader/CI results are not a hardware performance certification. No human tester or visual 1:1 certification is claimed.
