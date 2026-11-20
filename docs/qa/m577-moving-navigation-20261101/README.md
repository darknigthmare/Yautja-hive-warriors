# 1er novembre 2026 — cache de navigation et blindé mobile

Le M577 doit bloquer les soldats **à la position physique réelle de sa coque**. Sa `rotation`, sa largeur et sa profondeur ont un effet sur l'occupation, même si son centre X/Z reste immobile lors d'une manœuvre. Le cache `BattlefieldNavigation` suit donc désormais position, orientation, demi-gabarits et activation des colliders dynamiques.

La couche d'intégration ne réinitialise plus systématiquement les chemins de tous les PNJ à chaque micro-pas accepté : elle synchronise le collider existant, puis le cache est invalidé lors de la **prochaine requête de navigation**, une seule fois pour la pose constatée. Les contrôles physiques `canStand` utilisent toujours les colliders vivants et ne bénéficient jamais d'un passe-droit.

Cette optimisation est sans nouvelle unité, sans mutation des effectifs, ni modification des sauvegardes/identifiants. Les tests vérifient qu'un véhicule inchangé ne vide pas les caches, mais qu'une rotation sur place, un changement de gabarit et un déplacement les invalident. **Pas de mesure de FPS matériel ou de certification de la géométrie 1:1.**
