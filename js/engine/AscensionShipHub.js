/* La Lame Patiente, Kaedh's hunting ship (HW-DEC-108; campagne-unblooded.md §1): a small walkable
 * 3D base between two hunts. Creation of Hive Warriors, not a Bible V6 model. Four places answer [E]:
 * the drop bay launches the hunt, the world map changes the target, the rack shows earned tools,
 * the skull wall shows the great prey taken; the bridge stays closed to Unblooded. */
import * as THREE from 'three';
import { createHonorGuardModel } from '../graphics/SupportModels.js';
import { createFaunaModel } from '../graphics/FaunaModels.js';
import { ASCENSION_WORLDS } from '../data/AscensionWorlds.js';

export const SHIP_LEVEL = Object.freeze({ id: 'lame_patiente', name: 'LA LAME PATIENTE — vaisseau de Kaedh', environmentType: 'station', theme: 'space_station',
  weather: 'none', floorColor: 0x2a2626, wallColor: 0x3a3330, fogColor: 0x1d1a1a, accentColor: 0xff8a4a, fogDensity: 0.02, arenaHalfSize: 22, battlefield: false,
  fidelity: 'adaptation', era: 'ascension' });

const TOOL_LABELS = Object.freeze({ netgun: 'Lance-filet', bear_trap: 'Piège à mâchoires', voice_lure: 'Leurre sonore', tripwire_mine: 'Mines',
  smart_disc: 'Disque', flechettes: 'Fléchettes', cloak: 'Camouflage', shuriken: 'Shuriken' });

export class AscensionShipHub {
  constructor(scene, progress, { onLaunch = () => {}, onLine = () => {} } = {}) {
    this.scene = scene; this.progress = progress; this.onLaunch = onLaunch; this.onLine = onLine;
    this.group = new THREE.Group(); this.group.name = 'lame-patiente'; this.places = []; this.lastPrompt = null;
    this.targetWorldId = this.targets().at(-1);
  }

  _place(id, position, prompt, action, mesh) {
    mesh.position.copy(position); this.group.add(mesh); this.places.push({ id, position: position.clone(), prompt, action, mesh });
  }

