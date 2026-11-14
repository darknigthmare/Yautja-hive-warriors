/** Documentary cross-game provenance from Alien_base PR #25, currently unmerged.
 * Each source blob is an evidence locator, never proof of canonical or 1:1 fidelity.
 * No copied assets and no network request or access token. */
const RAW={
  "schemaVersion": "2.0-preview",
  "sourceRepository": "darknigthmare/alien_base",
  "sourceBranch": "feat/blood-arena-sync-on-unified-20261102",
  "sourcePullRequest": 25,
  "sourceCommit": "57689c2dd2dcadb3572e81ed6f3179dbad27f450",
  "sourceEntitiesBlobSha": "37db6ff37bb10390b49bb161c0b7d2feb3b2dd7c",
  "status": "unmerged-documentary-cross-references",
  "identityContract": "43-unchanged-v1-local-bindings",
  "notes": "Only additional source location references; not canon/fidelity certification and never alters stats or saves.",
  "references": {
    "character.yautja.alpha_predator": [
      {
        "repository": "darknigthmare/yautja-la-longue-chasse",
        "path": "app/game/hunterLore.ts",
        "blobSha": "6c73f105b53e79d743a939ed7af0ad22e7c03c67",
        "localId": "alpha"
      },
      {
        "repository": "darknigthmare/yautja-apex-hunt",
        "path": "src/data/YautjaLoreDatabase.js",
        "blobSha": "2ea6fbef17999783ac3bb14bfca24ff10fdd4beb",
        "localId": "alpha_yautja"
      }
    ],
    "character.yautja.city_hunter": [
      {
        "repository": "darknigthmare/yautja-la-longue-chasse",
        "path": "app/game/hunterLore.ts",
        "blobSha": "6c73f105b53e79d743a939ed7af0ad22e7c03c67",
        "localId": "city-hunter"
      }
    ],
    "character.yautja.feral_predator": [
      {
        "repository": "darknigthmare/yautja-la-longue-chasse",
        "path": "app/game/hunterLore.ts",
        "blobSha": "6c73f105b53e79d743a939ed7af0ad22e7c03c67",
        "localId": "feral-hunter"
      }
    ],
    "character.yautja.jungle_hunter": [
      {
        "repository": "darknigthmare/yautja-la-longue-chasse",
        "path": "app/game/hunterLore.ts",
        "blobSha": "6c73f105b53e79d743a939ed7af0ad22e7c03c67",
        "localId": "jungle-hunter"
      }
    ],
    "character.yautja.samurai_predator": [
      {
        "repository": "darknigthmare/yautja-la-longue-chasse",
        "path": "app/game/hunterLore.ts",
        "blobSha": "6c73f105b53e79d743a939ed7af0ad22e7c03c67",
        "localId": "samurai"
      },
      {
        "repository": "darknigthmare/yautja-apex-hunt",
        "path": "src/data/YautjaLoreDatabase.js",
        "blobSha": "2ea6fbef17999783ac3bb14bfca24ff10fdd4beb",
        "localId": "samurai_yautja"
      }
    ],
    "character.yautja.viking_predator": [
      {
        "repository": "darknigthmare/yautja-apex-hunt",
        "path": "src/data/YautjaLoreDatabase.js",
        "blobSha": "2ea6fbef17999783ac3bb14bfca24ff10fdd4beb",
        "localId": "viking_yautja"
      }
    ],
    "character.yautja.wolf_predator": [
      {
        "repository": "darknigthmare/yautja-la-longue-chasse",
        "path": "app/game/hunterLore.ts",
        "blobSha": "6c73f105b53e79d743a939ed7af0ad22e7c03c67",
        "localId": "wolf"
      }
    ],
    "item.yautja.combistick": [
      {
        "repository": "darknigthmare/yautja-la-longue-chasse",
        "path": "app/game/hunterLore.ts",
        "blobSha": "6c73f105b53e79d743a939ed7af0ad22e7c03c67",
        "localId": "combistick"
      }
    ],
    "item.yautja.netgun": [
      {
        "repository": "darknigthmare/yautja-la-longue-chasse",
        "path": "app/game/hunterLore.ts",
        "blobSha": "6c73f105b53e79d743a939ed7af0ad22e7c03c67",
        "localId": "netgun"
      }
    ],
    "item.yautja.plasma_caster": [
      {
        "repository": "darknigthmare/yautja-la-longue-chasse",
        "path": "app/game/hunterLore.ts",
        "blobSha": "6c73f105b53e79d743a939ed7af0ad22e7c03c67",
        "localId": "plasma-caster"
      }
    ],
    "item.yautja.smart_disc": [
      {
        "repository": "darknigthmare/yautja-la-longue-chasse",
        "path": "app/game/hunterLore.ts",
        "blobSha": "6c73f105b53e79d743a939ed7af0ad22e7c03c67",
        "localId": "smart-disc"
      }
    ],
    "item.yautja.wristblades": [
      {
        "repository": "darknigthmare/yautja-la-longue-chasse",
        "path": "app/game/hunterLore.ts",
        "blobSha": "6c73f105b53e79d743a939ed7af0ad22e7c03c67",
        "localId": "wristblades"
      }
    ]
  }
};
const sourceRefs=Object.freeze(Object.fromEntries(Object.entries(RAW.references).map(([id,refs])=>[
 id,Object.freeze(refs.map(ref=>Object.freeze({...ref})))
])));
export const ALIEN_BASE_V2_CROSSREF_PREVIEW=Object.freeze({
 schemaVersion:RAW.schemaVersion,
 sourceRepository:RAW.sourceRepository,
 sourceBranch:RAW.sourceBranch,
 sourcePullRequest:RAW.sourcePullRequest,
 sourceCommit:RAW.sourceCommit,
 sourceEntitiesBlobSha:RAW.sourceEntitiesBlobSha,
 status:RAW.status,
 identityContract:RAW.identityContract,
 notes:RAW.notes,
 references:sourceRefs
});
const EMPTY=Object.freeze([]);
export function getAlienBaseCrossReferencesV2(entityId){
 return typeof entityId==='string' && Object.hasOwn(sourceRefs,entityId) ? sourceRefs[entityId] : EMPTY;
}
