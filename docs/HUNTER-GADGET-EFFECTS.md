# Effets de gantelet et trophées — 25 octobre 2026

Cette reprise corrige deux effets temporaires qui utilisaient encore les anciens bras procéduraux. Le compte à rebours ne se projetait pas devant le véritable gantelet importé ; le trophée d'exécution était retiré de la scène sans libérer ses géométries et matériaux. Les corps, textures et fichiers GLB ne sont pas régénérés ou réécrits. Aucun crédit Meshy n'est consommé.

## Compte à rebours du gantelet

Le City Hunter utilise le plan mesuré de sa véritable console gauche, transformé avec le même `consoleRoot` que son écran. La projection se place à 0,12 unité normalisée devant ce plan et suit le bras, le décalage visuel du corps et l'échelle de métamorphose. Le précédent centre d'effet était à environ 1,68–1,75 unité de la console dans les poses CPU examinées. Pour le Jungle Hunter, l'ancre suit le segment réellement mappé entre coude et poignet ; cette approximation anatomique n'est pas une mesure de sa coque de gantelet. Le modèle procédural conserve une ancre sur sa propre plaque.

Les cônes tournants sont remplacés par une projection plane à signes segmentés, repères latéraux et arc de progression. Les signes changent avec les secondes restantes ; le signal accélère pendant les deux dernières secondes. La texture locale de 256 × 64 contient sept signes, sans police distante ni appel réseau. L'effet ajoute **204 triangles, quatre surfaces de mesh et trois matériaux privés**.

La durée est de **six secondes de simulation**, comme la séquence d'autodestruction du jeu. Pause, delta nul ou invalide ne font pas avancer l'effet. Un import tardif rattache la projection au corps reçu et ouvre sa console pour le temps restant, sans relancer les six secondes. Le nettoyage explicite ou l'expiration ferme la console si son mode reste celui de l'autodestruction et remet `wristNukeHoloMesh` à `null`.

Cette projection et ses signes sont une interprétation visuelle locale ; ils ne reproduisent pas un mécanisme de film certifié « 1:1 ».

## Trophées d'exécution

Le trophée utilise maintenant le véritable socket `rightHand` du personnage importé. Le crâne et neuf vertèbres détaillées remplacent l'ancienne sphère et les cylindres isolés. Le point de prise suit la main ; la colonne pend selon la verticale du personnage et reçoit une petite oscillation analytique. Les doigts des modèles ne disposent pas d'une nouvelle articulation de prise.

`executeSpineRip(victimKind)` choisit une silhouette de famille, plutôt que de montrer systématiquement un crâne humain après une exécution de xénomorphe :

| Victime | Famille visuelle | Triangles | Surfaces de mesh |
| --- | --- | ---: | ---: |
| Humain, Marine, synthétique | Crâne humain avec orbites, mâchoire et dents | 28 762 | 4 |
| Guerrier, Crusher, Praetorian, Grid et autres xénomorphes | Cranium allongé et dents de tête du modèle procédural existant | 7 753 | 5 |
| Queen, Empress, Matriarch et variantes royales | Crâne à large couronne | 17 055 | 4 |
| Offspring, Engineer | Crâne humanoïde plus haut | 28 730 | 4 |

Ces regroupements ne reconstituent pas chaque boss particulier. La tête de guerrier conserve seulement ses dents crâniennes : les griffes de mains et de pieds ne sont pas importées avec le trophée. Tous les buffers visibles et les matériaux de ces accessoires sont privés ; les cartes PBR partagées restent en cache.

Un seul trophée est actif par joueur. Il expire après **3,5 secondes de simulation**, ou est remplacé ou libéré au retour menu. Géométries et matériaux sont libérés exactement une fois. La pose de bras est restaurée uniquement si l'effet la possède encore ; une attaque survenue entre-temps garde sa priorité. Si l'exécution commence pendant un balancement de marche, le bras revient à sa pose de repos afin que la locomotion reprenne son mouvement.

## Contrat d'intégration

`getHunterGadgetEffects(player)` crée paresseusement `player._gadgetEffects`. Son contrôleur expose :

- `startCountdown({ duration: 6 })`, `stopCountdown()` ;
- `startTrophy({ kind, duration: 3.5 })`, `stopTrophy()` ;
- `update(delta, { paused })`, `rebind()`, `dispose()`, `getState()`.

Le jeu avance le contrôleur avant la mise à jour du rig importé, puis appelle `rebind()` après la pose et les mécanismes. Cela permet de restaurer le bras et de poser l'accessoire dans la même image. Les racines deviennent des enfants de `adapter.root` pendant l'import, puis du groupe visuel procédural en repli. Elles portent `userData.playerTransientEffect = true` pour être exclues des silhouettes de leurres. Le contrôleur les possède entièrement ; elles ne rejoignent pas aussi le registre `_effects`, afin d'éviter une double libération.

Le contrôleur est réattaché après l'arrivée et le retrait d'un import. Il est libéré avant le rig et le mesh du joueur. Le camouflage réduit séparément l'opacité des accessoires sans modifier un matériau de corps ou celui d'un autre joueur.

Les matériaux de trophée invalident leur programme uniquement lorsque le mode transparent change, afin de conserver le camouflage après un premier rendu opaque. En coopération, `updateDefeatedEffects(delta)` fait avancer les projections d'un chasseur tombé sans réactiver ses déplacements, sa régénération ou ses gadgets. Le compteur 3D reste ainsi synchronisé avec la séquence générale.

## Contrôles

Les [onze tests CPU](../tests/hunter-gadget-effects.test.js) passent. Ils chargent les vrais GLB City Hunter et Jungle Hunter avec textures de substitution CPU, puis vérifient :

- les ancrages sur les vrais os et le plan de console, avec une erreur inférieure à 10⁻⁶ unité, plusieurs poses, une transformation parente et les échelles 1/1,8 ;
- la conservation des empreintes de géométrie source, des matériaux empruntés et des textures PBR partagées ;
- six secondes réelles de simulation à 30/60/120 images par seconde, pause, temps nul, remplacement et import tardif ;
- les quatre familles de crânes, les buffers finis et les budgets ;
- la libération privée unique, l'indépendance de deux joueurs, le camouflage et la reprise des poses de locomotion et de combat.
- l'invalidation du shader uniquement lors des changements de transparence et les timers visuels du joueur tombé sans mise à jour de son gameplay.

Le [relevé CPU](qa/hunter-gadget-effects/cpu-validation.json) et le [journal](qa/hunter-gadget-effects/tests.txt) conservent les mesures. Ce contrôle de géométrie ne remplace pas la revue du rendu dans l'application et ne mesure pas les performances d'une carte graphique de jeu.
