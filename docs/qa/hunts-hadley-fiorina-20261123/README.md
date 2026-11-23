# Chasses de Hadley’s Hope et de Fiorina 161 (23 novembre 2026)

Phase 8 de la feuille de route, lot 2. Ces deux chasses suivent LV-223, dans l’ordre choisi par l’auteur. Elles réutilisent les boss existants et n’utilisent aucun crédit Meshy.

| | Hadley’s Hope (LV-426) | Fiorina 161 |
| --- | --- | --- |
| Source | *Aliens* (1986), 2179 | *Alien 3* (1992), 2179 |
| Identifiant | `hadleys_hope_colony` | `fiorina_161_foundry` |
| Boss | Reine xénomorphe (`xenomorph_queen`), déjà au registre | Runner de Fiorina (`fiorina_runner`) : modèle existant de runner, mis à la taille du boss |
| Échelle des secteurs | 1,0 | 0,85 (couloirs de fonderie) |
| Climat | tempête | aucun |
| Mécanismes | passerelles, portes blindées, conduites de vapeur du processeur, transformateurs, caches USCM, résine et œufs de la ruche | passerelles, portes blindées, vapeur de la fonderie, conduites de carburant des tunnels |
| Marines coloniaux et synthétiques | oui (2 + 2 par secteur actif, APC au secteur 3) | aucun : le film n’en montre pas |
| Caches d’armes humaines | oui | aucune |

## Ce qui est une adaptation

- **Les chasses Yautja.** Aucun des deux films ne montre de Yautja.
- **La ruche de Fiorina.** Le film ne montre qu’un seul Xénomorphe.
- **Le rythme du Runner** (`hit-and-run`) :
  - après chaque morsure, il rompt le contact pendant 2,2 s, puis se retourne ;
  - le retournement ouvre une fenêtre annoncée de 1,4 s ;
  - une attaque lourde dans cette fenêtre l’étourdit 1,6 s.

  - acculé contre un mur, il ne recule pas : il se retourne aussitôt, ce qui ouvre la fenêtre plus tôt.

  Ces valeurs sont des choix de jeu, pas des mesures du film.
- **Le modèle du Runner.** Le boss réutilise le runner générique du jeu. Ce n’est pas une reconstitution de la créature du film.

## Appui USCM selon le mode de fidélité

En mode « adapté », la barre d’appui APC/Cheyenne est disponible sur tous les lieux connus : c’est la règle existante de `MissionRuntimeContext`. En mode « fidèle », Hadley’s Hope garde cet appui, Fiorina 161 non.

## Vérification

- **Tests ajoutés :**
  - `hadley-fiorina-hunts` : source, boss, mécanismes, plan de secteurs, marines présents ou absents, caches ;
  - cas `fiorina_runner` de la matrice des contre-jeux : la morsure, le repli, l’absence d’attaque pendant le repli, puis l’étourdissement par une attaque lourde et seulement par elle.
- **Suite Node complète :** 1 666 réussis, 0 échec, 1 ignoré.
- **Catalogue :** `sync-battle-catalog --check` réussi.
- **Dans Chromium :** chaque chasse lancée depuis le menu, aucune erreur de page.
- **Runner dans Chromium** (sonde scriptée dans le secteur final, 20 s, ruche retirée) :
  - une morsure toutes les 3,3 s environ ;
  - il se retourne après chaque morsure ;
  - ce point de départ étant près d’un mur, il était acculé et s’est retourné sans reculer ;
  - aucune erreur.

  Une première sonde avait révélé deux défauts, corrigés avant ce commit :
  - le repli se dirigeait vers le joueur ;
  - contre un mur, le boss oscillait sur place.

  Les réglages de 2,2 s et 1,4 s restent à valider en partie réelle.
- **Captures :** vues fixes de l’insertion, prises par script. Ce ne sont pas des parties jouées.
