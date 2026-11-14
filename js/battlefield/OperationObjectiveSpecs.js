/* Original operation designs translated from PR #3. These objectives do not
 * certify a film reconstruction or silently create additional combatants. */
const action = (id, type, label, front, extra = {}) => ({ id, type, label, front, duration: 2.5, radius: 4.5, requires: [], ...extra });
const take = (id, label, front, extra = {}) => action(id, 'secure', label, front, { entityId: id, carry: true, ...extra });
const cut = (id, label, front, extra = {}) => action(id, 'sabotage', label, front, { disableSource: true, duration: 3, ...extra });
const open = (id, label, front, extra = {}) => action(id, 'activate', label, front, { opensRoute: true, ...extra });
const leave = (id, label, front, requires, extra = {}) => action(id, 'extract', label, front, { requires, duration: 3, needsFriendlyFront: true, ...extra });
const hold = (id, label, front, seconds, extra = {}) => action(id, 'defend', label, front, { duration: seconds, ...extra });
const kill = (id, label, front, uniqueId, extra = {}) => action(id, 'eliminate', label, front, { uniqueId, ...extra });
const free = (id, label, front, count, extra = {}) => action(id, 'rescue', label, front, { entityId: id, noncombatants: count, duration: 3, ...extra });
const truce = (id, label, front, requires, factionId = 'rival_clan', extra = {}) => action(id, 'negotiate', label, front, { requires, factionId, relationship: 'neutral', duration: 4, ...extra });
const convoy = (id, from, to, extra = {}) => ({ id, kind: 'convoy', front: from, routeFronts: [from, to], travelSeconds: 110, hp: 600, ...extra });
const win = (id, tasks, label = 'Objectif de l’opération accompli') => ({ id, tasks, label });
export function operationRoutePoints(config, from, to) {
  const fronts = new Map(config.fronts.map(front => [front.id, front]));
  if (!fronts.has(from) || !fronts.has(to)) throw new Error('Unknown operation route endpoint');
  if (from === to) return [[...fronts.get(from).position]];
  const queue = [{ id: from, cost: 0, edges: [] }], best = new Map([[from, 0]]);
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost); const node = queue.shift();
    if (node.id === to) {
      const points = [[...fronts.get(from).position]];
      for (const edge of node.edges) {
        const segment = edge.route.waypoints ? structuredClone(edge.route.waypoints) : [[...fronts.get(edge.route.from).position], [...fronts.get(edge.route.to).position]];
        if (edge.from !== edge.route.from) segment.reverse();
        for (const point of segment) if (Math.hypot(point[0] - points.at(-1)[0], point[1] - points.at(-1)[1]) > 1e-6) points.push(point);
      }
      return points;
    }
    for (const route of config.routes) {
      if (route.open === false || route.from !== node.id && route.to !== node.id) continue;
      const next = route.from === node.id ? route.to : route.from, cost = node.cost + (route.travelSeconds ?? 1);
      if (cost >= (best.get(next) ?? Infinity)) continue;
      best.set(next, cost); queue.push({ id: next, cost, edges: [...node.edges, { route, from: node.id }] });
    }
  }
  throw new Error(`No physical operation route ${from} -> ${to}`);
}

