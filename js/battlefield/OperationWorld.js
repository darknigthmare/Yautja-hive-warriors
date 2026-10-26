import * as THREE from 'three';
import { disposeObject } from '../engine/SceneResources.js';

/** Visible, mission-owned projections of objective identities; positions come
 * from the same controller used by channels, cargo and extraction checks. */
export class OperationWorld {
  constructor(scene, environment, controller, playerFaction, opposingFaction) { this.scene=scene;this.environment=environment;this.controller=controller;this.playerFaction=playerFaction;this.opposingFaction=opposingFaction;this.combatants=[];this.proxies=new Map();this.root=new THREE.Group();this.root.name='operation-objectives';scene.add(this.root);this.nodes=new Map(); }
  node(id, kind, color) {
    if(this.nodes.has(id)) return this.nodes.get(id);
    const group=new THREE.Group();group.name=id;
    const material=new THREE.MeshStandardMaterial({color,metalness:.65,roughness:.45});
    if(kind==='person') {
      const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.3,.8,4,8),material);torso.position.y=1;group.add(torso);
      const head=new THREE.Mesh(new THREE.SphereGeometry(.23,8,6),material);head.position.y=1.8;group.add(head);
    } else {
      const body=new THREE.Mesh(new THREE.BoxGeometry(kind==='convoy'?3.2:1.1,kind==='convoy'?1.8:1.4,kind==='convoy'?5:1),material);body.position.y=.8;group.add(body);
      if(kind==='task') {const screen=new THREE.Mesh(new THREE.BoxGeometry(.8,.55,.06),new THREE.MeshStandardMaterial({color:0x8af9cf,emissive:0x32b889,emissiveIntensity:1}));screen.position.set(0,1.1,.55);group.add(screen);}
    }
    const ring=new THREE.Mesh(new THREE.TorusGeometry(kind==='convoy'?3:1.3,.055,6,24),new THREE.MeshBasicMaterial({color}));ring.rotation.x=Math.PI/2;ring.position.y=.08;group.add(ring);
    this.root.add(group);this.nodes.set(id,group);return group;
  }
  update(state) {
    if(!state)return;
    const present=new Set();this.combatants=[];
    const place=(id,kind,position,visible,color)=>{present.add(id);const node=this.node(id,kind,color);node.visible=visible;node.position.set(position[0],this.environment.getElevationAt?.(position[0],position[1])??0,position[1]);};
    for(const task of state.tasks)place('task:'+task.id,'task',task.position,task.available&&task.status!=='done',0x57e3bb);
    for(const entity of state.entities){
      const available=entity.hp>0&&!entity.evacuated&&!entity.escaped&&entity.state!=='carried';
      place(entity.id,entity.kind,entity.position,available&&entity.kind!=='noncombatants',0xd5ac65);
      for(const member of entity.members)place(member.id,'person',member.position,member.hp>0&&member.state!=='evacuated',0xa8c6e3);
      if(available&&(entity.kind!=='noncombatants'||entity.state==='rescued')){
        let proxy=this.proxies.get(entity.id);
        if(!proxy){const node=this.nodes.get(entity.id);proxy={isBattleNPC:true,position:node.position,mesh:node,radius:entity.kind==='convoy'?2:1,hp:entity.hp,isFacehuggerLatched:false,takeDamage:amount=>{if(this.controller?.damageObjective(entity.id,amount,[node.position.x,node.position.z]))proxy.hp=this.controller.getWorldEntities().find(item=>item.id===entity.id)?.hp??0;}};this.proxies.set(entity.id,proxy);}
        proxy.hp=entity.hp;proxy.factionId=entity.factionId??(entity.kind==='convoy'?this.opposingFaction:this.playerFaction);this.combatants.push(proxy);
      }
    }
    for(const[id,node]of this.nodes)if(!present.has(id))node.visible=false;
  }
  damageNear(controller, origin, radius, amount) { for(const entity of controller.getWorldEntities())if(entity.hp>0&&entity.state!=='carried'&&Math.hypot(entity.position[0]-origin.x,entity.position[1]-origin.z)<=radius)controller.damageObjective(entity.id,amount,[origin.x,origin.z]); }
  dispose(){disposeObject(this.root);this.nodes.clear();this.proxies.clear();this.combatants=[];}
}
