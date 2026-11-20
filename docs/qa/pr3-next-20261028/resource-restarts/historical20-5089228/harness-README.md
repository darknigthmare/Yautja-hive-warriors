Status: **passed_resource_counters_and_texture_residency**. Source: 5089228a12ac2985ef03e72782fd29e8687f6b33. Index SHA256: 643b94f665f1eb3057d35e74b8313968683372f709fdeed671b0c1045b66db0d. Dist unchanged: true.

20 warmups followed by ten real fixed-configuration restarts; all ten cleanup samples must remain identical for a resource-counter pass. Assisted direct launch, insertion and simulation updates; native RNG unchanged. A changing measured window is reported as such, never silently trimmed. Shared imported UUIDs, image dimensions, GPU uploads and observed non-disposal are checked in active scenes and after menu cleanup. Horde cached player count must be zero.

| Cycle | Phase | GPU geometries | GPU textures | Programs | Scene children | JS heap after forced GC (bytes) |
|---|---|---:|---:|---:|---:|---:|
| 1 | warmup | 69 | 47 | 17 | 12 | 14268924 |
| 2 | warmup | 79 | 50 | 17 | 12 | 15142968 |
| 3 | warmup | 95 | 50 | 17 | 12 | 15553668 |
| 4 | warmup | 95 | 50 | 17 | 12 | 15753500 |
| 5 | warmup | 95 | 50 | 17 | 12 | 15973364 |
| 6 | warmup | 105 | 50 | 17 | 12 | 16032480 |
| 7 | warmup | 105 | 50 | 17 | 12 | 16184188 |
| 8 | warmup | 105 | 50 | 17 | 12 | 16264576 |
| 9 | warmup | 115 | 50 | 17 | 12 | 16586004 |
| 10 | warmup | 115 | 50 | 17 | 12 | 16639860 |
| 11 | warmup | 115 | 50 | 17 | 12 | 16676060 |
| 12 | warmup | 115 | 50 | 17 | 12 | 16695940 |
| 13 | warmup | 115 | 50 | 17 | 12 | 16729288 |
| 14 | warmup | 115 | 50 | 17 | 12 | 16769044 |
| 15 | warmup | 115 | 50 | 17 | 12 | 16773700 |
| 16 | warmup | 115 | 50 | 17 | 12 | 16835264 |
| 17 | warmup | 115 | 50 | 17 | 12 | 16849832 |
| 18 | warmup | 115 | 50 | 17 | 12 | 16873396 |
| 19 | warmup | 115 | 50 | 17 | 12 | 16911072 |
| 20 | warmup | 115 | 50 | 17 | 12 | 16941272 |
| 21 | measured | 115 | 50 | 17 | 12 | 16949852 |
| 22 | measured | 115 | 50 | 17 | 12 | 16964916 |
| 23 | measured | 115 | 50 | 17 | 12 | 16973212 |
| 24 | measured | 115 | 50 | 17 | 12 | 16975120 |
| 25 | measured | 115 | 50 | 17 | 12 | 16987916 |
| 26 | measured | 115 | 50 | 17 | 12 | 16996080 |
| 27 | measured | 115 | 50 | 17 | 12 | 17027836 |
| 28 | measured | 115 | 50 | 17 | 12 | 17046228 |
| 29 | measured | 115 | 50 | 17 | 12 | 17068028 |
| 30 | measured | 115 | 50 | 17 | 12 | 17349976 |

Heap endpoint delta: 400124 bytes. Renderer counters do not measure VRAM bytes. Forced-GC JS heap is neither GPU memory, process RSS nor normal-play memory. Dispose observers cover sampled resources only and keep weak resource references. Caches and the retained level/menu remain present. No general leak-freedom, hardware, human, victory or fidelity1:1 certification is claimed.