  build() {
    const glow = new THREE.MeshStandardMaterial({ color: 0xff8a4a, emissive: 0x6a2a10, roughness: .5 });
    const bone = new THREE.MeshStandardMaterial({ color: 0xd9d0b4, roughness: .6 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x4a4440, metalness: .6, roughness: .45 });
    // Drop bay: the hunt starts here.
    const bay = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, .2, 24), glow);
    this._place('bay', new THREE.Vector3(0, .1, -12), () => this.targetWorldId === 'rite' ? `SOUTE DE LARGAGE — [E] LE RITE DANS LA PYRAMIDE, AVEC ${this.progress.triad().join(' ET ').toUpperCase()}` : `SOUTE DE LARGAGE — [E] LARGUER LA MEUTE SUR ${this.world().title}`, () => this.onLaunch(this.targetWorldId), bay);
    // World map: chooses among the open worlds.
    const map = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, .3), metal);
    this._place('map', new THREE.Vector3(6, 1.2, -9), () => `CARTE DES MONDES — CIBLE : ${this.targetWorldId === 'rite' ? 'LE RITE' : this.world().title} · [E] SUIVANT`, () => this.cycleWorld(), map);
    // Rack: one object per earned tool.
    const rack = new THREE.Group(); rack.add(new THREE.Mesh(new THREE.BoxGeometry(5, .2, 1), metal));
    this.progress.state.tools.forEach((tool, index) => { const item = new THREE.Mesh(new THREE.BoxGeometry(.5, .9, .3), bone); item.position.set(-2 + index * .6, .6, 0); item.name = `rack-${tool}`; rack.add(item); });
    this._place('rack', new THREE.Vector3(-10, 1, 0), () => `RÂTELIER — ${this.progress.state.tools.length ? this.progress.state.tools.map(tool => TOOL_LABELS[tool] ?? tool).join(', ') : 'aucun outil gagné'}`, () => this.onLine(`SAAR : « ${this.progress.state.tools.length ? 'Chaque outil a été payé par une chasse.' : 'Rien ici ne vous appartient encore.'} »`), rack);
    // Skull wall: one head per great prey taken.
    const wall = new THREE.Group(); wall.add(new THREE.Mesh(new THREE.BoxGeometry(.3, 3, 8), metal));
    ASCENSION_WORLDS.filter(world => this.progress.state.completed.includes(world.id)).forEach((world, index) => {
      const head = createFaunaModel({ color: 0xd9d0b4, size: .45 }, { prey: true }); head.position.set(-.4, .6 + Math.floor(index / 4) * 1.1, -3 + (index % 4) * 2); head.rotation.y = -Math.PI / 2; head.name = `skull-${world.id}`; wall.add(head);
    });
    this._place('skulls', new THREE.Vector3(12, .5, 0), () => `MUR DES CRÂNES — ${this.progress.state.completed.length} GRANDE(S) PROIE(S)`, () => this.onLine(this.progress.state.completed.length ? 'KAEDH : « Je vois. »' : 'KAEDH : « Pas encore. »'), wall);
    // Bridge: closed to Unblooded; Kaedh stands there, back turned.
    const door = new THREE.Mesh(new THREE.BoxGeometry(4, 4, .4), metal);
    // The bridge opens once the eight worlds are hunted: there the hunter chooses the two companions of the rite.
    this._place('bridge', new THREE.Vector3(0, 2, 14), () => this.progress.riteOpen() && !this.progress.state.blooded ? `PASSERELLE — TRIADE : ${this.progress.triad().join(' ET ').toUpperCase()} · [E] CHANGER` : 'PASSERELLE — INTERDITE AUX UNBLOODED',
      () => { if (this.progress.riteOpen() && !this.progress.state.blooded) { const pair = this.progress.cycleTriad(); this.onLine(`KAEDH : « Il est à toi. » Triade : ${pair.join(' et ')}.`); } else this.onLine(this.progress.state.blooded ? 'KAEDH : « Je vois. »' : 'KAEDH : « Pas encore. »'); }, door);
    const kaedh = createHonorGuardModel(0); kaedh.position.set(0, 0, 12.2); kaedh.rotation.y = 0; kaedh.name = 'kaedh'; this.group.add(kaedh);
    const saar = createHonorGuardModel(1); saar.position.set(-7, 0, -3); saar.rotation.y = Math.PI / 2; saar.name = 'saar'; this.group.add(saar);
    this.scene.add(this.group);
    this.onLine('SAAR : « Approche. » Kaedh vous attend à bord de La Lame Patiente.');
    return this;
  }

  world() { return ASCENSION_WORLDS.find(world => world.id === this.targetWorldId) ?? ASCENSION_WORLDS[0]; }

  /** Open worlds, then the rite once all eight are hunted and the hunter is not yet Blooded. */
  targets() { return [...this.progress.unlockedWorlds().map(world => world.id), ...(this.progress.riteOpen() && !this.progress.state.blooded ? ['rite'] : [])]; }

  cycleWorld() {
    const targets = this.targets(), index = targets.indexOf(this.targetWorldId);
    this.targetWorldId = targets[(index + 1) % targets.length];
    this.onLine(this.targetWorldId === 'rite' ? 'CIBLE : LE RITE — LA PYRAMIDE' : `CIBLE : ${this.world().title} — ${this.world().prey.name}`);
  }

  nearest(position, radius = 3.6) {
    return this.places.map(place => ({ place, d: Math.hypot(place.position.x - position.x, place.position.z - position.z) }))
      .filter(entry => entry.d <= radius).sort((a, b) => a.d - b.d)[0]?.place ?? null;
  }

  /** Shows the prompt of the place the hunter stands at, once per arrival. */
  update(player) {
    const place = player ? this.nearest(player.position) : null;
    if (place && place.id !== this.lastPrompt) this.onLine(place.prompt());
    this.lastPrompt = place?.id ?? null;
  }

  interact(player) {
    const place = player ? this.nearest(player.position) : null;
    if (!place) return false;
    place.action(); return true;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse(node => { node.geometry?.dispose?.(); if (Array.isArray(node.material)) node.material.forEach(material => material.dispose?.()); else node.material?.dispose?.(); });
    this.places = [];
  }
}
