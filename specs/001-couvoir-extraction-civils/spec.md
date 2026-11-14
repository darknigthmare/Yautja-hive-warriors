# Feature Specification: couvoir, extraction et civils (HW-DEC-90)

**Feature Branch**: `claude/fervent-volta-hmhdfw` (aucune branche dédiée)
**Created**: 2026-11-14
**Status**: Prête pour le plan (choix de l'auteur reçus)
**Input**: recette REC-004 et décision HW-DEC-90, « Les intégrer » : les gabarits GRP-05 (couvoir), GRP-16 (extraction d'un vétéran) et GRP-28 (civils) existent dans l'audit du 26 octobre, mais aucune opération ne les alloue ; aucune opération jouable ne choisit le budget EFF-06.

## Sources

- `docs/audits/2026-10-26/audit-data.json` :
  - feuille `Groupes` : GRP-05 « À structurer », GRP-16 « À créer », GRP-28 « À créer » ;
  - feuille `Affrontements`, champ `thirdParties` : les civils GRP-28 sont chiffrés pour AFF-06 (2 groupes de 8), AFF-07 (3), AFF-08 (4), AFF-09 (2) et AFF-10 (5) ;
  - feuille `Validation`, procédure REC-004 : « Sur EFF-03 puis EFF-06 […] inclure couvoir GRP-05, extraction GRP-16 et civils GRP-28 ».
- L'audit est une source conservée : `scripts/sync-battle-catalog.mjs --check` interdit de modifier `js/data/BattleCatalogData.js`. Tout ajout passe par une couche d'adaptation explicite, avec sa provenance.

## User Scenarios & Testing

### User Story 1 — Civils d'une opération humaine (Priority: P1)

Dans AFF-06 à AFF-10, les civils chiffrés par l'audit existent comme personnes non combattantes. Ils fuient vers un abri accessible, se dispersent sous le danger, puis se regroupent. Ils ne comptent ni dans les quotas de morts ni dans les effectifs militaires.

**Independent Test**: créer AFF-08 et compter 32 civils (4 × 8) dans un registre distinct des 13 524 allocations combattantes, avec leurs identités, leur guide et leurs états.

**Acceptance Scenarios**:
1. **Given** AFF-08, **When** l'opération démarre, **Then** 32 civils sont présents dans un registre séparé, et les totaux combattants du contrat restent inchangés.
2. **Given** un civil tué par un tir, **When** le bilan est établi, **Then** sa mort est enregistrée une seule fois dans son registre, ne donne pas de moral, et n'est pas un kill du joueur.
3. **Given** une sauvegarde puis un rechargement, **Then** les mêmes civils sont présents, avec les mêmes états.

### User Story 2 — Extraction d'un vétéran du clan (Priority: P2)

Deux gardes Yautja escortent un vétéran blessé, non combattant, sur une route praticable. Ils demandent couverture et détour.

**Independent Test**: dans l'opération retenue, le vétéran vient d'un blessé réel de l'allocation alliée. Aucune unité n'est créée. L'extraction réussit ou échoue selon la route et les pertes.

### User Story 3 — Couvoir de la ruche (Priority: P3)

Une chambre de ponte contient 4 à 12 œufs et 2 à 4 adultes gardiens. Les œufs ne comptent pas comme soldats. Une éclosion consomme un œuf et suit les règles d'hôte existantes (`HostInfestation`). Elle ne crée jamais d'adulte sans hôte.

**Independent Test**: les œufs sont dans l'état `egg`. Détruire un œuf n'est pas un kill de soldat. Une éclosion fait passer une identité d'œuf à facehugger, sans en créer une nouvelle.

### Edge Cases

- Un civil coincé derrière une porte fermée : il attend, sans téléportation.
- Un vétéran dont les deux gardes meurent : l'extraction échoue, mais le vétéran reste vivant et secourable (contrat 7).
- Une sauvegarde antérieure à cette fonctionnalité : elle reprend sans civils ni œufs, grâce à une variante de reprise, comme pour les liens du catalogue.

## Requirements

- **FR-001** : les civils GRP-28 sont lus dans `thirdParties` de l'audit. Le format « N GRP-28 de 8 » ou « au format 8 » donne N × 8 personnes. Aucun chiffre n'est inventé.
- **FR-002** : civils, œufs et vétéran restent hors des budgets combattants et des 13 524 allocations. `assertConservation` couvre en plus leurs registres.
- **FR-003** : toute mort passe par un enregistrement unique de son registre ; aucune ne donne de moral d'officier.
- **FR-004** : une couche d'adaptation post-audit, versionnée et datée, porte les ajouts. Le catalogue généré n'est pas modifié.
- **FR-005** : les anciennes sauvegardes reprennent grâce à une variante `legacy…`, qui reproduit leur empreinte de configuration.
- **FR-006** : un état `egg` est ajouté aux états de la simulation. Il est exclu des quotas, des moraux et des effectifs combattants.

## Success Criteria

- **SC-001** : la recette REC-004, clause C2e, passe sans `todo`.
- **SC-002** : `node scripts/sync-battle-catalog.mjs --check` passe toujours.
- **SC-003** : les tests existants passent, et les empreintes des 27 opérations sans civils restent identiques.

## Décisions de l'auteur (14 nov. 2026)

1. **HW-DEC-97** : le couvoir GRP-05 est porté par AFF-27, LV-742, où la ruche est établie, avec sa Reine et l'infestation d'hôte.
2. **HW-DEC-98** : l'extraction GRP-16 est portée par AFF-10, la cité-port. Le captif Yautja non combattant prévu par l'audit devient le vétéran à extraire.
3. **HW-DEC-99** : le budget EFF-06 est attribué à AFF-05, « Un accord pendant que les fronts reculent », par la couche d'adaptation. L'audit continue d'indiquer EFF-09 ; l'écart est documenté.

## Assumptions

- Les gardes du couvoir et de l'extraction sont pris dans les allocations existantes de leur faction. Seuls les œufs et les civils sont nouveaux, et leur nombre est fixé par l'audit ou par une décision de l'auteur.
