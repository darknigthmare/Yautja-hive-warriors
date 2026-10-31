# M577 — trajet physique entre fronts Musou (31 octobre 2026)

## Contrat de gameplay

Cette passe ajoute la conduite assistée **d'un seul M577 déjà déployé**,
sur **une liaison de fronts adjacents**, avec ses **Marines/équipage
déjà alloués**. Ce n'est ni un RTS *AVP: Extinction*, ni un système de
création de soldats, ni un transport magique. Les objectifs, combats
hors caméra et effectifs des 27 missions restent en place.

## Implémentation

- `APCConvoyDrive` suit les waypoints de la véritable route du catalogue
  en pas de 0,6 unité au plus ; vitesse 4,8 unités/s **originale**.
- Les **neuf points de l'empreinte** (avant, centre, arrière et flancs)
  valident sol/hauteur/collisions. Le contrôle
  `BattlefieldNavigation.canStand(...,{ignoreOwner:'apc'})` ignore seulement
  la coque du véhicule qui se contrôle elle-même ; il ne passe pas
  à travers les vrais murs/portes/ponts.
- Les interruptions (porte fermée, terrain manquant, front contesté,
  véhicule détruit) immobilisent physiquement l'APC sans déplacer ses
  occupants ni débiter des unités.
- `APCVehicle.syncNavigationCollider` met à jour **le même collider** lors
  de chaque avancée ; les chemins des PNJ sont invalidés par le routeur.
- `BattleSimulation.beginAPCTransit/moveAPCManifest/completeAPCTransit`
  valident et sauvegardent le trajet dans le contrat déjà signé,
  sans changement de `configDigest`. En milieu de route, le manifeste
  ne peut quitter le corridor déclaré. La reprise nécessite une nouvelle
  commande (pas de pilotage automatique persistant implicite).
- Panneau Musou : **USCM M577 : VERS FRONT / STOP**. Les actions sont
  optionnelles, réservées aux factions alliées ; pas de sélection
  d'escouades RTS. Le débarquement reste bloqué pendant le transit.

## Limites explicites

**MVP de route physique** : uniquement une arête/liaison à la fois,
sans recherche multi-étapes, moteur de braquage/suspension animés,
vraies roues motrices, cabine intérieure 1:1, sortie de Cheyenne,
évitement sophistiqué de foules. Les gros virages sont contrôlés par
l'empreinte, mais ne simulent pas une vraie cinématique automobile.

Les tests couvrent l'empreinte, le trajet continu, les coupures de
passages, la sauvegarde au milieu du trajet, la reprise et la
non-duplication. Ne pas déclarer les tests réussis avant le
résultat du workflow du commit.
