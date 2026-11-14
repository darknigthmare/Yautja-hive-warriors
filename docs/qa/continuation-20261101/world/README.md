# Secteurs et circulation — reprise du 1er novembre 2026

Base : `03f37b4`, après lecture de `AGENTS.md`, du workflow local et des guides `level-design` et `game-ai` épinglés au commit `19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9`.

## Changement jouable

Les secteurs distinguent une approche d’observation, le centre de décision réel et le front de progression. La poche arrière n’accueille plus de nouvelle matérialisation de vague via `getSpawnPoint` ; ce n’est pas une zone invulnérable et les poursuivants restent présents. Les réserves, identités, dégâts, PV et plafond détaillé commun de 32 ne changent pas.

Les extensions disposent désormais de deux silhouettes architecturales distinctes au minimum dans chaque secteur hors insertion : monticules bas et côtes hautes fendues pour la ruche ; linteaux et ateliers bas pour les ruines ; abris, bois empilé ou mâts selon le rôle forestier ; machines et mâts pour les installations. Les coordonnées des sites et les ancrages de l’insertion restent ceux de la base. Les matériaux et géométries restent possédés, fusionnés, éliminés et streamés par les systèmes existants.

Les rails incrustés de l’approche rejoignent l’objectif réel. Les doubles chevrons de contournement et chevrons simples de progression restent présents ; les crochets ouverts identifient l’espace d’observation hors HUD. Il s’agit de signaux originaux de gameplay, sans prétention de reproduction filmique.

Dans un passage réel, deux directions opposées reçoivent des lignes latérales distinctes. Le mouvement dépense toujours le pas de son manager, respecte porte fermée, capsule, sol et obstacle, puis rejoint sa destination après le passage. Une grande capsule ne reçoit pas de voie artificiellement trop étroite. Le cache du trajet stratégique réutilise le même cycle d’invalidation que les portes, ponts et obstacles du système existant.

Le plan expose surface et population souhaitée du secteur ainsi que distance et temps de déplacement sans opposition dérivés du `moveSpeed` Jungle Hunter, style équilibré. Ces nombres ne sont ni une mesure de densité simultanée réelle, ni un étalonnage en mètres, ni une promesse de temps de parcours sous le feu.

## Contrôles et limites

Le test `battlefield-sector-planning.test.js` vérifie 34 cartes × 2 graines pour la cohérence des zones et des temps, les placements de renfort autour de deux joueurs, les silhouettes architecturales et 32 capsules en circulation réciproque sur un vrai corridor de chacun des 11 contextes. Ce stress utilise le déplacement/collision du moteur ; il ne représente pas 32 modèles/IA se poussant réellement les uns les autres.

Le passage navigation/planification réussit19/19 tests en61,431secondes avant le dernier raffinement de clé du cache. Après inclusion de l’ID du corridor courant dans cette clé, six régressions ciblées passent en10,800secondes : porte/obstacle, recherche de trajet réutilisée puis invalidée par porte/changement de corridor, et les quatre cas de l’héliport. `manifest.json` épingle les six fichiers du système, le test et les rapports en distinguant leurs étapes.

`tests.txt` conserve122/122 contrôles réussis en246,710secondes, comprenant constructions de34 cartes et68 variantes semées, sol, géométrie, cheminement et streaming. La mise en cache a été ajoutée pendant cette exécution ; celle-ci n’est donc pas une recette intégrée sur un SHA gelé. Le coordinateur réalise la suite finale et la revue navigateur sur la version intégrée.

Aucune clôture automatique de l’Excel n’est demandée : AUD-055/057/063/067/070 progressent, mais lisibilité humaine, relevé exhaustif des secteurs historiques, stress complet des formations opposées et densité mesurée en bataille restent à confirmer. AUD-059 ne devient pas une certification de géographie1:1. Aucun crédit Meshy consommé, ni nouvelle texture photographique ou modèle importé annoncé.


## Correctif final : effets moteurs environnementaux

La dernière revue a trouvé un blocage réel : l’azote définissait une vitesse nulle que la horde ne restaurait jamais ; vapeur et électricité modifiaient aussi la vitesse directement ou la restituaient d’après une espèce supposée. L’environnement possède désormais une instance du propriétaire partagé `TemporaryCombatEffects`. Azote et tour cryogénique immobilisent les déplacements pendant une durée finie ; vapeur, choc, liquide de stase, ammoniaque, fréon, abattoir, goudron et inhibiteur emploient des contributions bornées. Les volumes continus renouvellent leur contact sans multiplier cumulativement la vitesse.

L’expiration utilise l’horloge de simulation de l’environnement, respecte pause/photo, conserve le ralentissement d’un autre chasseur et restaure une nouvelle vitesse de phase effectivement écrite. La reconstruction abandonne uniquement la contribution environnementale. Les matériaux partagés des créatures ne sont plus recolorés et aucun `origColor` n’est ajouté. Le volume bleu reste le signal visuel. Le libellé de l’inhibiteur ne promet plus un blocage du crachat acide que le moteur n’exécutait pas.

`environment-effects-final.txt` réussit **34/34 tests en18,615secondes**, dont12 scénarios environnementaux, trois cas de contribution partagée du helper et19 régressions existantes de décors/Prey. `environment-effects-reviewed.json` épingle séparément les fichiers après ce correctif ; `manifest.json` plus haut décrit l’étape de navigation antérieure. Le guide `game-feel` épinglé a été consulté pour garder les signaux temporaires et préserver la simulation.

Une vitesse nulle borne la locomotion ; ce correctif n’invente pas un étourdissement global des attaques. Les anciens étourdissements explicitement minutés restent gérés par la horde. La matrice exhaustive des états hérités, la recette navigateur intégrée et la clôture éventuelle d’AUD-091 restent distinctes.


## Revue tardive : contact du pont et arrivée exacte

La suite globale a retrouvé une ancienne sonde qui demandait à un résolveur de mouvement de laisser chaque placement strictement inchangé. Le test conserve maintenant cette exigence physique via `resolveMovement`, puis un parcours persistant dans les deux sens vérifie le vrai contrat de déplacement : seek déjà avancé, un seul pas horizontal, pente continue, pied sur le support exact et arrivée réelle.

Ce nouveau parcours a révélé un défaut concret supplémentaire : près du but, le sélecteur ignorait les nœuds finaux proches et redonnait priorité à une extrémité lointaine du corridor. Un marcheur demeurait à1,71774 unité de sa destination. L’échec23/24 reste conservé dans `tactical-contact-regression.txt`.

Le commit `a80070c` borne maintenant une approche locale à4 unités, différence de hauteur≤0,65, sol continu et segment libre pour la capsule. Le point d’arrivée exact remplace alors les étapes stratégiques. Les contrôles négatifs gardent portes, mur, couches et gouffre détruit ; les déplacements physiques sont exécutés, pas seulement les vecteurs de chemin interrogés.

`tactical-arrival-final.txt` réussit **30/30 tests en106,777secondes**, sans échec ni skip : deux sens du pont, supports/impacts, destruction/réparation, vrai USCM, héliport Working Joe, traversée civile et circulation réciproque de32 capsules dans11 contextes. `tactical-arrival-reviewed.json` épingle code, tests et rapports. Les preuves antérieures restent distinctes de ce correctif ; la recette navigateur et la suite complète du nouveau build restent au coordinateur.
