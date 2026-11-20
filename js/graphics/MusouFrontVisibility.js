/* Four-draw Musou crowd selection across ALREADY allocated battle fronts.
 * A nearby dense horde should not completely erase a second nearby battle.
 * These are visual seats only: no soldier state, destination or order changes.
 */
export const MUSOU_CROWD_FRONT_POLICY = Object.freeze({
  version: 'finite-front-visibility-v1',
  minimumPerVisibleFront: 8,
  maxFloorProbesMultiplier: 4
});

const safeDistance = n => Number.isFinite(n) && n >= 0 ? n : Infinity;
const byProximity = (a,b) => safeDistance(a.distSq)-safeDistance(b.distSq) ||
  String(a.id).localeCompare(String(b.id));

/** Returns candidates ordered by reserved visibility from distinct fronts,
 * followed by globally nearest remaining units. A caller may reject candidates
 * on collision/floor grounds and inspect a bounded number of later entries.
 */
export function selectMusouFrontCandidates(entries, limit) {
  if (!Array.isArray(entries) || !Number.isInteger(limit) || limit < 1) return [];
  const sorted = entries.slice().sort(byProximity);
  const fronts = new Map();
  for(const entry of sorted){
    const front = typeof entry.frontId === 'string' && entry.frontId
      ? entry.frontId : '__unbound__';
    if(!fronts.has(front))fronts.set(front,[]);
    fronts.get(front).push(entry);
  }
  if(fronts.size<=1)return sorted;
  const quota=Math.min(MUSOU_CROWD_FRONT_POLICY.minimumPerVisibleFront,
    Math.max(1,Math.floor(limit/fronts.size)));
  const reservations=[],picked=new Set();
  // Stable order: the closest observed front gets its quota first.
  for(const units of fronts.values()) for(const candidate of units.slice(0,quota)){
    if(picked.has(candidate.id))continue;
    picked.add(candidate.id);reservations.push(candidate);
  }
  // Preserve the historical nearest-unit sort within spare capacity.
  for(const entry of sorted) if(!picked.has(entry.id))reservations.push(entry);
  return reservations;
}
