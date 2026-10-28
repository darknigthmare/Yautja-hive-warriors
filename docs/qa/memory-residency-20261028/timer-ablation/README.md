# Deadline-timer ablation

The original frozen release48b5 was exercised in22 real mission start/insertion/render/cleanup cycles. The first12 reproduce the old harness (2warmups+10measurements). The twelve120-second asset-settlement deadline timers were then cancelled, without changing the game, followed by10more cycles with correctly cancelled deadlines.

The explicit-GC CPU heap fell from17,567,156 to16,429,036bytes immediately after clearing those timers (−1,138,120bytes). The report retains each cycle, the precise before/after measurements and the unchanged build hashes. The old harness’s full run lasted83seconds, shorter than its120-second deadlines.

This identifies a measurement retention effect; it does not prove absence of every application leak. Later lazy caches and V8/inspector metadata are analyzed separately in the parent report. No human/hardware/VRAM or1:1 claim is made.
