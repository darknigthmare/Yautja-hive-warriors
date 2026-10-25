# Leurre holographique du chasseur — 25 octobre 2026

Le leurre utilise maintenant la silhouette du personnage réellement affiché : corps importé City Hunter ou Jungle Hunter, masque séparé et équipement présent, ou anatomie procédurale de la variante de repli. L'ancien cylindre surmonté d'une sphère est supprimé. La pose et le décalage d'appui sont capturés au déploiement ; l'échelle du personnage est conservée.

Il s'agit d'une **projection de pose figée**, avec balayage, lignes de scan et éclairage de contour cyan. Cette passe n'invente pas une animation de marche ou une reconstitution cinématographique 1:1. Le shader de projection ne réutilise pas les textures couleur 4K du corps. La direction, la vitesse de 7,5 unités/s, la durée de six secondes, la diversion, l'explosion et le délai de recharge de seize secondes gardent leurs règles de jeu.

## Visibilité et indépendance

La tête et le biomask restent présents lorsque le leurre est déclenché en vue FPS. L'adapter expose `getHeadRestVisibility(mesh)` : cette lecture restitue uniquement la visibilité connue à l'import. Les régions anatomiques masquées sous le biomask restent cachées. Le camouflage du joueur ne réduit pas l'opacité de la projection. Les lasers, trophées temporaires, compte à rebours et autres racines marquées `playerTransientEffect` ne font pas partie de la silhouette capturée.

Un chasseur tombé ne peut pas déclencher un nouveau leurre ; le refus ne consomme ni recharge ni effet sonore, même lorsque la coopération continue avec l'autre joueur.

La projection possède ses propres géométries, matériaux et squelettes, y compris les matrices d'inverse bind. Les surfaces de l'adapter appartiennent déjà à un joueur et peuvent être libérées lors d'un changement de modèle ; elles ne sont donc pas empruntées par le leurre. Les buffers sont copiés une seule fois au déploiement, sans ajouter de triangles à la silhouette. Le leurre reste valide si son émetteur est retiré ou recharge son modèle. Une importation tardive ne transforme pas rétroactivement une projection déjà créée.

Le budget de sécurité est de 400 000 triangles et 96 Mio de buffers géométriques par projection. Le vrai City Hunter équipé est contrôlé entre 300 000 et 330 000 triangles et sous 48 Mio. Il n'y a aucune copie de texture. Les ombres sont désactivées ; le rendu réutilise au plus trois matériaux cyan selon le sens de face des surfaces, sans second maillage de contour.

## Contrat de cycle de vie

`createHunterHologram(player)` retourne `mesh`, `captured`, `geometries`, `materials`, `skeletons`, `diagnostics`, `update(delta)` et `dispose()`. `Player.deployHoloDecoy(scene)` conserve les champs de gameplay et ajoute cette API au leurre.

La boucle de mission appelle `update(delta)` uniquement en simulation et `dispose()` à expiration ou au retour au menu. Le temps nul, négatif, invalide et l'absence de mise à jour ne changent ni la phase ni l'opacité. Le balayage utilise une horloge privée par projection ; il ne lit pas `Date.now()`. `dispose()` est idempotent et libère uniquement les buffers, matériaux et textures d'os de la projection.

## Contrôles

Les cinq cas de `tests/hunter-hologram.test.js` passent : silhouette procédurale réelle et échelle, visibilité FPS sans réactivation des faces couvertes, indépendance temporelle et accord à 120 images/s, vrai corps/masque/console City Hunter après destruction de l'émetteur, importation tardive et règles du gadget. Les assertions utilisent des UUID, empreintes et compteurs pour éviter de sérialiser de gros graphes Three en cas d'erreur.

Les contrôles de compilation du shader, de lisibilité et de nettoyage dans la vraie boucle navigateur sont suivis par le rapport d'intégration de la passe. Ces tests CPU ne prouvent pas la fréquence d'images sur matériel de jeu. Aucun crédit Meshy n'est consommé par cette projection locale.
