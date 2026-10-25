# Validation du jeu

Revue du 20 octobre 2026 effectuée par cinq agents QA spécialisés, avec lecture du code, tests automatisés et contrôles dans Chromium. **Aucun testeur humain n'a participé.** Ces vérifications ne couvrent pas toutes les combinaisons de combat, tous les navigateurs ou tous les matériels.

## Parcours et corrections

| Revue | Défauts corrigés et améliorations |
| --- | --- |
| Gameplay | Campagne reliée aux cinq cartes existantes, victoire après le boss final, enchaînement des chapitres, pause/reprise, défaite, replay, retour menu, annulation des effets différés, coopération et exécutions à proximité. |
| Systèmes | Audio et volume global, équipement effectif, nombre d'ennemis demandé, ciblage du joueur coop vivant le plus proche, morts alliées et facehuggers, énergie des boss, capsule d'insertion, libération des ressources GPU et budgets de particules. |
| Interface | Menu restructuré, sélection au clavier, focus et libellés accessibles, un écran actif à la fois, retours de navigation, réglages persistants, données locales invalides, Forge avec dépenses persistantes, petits écrans et sélection de la qualité graphique. |
| Graphismes | Modèles procéduraux détaillés et articulés pour le chasseur, les créatures, les alliés et les véhicules ; textures PBR partagées ; éclairage, ciels par biome, brouillard, pluie/spores en lots ; trois qualités de rendu, ombres et effets adaptés aux capacités graphiques ; redimensionnement et écran partagé. |
| Niveaux | Correction du champ manquant qui empêchait l'apparition des décors, six arènes différenciées avec relief et surfaces texturées, végétation et détails architecturaux, insertion dégagée, voies cardinales et anneau de circulation, repères lumineux, collisions, bornes et évitement local des obstacles par les ennemis au sol. |

## Refonte graphique

Les descriptions et captures procédurales ci-dessous proviennent de la revue du 20 octobre 2026. Elles restent des preuves historiques ; les modèles importés de cette passe ont leurs vérifications séparées dans docs/qa/validation.json.

La [description de la refonte](GRAPHICS.md) détaille les modèles, les budgets de géométrie et les pipelines de rendu. Le chasseur utilise maintenant un corps continu aux proportions adultes (environ 7,2 têtes), un masque profilé, des dreadlocks courbes, un filet projeté sur la peau, des plaques ajustées et des armes attachées aux articulations. Les créatures possèdent des crânes allongés, des côtes, des griffes et des queues segmentées. Les accessoires et les pièces mobiles conservent leurs points d'articulation pour les animations existantes.

Les surfaces utilisent des cartes PBR de couleur, de normales et de rugosité : **2048 × 2048** pour la peau du chasseur, la chitine et l'armure, **1024** pour la peau humaine et plusieurs surfaces du décor, **512 ou 256** pour les autres familles. Ces textures sont générées localement et partagées entre les matériaux, sans téléchargement externe. Les géométries des hordes et des boss sont mises en cache entre les vagues ; les détails sont regroupés par matériau et articulation, et la végétation utilise des instances. Le cache des données sources reste sous 224 Mio, distinct de la consommation GPU totale. Les matières ont des rugosités et réflexions séparées ; peau humaine et pigmentation du chasseur utilisent des cartes différentes.

| Qualité | Pipeline prévu |
| --- | --- |
| Fluide | Éclairage PBR et rendu direct, ombres 1024. |
| Équilibrée | Bloom discret, FXAA et conversion ACES, ombres 1536. |
| Élevée | Même traitement avec occlusion ambiante SSAO, ombres 2048. |

Le choix persiste dans le navigateur. Les modèles et textures gardent leur détail dans les trois modes. Les capacités limitées et le rendu logiciel entraînent une adaptation des effets ; les ombres passent à 512 sur un moteur logiciel. La coop utilise deux vues en rendu direct pour éviter de mélanger les effets des deux caméras. Le mode photo permet orbite, zoom et déplacement du cadrage ; les captures PNG incluent le rendu final. Pause, photo et menus ne relancent pas continuellement le rendu GPU sans changement. Les créatures utilisent trois géométries selon la caméra la plus proche, sans perdre leurs parties articulées.

