# Passe sur les appels de dessin (23 novembre 2026)

**Choix de l’auteur.** Réduire les appels de dessin, mesurés par compteurs. Ce conteneur rend sur le processeur (SwiftShader) : aucun temps GPU n’est mesuré, et aucun gain en images par seconde n’est revendiqué.

## Mesure

Script conservé hors dépôt : `draw.mjs`, dans le dossier de travail de la session.

- **Build** : production, Chromium sans interface.
- **Partie** : chasse lancée depuis le menu, insertion terminée, puis 120 mises à jour.
- **Compteur** : `renderer.info.render.calls` sur un rendu de la vue de jeu.

| Chasse | Avant | Après | Écart |
| --- | ---: | ---: | ---: |
| Hadley’s Hope | 288 | 207 | −28 % |
| Station Renaissance (Romulus) | 292 | 212 | −27 % |
| LV-223 | 263 | 178 | −32 % |
| Val Verde | 254 | 233 | −8 % |

Les triangles ne changent pas sensiblement : la même géométrie est dessinée, en moins d’appels.

## Ce qui est fait

Après la construction des mécanismes et le regroupement existant des repères (`batchReferenceLandmarks`), `instanceIdenticalDetails` parcourt chaque groupe de décor de secteur. Les enfants directs qui partagent exactement la même géométrie et le même matériau deviennent une seule `InstancedMesh`, avec leurs matrices locales d’origine.

Le regroupement ne normalise aucune géométrie et ne recolore aucun matériau : l’image est inchangée.

Restent des nœuds vivants :
- les maillages tenus par un champ de l’environnement (mécanismes, colliders, récupération) ;
- les maillages nommés ;
- ceux qui portent des données (`userData`) ;
- ceux qui ont des enfants ;
- les maillages transparents, animés (morphing, peau) ou munis d’un rappel de rendu.

La visibilité par secteur (streaming) s’applique toujours au groupe.

## Vérification

- **`tests/identical-detail-instances.test.js`** : matrices conservées ; maillages tenus, nommés, porteurs de données et transparents laissés tels quels.
- **Suite Node complète** : 1 689 réussis, 0 échec, 1 ignoré.
- **Comparaison d’images avant/après** (Hadley’s Hope, LV-223, Romulus, même vue d’insertion) : 0,13 à 1,57 % de pixels diffèrent de plus de 24 niveaux. Ces différences se limitent à l’annonce du HUD, qui s’estompe à un instant différent (`romulus-before-after-diff.png`).

## Ce qui reste

- **Les créatures** : 30 à 50 appels selon la vague. Chaque créature dessine ses parties séparément.
- **Les capsules et engins d’insertion** : environ 20 appels.

Les regrouper demanderait un atlas de matériaux ou une animation par instances : c’est un chantier distinct.
