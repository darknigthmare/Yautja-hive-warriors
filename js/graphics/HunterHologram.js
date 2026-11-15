/* A projection of the actual active hunter, not a cylinder-and-sphere proxy.
 * All captured buffers, skeletons and hologram materials belong to this effect:
 * a source-player reload/disposal cannot invalidate a still living projection.
 * This freezes a pose; it does not invent a locomotion clip or likeness scan. */
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const fail = message => { throw new Error(`HunterHologram: ${message}`); };
const smoothstep = (low, high, value) => {
  const t = THREE.MathUtils.clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};

function correspondingNodes(source, clone, result = new Map()) {
  result.set(source, clone);
  source.children.forEach((child, index) => correspondingNodes(child, clone.children[index], result));
  return result;
}

function visibleWithin(node, root) {
  let current = node;
  while (current) {
    if (!current.visible) return false;
    if (current === root) return true;
    current = current.parent;
  }
  return false;
}

function hologramMaterial(side, uniforms) {
  const material = new THREE.MeshBasicMaterial({ name: `hunter-hologram-${side}`, color: 0x36dcff,
    side, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending,
    depthWrite: false, depthTest: true, fog: true, toneMapped: false });
  material.onBeforeCompile = shader => {
    shader.uniforms.hunterHoloTime = uniforms.time;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      varying float vHunterHoloHeight;
      varying vec3 vHunterHoloNormal;
      varying vec3 vHunterHoloView;`);
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vHunterHoloHeight = (modelMatrix * vec4(transformed, 1.0)).y;
      vHunterHoloView = -mvPosition.xyz;
      #ifdef USE_SKINNING
        vHunterHoloNormal = normalize(transformedNormal);
      #else
        vHunterHoloNormal = normalize(normalMatrix * normal);
      #endif`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform float hunterHoloTime;
      varying float vHunterHoloHeight;
      varying vec3 vHunterHoloNormal;
      varying vec3 vHunterHoloView;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
      float holoRim = pow(1.0 - abs(dot(normalize(vHunterHoloNormal), normalize(vHunterHoloView))), 1.8);
      float holoLine = smoothstep(0.52, 0.88, sin(vHunterHoloHeight * 104.0 - hunterHoloTime * 7.0));
      float holoSweep = pow(max(0.0, 1.0 - abs(fract(vHunterHoloHeight * 0.13 - hunterHoloTime * 0.28) - 0.5) * 9.0), 2.0);
      diffuseColor.rgb *= 0.45 + holoRim * 1.1 + holoLine * 0.3 + holoSweep * 0.75;
      diffuseColor.a *= 0.66 + holoRim * 0.2 + holoLine * 0.14;`);
  };
  // Private uniforms may share a compiled program, but never another effect's time.
  material.customProgramCacheKey = () => 'hunter-hologram-scan-v1';
  return material;
}

export function createHunterHologram(player) {
  if (!player?.mesh?.isObject3D || player._disposed) fail('a living player visual is required');
  const imported = player._importedCharacter;
  const source = imported?.adapter?.root ?? player._proceduralMotionRoot;
  if (!source?.isObject3D || source.parent !== player.mesh) fail('an attached active visual is required');
  const root = new THREE.Group(); root.name = 'hunter-hologram'; root.userData.hunterHologram = true;
  player.mesh.updateWorldMatrix(true, true);
  player.mesh.matrixWorld.decompose(root.position, root.quaternion, root.scale);
  const captured = cloneSkeleton(source); root.add(captured);
  const nodes = correspondingNodes(source, captured);
  const excluded = new Set([player.laserGroup, player.wristNukeHoloMesh, ...(player._effects ?? [])].filter(Boolean));
  for (const [original, clone] of nodes) {
    if (excluded.has(original) || original.userData.playerTransientEffect || original.isLight || original.isLine || original.isSprite || original.isCamera) clone.removeFromParent();
  }
  // Only restore explicitly known pre-FPS visibility. Anatomical surfaces
  // intentionally hidden beneath a composed mask must stay hidden.
  let restoredHeads = 0, preservedHiddenHeads = 0;
  if (imported) {
    for (const original of imported.adapter.headMeshes) {
      const clone = nodes.get(original), rest = imported.adapter.getHeadRestVisibility?.(original);
      if (!clone || rest === null || rest === undefined) continue;
      clone.visible = rest;
      if (rest && !original.visible) restoredHeads++;
      if (!rest) preservedHiddenHeads++;
    }
  } else if (nodes.has(player.headMesh)) {
    nodes.get(player.headMesh).visible = true;
    restoredHeads = player.headMesh.visible ? 0 : 1;
  }
  captured.visible = true;
  const geometryCopies = new Map(), geometries = new Set(), materialsBySide = new Map(), skeletons = new Set();
  const uniforms = { time: { value: 0 } };
  let elapsed = 0, disposed = false, totalTriangles = 0, visibleTriangles = 0, visibleMeshes = 0, geometryBytes = 0;
  const materialFor = original => {
    const side = original?.side ?? THREE.FrontSide;
    if (!materialsBySide.has(side)) materialsBySide.set(side, hologramMaterial(side, uniforms));
    return materialsBySide.get(side);
  };
  const dispose = () => {
    if (disposed) return false;
    disposed = true; root.removeFromParent(); root.visible = false;
    geometries.forEach(geometry => geometry.dispose());
    materialsBySide.forEach(material => material.dispose());
    skeletons.forEach(skeleton => skeleton.dispose());
    return true;
  };
  try {
    captured.traverse(mesh => {
      if (!mesh.isMesh) return;
      if (mesh.isInstancedMesh || !mesh.geometry?.attributes.position) fail('only finite ordinary character surfaces are supported');
      const original = mesh.geometry;
      if (!geometryCopies.has(original)) {
        const copy = original.clone(); geometryCopies.set(original, copy); geometries.add(copy);
        const buffers = new Set();
        for (const attribute of [copy.index, ...Object.values(copy.attributes), ...Object.values(copy.morphAttributes).flat()]) {
          if (!attribute) continue;
          const array = attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array;
          if (!buffers.has(array)) { buffers.add(array); geometryBytes += array.byteLength; }
        }
      }
      mesh.geometry = geometryCopies.get(original);
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(materialFor) : materialFor(mesh.material);
      mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false;
      if (mesh.isSkinnedMesh) {
        mesh.skeleton.boneInverses = mesh.skeleton.boneInverses.map(matrix => matrix.clone());
        skeletons.add(mesh.skeleton);
      }
      const triangles = (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
      totalTriangles += triangles;
      if (visibleWithin(mesh, captured)) { visibleMeshes++; visibleTriangles += triangles; }
    });
    if (!visibleMeshes || totalTriangles > 400_000 || geometryBytes > 96 * 1024 * 1024) fail('the active silhouette exceeds the bounded projection budget');
    root.updateMatrixWorld(true); skeletons.forEach(skeleton => skeleton.update());
    const diagnostics = { sourceKind: imported ? 'imported' : 'procedural', sourceAssetKey: player.mesh.userData.generatedAsset?.key ?? player.data?.id ?? null,
      snapshotPose: true, visibleMeshes, visibleTriangles, totalTriangles, geometryBytes,
      ownedGeometries: geometries.size, ownedMaterials: materialsBySide.size, privateSkeletons: skeletons.size,
      sharedSourceGeometries: 0, copiedTextures: 0, restoredHeads, preservedHiddenHeads, elapsed: 0, disposed: false };
    const update = delta => {
      if (disposed || !Number.isFinite(delta) || delta <= 0) return false;
      elapsed = Math.min(60, elapsed + delta); uniforms.time.value = elapsed; diagnostics.elapsed = elapsed;
      const fade = 1 - smoothstep(5.6, 6, elapsed), appear = 0.82 + 0.18 * smoothstep(0, 0.2, elapsed);
      const opacity = 0.34 * appear * fade * (0.94 + Math.sin(elapsed * 8) * 0.06);
      materialsBySide.forEach(material => { material.opacity = opacity; });
      return true;
    };
    return { mesh: root, captured, geometries, materials: [...materialsBySide.values()], skeletons,
      diagnostics, update, dispose() { const result = dispose(); diagnostics.disposed = true; return result; } };
  } catch (error) { dispose(); throw error; }
}