## Reproduire les contrôles

```sh
npm ci
npm test
npm audit
```

La suite compile les vrais fichiers de production. Les tests navigateur couvrent notamment le chargement sans CDN externe et sous la politique CSP configurée pour Vercel, les menus et réglages, une mission solo, les déplacements, la pause, une exportation PNG du mode photo, la défaite, le replay, le nettoyage, la campagne, la coopération et les écrans de 390 pixels.

Les contrôles graphiques portent sur les budgets de triangles et de meshes, les positions finies, les UV et normales, les surfaces PBR, les caches de géométrie et de textures, le partage des ressources, leur libération et les articulations des modèles. Ils couvrent aussi les trois pipelines graphiques et leurs réglages persistants. L'exécution des effets élevés à petite résolution dans Chromium logiciel vérifie leur fonctionnement ; elle ne mesure pas une fréquence d'images sur une carte graphique réelle.

Résultat de la publication du 22/10/2026 : **156 tests réussis, 0 échec, 0 annulé, 0 ignoré**. L'audit npm du 22/10/2026 indique **0 vulnérabilité connue**. Voir les [résultats et empreintes](docs/qa/validation.json) et la [sortie complète des tests](docs/qa/test-output.txt).

Les tests de campagne abrègent volontairement les rencontres en simulant la fin des vagues et les dégâts mortels aux boss. Ils vérifient le vrai cycle de mission et la progression des cinq chapitres ; ils ne constituent pas un playthrough humain. Les tests de niveau vérifient aussi les trajets simulés autour des décors. Les tests système couvrent les ressources partagées, les effets annulables et le contournement d'un obstacle par une horde poursuivant le joueur coop le plus proche.

## Captures et conditions de comparaison

| Capture | Ce qu'elle permet de vérifier |
| --- | --- |
| [Menu sur ordinateur](docs/qa/menu-desktop.png) | Hiérarchie, navigation et action solo. |
| [Menu mobile](docs/qa/menu-mobile.png) | Accès aux choix du jeu sans débordement horizontal. |
| [Mission en production](docs/qa/mission.png) | Vraie navigation jusqu'à la mission, HUD complet après l'insertion et état réel du combat, avec ses effets et son encombrement. |
| [Chasseur avant](docs/qa/sculpt-before-hunter.png) / [après](docs/qa/after-hunter.png) | Détail et silhouette du modèle, avec la même caméra contrôlée. |
| [Environnement avant](docs/qa/sculpt-before-environment.png) / [après](docs/qa/after-environment.png) | Géométrie, végétation et surfaces du terrain, avec la même caméra et la même carte. |
| [Créatures avant](docs/qa/sculpt-before-creatures.png) / [après](docs/qa/after-creatures.png) | Détail et proportions des modèles de créatures. |
| [Gros plan du chasseur](docs/qa/sculpt-hunter-head.png), [guerrier](docs/qa/sculpt-warrior-profile.png), [Marine](docs/qa/sculpt-marine-face.png) | Surfaces et silhouettes examinées dans une scène de contrôle sur fond neutre. |

Les comparatifs du chasseur et de l'environnement utilisent un état de présentation contrôlé : simulation en pause, interface et autres acteurs masqués, cadrages identiques entre les deux versions. Ils servent à comparer les graphismes et ne sont pas présentés comme un combat. La capture `mission.png` provient au contraire d'un vrai parcours dans l'interface et conserve les effets visibles lors de sa prise.

Les captures de contrôle détaillées des agents sont conservées dans `/workspace/qa/` sur l'environnement de travail. Les images ne prouvent ni un gain de fréquence d'images ni une conformité d'accessibilité exhaustive.

