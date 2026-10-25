# Measured rest pivots

`applyBoneRestCorrections(scene, descriptor, {sourceSha256, privateScene:true})`
updates an existing joint in a detached private scene clone. It requires a
calibrated version1 descriptor with the exact source SHA256 and exact joint and
parent names:

```js
{
  version: 1,
  calibrated: true,
  sourceSha256: '…64 hexadecimal characters…',
  joints: [{bone: 'LeftArm', parent: 'LeftShoulder', position: [x, y, z]}]
}
```

`position` is measured in the joint parent's local coordinates. The module
keeps its rotation and scale, preserves the world rest transform of every
descendant, and compensates every skin that references the scene's bones:

`inverseNew = inverse(worldNewBone) * worldOldBone * inverseOld`.

All inverse-bind arrays and matrices are cloned before a joint moves. No mesh,
triangle, vertex attribute, bone, material, texture or hierarchy is added or
rewritten. Every world rest vertex and every unselected world transform must
remain within1e-6. A failure restores transforms, flags, bind matrices and the
original inverse-bind array identities. The caller's cached template must never
be passed directly; the explicit ownership flag is an attestation, not cloning.

The supported descriptor uses independent joints in separate ancestor branches.
Related joint corrections require another explicit calibration. There are no
anatomical guesses, automatic pivot inference or animation rebasing.

For City Hunter, the LeftArm target is measured from the mean of147 reviewed
source15/source18 boundary points, transformed through the actual LeftShoulder
world matrix. These points are a visual calibration, not a canonical closed
anatomical ring. The measured parent-local target is
`[-24.129454994679115,-6.445566247060389,4.8692597110073725]`.
Its source is the raw rig SHA
`bd962ad79d5034d6ac5c0d7fc03e185433d0784808ffc868e597c7656e6725e7`.

Apply this after measured region/weight preparation and before creating the
two hair chains. Old clips contain old joint/child locals and are not valid for
the corrected rest hierarchy. City discards clips only on its private prepared
GLTF wrapper; cached clips and the separate supplier walk/run files remain
unchanged. The standalone corrected GLB embeds no animation clips.

Tests exercise an actual change of rotation center, multiple skins sharing
cached inverse matrices, centimetre scales, affine descendants, full rollback
after a failed rest-surface proof and calibration/ownership guards.
