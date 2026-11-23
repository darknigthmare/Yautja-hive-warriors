import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCreatureModel, animateCreatureModel, creaturePartGeometry } from '../js/graphics/CreatureModels.js';

// Draw-call pass: the limbs, tail and carapace of a creature are one skinned mesh. Every vertex of a
// part must land exactly where the former separate part mesh, rotated by the same pose, put it.
test('the merged body moves each part exactly as its own rotated mesh did', () => {
  for (const kind of ['warrior', 'runner', 'queen']) {
    const actor = createCreatureModel(kind); actor.position.set(3, 0, -2); actor.rotation.y = .6;
    animateCreatureModel(actor, 1.3, true); actor.updateMatrixWorld(true);
    const body = actor.getObjectByName('creature-body'); assert.ok(body?.isSkinnedMesh, kind);
    body.skeleton.update();
    const skinned = new THREE.Vector3(), expected = new THREE.Vector3(); let offset = 0, worst = 0;
    for (const bone of body.skeleton.bones.slice(1)) { // merge order
      const geometry = creaturePartGeometry(actor, bone.name);
      const count = geometry.attributes.position.count;
      for (let i = 0; i < count; i += 37) {
        body.getVertexPosition(offset + i, skinned); skinned.applyMatrix4(body.matrixWorld);
        expected.fromBufferAttribute(geometry.attributes.position, i).applyMatrix4(bone.matrixWorld);
        worst = Math.max(worst, skinned.distanceTo(expected));
      }
      offset += count;
    }
    assert.ok(worst < 1e-4, `${kind}: worst vertex drift ${worst}`);
    assert.equal(actor._creatureMeshes.length, actor.children.length, 'every rendered mesh is listed for imported-model hiding');
  }
});
