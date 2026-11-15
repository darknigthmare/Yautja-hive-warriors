# Feature Specification: présentation cinématique (démarrage, menus, chargements, intel, outros, ambiances)

**Feature Branch**: `claude/fervent-volta-hmhdfw` (aucune branche dédiée)
**Created**: 2026-11-15
**Status**: Étapes 1 à 3 (démarrage, menu, musique, chargement, intel, outros, crédits) livrées le 15 nov. 2026 ; étape 4 (animations et décors en jeu) à venir
**Input**: demande de l’auteur du 15/11/2026, « rendre le jeu plus fluide et cinématique : les intel, les outros, l’avant-menu, l’écran d’accueil, le menu principal, les écrans de chargement, des animations, des décors ».

## Décisions de l’auteur (15/11/2026)

- **Avant-menu** : compte à rebours en glyphes yautja, mention « projet de fan non officiel », crédit « A fan game project by Darknigthmare », puis l’écran titre. Moins de 6 s, passable par n’importe quelle touche.
- **Fond du menu** : les quatre styles en alternance, pour qu’une arrivée sur le menu apporte de la nouveauté :
  1. diorama 3D d’un chasseur ;
  2. diorama 3D d’un monde, qui change d’une visite à l’autre ;
  3. fond 2D stylisé ;
  4. images fournies par l’auteur.
- **Musique** : trois couches.
  - Une partition procédurale WebAudio, livrée maintenant.
  - Des fichiers que l’auteur créera avec Google Flow Music. Le jeu fournit les emplacements, un document de commande (moments, tempo, boucles, prompts) et une organisation en couches calme, tension et combat.
  - Des sons d’ambiance par biome.
- **Intel (briefings)** : survol 3D de la vraie carte, avec un panneau de communication (interlocuteur, texte machine à écrire, grésillement).
- **Cinématiques** : toujours passables (maintenir une touche ou un bouton). Une option les désactive ou les raccourcit. La préférence système « réduire les animations » est respectée.
- **Ordre de livraison** : démarrage et menu principal ; écrans de chargement ; intel et outros ; animations et décors en jeu.

## Contrats à préserver

- Les modes, contrats et sauvegardes existants ne changent pas.
- Une cinématique n’altère aucun état de simulation : effectifs, PV, minuteries de mission.
- Aucun nom, logo ou visuel d’ayant droit n’est présenté comme officiel. La mention de fan est permanente sur l’avant-menu.
- Le rendu du menu ne coûte rien pendant la partie : sa scène est détruite ou suspendue dès le lancement d’une mission.
- Les tests navigateur existants démarrent sans attendre l’avant-menu. Il est passé automatiquement sous automatisation, sauf avec `?intro=1`, et un test dédié le vérifie.

## User Stories

### US1 — Démarrage et menu principal (P1)

L’ouverture de la page montre l’avant-menu, puis l’écran titre « APPUYEZ SUR UNE TOUCHE ». Cette touche débloque aussi l’audio. Le menu principal arrive ensuite sur l’un des quatre fonds, avec un thème musical. Les panneaux s’enchaînent par des transitions.

**Test indépendant** : avec `?intro=1`, voir l’avant-menu, le passer avec une touche et arriver au menu. Recharger fait changer le style de fond. Une mission lancée arrête la scène du menu.

### US2 — Écrans de chargement (P2) · livrée

