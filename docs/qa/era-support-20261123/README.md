# Appui humain selon l’époque (23 novembre 2026)

**Décision de l’auteur.** L’appui de l’USCM (APC M577, Cheyenne UD-4L) existe seulement là où la source montre des Marines coloniaux. Ailleurs, l’appui est remplacé par un équivalent de l’époque, ou supprimé si l’époque n’en offre pas. La règle s’applique dans les deux modes de fidélité. Le mode « fidèle » reste plus strict : il garde la liste existante de `MissionRuntimeContext`.

| Lieu | Sol | Air | Raison |
| --- | --- | --- | --- |
| Xenomorph Prime, Romulus, Charon, Hadley’s Hope | APC M577 | Cheyenne UD-4L | Marines coloniaux présents |
| Val Verde (1987) | — | UH-1 Huey | insertion en Huey dans *Predator* ; le passage armé est une adaptation |
| Gunnison (2007), Stargazer (2018) | — | UH-60 Black Hawk | Garde nationale et armée américaine ; le passage armé est une adaptation |
| Los Angeles (1997) | — | — | LAPD et équipe fédérale, aucun appareil armé |
| Prey (1719) | — | — | aucun équivalent d’époque |
| Planète-réserve, arène des Tueurs de tueurs | — | — | aucun commandement humain |
| Pyramide antarctique (2004), LV-223 (2093) | — | — | expéditions civiles |
| Fiorina 161 (2179) | — | — | colonie pénitentiaire, pas de Marines |

## Ce qui ne change pas

- **La frappe orbitale et le bombardement du vaisseau Yautja.** Ce ne sont pas des appuis humains : ils restent régis par l’indicateur de mission existant.
- **Les opérations du catalogue** (mode fronts). Elles possèdent leurs effectifs et gardent leur règle précédente.
- **Le format des sauvegardes.** L’emplacement aérien garde la clé `cheyenne` ; seul l’appareil change selon le lieu.

## Budgets

Ce sont des choix de jeu, pas des caractéristiques d’appareils réels.

| Appareil | PV | Sorties | Roquettes | Incendiaires |
| --- | ---: | ---: | ---: | ---: |
| Cheyenne | 1 800 | 2 | 12 (6 par sortie) | 6 (4 par sortie) |
| Black Hawk | 1 300 | 2 | 10 (5 par sortie) | 0 |
| Huey | 1 100 | 2 | 8 (4 par sortie) | 0 |

Le Huey et le Black Hawk sont des modèles procéduraux génériques (`createHelicopterModel`), pas des répliques mesurées.

## Vérification

- **`tests/era-support.test.js`** :
  - chaque lieu a une entrée ;
  - l’USCM est limité aux quatre lieux du tableau ;
  - les permissions sont données par type d’appui ;
  - l’orbital reste permis ;
  - les opérations gardent leur règle ;
  - le budget de chaque appareil est fini, sans troisième sortie.
- **`runtime-final-wiring`.** Le test des points de reprise de l’APC utilise désormais Xenomorph Prime : Gunnison n’a plus d’APC.
- **Dans Chromium**, appui déclenché depuis l’insertion :
  - Val Verde : Huey accepté, HUD « APC INDISPONIBLE | HUEY 1100 PV · 1/2 SORTIES · 4/8 ROQUETTES » ;
  - Gunnison : Black Hawk accepté, 5/10 roquettes ;
  - Fiorina : demande refusée, HUD « APC INDISPONIBLE | APPUI AÉRIEN INDISPONIBLE » ;
  - aucune erreur de page.

  Ces captures sont des vues fixes prises par script.
