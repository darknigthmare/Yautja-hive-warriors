/* Reproducible Excel-compatible gap register from the retained source audit.
 * Pure reporting, NEVER an assertion that procedural meshes are 1:1.
 * The game combat roster and signed operation digests stay untouched. */
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { BATTLE_CATALOG_DATA } from '../js/data/BattleCatalogData.js';

const output=new URL('../docs/audits/2026-11-01/Extinction_29_Profils_Manquants_1to1.csv',import.meta.url);
const profiles=BATTLE_CATALOG_DATA.profiles.filter(p=>/Extinction/i.test(p.work??''))
  .sort((a,b)=>a.id.localeCompare(b.id));
const sourceIndex=new Map(BATTLE_CATALOG_DATA.sources.map(p=>[p.id,p]));
export const EXTINCTION_SOURCE_COLS=["Identifiant","Faction source","Unité source","Jeu / médias","Continuité","Preuve dans le catalogue","URL(s) de référence","Statut audit source (historique)","État du runtime actuel (contrôle de code)","Travaux manquants 1:1","Restrictions de média","Séries contrôlées","Fidélité visuelle 1:1 certifiée"];
export const ORIGINAL_EXTINCTION_CATALOG_COUNT=29;
function runtime(p){
  if(p.id==='XEN-009')
    return 'Morphologie Carrier partielle ; transport stratégique sauvegardé de six Facehuggers préalloués ; lancer animé 3D et upgrade 12 NON implémentés';
  if(p.id==='XEN-010')
    return 'Morphologie en lames et attaque Ravager dédiées sur LV-742 ; catalepsie améliorée NON implémentée';
  if(p.id==='XEN-004')
    return 'Drone sous représentation Warrior proxy ; constructeur de nodules distinct à compléter';
  if(/^YAU-0(29|3[0-7])$/.test(p.id))
    return 'Rôle stratégique sourcé ; apparence commune clan_hunter, animation/équipement individuel non certifiés';
  if(p.id==='HUM-037')
    return 'Soin fini BattleSimulation.applyMedicHeal ; modèle, portée et paramètres source non certifiés 1:1';
  if(p.id==='HUM-038')
    return 'Réparation finie BattleSimulation.applyCommTechRepair ; modèle, appareillage et comportements source incomplets';
  if(p.id==='HUM-036')
    return 'Profil sniper de combat avec munitions finies ; visuels et animations source non certifiés';
  if(p.id==='HUM-040')
    return 'Profil exosuit à pilote/armure finis ; modèle mécanique source non certifié';
  if(p.id==='HUM-041')
    return 'Missile SADAR fini et projectile physique ; version AMAG et rendu source non certifiés';
  if(p.id==='HUM-039')
    return 'Synthétique source dans troupe ; visuel indépendant et capacités de rôle à vérifier';
  return p.codeStatus??'Non testé automatiquement sur cette caste';
}
function rows(){
  if(profiles.length!==ORIGINAL_EXTINCTION_CATALOG_COUNT||new Set(profiles.map(p=>p.id)).size!==profiles.length)
    throw new Error('Changes in 29 source profiles require an explicit audited review');
  return profiles.map(p=>[p.id,p.faction,p.name,p.work,p.continuity??'',p.evidenceFact??'',
    (p.sourceIds??[]).map(id=>sourceIndex.get(id)?.url??'').filter(Boolean).join(' | '),
    p.codeStatus??'',runtime(p),p.missingWork??'',p.restrictions??'',p.compatiblePlaces??'','non']);
}
export function extinctionCSV() {
  const q=value=>'"'+String(value??'').replaceAll('"','""')+'"';
  return '\uFEFF'+[EXTINCTION_SOURCE_COLS,...rows()].map(items=>items.map(q).join(';')).join('\r\n')+'\r\n';
}
const isMain=process.argv[1]&&import.meta.url.endsWith(process.argv[1].replaceAll('\\','/'));
if(isMain){
  const result=extinctionCSV();
  if(process.argv.includes('--check')){
    if(readFileSync(output,'utf8')!==result)
      throw new Error('Extinction gap CSV is stale; regenerate after sourcing new proof');
    console.log('29 sourced Extinction profiles synchronized; visual certifications still unverified');
  }else{
    mkdirSync(dirname(output.pathname),{recursive:true});
    writeFileSync(output,result,'utf8');
  }
}
