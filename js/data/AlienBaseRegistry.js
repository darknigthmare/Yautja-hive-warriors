/* Offline, public, allowlisted snapshot from darknigthmare/alien_base.
 * It never admits units/weapons, edits HP or saves, or fetches private GitHub at runtime. */
import { ALIEN_BASE_PUBLIC_SNAPSHOT_V1 as snapshot } from './alien-base-public-v1.js';
const freezeDeep=value=>{if(value&&typeof value==='object'){for(const v of Object.values(value))freezeDeep(v);if(!Object.isFrozen(value))Object.freeze(value)}return value};
freezeDeep(snapshot);
const collections=snapshot.records;
const lookups=Object.freeze(Object.fromEntries(Object.entries(collections).map(([key,rows])=>[key,new Map(rows.map(row=>[row.id,row]))])));
export const ALIEN_BASE_PUBLIC_VERSION=Object.freeze({format:snapshot.format,version:snapshot.version,sourceCommits:snapshot.sourceCommits});
export const ALIEN_BASE_REFERENCE_COUNTS=Object.freeze(Object.fromEntries(Object.entries(collections).map(([key,rows])=>[key,rows.length])));
export function getAlienBaseRecord(category,id){return typeof id==='string'&&Object.hasOwn(lookups,category)?lookups[category].get(id)??null:null}
export function getAlienBaseProfile(id){if(typeof id!=='string')return null;return getAlienBaseRecord('profiles',id.startsWith('yhw:')?id:'yhw:'+id)}
export function getAlienBaseWeapon(id){if(typeof id!=='string')return null;return getAlienBaseRecord('weapons',id.startsWith('tantalus:')?id:'tantalus:'+id)}
export function validateAlienBaseSnapshot(){const errors=[];if(snapshot.format!=='alien-base-public-v1')errors.push('unsupported schema');for(const[cat,rows]of Object.entries(collections)){if(new Set(rows.map(row=>row.id)).size!==rows.length)errors.push(cat+': duplicate ID');if(rows.some(row=>!row.name||!row.id))errors.push(cat+': incomplete record')}for(const row of collections.weapons)if(row.legacyId.startsWith('proposed-')&&row.admission!=='research-only')errors.push(row.id+': research admission');for(const row of collections.profiles)if(row.visual1to1!==false)errors.push(row.id+': invalid 1:1');return{valid:errors.length===0,errors,counts:ALIEN_BASE_REFERENCE_COUNTS}}
