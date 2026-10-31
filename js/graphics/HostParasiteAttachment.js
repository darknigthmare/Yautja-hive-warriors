/* Procedural Facehugger-on-host display for an existing infected Marine.
 * This is a temporary gameplay indicator, not a scan of the film prop.
 * Every geometry/material is owned by its host and released on despawn. */
import * as THREE from 'three';

const VISUAL_NAME = 'facehugger-host-attachment';

export function attachHostParasiteVisual(hostMesh) {
  if (!hostMesh?.add || !hostMesh?.position || !Array.isArray(hostMesh.children)) return null;
  const existing = hostMesh.children.find(child => child.name === VISUAL_NAME);
  if (existing) return existing;
  const group = new THREE.Group();
  group.name = VISUAL_NAME;
  group.userData.visualFidelity1to1Verified = false;
  group.userData.sourceRole = 'Facehugger on incubating human host — visual study';
  const shell = new THREE.MeshStandardMaterial({color:0xa18a6c,roughness:.67,metalness:.03});
  const underside = new THREE.MeshStandardMaterial({color:0x544439,roughness:.71,metalness:.01});

  const body = new THREE.Mesh(new THREE.SphereGeometry(.21,12,9),shell);
  body.name = 'parasite-abdominal-shell';
  body.scale.set(.88,.47,1.15);
  body.position.set(0,3.185,.26);
  group.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(.13,11,7),underside);
  belly.name = 'parasite-ventral-sac';
  belly.scale.set(.9,.55,1.15);
  belly.position.set(0,3.14,.32);group.add(belly);

  // Eight gripping digits fit around the host's face without modifying the
  // host's rig, mesh materials or identity.
  for(const side of [-1,1])for(let finger=0;finger<4;finger++){
    const z=.15+finger*.085;
    const path=new THREE.CatmullRomCurve3([
      new THREE.Vector3(side*.15,3.21,z),
      new THREE.Vector3(side*(.22+finger*.015),3.19,z+.04),
      new THREE.Vector3(side*.24,3.02-finger*.02,z+.10),
      new THREE.Vector3(side*.12,2.96-finger*.02,z+.17)
    ]);
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(path,12,.027,7,false),shell);
    mesh.name=`grip-${side<0?'left':'right'}-${finger}`;group.add(mesh);
  }
  const tailPath=new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,3.16,.08),
    new THREE.Vector3(.17,3.28,-.02),
    new THREE.Vector3(.31,3.30,-.19),
    new THREE.Vector3(.29,3.13,-.39),
    new THREE.Vector3(.18,2.96,-.33)
  ]);
  const tail=new THREE.Mesh(new THREE.TubeGeometry(tailPath,22,.035,8,false),shell);
  tail.name='parasite-curved-tail';group.add(tail);
  hostMesh.add(group);
  return group;
}