const plans = {
  'AFF-01': { tasks: [take('register', 'Sécuriser le registre des routes', 'A'), cut('relay', 'Couper l’alerte du relais', 'B'), leave('depart', 'Extraire le registre par un quai allié', 'C', ['register'], { cargo: ['register'] })], strategies: [win('archives_extracted', ['depart'])], failOnLoss: ['register'] },
  'AFF-02': { tasks: [hold('defense', 'Tenir les départs de la citadelle', 'A', 60), open('launch', 'Ouvrir le poste de départ', 'C'), leave('evacuate', 'Achever le départ protégé', 'D', ['defense', 'launch'])], strategies: [win('citadel_departure', ['evacuate'])] },
  'AFF-03': { entities: [convoy('freight', 'B', 'C')], tasks: [open('jammer', 'Brouiller le guidage du convoi', 'A', { stopsEntity: 'freight', opensRoute: false }), take('cargo', 'Récupérer le fret intercepté', 'B', { followsEntity: 'freight', requires: ['jammer'] }), leave('return', 'Ramener le fret au départ', 'A', ['cargo'], { cargo: ['cargo'] })], strategies: [win('convoy_intercepted', ['return'])], failOnEscape: ['freight'], failOnLoss: ['cargo'] },
  'AFF-04': { tasks: [take('evidence', 'Relever la preuve de l’incident', 'A'), cut('false_alarm', 'Désamorcer la fausse alerte', 'B'), truce('agreement', 'Transmettre la preuve et négocier', 'C', ['evidence', 'false_alarm']), leave('withdraw', 'Se retirer avec la preuve', 'A', ['evidence'], { cargo: ['evidence'] })], strategies: [win('deescalation', ['agreement'], 'Accord local obtenu'), win('evidence_withdrawal', ['withdraw'])] },
  'AFF-05': { tasks: [take('terms', 'Recueillir les conditions du retrait', 'A'), kill('duel', 'Neutraliser le chef du duel', 'B', 'BOS-28'), hold('withdrawal', 'Protéger le repli des détachements', 'C', 45), truce('ceasefire', 'Conclure le cessez-le-feu local', 'B', ['terms', 'withdrawal'], 'rival_clan', { requiresAliveUnique: 'BOS-28' }), leave('exit', 'Quitter la zone après le duel', 'C', ['duel', 'withdrawal'])], strategies: [win('negotiated_ceasefire', ['ceasefire']), win('duel_withdrawal', ['exit'])] },
  'AFF-06': { tasks: [take('equipment', 'Récupérer le matériel capturé', 'A'), open('warehouse', 'Ouvrir la sortie des entrepôts', 'B'), free('workers', 'Libérer le groupe de travailleurs', 'B', 8), leave('port_exit', 'Extraire le matériel du port', 'C', ['equipment', 'warehouse'], { cargo: ['equipment'], evacuates: ['workers'] })], strategies: [win('equipment_recovered', ['port_exit'])], failOnLoss: ['equipment'] },
  'AFF-07': { entities: [convoy('delivery', 'C', 'B', { travelSeconds: 130 })], tasks: [cut('rail_switch', 'Saboter l’aiguillage de livraison', 'A', { stopsEntity: 'delivery' }), take('shipment', 'Saisir la cargaison arrêtée', 'C', { followsEntity: 'delivery', requires: ['rail_switch'] }), cut('depot', 'Neutraliser le dépôt logistique', 'B'), leave('industrial_exit', 'Extraire la technologie récupérée', 'A', ['shipment'], { cargo: ['shipment'] })], strategies: [win('cargo_recovery', ['industrial_exit']), win('delivery_disabled', ['rail_switch', 'depot'])], failOnEscape: ['delivery'] },
  'AFF-08': { tasks: [cut('power', 'Couper l’alimentation défensive', 'B'), action('installation', 'capture', 'Prendre le contrôle de l’installation', 'C', { needsFriendlyFront: true }), leave('colony_exit', 'Sécuriser la sortie de la colonie', 'D', ['power', 'installation'])], strategies: [win('installation_recovered', ['colony_exit'])] },
  'AFF-09': { tasks: [open('power', 'Rétablir l’énergie du chantier', 'B'), open('airlock', 'Déverrouiller le sas du quai', 'C', { requires: ['power'] }), leave('shuttle', 'Lancer le départ de la navette', 'D', ['airlock'])], strategies: [win('shuttle_released', ['shuttle'])] },
  'AFF-10': { tasks: [free('captive', 'Libérer le captif du clan', 'A', 1), cut('cordon', 'Couper le cordon d’interception', 'B'), free('civilians', 'Faire sortir un groupe de civils', 'C', 8), leave('evacuation', 'Extraire le captif vers le terminal', 'D', ['captive', 'cordon'], { evacuates: ['captive', 'civilians'] })], strategies: [win('captive_extracted', ['evacuation'])], failOnLoss: ['captive'] },
  'AFF-11': { tasks: [take('archives', 'Saisir les archives contestées', 'A'), cut('human_array', 'Neutraliser l’appui de la force humaine', 'C'), truce('clan_truce', 'Négocier une trêve limitée avec le clan rival', 'B', ['archives']), leave('three_way_exit', 'Extraire les archives hors des deux fronts', 'D', ['archives'], { cargo: ['archives'], requiresAny: [['human_array'], ['clan_truce']] })], strategies: [win('contested_archives', ['three_way_exit'])], failOnLoss: ['archives'] },
  'AFF-12': { tasks: [hold('citadel_line', 'Tenir l’accès de la citadelle', 'A', 60), cut('siege_support', 'Couper l’appui du siège humain', 'B'), take('clan_records', 'Préserver les archives du clan', 'C'), leave('citadel_return', 'Mettre les archives à l’abri', 'D', ['citadel_line', 'clan_records'], { cargo: ['clan_records'], requiresAny: [['siege_support'], ['citadel_line']] })], strategies: [win('citadel_preserved', ['citadel_return'])], failOnLoss: ['clan_records'] },
  'AFF-13': { tasks: [free('survivors', 'Regrouper les survivants du secteur', 'A', 4), open('exit_power', 'Rétablir l’alimentation de la sortie', 'B'), leave('station_exit', 'Extraire le groupe par les accès techniques', 'C', ['survivors', 'exit_power'], { evacuates: ['survivors'] })], strategies: [win('sevastopol_escape', ['station_exit'])], failOnLoss: ['survivors'] },
  'AFF-14': { tasks: [cut('tunnel_one', 'Fermer la première voie de ruche', 'B'), cut('tunnel_two', 'Fermer la deuxième voie de ruche', 'C'), kill('matriarch', 'Neutraliser le Prétorien du passage', 'C', 'BOS-32'), leave('lethe_exit', 'Extraire le détachement de Lethe', 'A', ['tunnel_one', 'tunnel_two'], { requiresAny: [['matriarch'], ['tunnel_one', 'tunnel_two']] })], strategies: [win('lethe_extraction', ['lethe_exit'])] },
  'AFF-15': { tasks: [take('research', 'Récupérer les données de Freya', 'B'), cut('security', 'Neutraliser la poursuite du complexe', 'C'), open('ruin_gate', 'Ouvrir l’issue des ruines', 'D'), leave('freya_exit', 'Extraire les données par la voie ouverte', 'D', ['research'], { cargo: ['research'], requiresAny: [['security'], ['ruin_gate']] })], strategies: [win('freya_data', ['freya_exit'])], failOnLoss: ['research'] },
  'AFF-16': { tasks: [cut('hive_access', 'Couper l’accès de la ruche', 'B'), kill('sector_threat', 'Neutraliser la menace du secteur', 'C', 'BOS-33'), open('pad_power', 'Remettre en service la plateforme', 'C'), leave('lv895_exit', 'Extraire le contingent de LV-895', 'D', ['pad_power'], { requiresAny: [['hive_access'], ['sector_threat']] })], strategies: [win('lv895_departure', ['lv895_exit'])] },
  'AFF-17': { tasks: [open('cordon_gate', 'Ouvrir une brèche dans le cordon', 'B'), free('city_workers', 'Regrouper les civils du secteur', 'C', 8), take('containment_log', 'Récupérer le registre de confinement', 'A'), leave('prodigy_exit', 'Extraire les civils et le registre', 'D', ['cordon_gate', 'city_workers', 'containment_log'], { cargo: ['containment_log'], evacuates: ['city_workers'] })], strategies: [win('prodigy_evacuation', ['prodigy_exit'])], failOnLoss: ['city_workers', 'containment_log'] },
  'AFF-18': { tasks: [cut('lower_access', 'Couper la poussée du sous-sol', 'B'), hold('refuge', 'Maintenir le refuge accessible', 'C', 60), free('refugees', 'Regrouper les survivants du refuge', 'A', 8), leave('tobler_exit', 'Achever l’évacuation du refuge', 'C', ['lower_access', 'refuge', 'refugees'], { evacuates: ['refugees'] })], strategies: [win('tobler_refuge', ['tobler_exit'])], failOnLoss: ['refugees'] },
  'AFF-19': { tasks: [take('transfer_data', 'Récupérer les données du transfert', 'A'), open('epsilon_lock', 'Ouvrir le sas avant le transfert', 'B'), leave('epsilon_quay', 'Extraire les données au quai', 'C', ['transfer_data', 'epsilon_lock'], { cargo: ['transfer_data'] })], strategies: [win('epsilon_transfer', ['epsilon_quay'])], failOnLoss: ['transfer_data'] },
  'AFF-20': { tasks: [take('stolen_tech', 'Récupérer la technologie dérobée', 'B'), cut('tracking', 'Couper la poursuite industrielle', 'C'), open('freight_exit', 'Ouvrir la route du fret', 'D'), leave('neon_exit', 'Extraire le matériel récupéré', 'A', ['stolen_tech'], { cargo: ['stolen_tech'], requiresAny: [['tracking'], ['freight_exit']] })], strategies: [win('neonopolis_recovery', ['neon_exit'])], failOnLoss: ['stolen_tech'] },
  'AFF-21': { tasks: [take('beacon', 'Récupérer la balise disputée', 'B'), open('beacon_route', 'Ouvrir une voie de récupération', 'C'), leave('genna_exit', 'Ramener la balise du clan', 'A', ['beacon', 'beacon_route'], { cargo: ['beacon'] })], strategies: [win('genna_beacon', ['genna_exit'])], failOnLoss: ['beacon'] },
  'AFF-22': { tasks: [free('prisoners', 'Libérer le premier groupe de captifs', 'B', 8), cut('captor_alarm', 'Désactiver l’alerte des ravisseurs', 'C'), leave('prisoner_exit', 'Extraire le groupe libéré', 'A', ['prisoners', 'captor_alarm'], { evacuates: ['prisoners'] })], strategies: [win('last_hunt_rescue', ['prisoner_exit'])], failOnLoss: ['prisoners'] },
  'AFF-23': { tasks: [take('crash_evidence', 'Relever les preuves de l’épave', 'A'), truce('theta_agreement', 'Proposer une trêve locale à Theta', 'B', ['crash_evidence'], 'human_force', { requiresAliveUnique: 'HUM-032' }), kill('theta_duel', 'Survivre au duel contre Theta', 'B', 'HUM-032'), leave('tundra_exit', 'Quitter la toundra avec les preuves', 'C', ['crash_evidence'], { cargo: ['crash_evidence'], requiresAny: [['theta_agreement'], ['theta_duel']] })], strategies: [win('tundra_survival', ['tundra_exit'])], failOnLoss: ['crash_evidence'] },
  'AFF-24': { tasks: [free('habitat_people', 'Regrouper les habitants de l’habitat', 'A', 8), cut('hive_approach', 'Couper l’approche de la ruche', 'B'), hold('transport_window', 'Protéger la fenêtre de départ', 'C', 50), leave('spinner_exit', 'Évacuer les habitants vers le transport', 'C', ['habitat_people', 'hive_approach', 'transport_window'], { evacuates: ['habitat_people'] })], strategies: [win('spinner_habitat', ['spinner_exit'])], failOnLoss: ['habitat_people'] },
  'AFF-25': { tasks: [cut('human_tunnel', 'Sceller l’accès de la ruche', 'B'), hold('human_line', 'Tenir la ligne des Colonial Marines', 'A', 60), kill('human_matriarch', 'Neutraliser le Prétorien du passage', 'C', 'BOS-32'), leave('human_lethe_exit', 'Extraire les survivants humains', 'A', ['human_tunnel', 'human_line'], { requiresAny: [['human_matriarch'], ['human_tunnel']] })], strategies: [win('human_lethe', ['human_lethe_exit'])] },
  'AFF-26': { tasks: [free('human_survivors', 'Rassembler le groupe de survivants', 'B', 8), hold('human_refuge', 'Défendre le refuge humain', 'A', 60), open('human_lift', 'Rétablir le dispositif de sortie', 'C'), leave('human_tobler_exit', 'Extraire le groupe vers la surface', 'C', ['human_survivors', 'human_refuge', 'human_lift'], { evacuates: ['human_survivors'] })], strategies: [win('human_tobler', ['human_tobler_exit'])], failOnLoss: ['human_survivors'] },
  'AFF-27': { tasks: [cut('hive_route', 'Neutraliser la logistique de la ruche', 'B'), cut('marine_route', 'Neutraliser l’appui des Marines', 'A'), kill('extinction_queen', 'Vaincre la reine des failles', 'C', 'BOS-39'), open('return_route', 'Assurer la route de retour du clan', 'D'), leave('lv742_exit', 'Extraire le contingent de LV-742', 'D', ['return_route'], { requiresAny: [['extinction_queen', 'hive_route'], ['hive_route', 'marine_route']] })], strategies: [win('lv742_queen', ['lv742_exit', 'extinction_queen']), win('lv742_logistics', ['lv742_exit', 'hive_route', 'marine_route'])] },
};

