# PREY — outils tenus, stocks et effets du joueur

Implémentation du 28 octobre 2026, dans le checkout NEXT. Les formes sont des
modèles procéduraux originaux inspirés des accessoires de PREY, avec matériaux
PBR partagés. Ni photogrammétrie, ni calibration anatomique ou mesure certifiée
1:1 ; aucune génération Meshy payante n'a été lancée pour ce lot.

## Contrat Player

- `equipPreyWeapon('taabe_bow' | 'naru_axe')` admet seulement un joueur vivant,
  dans `prey_comanche_territory`, en mode adapté. Le mode fidèle refuse ces
  emprunts humains et conserve le prop au sol. Équiper ne fournit aucune munition.
- Les interactions Environment fournissent ensuite six flèches, plafond douze,
  ou quatre frappes de hache, plafond quatre. Les propriétés sont
  `hasTaabeBow`, `hasNaruAxe`, `taabeArrowAmmo`, `naruAxeCharges`.
- Le paramètre `{sourceLevelId:'prey_comanche_territory'}` sert uniquement aux
  fixtures sans gameContext. Il ne contourne pas une mission réelle différente.
- `getWeaponState()` fournit `actionMethod:'fireCompoundBow'`, ressource
  `arrows`, coût1 et stock effectif pour Taabe ; `lightAttack` et ressource
  `axe_charges` pour Naru. Aucun de ces outils ne consomme du plasma.
- `fireCompoundBow()` avec Taabe retire une flèche par tir admis, retourne un
  projectile physique `taabe_arrow` : vitesse48, dégâts240, vie1.5s, aucune
  perforation, cadence0.9s. Six tirs après un ramassage, puis refus. L'arc
  technologique préexistant garde son profil distinct.
- La hache a une vraie forme tenue dans la main droite et suit l'animation de
  frappe. Toute frappe légère/lourde admise retire une charge ; tentative pendant
  une attaque, manque d'endurance ou stock vide n'en retire pas. La frappe lourde
  est une attaque physique courte dédiée, sans substitution par fusil ou gauntlet.

`serializePreyEquipment()` conserve version1, mission d'origine, possessions,
stocks, outil sélectionné, récupération de l'arc et durées restantes des trois
effets. `restorePreyEquipment(saved)` valide tout avant mutation et ne remplit
aucune ressource ; l'appel doit précéder `selectWeapon()` dans la restauration
d'opération. Zéro flèche ou charge reste zéro. Une pose de corps importé ne
possède pas les accessoires : ceux-ci sont détachés avant sa destruction,
reliés aux sockets de mains ou aux bras procéduraux, et libérés par Player.

## Effets bornés et contact physique

- Taabe : déplacement réel multiplié par1.3 pendant25s, application répétée
  remplaçant la durée sans cumuler la vitesse. Retour à la vitesse initiale.
- Fleur : `getThermalSignatureMultiplier()` vaut0.35 pendant35s puis1.
  Aucun déclenchement de cloak technologique, aucune température médicale ou
  invisibilité absolue annoncée. L'acquisition thermique du Feral est reliée
  séparément dans Bosses ; proximité et vue directe restent des voies de détection.
- Boue : signature0.6 en l'absence de fleur et dégâts d'acide réels multipliés
  par0.6 pendant30s. Aucun cloak imposé. Les dégâts physiques ordinaires ne sont
  pas réduits par cet effet. Les anciens bonus plasma inventés ont été retirés.
- Un cloak technique activé indépendamment reste indépendant de ces durées.
- La revue croisée a retiré les anciens compteurs `shield` de grizzly et du
  rack Feral : Player ne consommait pas cette prétendue protection. Ils donnent
  désormais une récupération HP bornée de150 et100 respectivement ; le rack
  conserve ses six fléchettes, plafond douze. Un test vérifie dégâts et checkpoint
  sur le vrai Player après ces deux interactions.
- `update(0)` fige stocks, récupération et durées. Les durées restaurées ne
  repartent pas de zéro. Les valeurs non finies ou négatives sont refusées.
- `getCollisionHeight()` renvoie `max(2.4,cameraEyeHeight+0.35)` ; marche et
  saut transmettent cette hauteur au monde, y compris sous un vrai mesh de plafond.

## Preuve CPU

Commande finale :

```sh
node --max-old-space-size=2048 --test --test-concurrency=1 \
  tests/prey-player-equipment.test.js tests/prey-reference-interactions.test.js \
  tests/prey-interaction-contracts.test.js tests/hunter-reference-combat.test.js \
  tests/operation-player-state.test.js tests/player-laser-grounding.test.js
```

41/41 PASS, zéro échec/skip/annulation, 27034.286971ms. Sortie conservée dans
`../../qa/pr3-next-20261028/prey-player-reviewed/tests.txt` avec SHA256 des
quinze sources/tests identiques avant/après, dans `report.json`. La première
preuve de27 tests reste archivée dans `qa/prey-player-27-tests.txt`.
Les dix nouveaux tests utilisent le vrai Player,
les vrais pickups Environment et un plafond enregistré avec sa géométrie physique.
Ils couvrent aussi les sockets natifs à échelle GLB et la destruction unique des
ressources. La suite de combat préexistante a été adaptée uniquement pour son
ancienne assertion de hauteur constante2.4, devenue la hauteur réelle du joueur.

Cette preuve ne remplace pas une revue visuelle humaine du modèle en jeu.
Les hooks de projectile, la roue de sélection et le checkpoint d'opération sont
intégrés par le lot main/UI ; leur preuve complète doit être reliée à ce contrat.
