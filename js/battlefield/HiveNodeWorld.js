import * as THREE from 'three';
import { disposeObject } from '../engine/SceneResources.js';
import { HIVE_NODE_RULES } from './HiveNodeEcology.js';

/** Mission-owned projections of FINITE Hive Nodes. No soldier or reserve spawn.
 * Positions/HP come from BattleSimulation, not from the rendered meshes. */
export class HiveNodeWorld {
  constructor(scene, environment, simulation) {
    this.scene = scene; this.environment = environment; this.simulation = simulation;
    this.root = new THREE.Group(); this.root.name = 'hive-node-world';
    scene.add(this.root);
    this.models = new Map(); this.proxies = new Map();
    this.combatants = [];
    this.attackHits = new WeakMap();
  }

  createNode(id) {
    const root = new THREE.Group(); root.name = id;
    const resin = new THREE.MeshStandardMaterial({ color: 0x242c27, roughness: .7, metalness: .03,
      emissive: 0x1c2e20, emissiveIntensity: .16 });
    const membrane = new THREE.MeshStandardMaterial({ color: 0x495c41, roughness: .62, metalness: .02,
      emissive: 0x2b412d, emissiveIntensity: .27 });
    const spores = new THREE.MeshStandardMaterial({ color: 0x9cbf76, transparent: true, opacity: .65,
      emissive: 0x668842, emissiveIntensity: .8, depthWrite: false });
    const base = new THREE.Mesh(new THREE.SphereGeometry(1.28, 18, 12), resin);
    base.scale.set(1.35, .30, 1.35); base.position.y = .28; root.add(base);
    const core = new THREE.Mesh(new THREE.SphereGeometry(.66, 20, 14), membrane);
    core.scale.set(.9, 1.48, .9); core.position.y = .97; root.add(core);
    for (let n = 0; n < 8; n++) {
      const angle = n * Math.PI / 4, start = new THREE.Vector3(Math.sin(angle) * .24, .43, Math.cos(angle) * .24);
      const end = new THREE.Vector3(Math.sin(angle) * (2.0 + n % 3 * .23), .07, Math.cos(angle) * (2.0 + n % 3 * .23));
      const vector = end.clone().sub(start), length = vector.length();
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(.032, .14, length, 7), resin);
      branch.position.copy(start).addScaledVector(vector, .5);
      branch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize());
      root.add(branch);
      const petal = new THREE.Mesh(new THREE.SphereGeometry(.22, 9, 7), membrane);
      petal.position.copy(end);petal.scale.set(1, .35, 1);root.add(petal);
    }
    for (let n = 0; n < 11; n++) {
      const angle = n * 2.399963, distance = .18 + .4 * (n % 3);
      const mote = new THREE.Mesh(new THREE.SphereGeometry(.045, 6, 4), spores);
      mote.position.set(Math.cos(angle) * distance, 1.5 + .055 * (n % 6), Math.sin(angle) * distance);
      root.add(mote);
    }
    const field = new THREE.Mesh(new THREE.TorusGeometry(
      HIVE_NODE_RULES.radius, .04, 5, 56),
      new THREE.MeshBasicMaterial({ color: 0x6f9b59, transparent: true,
        opacity: .20, depthWrite: false }));
    field.name = 'hive-space-boundary';
    field.rotation.x = Math.PI / 2;
    field.position.y = .07; root.add(field);
    root.userData.hiveNodeId = id;
    root.userData.visualFidelity1to1Verified = false;
    this.root.add(root); this.models.set(id, root);return root;
  }

  update() {
    if (!this.simulation || !this.root.parent) return;
    // The world only needs finite building models, not a copy of every
    // short-lived spore track on every rendered frame.
    const state = this.simulation.getHiveNodeState({ nodesOnly: true });
    const active = new Set();
    this.combatants = [];
    for (const node of state.nodes) {
      active.add(node.id);
      const mesh = this.models.get(node.id) ?? this.createNode(node.id);
      mesh.position.set(node.position[0],
        (this.environment?.getElevationAt?.(node.position[0], node.position[1]) ?? 0),
        node.position[1]);
      let proxy = this.proxies.get(node.id);
      if (!proxy) {
        proxy = { isHiveNodeProxy: true, isBattleNPC: true, nodeId: node.id,
          mesh, position: mesh.position, radius: 1.8, factionId: node.factionId, hp: node.hp,
          takeDamage: (amount, killerFaction) => {
            const result = this.simulation?.damageHiveNode(node.id, amount, killerFaction);
            if (result) proxy.hp = result.hp;
            return result;
          }
        };
        this.proxies.set(node.id, proxy);
      }
      proxy.hp = node.hp; proxy.factionId = node.factionId;
      this.combatants.push(proxy);
    }
    for (const [id, mesh] of this.models) if (!active.has(id)) {
      disposeObject(mesh);
      this.models.delete(id); this.proxies.delete(id);
    }
  }

  /** The player melee hit collection and the NPC target provider use different
   * bridges; both must converge on the same node identity and HP. */
  hitWithAttack(attack, killerFaction) {
    if (!attack?.origin?.isVector3 || !Number.isFinite(attack.damage) || attack.damage <= 0 ||
        !Number.isFinite(attack.radius) || attack.radius < 0 || !this.simulation) return [];
    let seen = this.attackHits.get(attack);
    if (!seen) { seen = new Set(); this.attackHits.set(attack, seen); }
    const hits = [];
    for (const proxy of [...this.combatants]) {
      if (seen.has(proxy.nodeId) || (attack.targetOnly && attack.targetOnly !== proxy && attack.targetOnly?.actor !== proxy) ||
          !this.simulation.areHostile(killerFaction, proxy.factionId) ||
          proxy.position.distanceTo(attack.origin) > attack.radius + proxy.radius) continue;
      const origin = attack.origin.clone().add(new THREE.Vector3(0, 1.2, 0));
      const destination = proxy.position.clone().add(new THREE.Vector3(0, .7, 0));
      if (this.environment?.hasLineOfSight &&
          !this.environment.hasLineOfSight(origin, destination)) continue;
      const result = proxy.takeDamage(attack.damage, killerFaction);
      if (!result) continue;
      seen.add(proxy.nodeId);
      hits.push({ pos: proxy.position.clone(), damage: attack.damage,
        killed: result.destroyed, kind: 'hive_node', nodeId: proxy.nodeId });
    }
    if (hits.some(hit => hit.killed)) this.update();
    return hits;
  }

  dispose() {
    disposeObject(this.root);
    this.models.clear(); this.proxies.clear(); this.combatants = [];
    this.simulation = null; this.scene = null; this.environment = null;
    this.attackHits = new WeakMap();
  }
}