Passe Meshy précédente du 22/10/2026 : **trois modèles intégrés** — deux corps articulés et un biomask rigide séparé. Coûts : 130 crédits consommés pour la passe par références, auxquels s'ajoutent 40 crédits pour les essais textuels historiques. Les fichiers et leurs SHA sont consignés dans les [preuves de validation](docs/qa/validation.json) ; le [suivi par références](docs/meshy/reference-generation.json) conserve les tâches et vérifications. Une fidélité exacte « 1:1 » n'est pas établie.

## Limites et publication

- Le combat nécessite un clavier et une souris ; les menus sont adaptés au mobile. La coop est locale, sans multijoueur réseau.
- Les modèles procéduraux et les modèles générés restent des interprétations. La revue visuelle, les rigs des deux corps et l'intégration du biomask sont contrôlés séparément ; une ressemblance exacte « 1:1 » et une qualité de production photoréaliste ne sont pas attestées.
- Les budgets de géométrie, les caches et les qualités graphiques bornent certains coûts ; ils ne garantissent pas un nombre d'images par seconde sur le matériel des joueurs. Les données sources des textures ne représentent pas toute la mémoire GPU consommée.
- Le contournement de l'IA est local, sans navmesh globale ; les attaques aériennes et charges conservent leurs trajectoires spéciales.
- En combat dense, les gros ennemis et les effets de corrosion peuvent masquer partiellement le joueur. Le dosage visuel et l'équilibrage méritent un playtest humain.
- La progression reste locale au navigateur. En navigation privée ou lorsque le stockage est bloqué, le jeu fonctionne sans garantie de conservation.
- Chromium/WebGL logiciel est utilisé pour les contrôles automatisés ; Safari, Firefox, matériel graphique réel et sessions d'endurance prolongées restent à tester.
- Publication Vercel vérifiée : [ouvrir cette version](https://yautja-hive-warriors.vercel.app). Déploiement READY, HTTP 200 et chargement navigateur sans erreur vérifiés.


## City Hunter — passe du 23/10/2026

Les 75 crédits approuvés ont produit le corps, son découpage, les textures PBR, le rig et un masque séparé. La [fiche City Hunter](docs/meshy/CITY-HUNTER.md) détaille les corrections locales et leurs limites. Le [rapport de cette passe](docs/qa/city-hunter-validation.json) distingue la régression générale, les tests ciblés, le contrôle du modèle réel et la publication. Les clips fournisseurs restent des fichiers de retouche ; ils ne sont pas activés en jeu. Aucun testeur humain ni fidélité 1:1 n’est déclaré.


## Niveaux et pression de combat — 23 octobre 2026

Le [rapport de cette passe](docs/qa/musou-battlefield-validation.json) distingue la suite CPU, les contrôles navigateur, le parcours accéléré de campagne et la vérification de production. La suite CPU complète compte 269 réussites, puis six tests ciblés valident la dernière règle d’introduction. Les tests ne modifient pas les PV ni les protections du joueur pour prouver la survie au démarrage. Les traversées de campagne utilisent une simulation accélérée et contrôlée des déplacements et éliminations réels ; elles ne représentent pas un playthrough humain.


La version du 23/10/2026 est publiée et vérifiée à l’adresse Vercel : index, cinq bundles et douze fichiers GLB conformes aux empreintes locales. Les 13 cas de régression navigateur sont résolus et passent, puis la session HTTPS City Hunter valide ses modèles, le HUD, les collisions des portes, les premiers objectifs et le relais. La [vue de début de mission](docs/qa/battlefield-city.png) est une capture contrôlée sur le site public, après la fin naturelle de l’insertion ; elle ne représente pas un playtest humain.

## Insertion animée et véhicules — 23 octobre 2026

La [nouvelle insertion](docs/INSERTION.md) cache les joueurs pendant le vol, ouvre deux portes articulées, fait sortir les personnages et rend ensuite les commandes avec sept secondes de protection. Deux capsules sont utilisées en coopération. Les collisions, les lames maintenues dans la cabine, la pause, la relance et le nettoyage ont leurs contrôles dédiés. Le skimmer et le Cheyenne reçoivent aussi des corrections de géométrie, d'orientation et de propulsion.

Le build final réussit **292 tests CPU et utilitaires**, sans échec ni test ignoré. Les **14 cas distincts de régression navigateur** passent sur le premier build d'insertion, après adaptation de deux parcours de test pour contourner la nouvelle coque solide. La dernière correction de pose des lames est ensuite vérifiée sur les sept variantes procédurales ; les cas navigateur d'insertion et de rendu sont rejoués sur le build final. Les résultats et leurs empreintes respectives sont distingués dans [le rapport dédié](docs/qa/insertion-validation.json), avec douze vues locales City Hunter, Wolf et Jungle Hunter.

La version finale est publiée sur [Vercel](https://yautja-hive-warriors.vercel.app). Les 29 fichiers statiques correspondent au build validé, dont les douze GLB et les cinq bundles. La vérification HTTPS de l'application réussit dix phases City Hunter/co-op : santé complète, combat suspendu jusqu'à la sortie, sept secondes de protection au transfert des commandes, nettoyage complet et zéro erreur JavaScript, CSP ou chargement. Voir [le relevé public](docs/qa/insertion/live-cinematic-report.json) et [la sortie en production](docs/qa/insertion/live-city-exiting.png).

Ces contrôles étaient ceux de la passe d'insertion du 23 octobre. L'état des mécanismes repris le 24 octobre est conservé dans [la revue des modèles](docs/MODEL-FIDELITY-AUDIT.md). Aucun crédit Meshy supplémentaire n'a été consommé dans cette passe.

## Reprise des chantiers — 24 octobre 2026

La reprise développe la [console City Hunter](docs/meshy/CITY-HUNTER-CONSOLE.md), la [queue et les appuis du Big Chap](docs/BIG-CHAP-TAIL.md), la [locomotion du joueur](docs/LOCOMOTION.md), le [M577 APC](docs/APC.md) et les [relais à défendre](docs/BATTLEFIELDS.md). Cinq agents IA ont effectué des revues indépendantes ; aucun testeur humain n'est déclaré. La plaque fermée City Hunter est identique à l'original dans le cadrage contrôlé, avec zéro pixel différent. La fidélité cinématographique 1:1 reste non établie.

Le build corrigé passe **336 tests CPU et utilitaires**, sans échec ni test ignoré. La première suite navigateur compte 14 réussites sur 15 ; son test d'état partiel du relais supposait une arrivée avant expiration de la grâce et n'isolait pas les morts secondaires. Le parcours corrigé attend un vrai renfort et conserve la preuve d'un état partiel avec sas fermé. Les trois cas ciblés relais, campagne complète sur cinq cartes et rendu passent sur le build final ; le premier échec reste archivé. Le [rapport de reprise](docs/qa/open-work-validation.json) distingue les builds et les contrôles.

Le contrôle final dans l'application passe avec **19 captures**, zéro erreur JavaScript, zéro échec de chargement et aucune requête externe. Il exerce City Hunter et Jungle Hunter importés, leurs masques, la console et l'EMP, la coopération, la caméra FPS à 10/30/60/120 images par seconde, les sommets réels de queue et de pieds Big Chap, le relais, l'APC du quatrième territoire et le nettoyage complet. Deux premières tentatives du nouveau harness ont été conservées : une tolérance d'appui de 10⁻⁸ et une comparaison acceptant les deux signes de zéro corrigent des assertions numériques sans modifier la production. Voir les [captures commentées](docs/qa/open-work/README.md).

**La publication du build corrigé est bloquée par le quota quotidien Vercel** (`api-deployments-free-per-day`, plus de 100 créations). Aucun candidat final n'a été créé ou promu ; le candidat intermédiaire reste retenu et le domaine public conserve la version précédente. Le staging final est préparé sans modifier la facturation, l'équipe ou le projet.
