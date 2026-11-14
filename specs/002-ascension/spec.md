# Feature Specification: mode Ascension, la campagne de l'Unblooded

**Feature Branch**: `claude/fervent-volta-hmhdfw` (aucune branche dédiée)
**Created**: 2026-11-14
**Status**: Étapes 1 et 2 livrées le 14 nov. 2026 ; étapes 3 à 5 à faire
**Input**: décisions HW-DEC-86 et 105 à 109. Contenu narratif : `design/gdd/campagne-unblooded.md`. Prototype v58 archivé : `design/archive-master-v58/FaunaHunt.js`. Ce prototype n'est pas porté tel quel, car il retirait les bêtes en mettant leurs PV à zéro.

## Principe

Un mode à part, « Ascension ». Un Unblooded, avec sa meute (Harek, Yena, Tov) et Saar comme Adjutant, est déposé monde après monde par l'Elite Kaedh, depuis *La Lame Patiente*. Il y a huit chasses de faune, puis le rite dans la pyramide. Les modes v70 et leurs contrats ne changent pas.

## User Scenarios & Testing

### User Story 1 — Une chasse de faune jouable (P1)

Sur Vara-Kesh, les six secteurs v70 portent chacun une harde et son meneur ; le dernier porte la grande proie, le Faucheur. On ouvre les portes en abattant le meneur. La grande proie chancelle, puis on l'exécute.

**Independent Test** : lancer l'Ascension sur Vara-Kesh, atteindre le secteur final par le jeu réel, exécuter la grande proie, et voir la victoire de la chasse et l'outil gagné.

### User Story 2 — La Lame Patiente (P2)

Entre deux chasses, une petite scène 3D comporte la soute de largage, le râtelier (outils gagnés), le mur des crânes (grandes proies), la carte des mondes et la passerelle, interdite. Saar et Kaedh y sont présents.

### User Story 3 — Les huit mondes et le rite (P3)

Les huit mondes suivent l'ordre de la bible, chacun sur une variante procédurale de terrain avec ses comportements propres. Viennent ensuite le rite en triade dans la pyramide, sans arme à énergie, puis le rang Blooded.

## Requirements

- **FR-001** : la faune est un type d'ennemi de la horde, marqué `fauna`. Toutes les armes la touchent par `checkMeleeHits` et les chemins existants. Toute mort passe par `defeatAlien` et les événements de combat. La faune n'a ni acide, ni parasite, ni œuf.
- **FR-002** : une harde est finie. Seuls les meneurs qui « pondent » (matrone d'Eshra, sentinelles de Dharos) peuvent faire naître des bêtes, dans un plafond fixe et seulement tant qu'ils vivent. Aucune bête ne quitte la chasse en disparaissant : une bête qui fuit reste dans le monde.
- **FR-003** : au plus 32 acteurs détaillés à la fois, comme ailleurs.
- **FR-004** : la progression (mondes finis, outils gagnés, rang) est gardée dans le navigateur par le système de sauvegarde v70, avec une version de schéma. L'envoi au compte Supabase vient plus tard (HW-DEC-109).
- **FR-005** : le canon d'épaule reste verrouillé jusqu'au rang Blooded, et le camouflage jusqu'à Rukh Tal. Le kit de départ et les outils gagnés suivent la bible.
- **FR-006** : chaque bête, meneur et grande proie créé hors de la Bible V6 est marqué « création » (fidélité : adaptation).

## Success Criteria

- **SC-001** : une chasse complète de Vara-Kesh se joue dans le navigateur sans erreur, du largage à la victoire.
- **SC-002** : un test vérifie le contrat de la faune : mort enregistrée une seule fois, aucune disparition silencieuse, harde finie.
- **SC-003** : les tests existants passent.

## Étapes

1. Faune dans la horde, données des huit mondes, chasse de Vara-Kesh sur les secteurs v70, entrée « Ascension » du menu.
2. Variantes de terrain des huit mondes et comportements propres.
3. Scène 3D de *La Lame Patiente*, progression et outils gagnés.
4. Le rite et le rang Blooded.
5. L'envoi de la progression au compte Supabase.
