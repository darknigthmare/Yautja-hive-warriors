import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const input=new URL('../docs/audits/2026-10-30/musou-crossmedia-gaps.json',import.meta.url);
const output=new URL('../docs/audits/2026-11-01/Musou_Fidelite_1to1_Manquants.csv',import.meta.url);
const source=JSON.parse(readFileSync(input,'utf8'));
const cols=["Opération","Mission","Statut de l'histoire","Lieu","Ennemis alloués","Alliés alloués","Plan de fronts déclaré","Carte 1:1 validée","Castes et époque vérifiées","Modèles 1:1 validés","Animations 1:1 validées","Boss visuel 1:1 validé","Partie complète QA","Coop QA","Travaux restants","Lien de preuve fourni"];
const yes=x=>x===true?"validé":"non validé";
function row(o){
  const original=Number(o.id.slice(-2))<=12,c=o.checks??{},bud=o.finiteAllocatedNpc??{};
  const count=k=>Object.values(bud).reduce((n,z)=>n+(z?.[k]??0),0);
  const urls=[o.mediaContext,o.map?.sourceContinuity].flatMap(t=>(t??"").match(/https?:\/\/[^\s)\]]+/g)??[]).map(t=>t.replace(/[.,;]+$/,""));
  return [o.id,o.title,original?"scénario original (pas de mission canonique 1:1)":"lieu/espèces média + mission Musou adaptée",o.map?.place??"",count("enemy"),count("ally"),
    yes(c.explicitFrontGroupCompositionConfirmed),
    original?"non applicable pour une carte canonique ; cohérence interne non certifiée":yes(c.physicalMap1to1Confirmed),
    yes(c.sourceEraSpeciesCrosschecked),
    // The audit has no generic actor-model certification field; an animation
    // flag never certifies a model. Keep the asset column explicitly unverified.
    'non validé',yes(c.combatAnimation1to1Confirmed),
    yes(c.bossVisual1to1Confirmed),yes(c.fullMissionPlaythroughConfirmed),yes(c.multiplayerFullQaConfirmed),
    original?"QA terrain, boss original, animations et cohérence des fronts":"Vérifier les lieux, castes/époques, équipements, modèles multi-angles, gameplay et coopération",
    urls[0]??"source à compléter"];
}
const q=v=>'"'+String(v??"").replaceAll('"','""')+'"';
if(source.operationCount!==source.operations.length||source.operations.length!==27)
  throw new Error('The source 27-operation contract was changed without revalidation');
const csv='\uFEFF'+[cols,...source.operations.map(row)].map(items=>items.map(q).join(';')).join('\r\n')+'\r\n';
if(process.argv.includes('--check')){
  if(readFileSync(output,'utf8')!==csv)throw new Error('Generated fidelity gap CSV is stale');
  console.log('27 operation fidelity CSV rows synchronized with source audit');
}else{
  mkdirSync(dirname(output.pathname),{recursive:true});
  writeFileSync(output,csv,'utf8');
}
