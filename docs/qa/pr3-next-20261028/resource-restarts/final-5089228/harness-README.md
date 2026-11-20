Status: **failed_resource_or_runtime_check**. Source: 5089228a12ac2985ef03e72782fd29e8687f6b33. Index SHA256: 643b94f665f1eb3057d35e74b8313968683372f709fdeed671b0c1045b66db0d. Dist unchanged: true.

5 warmups followed by ten real fixed-configuration restarts; all ten cleanup samples must remain identical for a resource-counter pass. Assisted direct launch, insertion and simulation updates; native RNG unchanged. A changing measured window is reported as such, never silently trimmed. Shared imported UUIDs, image dimensions, GPU uploads and observed non-disposal are checked in active scenes and after menu cleanup. Horde cached player count must be zero.

| Cycle | Phase | GPU geometries | GPU textures | Programs | Scene children | JS heap after forced GC (bytes) |
|---|---|---:|---:|---:|---:|---:|
| 1 | warmup | 83 | 50 | 17 | 12 | 14271568 |
| 2 | warmup | 93 | 50 | 17 | 12 | 15080908 |
| 3 | warmup | 95 | 50 | 17 | 12 | 15425420 |
| 4 | warmup | 95 | 50 | 17 | 12 | 15603388 |
| 5 | warmup | 95 | 50 | 17 | 12 | 15853440 |
| 6 | measured | 95 | 50 | 17 | 12 | 15930976 |
| 7 | measured | 95 | 50 | 17 | 12 | 16069960 |
| 8 | measured | 95 | 50 | 17 | 12 | 16194976 |
| 9 | measured | 95 | 50 | 17 | 12 | 16494904 |
| 10 | measured | 102 | 50 | 17 | 12 | 16531048 |
| 11 | measured | 102 | 50 | 17 | 12 | 16544552 |
| 12 | measured | 102 | 50 | 17 | 12 | 16584336 |
| 13 | measured | 102 | 50 | 17 | 12 | 16673680 |
| 14 | measured | 102 | 50 | 17 | 12 | 16745308 |
| 15 | measured | 102 | 50 | 17 | 12 | 17033664 |

Heap endpoint delta: 1102688 bytes. Renderer counters do not measure VRAM bytes. Forced-GC JS heap is neither GPU memory, process RSS nor normal-play memory. Dispose observers cover sampled resources only and keep weak resource references. Caches and the retained level/menu remain present. No general leak-freedom, hardware, human, victory or fidelity1:1 certification is claimed.
