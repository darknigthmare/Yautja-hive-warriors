# QA105 — Repeated real mission cleanup

Status: **completed**. Source: null. Frozen dist index: e90644ce7f244481f2e409d73a1cd7db69e221cdb80a5459ad6322638b62e099. Dist unchanged: true.

Twenty warmups followed by ten identical-configuration City Hunter / Los Angeles / one-enemy sandbox missions, each completing the real capsule insertion, rendering the live scene, returning through returnToMenu and rendering cleanup twice. Direct launch and simulation-stepped insertion are assisted fixtures. Native RNG is unchanged. No mission victories, invincibility, damage or actor-cap overrides are claimed.

| Cycle | Phase | GPU geometries | GPU textures | Programs | Scene children | CPU JS heap after explicit GC (bytes) |
|---|---|---:|---:|---:|---:|---:|
| 1 | warmup | 64 | 47 | 17 | 12 | 13917000 |
| 2 | warmup | 80 | 47 | 17 | 12 | 14611144 |
| 3 | warmup | 90 | 50 | 17 | 12 | 15069532 |
| 4 | warmup | 100 | 50 | 17 | 12 | 15253036 |
| 5 | warmup | 100 | 50 | 17 | 12 | 15554480 |
| 6 | warmup | 100 | 50 | 17 | 12 | 15615496 |
| 7 | warmup | 100 | 50 | 17 | 12 | 15647764 |
| 8 | warmup | 100 | 50 | 17 | 12 | 15700896 |
| 9 | warmup | 100 | 50 | 17 | 12 | 16029944 |
| 10 | warmup | 100 | 50 | 17 | 12 | 16044956 |
| 11 | warmup | 100 | 50 | 17 | 12 | 16061464 |
| 12 | warmup | 100 | 50 | 17 | 12 | 16135256 |
| 13 | warmup | 100 | 50 | 17 | 12 | 16150372 |
| 14 | warmup | 100 | 50 | 17 | 12 | 16241200 |
| 15 | warmup | 100 | 50 | 17 | 12 | 16239072 |
| 16 | warmup | 100 | 50 | 17 | 12 | 16260468 |
| 17 | warmup | 100 | 50 | 17 | 12 | 16276616 |
| 18 | warmup | 100 | 50 | 17 | 12 | 16290500 |
| 19 | warmup | 100 | 50 | 17 | 12 | 16327524 |
| 20 | warmup | 100 | 50 | 17 | 12 | 16327608 |
| 21 | measured | 110 | 50 | 17 | 12 | 16367128 |
| 22 | measured | 110 | 50 | 17 | 12 | 16461876 |
| 23 | measured | 110 | 50 | 17 | 12 | 16550564 |
| 24 | measured | 110 | 50 | 17 | 12 | 16531084 |
| 25 | measured | 110 | 50 | 17 | 12 | 16544660 |
| 26 | measured | 110 | 50 | 17 | 12 | 16554700 |
| 27 | measured | 110 | 50 | 17 | 12 | 16581648 |
| 28 | measured | 110 | 50 | 17 | 12 | 16619916 |
| 29 | measured | 110 | 50 | 17 | 12 | 16596996 |
| 30 | measured | 110 | 50 | 17 | 12 | 16851760 |

last-five-post-cleanup GPU/scene counters plateau; retained caches are included, no claim about all gameplay/resource paths

Renderer counters count live WebGL resources, not allocated VRAM bytes. Shared asset/creature caches and the retained level/menu remain present. Manager container counts, scene resources and observed dispose events appear in report.json. Dispose listeners only observe sampled resources; they do not instrument every allocation. Optional CDP forced GC measures CPU JS heap, not GPU memory, process RSS or normal-play usage. SwiftShader/CI results are not a hardware performance certification. No human tester or visual 1:1 certification is claimed.
