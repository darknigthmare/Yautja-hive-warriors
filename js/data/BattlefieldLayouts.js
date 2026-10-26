import { makeTacticalBridgeSpec } from '../entities/TacticalBridge.js';
import { getBattlefieldMapVariant } from './BattlefieldMapVariants.js';
import { variantSectorCenters, createStrategicRoutes } from './BattlefieldTopology.js';
/* Six connected combat sectors. Coordinates are in the game's world units. */
const IDS = ['insertion', 'approach', 'relay', 'foundry', 'command', 'nest'];
const CENTERS = [[0, 0], [0, -170], [170, -170], [170, -340], [0, -340], [0, -510]];
const NAMES = {
  forest: ['Clairière d’insertion', 'Avant-poste forestier', 'Relais de surveillance', 'Gorge des chasseurs', 'Camp du commandant', 'Nid de la vallée'],
  jungle: ['Zone d’insertion', 'Camp avancé', 'Relais radio', 'Ruines envahies', 'Bastion de la jungle', 'Sanctuaire du prédateur'],
  hive: ['Brèche extérieure', 'Couvoir avancé', 'Nœud synaptique', 'Fonderie de résine', 'Garde royale', 'Chambre de la matriarche'],
  temple: ['Cour des chasseurs', 'Porte des gardiens', 'Autel des glyphes', 'Galerie des épreuves', 'Bastion rituel', 'Sanctuaire de la reine'],
  rooftop: ['Héliport d’insertion', 'Terrasse de sécurité', 'Relais des toits', 'Cour industrielle', 'Poste de commandement', 'Toit du dernier combat'],
  station: ['Sas d’insertion', 'Hangar de sécurité', 'Relais d’alimentation', 'Ateliers de maintenance', 'Pont de commandement', 'Laboratoire central']
};

const RELAY_OPERATIONS = {
  forest: { position: [12, -18], defenseTarget: 8, label: 'Réactivez le relais de surveillance', defenseLabel: 'Repoussez la contre-attaque du relais' },
  jungle: { position: [-18, 16], defenseTarget: 10, label: 'Rétablissez la radio du camp', defenseLabel: 'Repoussez les chasseurs de la jungle' },
  hive: { position: [-18, -14], defenseTarget: 12, label: 'Surchargez le nœud synaptique', defenseLabel: 'Repoussez la réponse de la ruche' },
  temple: { position: [18, 18], defenseTarget: 10, label: 'Activez les glyphes de l’autel', defenseLabel: 'Repoussez les gardiens de l’autel' },
  rooftop: { position: [-20, 14], defenseTarget: 8, label: 'Déverrouillez le relais des toits', defenseLabel: 'Repoussez la contre-attaque des terrasses' },
  station: { position: [20, -14], defenseTarget: 12, label: 'Rétablissez l’alimentation du sas', defenseLabel: 'Repoussez la contre-attaque du hangar' }
};

const rectangle = (x, z, halfWidth, halfDepth) => ({ minX: x - halfWidth, maxX: x + halfWidth, minZ: z - halfDepth, maxZ: z + halfDepth });
export const pointInBattlefieldRect = (position, bounds, inset = 0) => position.x >= bounds.minX + inset && position.x <= bounds.maxX - inset && position.z >= bounds.minZ + inset && position.z <= bounds.maxZ - inset;

