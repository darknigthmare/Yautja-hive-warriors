# Independent automated QA — open work, 2026-10-24

The harness loads the real production app and generated body/mask/creature assets. Controlled paused frames inspect animation and mechanisms; accelerated combat uses actual damage/death callbacks and physical gate movement. These checks are automated, with no human testers and no certified 1:1 fidelity.

- Harness: `check-open-work.mjs`; modes `--scope=characters|tail|battlefield|all`, optional HTTPS origin.
- Browser suite: `node --test --test-concurrency=1 tests/browser.test.mjs tests/gameplay.test.mjs tests/render-browser.test.mjs`.
- One Chromium runs at a time. Vite preview serves the existing `dist`; this harness does not rebuild.
- Report `indexSha256` identifies the exact build inspected. Intermediate reports must not be presented as proof of a later build.

## Intermediate evidence

Build index SHA `92a5d0d113362be4590fffbdb82503dbe496ea310a29cb0930795f8bdca1d3e0`:

- `intermediate-92a5/tail-report.json`: PASS. Two real Big Chap actors, private nine-joint tails, 28,590 selected tail vertices, five motion phases above the floor, independent idle motion, LOD and cleanup. Matched source run at phase 6.0868357663: former rigid tail minimum −0.178122 m; articulated tail minimum +0.027376 m.
- `intermediate-92a5/battlefield-report.json`: PASS. Relay 0/8 → 6/8 remains closed; 8/8 opens gate and turns secured visual green; pending queue canceled. Four screenshots show the actual terminal state changes.
- These reports predate optional full-foot grounding and the final City/APC adjustments.

## Final validation in progress

The first complete browser run on index `8c1e168…` is preserved as `final-browser-tests.log`:14/15 PASS, one partial-relay fixture assertion failed. The exact first partial count was not logged; the fixture had assumed3.1s already passed sector grace plus spawn delay and blasted the entire batch. Its correction waits for actual arrival and isolates one true enemy, preserving partial-progress and locked-gate assertions.

Corrected build index `9fdd19169a75d324dbde0e77bddbac90167e81ca19bfb06880084246a4bad6d6`: `final-browser-v2-targeted-report.json` and `.log` record3/3 PASS (relay, full five-map campaign, rendering/co-op export),177.9s, zero skips. The relay first batch arrived after5.1s, then1/8 stayed locked and8/8 opened. The final full real-asset harness passed locally; no public v2 validation has been performed.


## Final real-asset harness — PASS

`all-report.json`, index `9fdd19169a75d324dbde0e77bddbac90167e81ca19bfb06880084246a4bad6d6`, records 19 captures, zero JavaScript/console errors, zero failed asset requests and zero external requests.

- Real City Hunter and Jungle Hunter with separate masks: equal distance/phase at30/60/120fps; delta0 and pause freeze controlled poses; rejected displacement earns no step; two City actors retain private joints/mechanisms.
- City console: original plate740 triangles, original material/UVs; rest renders the source plate/housing and hides the interior; open renders the hinged plate and visible glyph screen; EMP actual key opens it. Review `city-console-closed-back.png`, `city-console-open-back.png`, `city-console-emp.png`. The opposite 'front' view intentionally looks through the body and is retained as an occluded control angle.
- First-person camera: actual `game.update` at10/30/60/120fps after warmup, actual KeyI input, no overshoot, stable target, equal1s error0.000010127m, zero actor displacement, third person restored. Horde/queue cleared before each trial; sector recovery queued12 but spawned zero active attackers during the retained opening grace.
- Big Chap: two private nine-joint tails;28,590 actual tail vertices;8,138 complete lower-leg/foot vertices match515 support samples. Contact minimum+0.005m and true airborne minimum+0.310496m with zero visual correction. Gameplay actor never displaced. Matched run comparison changes only tail joints: old rigid minimum−0.159855m → articulated+0.022116m; native body world-matrix error0.
- Relay: actual interaction0/8 and partial1/8 keep gate shut;8/8 opens gate, visual secured green and queue canceled. `relay-partially-defended.png`, `relay-secured.png`.
- APC: physical sector4 arrival creates the actual support vehicle and registered navigation owner; real game loop displaces player2.64m/enemy2.99m out of the actual hull; turret reaches full deployment. `apc-sector-four-support.png` reviewed, with model readable in terrain.
- Cleanup: both players null; enemies/pods zero; mission inactive; APC null/inactive; APC navigation colliders zero.

Two failed harness attempts are retained separately: `all-attempt1-report.json` for a3.85e−10m City derived grounding difference under delta0 (controlled joints/phase exact), and `all-attempt2/` for JavaScript strict comparison of−0 versus+0 on the airborne offset. Final harness permits1e−8 only on the recomputed derived grounding/laser values and compares absolute zero for the airborne offset. No production change was made for either numerical issue.

Visual review confirms the console is readable open and closed without the old exposed interior edge, the Big Chap tail remains continuous above the floor, and the terminal/APC state appears correctly. Generated source anatomy and interpreted mechanism/vehicle detail are not certified film-exact models. Wolf remains procedural in the camera fixture. This is automated technical QA with controlled screenshots, not a human combat playthrough.
