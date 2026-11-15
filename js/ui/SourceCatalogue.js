import { BATTLE_PROFILES } from '../data/BattleCatalog.js';

/** Source documentation is browsable without presenting its records as assets. */
export function mountSourceCatalogue(parent) {
  const details=document.createElement('details');details.className='source-catalogue glass-panel';
  const summary=document.createElement('summary');summary.textContent=`CONSULTER LES ${BATTLE_PROFILES.length} FICHES SOURCÉES`;
  const label=document.createElement('label');label.textContent='Rechercher une incarnation, une espèce ou une œuvre';
  const search=document.createElement('input');search.type='search';search.placeholder='Ex. City Hunter, reine, Alien…';label.append(search);
  const select=document.createElement('select');select.setAttribute('aria-label','Fiche du catalogue');
  const article=document.createElement('article');article.setAttribute('aria-live','polite');
  const show=()=>{const profile=BATTLE_PROFILES.find(row=>row.id===select.value);article.replaceChildren();if(!profile){article.textContent='Aucune fiche ne correspond à cette recherche.';return;}
    for(const text of [`${profile.id} — ${profile.name}`,`${profile.work} · ${profile.medium} · ${profile.continuity}`,`Statut d’apparition : ${profile.eligibility.sourceLabel}`,`Rôle proposé : ${profile.design.role}`,`Preuve : ${profile.evidence.fact}`,`Travail restant : ${profile.design.remainingWork}`,'Cette fiche documente une source. La présence d’un modèle spécifique et sa fidélité visuelle 1:1 restent à vérifier.']){const p=document.createElement('p');p.textContent=text;article.append(p);}
    for(const url of profile.evidence.urls){if(!/^https?:\/\//.test(url))continue;const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Consulter la source · '+new URL(url).hostname;article.append(link,document.createElement('br'));}
  };
  const filter=()=>{const query=search.value.toLocaleLowerCase('fr');const rows=BATTLE_PROFILES.filter(row=>`${row.name} ${row.id} ${row.work} ${row.sourceFamily}`.toLocaleLowerCase('fr').includes(query));select.replaceChildren(...rows.map(row=>{const option=document.createElement('option');option.value=row.id;option.textContent=`${row.id} · ${row.name}`;return option;}));show();};
  search.addEventListener('input',filter);select.addEventListener('change',show);details.append(summary,label,select,article);parent.append(details);filter();return details;
}
