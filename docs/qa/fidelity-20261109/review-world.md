# Revue indépendante — structures Val Verde

Revue ciblée des nouvelles structures, du diff de `ReferenceEnvironmentMechanisms.js` et du tag `referenceWalkContactOnly`. Aucun fichier de production modifié par le reviewer.

## Constats avant correction

- **P2 — sols et rayons fantômes après retrait d’un bâtiment.** La fonction d’activité des trois nouvelles surfaces vérifiait `mesh.parent` et `owner.visible`, mais pas le rattachement du bâtiment à `referenceRoot`. Avec le vrai `EnvironmentManager`, après `removeReferenceObject(tower, shack)`, le deck restait actif à **5,59**, le toit à **3,193** en son centre, et un rayon rencontrait encore le deck supprimé. `getVerticalNavigationTarget()` continuait aussi à renvoyer l’accès de la tour ; sa sélection générique ne filtrait pas les surfaces inactives. Les deux parties ont été transmises aux propriétaires pour correction.
- **P2 — accès impraticable au pas réel du joueur.** Les marches montaient environ **0,308 m pour 0,124 m de course horizontale**. Le test par incréments artificiels de 0,025 m réussissait, mais un frame normal pouvait sauter plus que les 0,65 m de montée autorisée. Repro avec la vraie méthode `Player.prototype.move()`, l’environnement réel, une hauteur de collision minimale de 2,4 m et un départ centré au pied : vitesse 16 à 60 FPS atteint au maximum 3,6608 puis passe sous la plateforme ; vitesse 16 à 30 FPS reste au sol ; vitesse 19 à 60 FPS ne dépasse pas 0,5775 ; vitesse 14 à 120 FPS reste bloquée vers 4,94. Les vitesses 14–19 proviennent des personnages existants. Ce constat a été signalé avant le gel final.

## Points relus sans autre régression trouvée

Le toit calculé et son support utilisent les mêmes sommets échantillonnés ; le calcul est séparable en X et Z et suit les triangles de tôle. Les anciens sols fixes à `[8,6]` et `[2,10]` ont bien été retirés. `shackPos` et `platformPos` suivent les nouvelles positions déterministes. Le tag des marches empêche leur promotion en une grande boîte opaque verticale ; les surfaces mesurées restent détenues par le registre, et les murs/postes conservent leurs contacts propres.

Les deux builders ne sont appelés qu’une fois par le profil Val Verde ; la révision n’ajoute ni nouvel identifiant de sauvegarde ni stock ou acteur. Le cycle de reconstruction utilise les constantes de placement et la remise à zéro du registre de surfaces lors du nettoyage de niveau. Les nouvelles ressources de planches et de tôle sont suivies par l’ownership de l’environnement ; le partage local de la géométrie des sacs de sable est dédupliqué lors du nettoyage.

Les régressions complètes des 34 plans et la revue graphique restent celles de l’agent monde. Cette revue ne prétend pas certifier la fidélité à un décor de film et n’ajoute aucun effet de caméra ou règle globale de collision.

## Vérification finale

Le premier P2 est corrigé : une nouvelle reproduction indépendante avec les vraies API confirme une élévation nulle pour le deck et le toit retirés, aucun rayon sur le deck supprimé, aucun waypoint vers son ancien accès et trois surfaces inactives. Le culling de `referenceRoot` seul conserve les surfaces attachées, comme prévu.

Le second P2 a nécessité deux corrections. Les vrais appuis des marches sont enregistrés avant le deck, et le déplacement volontaire d’un joueur au sol qui traverse cet accès est subdivisé sur ses triangles mesurés. La limite de marche globale n’est pas relevée et aucune rampe invisible n’est ajoutée. Le helper reçoit le déplacement de l’entrée courante ; il n’infère pas un déplacement depuis une ancienne position de sauvegarde. La géométrie finale fournit également un véritable palier de 30 cm et une encoche de 1,6 m dans la première planche du deck ; elle supprime le surplomb responsable d’une chute intermédiaire de 69,6 cm en descente. Les sacs de sable ne bouchent plus cette entrée.

La validation indépendante a réutilisé **la vraie méthode `Player.move()`**, un `EnvironmentManager` et les vrais builders. Les **12 combinaisons de montée uniquement** suivantes rejoignent toutes le deck à **Y=5,59**, avec la hauteur de collision réelle de **3,95** : vitesses **14 / 16 / 19**, chacune à **20 / 30 / 60 / 120 FPS**. Le cas aérien testé conserve sa hauteur et son drapeau `isLeaping`. Après retrait des bâtiments, le helper renvoie `false` sans modifier la position ; les anciennes surfaces ne fournissent ni hauteur, ni rayon, ni waypoint.

L’agent monde a ensuite identifié une régression de **descente** : le joueur quittait le bord et restait à environ **Y=1,06 / 0,43** au pied selon le cas. La descente et l’arrivée au sol n’étaient pas couvertes par les 12 essais de montée ; la première conclusion globale de résolution était donc trop large. Elle a été retirée, puis la revue a été exécutée de nouveau après la correction géométrique finale.

La dernière vérification indépendante passe les **15 combinaisons de montée ET de descente complète**, toujours avec la vraie méthode `Player.move()` et une hauteur de collision de 3,95 : vitesses **14 / 16 / 19**, chacune à **10 / 20 / 30 / 60 / 120 FPS**. Toutes arrivent sur le deck à **Y=5,59** puis reviennent au pied à **Y=0**. Une sortie latérale réelle ne conserve aucun support élevé et rejoint **Y=0,000986** après une demi-seconde de mouvement. Le saut garde sa hauteur et `isLeaping`, la marche sous le deck reste au sol et le retrait des bâtiments conserve les invariants hauteur/rayon/waypoint/helper décrits plus haut.

Les contrôles ont été exécutés en Node avec assertions, sans navigateur ni build. **Les deux P2 sont clos pour les cas explicitement vérifiés ci-dessus sur la dernière géométrie.** L’agent monde possède les tests permanents ainsi que la régression des 34 plans ; leurs résultats ne sont pas déduits de ces seuls essais indépendants.
