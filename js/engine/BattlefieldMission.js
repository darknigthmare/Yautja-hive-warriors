import * as THREE from 'three';
import { BattlefieldProgression } from './BattlefieldProgression.js';

// Connect objective state to real encounters. Opening a gate never teleports
// the player: the next encounter starts only when a living player walks in.
export class BattlefieldMission {
  constructor({ environment, horde, bosses, level, onAnnouncement = () => {}, onSectorEntered = () => {} }) {
    if (!environment.battlefieldLayout) throw new Error('BattlefieldMission requires a built connected map');
    Object.assign(this, { environment, horde, bosses, level, onAnnouncement, onSectorEntered });
    this.progression = new BattlefieldProgression(environment.battlefieldLayout);
    this.disposed = false;
    this._bossSectorId = null;
    this._bossEncounter = null;
    this._spawnSectorId = null;
    this._players = [];
    this._previousDeathCallback = horde.onDefeated;
    this._deathCallback = record => {
      this._previousDeathCallback?.(record);
      if (this.disposed) return;
      this.progression.recordKill({ ...record, sectorId: record.sectorId ?? this._spawnSectorId });
    };
    horde.onDefeated = this._deathCallback;
    this._previousSpawnProvider = horde.spawnPositionProvider;
    this._spawnProvider = (playerPosition, distance, index) => {
      for (let attempt = 0; attempt < 16; attempt++) {
        const point = this.environment.getSpawnPoint(this._spawnSectorId, index + attempt, playerPosition, distance);
        if (point && this._players.every(player => Math.hypot(point.x - player.position.x, point.z - player.position.z) >= 24)) return point;
      }
      return null;
    };
    horde.spawnPositionProvider = this._spawnProvider;
  }

  get complete() { return this.progression.complete; }

  update(players) {
    if (this.disposed) return;
    this._players = players.filter(player => player && player.hp > 0);
    this.progression.update(players);
    // All damage sources eventually clear the actual BossManager encounter.
    // A null boss before its sector was entered can never grant a victory.
    if (this._bossSectorId && this._bossEncounter?.hp <= 0 && !this.bosses.activeBoss) {
      this.progression.recordBossDefeat({ sectorId: this._bossSectorId });
      this._bossSectorId = null;
      this._bossEncounter = null;
    }
    this._flushEvents();
    this._recoverFiniteObjective();
  }

  _recoverFiniteObjective() {
    // Normal waves retain facehuggers and other consumable threats. If those
    // exhaust a finite quota, replace only the missing opposition, through
    // the same delayed, creditable queue; never award phantom eliminations.
    if (!this._players.length || this.horde.remainingCount !== 0) return;
    const sector = this.progression.currentSector, state = this.progression.currentState;
    if (!state.entered || state.completed) return;
    const objective = sector.objective;
    const remaining = objective.type === 'kills' ? objective.target - state.kills
      : objective.type === 'interact' && state.interacted ? objective.defenseTarget - state.defenseKills : 0;
    if (remaining > 0) this.horde.enqueueReinforcements(remaining);
  }

  interact(player) {
    if (this.disposed || !this.progression.canInteract(player)) return false;
    this.progression.interact(player);
    this._flushEvents();
    return true;
  }

  _flushEvents() {
    for (const event of this.progression.drainEvents()) {
      if (event.type === 'sector-entered') this._enterSector(event.sectorId);
      else if (event.type === 'relay-activated') {
        // Keep the current defenders and append a bounded, delayed response.
        // Clearing/spawning a wave here would erase the battle the player sees.
        this.horde.enqueueReinforcements(event.target + 4);
        this.onAnnouncement(`RELAIS ACTIVÉ — CONTRE-ATTAQUE EN APPROCHE. REPOUSSEZ ${event.target} ENNEMIS POUR OUVRIR LE SAS.`);
      }
      else if (event.type === 'sector-completed') {
        this.horde.cancelPendingSpawns?.();
        this.environment.completeSector?.(event.sectorId);
      } else if (event.type === 'gate-opened') {
        this.environment.openGate(event.gateId);
        const next = this.progression.layout.sectors.find(sector => sector.id === event.to);
        this.onAnnouncement(`PASSAGE OUVERT — REJOIGNEZ ${next.name.toUpperCase()}`);
      }
    }
  }

  _enterSector(id) {
    const sector = this.progression.layout.sectors.find(value => value.id === id);
    this._spawnSectorId = id;
    this.environment.setActiveSector(id);
    // Reinforcements from a cleared zone cannot follow as an unbounded second
    // wave. Encounter-owned hazards and queues leave with that encounter.
    this.horde.clearWave();
    const center = new THREE.Vector3(sector.center[0], 0, sector.center[1]);
    const bounds = sector.bounds;
    const localPlayer = this._players.find(player => player.position.x >= bounds.minX && player.position.x <= bounds.maxX && player.position.z >= bounds.minZ && player.position.z <= bounds.maxZ);
    this.horde.spawnWave(sector.recommendedEnemies ?? (sector.objective.type === 'kills' ? sector.objective.target + 6 : 18), localPlayer?.position ?? center);
    if (sector.objective.type === 'commander') {
      const position = new THREE.Vector3(sector.objective.position[0], 0, sector.objective.position[1]);
      this.horde.spawnHiveOfficer(position.clone().add(new THREE.Vector3(0, 0, 30)), 0, 'COMMANDANT DU SECTEUR');
      const commander = this.horde.aliens.at(-1);
      if (commander) {
        commander.mesh.position.copy(position);
        commander.objectiveCommander = true;
        commander.battlefieldSectorId = id;
        commander.hp = commander.maxHp = 900 + sector.index * 150;
      }
    } else if (sector.objective.type === 'boss') {
      const position = new THREE.Vector3(sector.objective.position[0], 0, sector.objective.position[1]);
      this.bosses.spawnBoss(this.level.bossType ?? 'xenomorph_queen', position);
      if (!this.bosses.activeBoss) throw new Error('The final battlefield boss could not be created');
      this._bossSectorId = id;
      this._bossEncounter = this.bosses.activeBoss;
    }
    this.onSectorEntered(sector);
    this.onAnnouncement(`${sector.name.toUpperCase()} — ${sector.objective.label}`);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.horde.onDefeated === this._deathCallback) this.horde.onDefeated = this._previousDeathCallback;
    if (this.horde.spawnPositionProvider === this._spawnProvider) this.horde.spawnPositionProvider = this._previousSpawnProvider;
    this.horde.cancelPendingSpawns?.();
    this._players = [];
    this._bossEncounter = null;
  }
}