export function createBattlefieldLayout(level = {}) {
  const type = level.environmentType ?? 'forest';
  const variant = getBattlefieldMapVariant(level.mapId ?? level.auditMapId);
  const sourceCenters = variant ? variantSectorCenters(variant) : CENTERS;
  const ids = sourceCenters.map((_, index) => index === sourceCenters.length - 1 ? 'nest' : IDS[index] === 'nest' || index >= IDS.length ? `area-${index}` : IDS[index]);
  const corridorWidth = variant?.corridorWidth ?? 18;
  const orientation = { forest: 0, hive: 1, temple: 0, rooftop: 2, jungle: 3, station: 1 }[type] ?? 0;
  const mirror = type === 'temple' || type === 'hive' ? -1 : 1;
  const transform = ([originalX, originalZ]) => {
    let x = originalX * mirror, z = originalZ;
    for (let turn = 0; turn < orientation; turn++) [x, z] = [-z, x];
    return [x === 0 ? 0 : x, z === 0 ? 0 : z];
  };
  const names = NAMES[type] ?? NAMES.forest;
  const kinds = ['kills', 'commander', 'interact', 'kills', 'commander', 'boss'];
  const targets = [12, 1, 1, 30, 1, 1];
  const labels = ['Éliminez 12 ennemis pour ouvrir le passage', 'Vainquez le commandant de l’avant-poste', 'Activez le relais pour ouvrir le sas', 'Éliminez 30 ennemis dans cette zone', 'Vainquez le gardien du bastion', 'Vainquez le boss du secteur final'];
  const relay = RELAY_OPERATIONS[type] ?? RELAY_OPERATIONS.forest;
  const sectors = ids.map((id, index) => {
    const center = transform(sourceCenters[index]);
    const final = index === ids.length - 1;
    const kind = final ? 'boss' : kinds[index] === 'boss' || index >= kinds.length ? (index % 4 === 0 ? 'commander' : 'kills') : kinds[index];
    const target = kind === 'kills' ? (index < 5 ? targets[index] : 30) : 1;
    const halfWidth = index === 0 || !variant ? 66 : [62, 74, 82, 68][(index + Number(variant.id.slice(3))) % 4];
    const halfDepth = index === 0 || !variant ? 66 : [72, 60, 80, 68][(index * 3 + Number(variant.id.slice(3))) % 4];
    const actionOffset = transform(index === 2 ? relay.position : [0, 0]);
    return { id, index, name: names[index] ?? `${variant?.name ?? level.name ?? type} · Zone ${index + 1}`, center, bounds: rectangle(...center, halfWidth, halfDepth),
      objective: { type: kind, target, label: index === 2 ? relay.label : final ? 'Vainquez le boss du secteur final' : (index < 5 ? labels[index] : null) ?? (kind === 'commander' ? 'Vainquez le commandant de la zone' : `Éliminez ${target} ennemis dans cette zone`), position: [center[0] + actionOffset[0], center[1] + actionOffset[1]], radius: index === 2 ? 4.5 : 8,
        ...(index === 2 ? { defenseTarget: relay.defenseTarget, defenseLabel: relay.defenseLabel } : {}) },
      recommendedEnemies: [18, 22, 16, 38, 26, 18][index] ?? (kind === 'kills' ? target + 6 : 18) };
  });
  const corridors = [], gates = [];
  for (let index = 0; index < sectors.length - 1; index++) {
    const from = sectors[index], to = sectors[index + 1];
    const center = [(from.center[0] + to.center[0]) / 2, (from.center[1] + to.center[1]) / 2];
    const axis = from.center[0] === to.center[0] ? 'z' : 'x';
    // Six units overlap each room so radius-based movement crosses the join smoothly.
    const distance = Math.hypot(to.center[0] - from.center[0], to.center[1] - from.center[1]);
    const fromHalf = axis === 'x' ? (from.bounds.maxX - from.bounds.minX) / 2 : (from.bounds.maxZ - from.bounds.minZ) / 2;
    const toHalf = axis === 'x' ? (to.bounds.maxX - to.bounds.minX) / 2 : (to.bounds.maxZ - to.bounds.minZ) / 2;
    const fromEdge = (axis === 'x' ? from.center[0] : from.center[1]) + Math.sign(axis === 'x' ? to.center[0] - from.center[0] : to.center[1] - from.center[1]) * fromHalf;
    const toEdge = (axis === 'x' ? to.center[0] : to.center[1]) - Math.sign(axis === 'x' ? to.center[0] - from.center[0] : to.center[1] - from.center[1]) * toHalf;
    center[axis === 'x' ? 0 : 1] = (fromEdge + toEdge) / 2;
    const halfLength = (distance - fromHalf - toHalf) / 2 + 6;
    const bounds = rectangle(...center, axis === 'x' ? halfLength : corridorWidth / 2, axis === 'z' ? halfLength : corridorWidth / 2);
    const id = `${from.id}-${to.id}`;
    corridors.push({ id: `corridor-${id}`, from: from.id, to: to.id, center, axis, bounds });
    gates.push({ id: `gate-${id}`, from: from.id, to: to.id, center: [...center], axis,
      bounds: rectangle(...center, axis === 'x' ? 1 : corridorWidth / 2, axis === 'z' ? 1 : corridorWidth / 2), corridorId: `corridor-${id}` });
  }
  const bounds = { minX: Math.min(...sectors.map(sector => sector.bounds.minX)), maxX: Math.max(...sectors.map(sector => sector.bounds.maxX)), minZ: Math.min(...sectors.map(sector => sector.bounds.minZ)), maxZ: Math.max(...sectors.map(sector => sector.bounds.maxZ)) };
  const layout = { version: variant ? 2 : 1, id: `battlefield-${variant?.id ?? level.id ?? type}`, entrySectorId: ids[0], sectors, corridors, gates, bounds,
    dimensions: { width: bounds.maxX - bounds.minX, depth: bounds.maxZ - bounds.minZ }, sectorHalfSize: 66, corridorWidth,
    strategicMode: level.strategicMode === true, ...(variant ? { variant, mapId: variant.id } : {}) };
  const strategic = createStrategicRoutes(layout);
  layout.strategicRoutes = strategic.routes; layout.frontAnchorIds = strategic.frontAnchorIds;
  layout.corridors.push(...strategic.tactical);
  layout.gates.push(...strategic.tacticalGates);
  const tacticalBridge = makeTacticalBridgeSpec(layout);
  layout.tacticalBridges = tacticalBridge ? [tacticalBridge] : [];
  for (const corridor of strategic.tactical) {
    layout.bounds.minX = Math.min(layout.bounds.minX, corridor.bounds.minX); layout.bounds.maxX = Math.max(layout.bounds.maxX, corridor.bounds.maxX);
    layout.bounds.minZ = Math.min(layout.bounds.minZ, corridor.bounds.minZ); layout.bounds.maxZ = Math.max(layout.bounds.maxZ, corridor.bounds.maxZ);
  }
  layout.dimensions = { width: layout.bounds.maxX - layout.bounds.minX, depth: layout.bounds.maxZ - layout.bounds.minZ };
  return layout;
}