**Livré** :
- Le monde se construit derrière un voile flouté, ce qui préchauffe aussi les ombres.
- La barre suit les modèles réellement demandés depuis l'ouverture de l'écran.
- La fiche du monde (repère, lore original, mention d'adaptation) est accompagnée d'un conseil tiré des vraies commandes.
- Le temps de mission est gelé jusqu'à ce que tout soit prêt, avec un plafond de 14 s.
- Sous automatisation, rien n'est gelé, sauf avec `?intro=1`.

Entre la préparation et la mission, un écran montre :
- la progression réelle du chargement des modèles ;
- le monde choisi ;
- une fiche de lore et un conseil.

### US3 — Intel et outros (P3) · livrée

**Décisions de l'auteur du 15/11/2026** :
- L'interlocuteur dépend du mode.
  - Chasse libre et campagne : l'Ancien du clan.
  - Ascension : Kaedh, avec Saar pour la logistique.
  - Fronts : la radio de la faction humaine réellement présente, interceptée et décodée par le bio-masque ; l'Ancien conclut.
- Chaque réplique s'accompagne de cliquetis et de grésillements.
- Victoire : orbite de caméra. Défaite : caméra qui s'élève au-dessus du chasseur tombé.

**Livré** :
- **Intel** :
  - Survol en bandes noires des secteurs réels, après le chargement.
  - Répliques construites depuis les données de la mission : lieu, secteurs, premier objectif, boss préparé, factions.
  - Aucune radio humaine n'est inventée sans faction humaine.
  - Temps de mission gelé pendant l'intel.
- **Outros** : déroulés avant le bilan, une fois les résultats enregistrés.
- **Fin de campagne** : défilement des crédits (projet de fan, outils, polices, modèles générés, musique procédurale, mention de non-affiliation).
- **Passer** : maintenir Espace, Entrée ou un bouton de manette 0,5 s, ou cliquer « Passer ». Le réglage « Courtes » garde les répliques sans survol et raccourcit l'outro.

- **Avant la mission** : survol 3D des secteurs, portes et objectifs, avec le panneau de communication de l’interlocuteur.
- **Après la mission** : une séquence de victoire ou de défaite avant le bilan.
- **Fin de campagne** : épilogue et crédits.

### US4 — Animations et décors en jeu (P4) · en cours

**Livré** : caméra de mise à mort du boss.
- Orbite en temps réel autour du chasseur et de sa proie, avec bandes noires et HUD atténué.
- Bornée contre les parois par la collision caméra existante.
- Seule la caméra bouge ; l'exécution est déjà résolue.
- Désactivée en coopération, sous automatisation et avec « Cinématiques : désactivées ».

**Reste** : vie ambiante des cartes (faune, météo, lumières, débris).

- Vie ambiante des cartes : faune, météo, lumières, débris.
- Caméra cinématique de mise à mort du boss, avec bandes noires.

## Requirements

- **FR-001** : l’avant-menu et l’écran titre sont passables ; l’option « Cinématiques » vaut `complètes`, `courtes` ou `désactivées`.
- **FR-002** : le style de fond du menu tourne d’une arrivée à l’autre. L’index est gardé dans le navigateur, ce qui reste facultatif.
  - Le style « images » n’entre dans la rotation que si `public/menu/manifest.json` liste au moins une image présente.
- **FR-003** : un directeur musical joue des repères nommés : `title`, `menu`, `briefing`, `explore`, `combat`, `boss`, `victory`, `defeat`, `hub`, `loading`.
  - Il passe de l’un à l’autre en fondu.
  - Un fichier présent dans `public/audio/music/` remplace la version procédurale du même repère.
  - Les couches `calm`, `tension` et `combat` d’un repère sont mixées selon l’intensité du danger.
- **FR-004** : l’ambiance sonore par biome est procédurale. Un fichier de `public/audio/ambient/` la remplace s’il est présent.
- **FR-005** : la scène 3D du menu n’utilise que des modèles déjà livrés et des formes procédurales.
- **FR-006** : chaque ajout de contenu inspiré d’une source est rattaché à elle. Les créations originales sont marquées comme telles.

## Success Criteria

- **SC-001** : de la page au menu, sans erreur de console, en moins de 6 s si l’on ne touche à rien. L’avant-menu se passe en une touche.
- **SC-002** : les tests existants passent, navigateur compris.
- **SC-003** : pendant une mission, le menu ne rend aucune image : son rendu est suspendu.
- **SC-004** : le document de commande musicale couvre chaque repère, avec sa durée, son tempo, ses points de boucle et un prompt.
