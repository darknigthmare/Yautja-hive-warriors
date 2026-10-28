/* Persistent in-world route cues, independent of the HUD. Single chevrons
 * follow the main passage; paired chevrons identify an optional flank. */
import * as THREE from 'three';

export function buildBattlefieldWayfinding(environment) {
  const layout = environment.battlefieldLayout; if (!layout) return [];
  const positions = [], uvs = [], cues = [];
  const quad = (centerX, centerZ, dx, dz, corners) => {
    const points = corners.map(([side, along]) => {
      const x = centerX + dz * side + dx * along, z = centerZ - dx * side + dz * along;
      return [x, environment.getElevationAt(x, z) + .045, z];
    });
    for (const index of [0, 2, 1, 0, 3, 2]) { positions.push(...points[index]); uvs.push(points[index][0] / 4, points[index][2] / 4); }
  };
  const chevron = (x, z, dx, dz) => {
    quad(x, z, dx, dz, [[-1.15, -1], [-.55, -1], [0, .35], [0, 1.05]]);
    quad(x, z, dx, dz, [[1.15, -1], [0, 1.05], [0, .35], [.55, -1]]);
  };
  for (const sector of layout.sectors) {
    const exits = layout.gates.filter(gate => gate.from === sector.id);
    for (const gate of exits) {
      const dx = gate.center[0] - sector.center[0], dz = gate.center[1] - sector.center[1], distance = Math.hypot(dx, dz);
      if (!distance || dx && dz) continue;
      const forwardX = dx / distance, forwardZ = dz / distance, samples = [];
      for (let along = 6; along <= Math.min(distance - 3, 100); along += 10) {
        const x = sector.center[0] + forwardX * along, z = sector.center[1] + forwardZ * along;
        chevron(x, z, forwardX, forwardZ);
        if (gate.tactical) chevron(x - forwardX * 2.5, z - forwardZ * 2.5, forwardX, forwardZ);
        samples.push([x, environment.getElevationAt(x, z) + .045, z]);
      }
      cues.push({ sectorId: sector.id, gateId: gate.id, targetSectorId: gate.to,
        kind: gate.tactical ? 'flank' : 'main', symbol: gate.tactical ? 'paired-chevrons' : 'single-chevron', samples });
    }
  }
  if (positions.length) {
    const geometry = environment.geometry('battlefield-wayfinding-floor', () => {
      const result = new THREE.BufferGeometry(); result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      result.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); result.computeVertexNormals(); return result;
    });
    const material = environment.organic ? environment.material('wayfinding-inlaid-stone', { color: 0xc2b79d, roughness: .98, metalness: 0, surface: 'stone' }) : environment.trimMat;
    const mesh = environment.mesh(geometry, material, [0, 0, 0]); mesh.name = 'battlefield-wayfinding-floor'; mesh.castShadow = false;
    mesh.userData.physicalRouteCues = cues;
  }
  environment.root.userData.wayfinding = { main: 'single-chevron', flank: 'paired-chevrons', cueCount: cues.length, interpretation: 'Original game route markings; human readability remains to be evaluated' };
  return cues;
}
