import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const out=new URL('./',import.meta.url).pathname; await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1400,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/qa-apc-mechanisms-preview.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body style="margin:0"></body>'}));
 await page.goto(`${process.env.QA_BASE_URL||'http://127.0.0.1:5198'}/qa-apc-mechanisms-preview.html`);
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');const {createAPCModel}=await import('/js/graphics/SupportModels.js');
  const scene=new T.Scene();scene.background=new T.Color(0x323b40);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1400,950);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;document.body.append(renderer.domElement);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  scene.add(new T.HemisphereLight(0xe1edf2,0x555249,2));const key=new T.DirectionalLight(0xffedce,3.3);key.position.set(7,10,10);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:1,far:35});key.shadow.normalBias=.025;scene.add(key);
  const rim=new T.DirectionalLight(0xa5bac0,1.0);rim.position.set(-10,6,-10);scene.add(rim);
  const floor=new T.Mesh(new T.PlaneGeometry(150,150),new T.MeshStandardMaterial({color:0x4b504a,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.005;floor.receiveShadow=true;scene.add(floor);
  const camera=new T.PerspectiveCamera(34,1400/950,.1,180),model=createAPCModel();scene.add(model.group);
  window.draw=spec=>{
   model.setTurretDeployment(spec.deployment??1);model.turret.rotation.y=0;model.gun.rotation.x=0;model.barrels.position.z=0;model.muzzleFlash.visible=false;model.flareMaterial.opacity=0;
   if(spec.aim){model.setTurretAim(new T.Vector3(...spec.aim));model.barrels.position.z=-.15;model.muzzleFlash.visible=true;model.flareMaterial.opacity=.8;}
   const center=new T.Vector3(0,1.65,-.45),view=spec.view??[.92,.48,1];camera.position.copy(center).add(new T.Vector3(...view).multiplyScalar(14));camera.lookAt(center);renderer.render(scene,camera);
   return {triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,carriage:model.carriage.position.toArray(),carriageRotationX:model.carriage.rotation.x,turretYaw:model.turret.rotation.y,gunElevation:-model.gun.rotation.x};
  };
 });
 const shots=[
 {name:'apc-quarter'},
 {name:'apc-service-flank',view:[-1.12,.25,.05]},
 {name:'apc-rear-deployed',view:[.8,.38,-1]},
 {name:'apc-rear-stowed',view:[.8,.38,-1],deployment:0},
 {name:'apc-rear-rising',view:[.8,.38,-1],deployment:.25},
 {name:'apc-rear-corner',view:[.8,.38,-1],deployment:.375},
 {name:'apc-roof-travel',view:[.8,.38,-1],deployment:.625},
 {name:'apc-elevated',view:[.8,.33,1],aim:[8,12,20]},
 ];
 const captures=[];
 for(const spec of shots){const metrics=await page.evaluate(spec=>window.draw(spec),spec);await page.screenshot({path:`${out}/${spec.name}.png`});captures.push({...spec,...metrics});}
 const report={date:'2026-10-25',scope:'Controlled model scene; real meshes/materials, local reconstruction checked against three licensed NECA photographs; no film 1:1 certification or hardware frame-rate claim',errors,captures};
 await fs.writeFile(`${out}/render-report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
