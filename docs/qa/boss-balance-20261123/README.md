# Équilibrage des boss : duel scripté (23 novembre 2026)

Demande de l’auteur : comparer les boss. Cette mesure est un duel figé, pas un combat joué.

## Protocole

Script conservé dans ce dossier : `duel-probe.mjs`, à lancer depuis la racine du dépôt. Résultats bruts : `duel-results.json`.

- **Moteur** : `BossManager` de production, sans modèle 3D ni environnement.
- **Le chasseur** reste à 8 unités et ne pare ni n’esquive.
- **Ses coups** : un toutes les 0,5 s, 100 points de face, un coup lourd sur quatre. Les armures, boucliers, interruptions et immunités du boss s’appliquent.
- **Durée** : 180 s au plus, 60 images par seconde.

## Colonnes

- **TTK** : temps pour abattre le boss sous cette pression fixe.
- **DPS** : dégâts que le boss inflige au chasseur immobile.
- **Exposé** : part du temps où le boss ouvre une fenêtre (`exposedUntil`).
- **Caché** : part du temps où il est intouchable (conduits, sable, plongée).

| Boss | Chasses (boss final) | PV | TTK (s) | DPS reçu | Exposé % | Caché % |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `xenomorph_queen` | antarctic_pyramid hadleys_hope_colony usm_auriga_labs | 3 000 | 14,5 | 16,9 | 17 | 0 |
| `praetorian` | — | 3 000 | 25,5 | 9,6 | 23 | 0 |
| `predalien` | — | 3 000 | 14,5 | 21,7 | 28 | 0 |
| `the_offspring` | romulus_station | 4 500 | 22 | 16,8 | 19 | 0 |
| `predalien_queen` | gunnison_forest | 5 000 | 24,5 | 15,3 | 38 | 0 |
| `empress_matriarch` | xenomorph_prime | 6 000 | 29,5 | 32,5 | 29 | 0 |
| `predalien_abomination` | — | 6 500 | 32 | 28,3 | 32 | 0 |
| `nostromo_drone` | nostromo_refinery | 6 800 | 58,5 | 15,4 | 32 | 41 |
| `trilobite_prime` | — | 7 000 | 34,5 | 16,7 | 23 | 0 |
| `jungle_hunter_boss` | val_verde_jungle | 7 500 | 37 | 19,3 | 18 | 0 |
| `city_hunter_boss` | la_rooftops | 7 600 | 37,5 | 19,1 | 17 | 0 |
| `fiorina_runner` | fiorina_161_foundry | 7 800 | 38,5 | 10,9 | 58 | 0 |
| `imperial_queen` | — | 8 000 | 39,5 | 33,2 | 29 | 0 |
| `awakened_engineer` | lv223_engineer_structures | 8 500 | 49,5 | 19,2 | 25 | 0 |
| `feral_predator_boss` | prey_comanche_territory | 8 600 | 49,5 | 19,7 | 18 | 0 |
| `berserker_super_predator` | game_preserve_planet | 8 800 | 43,5 | 19,4 | 18 | 0 |
| `apex_gladiator_predator` | killer_of_killers_arena | 9 000 | 44,5 | 19 | 18 | 0 |
| `ultimate_upgrade_predator` | stargazer_facility | 9 200 | 45,5 | 26 | 23 | 0 |
| `rogue_king_prime` | charon_rogue_base | 9 500 | 47 | 19,5 | 24 | 0 |
| `predalien_matriarch_titan` | — | 10 000 | 49,5 | 41,8 | 33 | 0 |
| `vara_kesh_reaper` | Ascension | 2 500 | 12 | 8,7 | 15 | 0 |
| `eshra_hydra` | Ascension | 3 000 | 14,5 | 5,6 | 13 | 0 |
| `kharuun_sand_maw` | Ascension | 3 400 | 16,5 | 8,5 | 14 | 0 |
| `terek_va_hive_mind` | Ascension | 3 800 | 20 | 13,2 | 15 | 0 |
| `nereth_jaw` | Ascension | 4 200 | 20,5 | 8,5 | 15 | 0 |
| `oshara_swimmer` | Ascension | 4 800 | 23,5 | 8,9 | 16 | 0 |
| `rukh_tal_spur` | Ascension | 5 400 | 26,5 | 9,2 | 16 | 0 |
| `dharos_watcher` | Ascension | 6 000 | 29,5 | 9,5 | 17 | 0 |

## Constats

1. **La Reine xénomorphe est le boss final le plus faible**, et de loin. Elle a 3 000 PV et tombe en 14,5 s dans ce duel. Les autres boss finaux de niveau APEX ou plus tombent en 37 à 50 s. Elle est pourtant le boss final de trois chasses : la pyramide antarctique (LÉGENDAIRE), Hadley’s Hope et l’Auriga (APEX).
2. **Les boss EXPERT** (Predalien de Gunnison, Offspring) tombent en 22 à 25 s. C’est cohérent avec leur niveau.
3. **Le Runner de Fiorina** inflige peu (10,9 DPS), car il rompt le contact après chaque morsure. Il tombe en 38,5 s, comme les autres boss APEX.
4. **Le Xénomorphe du Nostromo.** La première version ne mordait jamais à la chute contre un chasseur immobile : le point de chute était à 7 unités derrière lui. Corrigé dans ce commit :
   - chute à 2 unités derrière le chasseur ;
   - 2,4 s cachées au lieu de 3,2 ;
   - morsure de chute de 55 au lieu de 45.

   Il inflige maintenant 15,4 DPS. Son TTK de 58,5 s vient de son temps caché (41 %) : en temps où il est touchable, cela fait environ 34 s.
5. **Les grandes proies d’Ascension** montent de façon régulière, de 12 à 30 s. C’est conforme à la progression des huit mondes.

## Ce que cette mesure ne dit pas

- Elle ne remplace pas une partie réelle : le chasseur ne bouge pas, et la foule, les alliés et les décors sont absents.
- Les DPS reçus sont ceux d’un chasseur qui n’esquive jamais.
- Les DPS reçus sont mesurés avant le changement de PV de la Reine.

## Décision appliquée

L’auteur a choisi 7 500 PV pour la Reine xénomorphe, dans toutes les chasses. Cela donne un TTK d’environ 37 s dans ce duel, aligné sur les boss APEX.

Les opérations du catalogue gardent leurs PV alloués (BOS-39 : 3 000). Ce sont des unités de la simulation, pas le boss du registre.
