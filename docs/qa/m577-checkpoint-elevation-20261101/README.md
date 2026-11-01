# M577 — prévention des sauvegardes sur un mauvais étage

La comparaison seule XZ entre le manifeste USCM et l'APC pouvait
laisser passer une position Y forgée ou perdue au rechargement. La
validation compare désormais la hauteur réelle du plancher renvoyée par
`getElevationAt` à la hauteur de coque enregistrée, avec une tolérance
de 0,35 unité. Un plancher manquant ou un prédicat de sol défaillant
refuse la reprise, sans inventer un téléporteur pour l'APC ni pour ses
occupants.

La logique ne change ni les capacités des sièges, ni l'effectif fini,
ni le `configDigest`, ni le format de sauvegarde. Les anciennes fixtures
sans API d'altitude restent compatibles. Des tests couvrent un pont à
Y=3, un faux Y=300 et des niveaux non mesurables, ainsi que le refus
de débarquement d'un vrai manifeste flottant.

Cette vérification de plans horizontaux n'est pas une certification
de cinématique automobile ni d'intérieur M577 conforme au film.
