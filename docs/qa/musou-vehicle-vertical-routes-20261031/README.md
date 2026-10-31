# Transport Yautja — route, hauteur et terrain praticable

Date : 31 octobre 2026. PR #6.
Base : `e10bb84b2a05e0bc7586266f07dfa2f6644df7b3`.

## Contrat de jeu conservé

Le Skimmer est un véhicule Yautja contrôlable directement dans
le gameplay d'action **Musou**. L'assistance de trajet suit les
routes de l'opération lorsque le conducteur le demande,
**sans** transformer la partie en RTS, téléporter le joueur
ou faire apparaître des renforts.

## Failles corrigées

`OperationTransport._safeRoute` partage désormais la même
autorisation physique que les armées et les renforts :
**portes réelles, existence des routes et ponts tactiques
intacts**, en plus de l'occupation des fronts et de l'absence
d'ennemis proches.

Le pilote assisté ne peut plus être déplacé sur un autre
étage à la suite d'un changement brutal de la hauteur de
terrain entre deux frames :

- Chaque tronçon demande un sol/une hauteur finie et,
  si une navigation physique existe, une empreinte praticable
  pour la capsule de véhicule (rayon 1,2).
- La progression verticale est bornée par la vitesse,
  **au maximum 12 unités de hauteur/seconde** avec
  une tolérance de 0,075 unité par pas pour les petites
  variations du relief.
- Une différence de hauteur impossible, par exemple
  un étage de huit unités sans rampe, **annule
  uniquement l'autopilote** :
  `vertical_transfer_unavailable`. La position
  physique actuelle, l'état monté et le contrôle
  manuel du Skimmer sont conservés.
- Une dalle absente ou un sol impossible annule
  l'assistance avec `route_terrain_unavailable`.
- Les portes, les ponts détruits, les menaces,
  les collisions et les commandes manuelles
  conservent leurs règles préexistantes.

Cette règle évite la téléportation verticale
pendant **l'assistance** ; le véhicule Yautja
reste capable de voler manuellement selon les
commandes et systèmes du jeu. Les animations
d'anti-gravité du Skimmer et leur fidélité
aux médias restent à vérifier.

## Tests

Cinq nouveaux scénarios Node/Three de
`tests/operation-transport-vertical.test.js` :

1. itinéraire en pente : montée progressive
   et arrivée sans changement brusque d'altitude ;
2. rupture de 8 unités entre deux planchers :
   annulation de l'aide au lieu de saut vertical ;
3. sol déclaré non praticable : arrêt sûr
   sans modifier le conducteur ;
4. fermeture en cours de trajet d'une vraie
   porte et destruction d'un pont :
   annulation sans téléportation ;
5. IDs de route et de porte inexistants :
   aucune autorisation d'autopilote.

La suite `tests/operation-transport.test.js`
doit aussi être rejouée : elle exerce un
**vrai EnvironmentManager**, les couloirs,
leurs virages, le montage/démontage et les
rencontres ennemies. Les tests sont ajoutés
au workflow GitHub Actions ciblé. Un
résultat CI ne doit être revendiqué qu'après
la vérification du SHA correspondant.

## Limites restantes

Les mécanismes physiques exacts de navette,
APC et dropship Cheyenne et leurs capacités
de chargement, les véhicules IA escortés,
la navigation sur plusieurs niveaux,
les obstacles mouvants, les rampes complexes
et les contraintes d'anti-gravité selon
les planètes nécessitent des tests dédiés.
La géométrie et la silhouette du Skimmer
ne sont pas certifiées en fidélité 1:1.
Aucun asset canonique sous licence n'est
incorporé dans cette passe.