// These are original tactical reactions to player actions, not unseen extra
// armies or a claim that the source work depicts these battles.
const reactionTriggers = ['register', 'launch', 'jammer', 'false_alarm', 'terms', 'warehouse', 'rail_switch',
  'power', 'power', 'cordon', 'archives', 'clan_records', 'exit_power', 'tunnel_one', 'research', 'hive_access',
  'cordon_gate', 'lower_access', 'epsilon_lock', 'stolen_tech', 'beacon', 'captor_alarm', 'crash_evidence',
  'hive_approach', 'human_tunnel', 'human_lift', 'hive_route'];

export function createOperationObjectiveSpec(operation, config) {
  const plan = plans[operation.id]; if (!plan) throw new Error(`Unknown narrative operation ${operation.id}`);
  const tasks = plan.tasks.map((task, index) => {
    const frontId = `front_${task.front.toLowerCase()}`, front = config.fronts.find(front => front.id === frontId);
    if (!front) throw new Error(`Narrative ${operation.id}/${task.id} requires physical front ${frontId}`);
    const offset = [6 + index % 2 * 4, -5 + Math.floor(index / 2) * 4];
    const route = config.routes.find(route => route.from === frontId || route.to === frontId);
    return { ...structuredClone(task), frontId, position: [front.position[0] + offset[0], front.position[1] + offset[1]],
      offset, opensRouteId: task.opensRoute ? route?.id ?? null : null };
  });
  const entities = (plan.entities ?? []).map(entity => {
    const routeFronts = entity.routeFronts.map(letter => `front_${letter.toLowerCase()}`);
    const waypoints = operationRoutePoints(config, routeFronts[0], routeFronts[1]);
    return { ...structuredClone(entity), factionId: config.factions.some(faction => faction.id === 'rival_clan') ? 'rival_clan' : 'human_force', routeFronts, position: [...waypoints[0]], waypoints };
  });
  for (const task of tasks) if (['secure', 'rescue'].includes(task.type)) entities.push({ id: task.entityId, kind: task.type === 'rescue' ? 'noncombatants' : 'cargo',
    position: [...task.position], frontId: task.frontId, factionId: config.playerFaction, hp: task.type === 'rescue' ? 400 : 600,
    noncombatants: task.noncombatants ?? 0, sourceTaskId: task.id, carry: task.carry === true });
  const afterTaskId = reactionTriggers[Number(operation.id.slice(-2)) - 1], trigger = tasks.find(task => task.id === afterTaskId);
  const faction = config.factions.find(faction => faction.id !== config.playerFaction && config.groups.some(group => group.factionId === faction.id));
  const reactions = trigger && faction ? [{ id: `${operation.id}:counterattack`, afterTaskId, factionId: faction.id,
    targetFrontId: trigger.frontId, delay: 12, label: `Contre-offensive annoncée vers ${trigger.frontId.slice(-1).toUpperCase()} — départ dans 12 s`,
    designOrigin: 'original_gameplay_reaction', extraCombatants: 0 }] : [];
  return { version: 1, id: `${operation.id}:narrative-v1`, operationId: operation.id, title: operation.title,
    designOrigin: 'original_audit_operation_adaptation', sourceVictory: operation.victory,
    tasks, entities, reactions, strategies: structuredClone(plan.strategies), failOnLoss: [...(plan.failOnLoss ?? [])],
    failOnEscape: [...(plan.failOnEscape ?? [])], humanControllerRequired: operation.requiresHumanController,
    fidelity1to1Verified: false };
}

