/* Who populates an Ascension hunt (spec 002, HW-DEC-106): one finite herd per sector, its leader
 * in place of the sector commander, and the world's great prey as the final boss. Herds are sized
 * so that every sector objective can be met without reinforcements; none are ever invented. */
import * as THREE from 'three';

export class FaunaEncounter {
  constructor(horde, world, { onLine = () => {} } = {}) {
    this.horde = horde; this.world = world; this.onLine = onLine; this.leaders = []; this.scattered = new WeakSet();
  }

  herdSize(sector) {
    const base = this.world.herdSizes[Math.min(sector.index, this.world.herdSizes.length - 1)] ?? 10;
    const objective = sector.objective ?? {};
    const needed = objective.type === 'kills' ? objective.target : objective.type === 'interact' ? objective.defenseTarget ?? 0 : 0;
    return Math.min(40, Math.max(base, needed + 2));
  }

  /** The herd grazes in the part of the sector farthest from the arriving hunter, never on the drop point. */
  herdCenter(sector, position) {
    const center = new THREE.Vector3(sector.center[0], 0, sector.center[1]), bounds = sector.bounds;
    if (!bounds || !position) return center;
    const spanX = (bounds.maxX - bounds.minX) * .3, spanZ = (bounds.maxZ - bounds.minZ) * .3;
    const candidates = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([x, z]) => new THREE.Vector3(center.x + x * spanX, 0, center.z + z * spanZ));
    return candidates.sort((a, b) => b.distanceToSquared(position) - a.distanceToSquared(position))[0];
  }

  spawnSector(sector, position) {
    const center = this.herdCenter(sector, position), count = this.herdSize(sector);
    for (let index = 0; index < count; index++) {
      const angle = index * 2.399963, radius = 8 + (index % 5) * 3;
      this.horde.spawnFauna(this.world.herd, 'herd', center.clone().add(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)), center);
    }
    const line = this.world.lines[Math.min(sector.index, this.world.lines.length - 1)];
    if (line && sector.objective?.type !== 'boss') this.onLine(line);
    if (sector.objective?.type === 'boss') this.onLine(this.world.preyLine);
    return count;
  }

  spawnLeader(sector, position) {
    const center = new THREE.Vector3(sector.center[0], 0, sector.center[1]);
    const leader = this.horde.spawnFauna(this.world.leader, 'leader', position, center);
    leader.herdColor = this.world.herd.color; this.leaders.push(leader);
    return leader;
  }

  /** Herds are finite: a missing kill is never filled by a new animal. */
  reinforce() { return 0; }

  update() {
    for (const leader of this.leaders) if (leader.hp <= 0 && !this.scattered.has(leader)) { this.scattered.add(leader); this.horde.scatterFaunaHerd(leader.home); }
  }
}
