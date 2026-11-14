# Guerres Musou — renforts et fronts soumis aux portes/ponts physiques

Date : 31 octobre 2026. Base `e6e3ea4e96ec2d5dff24a5a7b985a7ae7e3a51fb`, PR #6.

## Problème confirmé

Le suivi des renforts et des régiments était déjà fini dans
`BattleSimulation` : aucune troupe ne naît sans être préallouée.
Toutefois, le routage des unités distantes faisait confiance au seul
`route.open` logique. Le système d'environnement gère indépendamment
de véritables portes et des ponts tactiques destructibles.

Une porte physique fermée **sans ordre de route explicite** pouvait
donc laisser une escouade ou un renfort hors caméra poursuivre
ses waypoints sur une route stratégiquement « ouverte ».

Autre difficulté : une mission ouvre logiquement une route AVANT
de déclencher l'ouverture de ses portes physiques. Tester des
portes encore fermées à cet instant empêcherait de les ouvrir.

## Correctif

- `js/battlefield/PhysicalRouteAvailability.js` lit les portes,
  routes et ponts réellement déclarés dans le layout de la scène.
  **Une route inconnue, un portail inexistant ou un pont détruit
  échoue en mode fermé.**
- Le mode `opening` du validateur accepte une **demande
  légitime d'ouverture** d'une porte existante encore fermée ;
  il continue de refuser les ponts détruits et les IDs
  physiques inventés.
- `BattleSimulation._routeTraversable` vérifie à la fois
  l'autorisation logique et la situation physique fournie
  par le niveau, sans modifier les identités ni la définition
  signée du catalogue.
- Les **ordres de groupe**, **stratégies d'officiers**,
  **tactiques**, **recherches de chemin** et **renforts
  préalloués** utilisent maintenant cet état de passage.
- Pendant un trajet, une porte qui se ferme immobilise
  le groupe **sur ses vraies coordonnées actuelles** ;
  le trajet et les pertes ne sont ni réinitialisés ni
  téléportés au front précédent.
- Une réouverture valide permet de reprendre le
  mouvement en conservant la même escouade.
- `GameApp.startBattleOperation` lie cette autorité
  à `EnvironmentManager`. Elle est active dans le
  combat principal et ne dépend pas du rendu de
  l'acteur ni des FPS.
- Les captures et sauvegardes n'ajoutent aucun
  champ obligatoire : le `configDigest`, les
  effectifs (et les anciens checkpoints) restent
  identiques. La présence physique des portes
  reste propriétaire du système de monde.

Le système demeure **Musou**, pas une sélection
d'unités RTS : le joueur contrôle son chasseur,
les armées alliées et adverses passent ou restent
bloquées selon l'état du terrain.

## Cas testés

Six tests Three.js/Node dans
`tests/musou-physical-routes.test.js` vérifient :

1. itinéraire du catalogue relié aux vrais
   IDs de portes et aux routes physiques ;
2. fermeture pendant le mouvement d'une troupe
   hors caméra, conservation du trajet et
   reprise sans téléportation ;
3. pont tactique détruit même lorsque ses
   portes sont ouvertes ;
4. IDs de portes falsifiés, absence de
   dépenses ou renforts induits par une fermeture ;
5. restauration de checkpoint sous portes
   encore fermées et reprise après réouverture ;
6. ouverture de mission en deux temps (logique
   puis porte physique), sans contournement
   des ponts détruits.

Les tests ciblés Node et le build Vite seront
rejoués dans GitHub Actions. L'intégration WebGL,
les véhicules, les escalators et les
plusieurs étages n'ont **pas encore** été
certifiés par cette seule passe.

### Limites ouvertes

- Détection de collisions intermédiaires pour
  les grands véhicules skimmers et APC ;
- animation des troupes traversant une porte,
  évitement des goulets et des alliés ;
- attaques et réserves sur plusieurs hauteurs
  avec traversée d'escaliers, de rampes,
  navettes et plateformes destructibles ;
- performance 3D sur les plus grands
  fronts en coop ;
- équivalence audiovisuelle 1:1 des armes,
  armures, castes et lieux originaires
  des films, séries, comics et jeux.

Les fonctions, timings et chemins de ce
lot sont des adaptations de gameplay Musou ;
aucun maillage ou mécanisme *AVP: Extinction*
sous licence n'est dupliqué ici.
