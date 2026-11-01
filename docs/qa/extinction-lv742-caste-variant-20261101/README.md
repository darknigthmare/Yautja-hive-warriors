# AFF-27 / LV-742 — variante Carrier et Ravager (1er novembre 2026)

Une option explicite au menu de mission transforme **des identités
préexistantes de groupes xénomorphes GRP-58/59** en un Carrier,
six Facehuggers et un Ravager du jeu *AVP: Extinction*. Le total
d'ennemis/alliés et les réserves restent strictement identiques.
Le Carrier embarque ces six Facehuggers dès le début de la
simulation, même si la ruche combat sur un autre front.

Le changement est **signé dans le digest de la configuration** :
une sauvegarde de la variante ne peut pas être interprétée comme
une sauvegarde de l'opération normale, et inversement.
Le choix est conservé dans `scene.extinctionVariant` à la
reprise. Les anciens checkpoints sans ce champ restent sur
`none` et utilisent la configuration historique.

La variante est une **adaptation Musou expérimentale** : elle ne
copie pas la sélection d'unités RTS, n'invente ni économie ni
naissances, et ne s'applique pas à Lethe, Sevastopol ni aux films.
Seuls les profils sources XEN-009 et XEN-010, attachés à AFF-27,
peuvent être matérialisés. Le Carrier conserve une cargaison
de six identifiants finis, sans affichage de Facehuggers
« gratuits » sur ses sculptures.

Manquants à traiter : animation/débarquement 3D en combat,
catalepsie du Ravager sur le champ proche, amélioration via la
Reine et reproduction mesurée des modèles/textures.
**Aucune fidélité 1:1 visuelle certifiée.**
