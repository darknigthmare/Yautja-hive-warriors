# Carrier — lâcher physique de parasites déjà alloués (1er novembre 2026)

La variante AFF-27 peut maintenant demander un **lâcher 3D** par
l'IA du Carrier lorsqu'une cible hostile est proche. L'acteur
Carrier ne téléporte pas un nouvel ennemi : la simulation
retire exactement un Facehugger de sa cargaison, le transfère
de distant à actif dans le budget autorisé et la projection
`BattleActorBridge` crée le modèle de cet **identifiant
déjà attribué à l'opération**.

L'acteur parasite traverse une trajectoire parabolique visible
d'environ une seconde vers une zone de plancher réelle
validée par `BattlefieldNavigation.safeSpawnNear/canStand`.
Les collisions/étages, la portée et la visibilité doivent
être valides avant le transfert. Pendant le vol le parasite
ne peut pas attaquer ni infecter ; ensuite il utilise
l'IA Facehugger existante. Si le sol ou le budget est
indisponible, aucune mutation du manifeste ni nouvel acteur
n'a lieu. Le cooldown d'environ trois secondes est une
adaptation de gameplay, pas une statistique issue du RTS.

La sauvegarde conserve les ID et les positions même pendant
le vol, sans nouveau `configDigest`. L'animation n'est pas
un enregistrement de l'attaque 1:1 du jeu de 2003.
La destruction incendiaire de la cargaison, l'upgrade 12
et les combats offscreen restent des mécanismes distincts.
