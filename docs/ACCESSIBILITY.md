# Préférences d'accessibilité — 26 octobre 2026

[`AccessibilityPreferences.js`](../js/ui/AccessibilityPreferences.js) conserve trois préférences de présentation : palette accessible, symboles indépendants des couleurs et réduction des flashes. Leur sauvegarde est un objet versionné sous `yautja_accessibility_v1`. Les valeurs mal formées, versions inconnues, quotas atteints ou stockage privé n'empêchent ni le démarrage ni les changements pendant la session. Les abonnés reçoivent des copies ; un panneau fermé ne peut pas casser les autres mises à jour.

L'intégration crée `new AccessibilityPreferences({document})`, consulte `get()`, modifie `set({palette:'accessible',symbols:true,reducedFlashes:true})` et écoute `subscribe(callback)`. La construction applique directement les réglages sauvegardés. Les classes du corps sont `accessible-colors`, `marker-symbols` et `reduced-flashes`. Les variables CSS `--marker-player`, `--marker-ally`, `--marker-hostile`, `--marker-neutral`, `--marker-objective` et `--marker-danger` fournissent leurs couleurs. Cette préférence ne réécrit pas les matériaux de costumes ni la provenance visuelle des modèles.

`markerAppearance({role,factionId,label},preferences)` et `drawAccessibleMarker(context2D,{x,y,role,factionId,label,size,filled},preferences)` fournissent des marqueurs sans dépendre uniquement de la teinte.

| Sens | Forme | Lettre de base |
| --- | --- | --- |
| Joueur | Cercle | P |
| Allié | Losange | A |
| Hostile | Triangle | E |
| Neutre | Carré | N |
| Objectif | Étoile | O |
| Danger | Croix | ! |

En palette accessible, les familles humaines, xénomorphes, Yautja et synthétiques ont quatre teintes différentes et les lettres H/X/Y/S. La forme continue d'indiquer la relation : deux unités d'une même famille peuvent donc être distinguées comme alliée ou hostile. Le libellé accessible contient la relation et le nom fourni ; l'intégration doit aussi conserver les noms des fronts et objectifs. Les marqueurs ont un bord sombre et clair pour rester lisibles sur des fonds différents. Les petits groupes à plusieurs clans conservent leurs étiquettes de carte ; ce module ne prétend pas attribuer une nouvelle couleur unique à chaque identifiant de faction arbitraire.

`reducedFlashPolicy(preferences)` fournit les limites prévues pour les effets : flash d'écran à 0,08, suppression de l'éclair lumineux et des pulsations, secousse de caméra réduite au quart. Le renderer consulte directement la classe `reduced-flashes` pour les éclairs. Les autres producteurs d'effets peuvent appliquer cette politique ou la même classe. Les avertissements gardent leur forme et leur lettre lorsque les flashes sont réduits.

Les tests couvrent sauvegarde/restauration, refus de stockage, données corrompues, valeurs rejetées, copie/abonnement, distinction des formes en monochrome, lettres et couleurs de camp, tracés canvas et politique des effets. Ils ne constituent pas une certification clinique de perception des couleurs ou de photosensibilité. AUD-103 exige également un contrôle visuel des scénarios réels avec les réglages activés : le module et son intégration ne remplacent pas cette revue.

La navigation clavier/manette est décrite dans [GAMEPAD-CONTROLS.md](GAMEPAD-CONTROLS.md). Les collisions et l'occlusion de la caméra relèvent d'AUD-104 et des vérifications de monde séparées.
