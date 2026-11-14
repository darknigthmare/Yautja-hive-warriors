/* Original, source-AFF-06..10 field equipment studies.
 * Not canonical film props, skins, or proof of 1:1 asset fidelity.
 * Adds visible gear to an already allocated soldier; never changes
 * identity, collision, combat damage or abilities. */
import * as THREE from 'three';

const ALLOWED_OPERATIONS=new Set(['AFF-06','AFF-07','AFF-08','AFF-09','AFF-10']);
const ROOT_NAME='original-musou-field-gear';

export function attachOriginalMusouFieldGear(mesh,slot){
  if(!mesh?.add||!Array.isArray(mesh.children)||!slot||
    slot.species!=='human'||!ALLOWED_OPERATIONS.has(slot.sourceOperationId)||
    slot.visualFidelity1to1Verified!==false)return null;
  const existing=mesh.children.find(child=>child.name===ROOT_NAME);
  if(existing)return existing;
  const originalContemporary=['AFF-06','AFF-07'].includes(slot.sourceOperationId);
  const root=new THREE.Group();root.name=ROOT_NAME;
  root.userData={sourceGroupId:slot.sourceGroupId,sourceRole:slot.role,
    sourceOperationId:slot.sourceOperationId,visualFidelity1to1Verified:false,
    operationalAbilityImplemented:false,provenance:'original-low-poly-prototype'};
  const palette={
    shell:new THREE.MeshStandardMaterial({color:originalContemporary?0x676957:0x53695e,roughness:.85,metalness:.01}),
    textile:new THREE.MeshStandardMaterial({color:originalContemporary?0x383e35:0x3d4c47,roughness:.92,metalness:0}),
    steel:new THREE.MeshStandardMaterial({color:0x777c77,roughness:.55,metalness:.42}),
    screen:new THREE.MeshStandardMaterial({color:0x24586a,roughness:.33,metalness:.1,emissive:0x153749,emissiveIntensity:.3})
  };
  const box=(name,x,y,z,w,h,d,key='shell')=>{
    const part=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),palette[key]);
    part.name=name;part.position.set(x,y,z);root.add(part);return part;
  };
  const rod=(name,x,y,z,height,radius=.025,key='steel')=>{
    const part=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,8),palette[key]);
    part.name=name;part.position.set(x,y,z);root.add(part);return part;
  };
  const pouch=(name,side,y=1.86)=>box(name,side*.38,y,.03,.2,.25,.23,'textile');
  if(originalContemporary){
    // Layering a contemporary original field vest visually distinguishes the
    // present-day port/industry scenarios from Colonial Marines roles.
    box('present-day-body-armor',0,2.2,.23,.76,.77,.20,'textile');
    box('present-day-vest-top',0,2.55,.31,.56,.12,.08);
    box('present-day-helmet-band',0,3.13,.14,.53,.11,.37,'textile');
  }
  const role=slot.role;
  switch(role){
    case 'squad_leader':
    case 'commander':
      box('commander-shoulder-left',-.47,2.62,.06,.22,.11,.3,'steel');
      box('commander-shoulder-right',.47,2.62,.06,.22,.11,.3,'steel');
      if(role==='commander')box('command-navigation-pad',-.41,1.97,.34,.30,.18,.08,'screen');
      break;
    case 'radio':
      box('radio-backpack',0,2.21,-.43,.51,.65,.25,'textile');
      rod('radio-antenna',.22,3.02,-.47,1.35,.018);
      box('microphone',.21,3.00,.28,.12,.10,.11,'steel');
      break;
    case 'capture_specialist':{
      pouch('capture-restraints',1);
      const coil=new THREE.Mesh(new THREE.TorusGeometry(.19,.035,7,18),palette.steel);
      coil.name='capture-coil';coil.position.set(-.39,1.91,.11);
      coil.rotation.y=Math.PI/2;root.add(coil);
      break;
    }
    case 'sapper':
      pouch('sapper-tool-bag',-1);
      box('sapper-folding-tool',-.37,1.85,-.29,.09,.68,.13,'steel');
      break;
    case 'support':
    case 'smartgunner':
      box('support-ammunition-pack',-.14,2.16,-.45,.48,.54,.28,'textile');
      for(let n=0;n<4;n++)box('reserve-round-'+n,.14+n*.075,2.25,.31,.046,.23,.06,'steel');
      break;
    case 'shield_guard':
      box('orbital-shield-prototype',-.76,2.14,.64,.65,1.24,.12,'shell');
      box('shield-grip',-.42,2.16,.48,.09,.37,.10,'steel');
      break;
    case 'observer':
    case 'counter_surveillance':
      box('observer-optics',.30,3.09,.52,.34,.17,.29,'textile');
      for(const side of [-1,1])
        box('observer-lens-'+side,.30+side*.105,3.1,.68,.075,.07,.027,'screen');
      break;
    case 'technician':
      box('wrist-terminal',-.37,1.96,.31,.24,.17,.10,'steel');
      box('wrist-screen',-.37,1.97,.37,.18,.11,.02,'screen');
      pouch('technician-kit',1);
      break;
    case 'breacher':
      box('breach-ram-tool',-.48,2.11,-.40,.14,.88,.23,'steel');
      pouch('breach-charge-pack',1);
      break;
    case 'liaison':
      box('liaison-document-satchel',.41,1.84,.17,.3,.40,.16,'textile');
      break;
    default: // rifleman / guard: an original belt kit with no invented tech
      pouch('field-utility-kit',-1);
  }
  mesh.add(root);
  return root;
}
