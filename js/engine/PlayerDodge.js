import * as THREE from 'three';
/** A finite physical dodge. It avoids telegraphed areas by moving through the
 * same cover solver as walking; it grants no invisible damage immunity. */
export class PlayerDodge {
 constructor(environment){this.environment=environment;this.states=new Map();}
 start(player,direction){if(!player||player.hp<=0||player.isFacehuggerLatched||player.isMountedSmartgun||player.isLeaping||player.stamina<20||this.states.get(player)?.cooldown>0)return false;const travel=new THREE.Vector3(direction?.x??0,0,-(direction?.y??0));if(travel.lengthSq()<.01)travel.set(-Math.sin(player.rotationY),0,-Math.cos(player.rotationY));travel.normalize();player.stamina-=20;player.cancelAttack?.('dodge');player.isDodging=true;this.states.set(player,{direction:travel,remaining:.22,cooldown:.8});return true;}
 update(delta){if(!(delta>0))return;for(const[player,state]of this.states){state.cooldown=Math.max(0,state.cooldown-delta);const elapsed=Math.min(delta,state.remaining);if(elapsed>0&&player.hp>0){player.position.addScaledVector(state.direction,25*elapsed);this.environment.resolveMovement(player.position);state.remaining-=elapsed;}if(state.remaining<=0||player.hp<=0)player.isDodging=false;if(state.cooldown===0){this.states.delete(player);player.isDodging=false;}}}
 reset(){for(const player of this.states.keys())player.isDodging=false;this.states.clear();}
}
