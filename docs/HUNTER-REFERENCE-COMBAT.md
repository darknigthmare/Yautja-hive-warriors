# Kits de référence et combat des chasseurs — 26 octobre 2026

Cette passe rapproche les équipements de chaque incarnation des sources disponibles et donne aux sept chasseurs des styles de jeu distincts. Les statistiques, enchaînements et gestes musou restent une adaptation originale. Les photographies de produits licenciés ne sont pas des scans des costumes : aucune fidélité géométrique ou chorégraphique « 1:1 » n'est démontrée.

## Équipement et sélection

[`hunterArsenal.js`](../js/data/hunterArsenal.js) conserve les sources et les restrictions de chaque incarnation. Le mode `faithful` filtre les armes et deux gadgets au maximum ; le mode `adapted` autorise les équipements croisés. `Player.applyLoadout` applique le kit sans multiplier les statistiques à chaque réouverture du menu. `Player.selectWeapon` constitue l'état unique pour la géométrie tenue, le profil de portée/dégâts et l'action exposée à l'interface par `getWeaponState`.

Les disques, shurikens, arcs et bolts sont explicitement des actions à projectile ; les sélectionner ne produit pas une frappe de mêlée portant seulement un autre nom. Une arme inconnue ou interdite est refusée avant de changer l'état. Les nouveaux pouvoirs sans attestation dans le kit sont refusés avant leur dépense de ressources ; `getArsenalState` expose les refus et les actions autorisées. Le mode de référence ne certifie pas une liste exhaustive de tous les accessoires d'un film.

Le disque ne peut plus être lancé sans limite : son délai de récupération est de 3,2 secondes. Ceux du shuriken et de l'arc sont respectivement de 4 et 4,2 secondes. `getWeaponState` expose les dégâts, la ressource, le coût et le délai de l'action sélectionnée depuis les mêmes profils que les tirs réels ; le plasma du raccourci à distance reste un état distinct.

| Chasseur | Kit de référence initial | Trait de jeu original |
| --- | --- | --- |
| Jungle Hunter | Lames, plasma, soins, autodestruction | Chaîne légère de cinq coups, équilibre |
| City Hunter | Combi-stick, disque, plasma, soins, autodestruction | Quatre coups, déplacement et récupération rapides |
| Wolf | Lames, fouet, double plasma, soins, solvant | Trois coups, impacts précis et engagement lourd |
| Feral | Lames, bolt gun, bouclier, soins | Quatre coups, pression et bolts limités |
| Alpha | Faucille, arc, plasma, soins, piège | Allonge et préparation plus longue |
| Samurai | Katana, disque, plasma, soins, piège | Trois coups et courtes fenêtres actives |
| Viking | Hache, disque, plasma, soins, piège | Mobilité lente, gros engagement et coût élevé |

Feral n'utilise pas de plasma dans le kit de référence. `fireRangedShot` produit un bolt physique, sans charge plasma, depuis l'extrémité de l'arme tenue, avec douze munitions et une cadence minimale de 0,8 seconde. Le raccourci de tir sélectionne cette arme pour accorder état, visuel et attaque. Les trois nervures dorées du gantelet gauche sont traitées comme le bouclier replié ; elles ne sont pas annoncées comme un lanceur mesuré. La silhouette indépendante du bolt gun se base sur la planche d'accessoires Prime1 `MMPR-07DXS_a12` déjà archivée dans les références de travail. Le bouclier et le gun restent des approximations procédurales.

## Fenêtres, coûts et simulation

[`hunterCombatStyles.js`](../js/data/hunterCombatStyles.js) définit sept ensembles différents de préparation, fenêtre active, récupération, portée, dégâts, longueur de chaîne, mobilité, endurance et récupération d'endurance. Les coups légers consomment entre 2,6 et 5 points ; les lourds, entre 15 et 29 points avant l'augmentation de fin d'enchaînement. Les grandes attaques de foule ajoutent un délai de récupération propre au style, entre 2 et 4 secondes. Une attaque refusée ne dépense rien.

L'admission d'une attaque fournit un `attackId`, `windup`, `hitDelay`, `activeDuration`, `recovery` et `duration`, tous en secondes de simulation. L'impact prévu est au milieu de la fenêtre active. Le contrôleur de mission attend ce délai et appelle `claimAttackImpact(attackId)` une seule fois ; il vérifie aussi l'identité du joueur et ses PV. La garde peut annuler une préparation ou une récupération, mais pas les instants actifs. Les impacts peuvent interrompre une attaque ; le lourd Viking résiste à l'interruption pendant sa fenêtre active et conserve les dégâts reçus. Les bras suivent une anticipation, une frappe et un retour privés sans réécrire les GLB source.

La parade et le blocage dépendent du contexte transmis par l'attaquant. Les tirs requièrent le bouclier lorsque `blockRequiresShield` est présent. Les attaques de reine, écrasements, acide et autres impacts déclarés non bloquables passent cette défense. Une parade coûte six points d'endurance, un blocage huit ; maintenir le bouclier arrête la régénération. Une barre vide ne fournit pas une défense permanente.

Les anciens minuteurs des capacités utilisent maintenant le temps de simulation du propriétaire. Ils s'arrêtent avec la pause et sont annulés à sa destruction. Les effets temporaires possèdent leurs ressources ; les images rémanentes utilisent la projection privée existante, ce qui évite de libérer les géométries ou squelettes du personnage vivant.

## Décor, diplomatie et morts

Les boucles historiques qui modifient directement les PV vérifient les relations de factions avant l'application. Une trêve libère également un filet déjà lancé. Les morts sont confiées à `horde.defeatAlien` et au registre commun pour éviter de retirer et créditer une victime plusieurs fois.

Le flamer, pistolet plasma, fusil Gauss, bolt gun Seegson, lance de précision, double rayon et zones de napalm consultent le même décor solide via `env.hasLineOfSight`. Le filet utilise un véritable `env.traceSegment` derrière sa cible pour l'ancrage : l'ancienne limite fixe à ±63 unités ne représente plus un mur sur les grandes cartes. Les modes décrits comme perforants peuvent traverser des corps ; aucune traversée de mur n'est accordée dans cette passe. Les autres projectiles passent par les collisions de leur contrôleur principal.

## Vérification et limites

[`hunter-reference-combat.test.js`](../tests/hunter-reference-combat.test.js) couvre les restrictions et états d'armes, les munitions Feral, les sept profils numériques, les phases et la récupération à 30/60/120 FPS, les coûts/cooldowns de foule, les contextes de défense, l'arrêt des minuteurs, la propriété des effets, la protection des alliés par diplomatie, les murs et l'ancrage du filet dans une carte agrandie. Les silhouettes ajoutées sont finies, distinctes et sous 12 000 triangles par arme contrôlée. Les tests antérieurs des visuels générés, de la locomotion, des gadgets et de l'hologramme restent nécessaires dans la validation d'ensemble.

Cette passe ne ferme pas à elle seule les interactions tactiques de formations, tous les statuts de tous les adversaires, ni l'intégralité des entrées du tableur. Les mains et mollets des Yautja importés n'ont pas reçu de faux pivots : leur articulation demande des mesures et une pondération propres. Les lames City Hunter fusionnées restent non séparées, conformément au rejet de leur découpe non fermée. Les sources GLB et textures sont préservées. Aucun nouveau modèle Meshy payant n'a été généré et aucun testeur humain n'est déclaré.
