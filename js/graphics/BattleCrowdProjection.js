/* Distant Musou battle visual LOD.
 * At most FOUR InstancedMesh draw calls for already allocated distant units.
 * Not combat NPCs, not an RTS selection layer, not canonical Predator/Alien
 * models. A proxy disappears as soon as its source unit is materialized.
 */
import * as THREE from 'three';

export const CROWD_VISUAL_POLICY = Object.freeze({
  version: 'musou-distant-instancing-v1',
  minDistance: 34, maxDistance: 205,
  maxPerSpecies: 80, speciesCount: 4,
  refreshSeconds: .4, visualFidelity1to1Verified: false
});

const TYPES = Object.freeze({
  yautja: Object.freeze({ color: 0x627d74, width: 1.16, height: 1.42 }),
  xenomorph: Object.freeze({ color: 0x323c38, width: .88, height: 1.25 }),
  human: Object.freeze({ color: 0x727f80, width: .95, height: .95 }),
  synthetic: Object.freeze({ color: 0x7e9b98, width: .96, height: 1 })
});
const validPoint = value => Array.isArray(value) && value.length === 2 &&
  value.every(Number.isFinite);
const point = player => {
  const p=player?.position??player;
  if(validPoint(p)) return [p[0],p[1]];
  if(p?.isVector3 && Number.isFinite(p.x) && Number.isFinite(p.z)) return [p.x,p.z];
  return null;
};
const distanceSquared=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2;
const speciesOf = unit => unit.species === 'xeno' ? 'xenomorph' : unit.species;

export class BattleCrowdProjection {
  constructor(scene, environment, simulation) {
    if (!scene?.add || !simulation?.units?.values) throw new TypeError('Crowd projection requires live scene and battle');
    this.scene=scene;this.environment=environment;this.simulation=simulation;
    this.elapsed=0;this.disposed=false;this.refreshes=0;
    this.geometry=new THREE.CapsuleGeometry(.25,.82,2,5);
    this.meshes=new Map();this.materials=new Map();this.dummy=new THREE.Object3D();
    this.visibleCounts=Object.fromEntries(Object.keys(TYPES).map(id=>[id,0]));
    this.sourceCount=0;
    for(const [type,look] of Object.entries(TYPES)) {
      const material=new THREE.MeshLambertMaterial({color:look.color,transparent:true,
        opacity:.65,depthWrite:false,side:THREE.FrontSide});
      const mesh=new THREE.InstancedMesh(this.geometry,material,CROWD_VISUAL_POLICY.maxPerSpecies);
      mesh.name=`musou-distant-${type}`;mesh.count=0;mesh.frustumCulled=false;
      mesh.castShadow=false;mesh.receiveShadow=false;
      mesh.userData={purelyVisual:true,notACombatant:true,
        visualFidelity1to1Verified:false,source:'already-allocated-distant-units'};
      mesh.raycast=()=>{}; // Never hit/select an impostor as a real NPC.
      this.meshes.set(type,mesh);this.materials.set(type,material);scene.add(mesh);
    }
  }

  update(delta, players, {force=false}={}) {
    if (this.disposed || !Number.isFinite(delta) || delta<0) return false;
    this.elapsed+=delta;
    if(!force && this.elapsed<CROWD_VISUAL_POLICY.refreshSeconds) return false;
    this.elapsed=0;this.refreshes++;
    const observers=(players??[]).map(point).filter(Boolean), near2=CROWD_VISUAL_POLICY.minDistance**2,
      far2=CROWD_VISUAL_POLICY.maxDistance**2;
    const buckets=new Map(Object.keys(TYPES).map(type=>[type,[]]));
    this.sourceCount=0;
    for(const unit of this.simulation.units.values()) {
      if(unit.state!=='distant'||!(unit.hp>0)||!validPoint(unit.position))continue;
      const type=speciesOf(unit),list=buckets.get(type);if(!list)continue;
      this.sourceCount++;
      if(!observers.length)continue;
      let nearest=Infinity;
      for(const observer of observers)nearest=Math.min(nearest,distanceSquared(observer,unit.position));
      if(nearest<near2||nearest>far2)continue;
      list.push({id:unit.id,position:unit.position,distSq:nearest});
    }
    for(const [type,look] of Object.entries(TYPES)){
      const list=buckets.get(type).sort((a,b)=>a.distSq-b.distSq||
        a.id.localeCompare(b.id)).slice(0,CROWD_VISUAL_POLICY.maxPerSpecies);
      const mesh=this.meshes.get(type),current=[];
      for(const entry of list){
        const [x,z]=entry.position;
        const y=this.environment?.getPlacementElevationAt?.(x,z) ??
          this.environment?.getElevationAt?.(x,z) ?? 0;
        if(!Number.isFinite(y))continue;
        const ground=new THREE.Vector3(x,y,z);
        if(this.environment?.navigation?.canStand &&
          !this.environment.navigation.canStand(ground,.35))continue;
        const index=current.length;
        this.dummy.position.set(x,y+.73*look.height,z);
        this.dummy.rotation.set(0,0,0);
        this.dummy.scale.set(look.width,look.height,look.width);
        this.dummy.updateMatrix();mesh.setMatrixAt(index,this.dummy.matrix);
        current.push(entry.id);
      }
      mesh.count=current.length;
      mesh.instanceMatrix.needsUpdate=true;
      this.visibleCounts[type]=current.length;
    }
    return true;
  }

  getStats(){
    return {policy:CROWD_VISUAL_POLICY.version,drawCallsAtMost:this.meshes.size,
      instanceCapacity:this.meshes.size*CROWD_VISUAL_POLICY.maxPerSpecies,
      visible:Object.values(this.visibleCounts).reduce((a,b)=>a+b,0),
      bySpecies:{...this.visibleCounts},sourceDistantUnits:this.sourceCount,
      refreshes:this.refreshes,visualFidelity1to1Verified:false};
  }

  dispose(){
    if(this.disposed)return;
    this.disposed=true;
    for(const mesh of this.meshes.values())this.scene.remove(mesh);
    for(const material of this.materials.values())material.dispose();
    this.geometry.dispose();this.meshes.clear();this.materials.clear();
    this.simulation=null;this.environment=null;this.scene=null;
  }
}
