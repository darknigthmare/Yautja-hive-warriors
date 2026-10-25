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
  const sectors = IDS.map((id, index) => {
    const center = transform(CENTERS[index]);
    const actionOffset = transform(index === 2 ? relay.position : [0, 0]);
    return { id, index, name: names[index], center, bounds: rectangle(...center, 66, 66),
      objective: { type: kinds[index], target: targets[index], label: index === 2 ? relay.label : labels[index], position: [center[0] + actionOffset[0], center[1] + actionOffset[1]], radius: index === 2 ? 4.5 : 8,
        ...(index === 2 ? { defenseTarget: relay.defenseTarget, defenseLabel: relay.defenseLabel } : {}) },
      recommendedEnemies: [18, 22, 16, 38, 26, 18][index] };
  });
  const corridors = [], gates = [];
  for (let index = 0; index < sectors.length - 1; index++) {
    const from = sectors[index], to = sectors[index + 1];
    const center = [(from.center[0] + to.center[0]) / 2, (from.center[1] + to.center[1]) / 2];
    const axis = from.center[0] === to.center[0] ? 'z' : 'x';
    // Six units overlap each room so radius-based movement crosses the join smoothly.
    const bounds = rectangle(...center, axis === 'x' ? 25 : 9, axis === 'z' ? 25 : 9);
    const id = `${from.id}-${to.id}`;
    corridors.push({ id: `corridor-${id}`, from: from.id, to: to.id, center, axis, bounds });
    gates.push({ id: `gate-${id}`, from: from.id, to: to.id, center: [...center], axis,
      bounds: rectangle(...center, axis === 'x' ? 1 : 9, axis === 'z' ? 1 : 9), corridorId: `corridor-${id}` });
  }
  const bounds = { minX: Math.min(...sectors.map(sector => sector.bounds.minX)), maxX: Math.max(...sectors.map(sector => sector.bounds.maxX)), minZ: Math.min(...sectors.map(sector => sector.bounds.minZ)), maxZ: Math.max(...sectors.map(sector => sector.bounds.maxZ)) };
  return { version: 1, id: `battlefield-${level.id ?? type}`, entrySectorId: IDS[0], sectors, corridors, gates, bounds,
    dimensions: { width: bounds.maxX - bounds.minX, depth: bounds.maxZ - bounds.minZ }, sectorHalfSize: 66, corridorWidth: 18 };
}
