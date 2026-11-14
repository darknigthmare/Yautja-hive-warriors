# Tentatives navigateur conservées

Ces quatre exécutions portent sur le runtime `94630d8302c320eb7c39c78ad62f1464e6f4d538`, index `8632fe71abb813f1b4242b5c74d446622533d93f91e4e643e80b1eb57d032022`. Leurs rapports restent dans leur état réellement obtenu. Les helpers et le dist ont été vérifiés inchangés pendant chaque exécution ; tous les navigateurs ont été fermés. Aucune de ces quatre tentatives ne constitue un run complet positif des trois cas.

| Tentative | Cas réellement exécutés | Résultat et suite |
| --- | --- | --- |
| [R1](runtime-94630d8-r1/report.json) | UI/coop | Échec de fixture : lecture du défilement clavier natif immédiatement après `End`. La suite attend ensuite le vrai résultat sous deux secondes, sans assigner `scrollTop` ni modifier le CSS. |
| [R2](runtime-94630d8-r2/report.json) | UI/coop | Échec de fixture après les menus, légendes, caméras d’insertion et ordre réel : fermer la carte ouverte pendant une pause restaure normalement l’écran de pause. Le helper cherchait alors un bouton du HUD caché. La suite utilise le vrai bouton Reprendre, puis teste une nouvelle pause. |
| [R3](runtime-94630d8-r3/report.json) | UI/coop, Carrier | UI/coop positif, y compris reprise réelle du checkpoint. Carrier négatif : la position d’observation trop éloignée de son groupe le faisait normalement passer hors du détail ; les quatorze requêtes observées restaient hors de l’arc de lancement. Le diagnostic CPU de sélection et la tentative suivante sont distincts. |
| [R4](runtime-94630d8-r4/report.json) | Carrier, Ravager | Carrier positif après sélection d’une position physique dans les mêmes bornes tactiques. Ravager négatif : le vrai checkpoint de catalepsie est rejeté par le système de secours allié lors de la reprise. Ce défaut applicatif exige une correction et une nouvelle validation. |

R4 demande explicitement deux cas. L’UI n’y reçoit aucun passage ni saut artificiel. Le Carrier acquiert sa cible en 63 mises à jour normales de `GameApp.update` (1,05 s), sans appel explicite de lancement ni changement des portées ou du plafond de 32 acteurs. Le parasite existant part à 2,05 unités, atteint 3,225 unités au milieu du vol après le `Bridge.sync` de production et rejoint exactement la destination déclarée. La cargaison passe de six à cinq identités ; pause et nettoyage sont contrôlés.

Le Ravager sauvegardé possède toujours son ID, 50 PV, son amélioration consommée et sa phase de 0,25 à 12,25 s. La reprise réelle échoue. La [reproduction CPU composée](ravager-rescue-restore-baseline.json) confirme le rejet `Incapacitated unit has no saved rescue timer` dans `AllyRescueSystem.restore`, distinct du propriétaire de la catalepsie. Le défaut ne peut pas être présenté comme une simple insuffisance de délai du navigateur.

Le fichier `prelaunch-missing-output-directory.json` conserve aussi un problème de préparation des logs : Node et Chrome n’avaient pas démarré. Il ne compte pas comme exécution de cas.

Les captures d’insertion gardent les deux caméras réelles ; les gros plans de combat emploient la caméra d’inspection déclarée. Les rapports précisent les pauses de contrôle, les relocations du seul joueur, les mises à jour déterministes et les vraies entrées de menu. Le toit au premier plan reste une réserve visuelle distincte. Aucun playtesteur humain, fidélité visuelle 1:1, performance matérielle ou victoire naturelle n’est certifié.

Un correctif ultérieur ne réécrit pas ces rapports et ne leur attribue pas sa nouvelle empreinte de build. Sa recette doit apparaître dans une nouvelle exécution liée à ses propres pins.

## Validation après le correctif de propriétaire

[R5](runtime-4ecac29-r5/report.json) exécute de nouveau **les trois cas et les réussit dans une seule exécution**, sur la nouvelle source `4ecac297e82a84c18e8b968ffbcea0c3693d29ba`, index `70067415028edf40bac7085f72b56a43037f55deae2de7b332524e8f7012795a`. Les trois helpers sont strictement identiques à R4 ; aucun ancien résultat n’est réattribué au nouveau build.

Cette passe dure 179,928 s et conserve 21 PNG, trois snapshots de helpers et le rapport, soit 25 entrées vérifiées dans son manifeste. Aucune erreur JavaScript, requête échouée ou externe ; dist et helpers inchangés pendant la recette, Chrome fermé.

La reprise Ravager conserve le même ID, les 50 PV, l’amélioration consommée, le temps stratégique de 1 s et l’échéance absolue de 12,25 s. La rematérialisation conserve cette phase à 1,25 s ; le réveil atteint 500 PV exactement à 12,25 s. Le feu provoque ensuite une seule mort et aucun nouveau cycle de catalepsie. La nouvelle racine de rendu après rechargement reste stable jusqu’au réveil ; aucun objet JavaScript n’est présenté comme persistant à travers le rechargement de page.

La [revue finale de ces preuves](../runtime-final-review.json) contrôle les pins, les fichiers archivés et les invariants des trois cas. Les limitations de portée décrites plus haut restent valables.

Le gros plan de catalepsie restaurée masque une partie de l’anatomie couchée derrière la capsule/le joueur et coupe une autre partie du corps. Le cas vérifie la phase, sa projection et sa reprise ; cette image ne certifie pas la lisibilité complète de la silhouette couchée. Les captures du réveil et du nettoyage montrent séparément l’acteur debout puis son retrait.
