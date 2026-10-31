/* Appearance cues for finite, DISTANT Musou units.
 * These are economical procedural LOD distinctions, not certified screen-accurate
 * Alien / Predator assets. Four species InstancedMeshes remain the render budget.
 */
import { sourceUnitVisualKind } from '../data/SourceActorPresentation.js';

const appearance=(color,width=1,height=1)=>Object.freeze({color,width,height});
const PALETTES=Object.freeze({
  xenomorph:Object.freeze({
    default:appearance(0x323c38),
    runner:appearance(0x48584c,.82,.80),
    warrior:appearance(0x323c38),
    drone:appearance(0x404f47,.87,.9),
    spitter:appearance(0x425c4d,1,1.04),
    praetorian:appearance(0x34433d,1.28,1.3),
    queen:appearance(0x49514c,1.52,1.67),
    facehugger:appearance(0x9c856b,.57,.27)
  }),
  human:Object.freeze({
    default:appearance(0x727f80),
    marine:appearance(0x727f80),
    smartgunner:appearance(0x7b8b7a,1.2,1.06),
    flametrooper:appearance(0x8e806b,1.16,1.08),
    medic:appearance(0x9cab9b,.95,.99),
    commtech:appearance(0x6893a2,.96,1),
    sniper:appearance(0x5a7064,.93,.97),
    sadar:appearance(0x8e7860,1.13,1.07),
    exosuit:appearance(0x7f8995,1.45,1.40),
    officer:appearance(0x9c8971,1.1,1.08)
  }),
  synthetic:Object.freeze({
    default:appearance(0x7e9b98),
    synthetic:appearance(0x7e9b98),
    weyland_combat:appearance(0x9eacb4,1.05,1.03),
    working_joe:appearance(0xa88d68,.98,1.03)
  }),
  yautja:Object.freeze({
    default:appearance(0x627d74),
    clan_hunter:appearance(0x627d74),
    officer:appearance(0x9f977c,1.18,1.20)
  })
});

export const DISTANT_CROWD_APPEARANCES=PALETTES;
// No per-NPC appearance allocation on the 2.5 Hz visualization path.
const RESOLVED=Object.freeze(Object.fromEntries(Object.entries(PALETTES).map(([species,roles])=>
  [species,Object.freeze(Object.fromEntries(Object.entries(roles).map(([role,style])=>
    [role,Object.freeze({species,role,...style})])))])));

export function distantCrowdAppearance(unit) {
  const species=unit?.species==='xeno'?'xenomorph':unit?.species;
  const group=Object.hasOwn(PALETTES,species??'')?PALETTES[species]:null;
  if(!group)return null;
  const special=sourceUnitVisualKind(unit),type=typeof special==='string'
    ? special : typeof unit.actorType==='string'?unit.actorType:'default';
  const role=(unit.officer===true||!!unit.uniqueId)&&Object.hasOwn(group,'officer')
    ? 'officer' : Object.hasOwn(group,type)?type:'default';
  return RESOLVED[species][role];
}