export function bindOperationObjectivesToFronts(configuration) {
  const config = structuredClone(configuration), spec = config.operationObjectives;
  if (!spec) return config;
  const usedDetours = new Set();
  const canCloseDetour = id => {
    const reached = new Set([config.fronts[0].id]), pending = [...reached];
    while (pending.length) {
      const current = pending.shift();
      for (const route of config.routes) {
        if (route.id === id || route.open === false || route.from !== current && route.to !== current) continue;
        const next = route.from === current ? route.to : route.from;
        if (!reached.has(next)) { reached.add(next); pending.push(next); }
      }
    }
    return reached.size === config.fronts.length;
  };
  for (const task of spec.tasks) {
    const front = config.fronts.find(front => front.id === task.frontId);
    if (!front) throw new Error(`Narrative front missing: ${task.frontId}`);
    task.position = [front.position[0] + task.offset[0], front.position[1] + task.offset[1]];
    if (task.opensRoute) {
      const detours = config.routes.filter(route => /flank|outer/.test(route.id) && route.physicalGateIds?.length && !usedDetours.has(route.id));
      detours.sort((a, b) => Number(b.from === front.id || b.to === front.id) - Number(a.from === front.id || a.to === front.id));
      const route = detours.find(route => canCloseDetour(route.id));
      if (route) {
        task.opensRouteId = route.id; task.physicalGateIds = [...route.physicalGateIds];
        task.physicalRouteId = route.physicalRouteId ?? route.id.replace(/^bound-/, '');
        task.routeBinding = 'physical_optional_detour'; route.open = false; usedDetours.add(route.id);
      } else {
        task.opensRouteId = config.routes.find(route => route.from === front.id || route.to === front.id)?.id ?? null;
        task.physicalGateIds = []; task.physicalRouteId = null; task.routeBinding = 'logical_only';
      }
    }
  }
  for (const entity of spec.entities) {
    if (entity.routeFronts) {
      entity.waypoints = operationRoutePoints(config, entity.routeFronts[0], entity.routeFronts[1]);
      entity.position = [...entity.waypoints[0]];
    } else {
      const task = spec.tasks.find(task => task.id === entity.sourceTaskId); entity.position = [...task.position];
    }
  }
  return config;
}
