# Hive Warriors

Jeu d'action 3D dans le navigateur, réalisé avec Three.js et Vite. Six environnements avec territoires reliés, chasse libre, campagne de cinq chapitres, coopération locale à deux joueurs, forge et arène personnalisée.

## Développement

Archive de livraison : sources et fichiers GLB dans `public/models/`, sans dossier `dist/` pour éviter de dupliquer les modèles. Après extraction, recompiler avec `npm ci && npm run build`, puis lancer `npm run preview`.

Node.js 24 recommandé (`.nvmrc`), npm 11. Chaque tâche cloud dispose déjà d'un checkout isolé : utiliser le dépôt existant sans créer de worktree.

```sh
npm ci
npm run dev -- --port 5173 --strictPort
```

Les polices, Three.js et les confettis sont intégrés au build. Aucun backend, compte ou secret n'est nécessaire pour jouer. La progression et les réglages sont sauvegardés dans le stockage local du navigateur ; ils ne sont pas synchronisés entre appareils.

```sh
npm run build
npm run preview
npm test
```

`npm test` compile la version de production et exécute les tests Node et Chromium. Sur cette machine, Chromium est détecté dans `/usr/bin/chromium`. Ailleurs, utiliser `npx playwright install chromium` ou définir `CHROMIUM_PATH` vers un binaire installé. Les tests WebGL utilisent le rendu logiciel et sont exécutés en série. Ils vérifient des transitions de combat simulées et les parcours d'interface ; ils ne remplacent pas une session de jeu avec des testeurs humains.

## Commandes principales

Les commandes utilisent les positions physiques des touches : WASD en QWERTY, ZQSD en AZERTY.

| Action | Commande |
| --- | --- |
| Déplacement joueur 1 | WASD / ZQSD |
| Attaque légère / lourde | Clic gauche / droit |
| Canon plasma | Majuscule gauche |
| Pause / reprise | Échap ou bouton Pause |
| Roue d'armes | R ou clic milieu |
| Surcharge Musou | Espace ou Q (A en AZERTY) |
| Super-saut | Majuscule + Espace |
| Camouflage | F |
| Modes de vision | V |
| Exécution à proximité | E |
| Photo / quitter le mode photo | O / Échap |
| Cadrer en mode photo | Glisser gauche : orbite ; molette : zoom ; glisser droit : déplacer |
| Déplacement joueur 2 | Flèches |
| Attaques joueur 2 | Entrée, pavé numérique 0 et décimale |

La liste complète figure dans « Options & commandes ». Les gadgets utilisables dépendent de l'équipement choisi. Les menus s'adaptent au mobile ; le combat requiert un clavier et une souris. La coopération est locale sur un même appareil.

Chaque chasseur arrive désormais dans une [capsule avec ouverture et sortie animées](docs/INSERTION.md). Les commandes et le combat commencent après la sortie ; Échap permet de suspendre l'insertion. Les sept secondes de préparation restent disponibles après ce déploiement.

## Vercel

Publication Vercel vérifiée : [ouvrir cette version](https://yautja-hive-warriors.vercel.app). Déploiement READY, HTTP 200 et chargement navigateur sans erreur vérifiés.

`vercel.json` configure Vite, `npm ci`, la sortie `dist`, les en-têtes de sécurité et le cache des ressources versionnées. Node 24 est recommandé dans les paramètres du projet. Le build n'appelle aucun CDN externe.

Pour publier sur un compte déjà connecté à Vercel :

```sh
npx vercel --prod
```

Dans l'environnement cloud, l'API `api.vercel.com` doit être autorisée et l'accès au compte doit être configuré. Ne jamais placer un jeton dans le dépôt ou le chat ; utiliser les paramètres sécurisés. La présence de `vercel.json` et la réussite du build ne prouvent pas qu'une publication a eu lieu.

Voir [QA.md](QA.md) pour le périmètre de validation et les limites connues.

La [refonte graphique](GRAPHICS.md) détaille les corps sculptés continus, les textures PBR jusqu'à 2048², les gros plans et les budgets de distance. Le réglage graphique est disponible dans « Options & commandes » ; les effets s'adaptent automatiquement aux capacités du navigateur.

La passe Meshy du 22/10/2026 guidée par références est suivie dans [docs/meshy/reference-generation.json](docs/meshy/reference-generation.json). **trois modèles intégrés** — deux corps articulés et un biomask rigide séparé. Coûts : 130 crédits consommés pour la passe par références, auxquels s'ajoutent 40 crédits pour les essais textuels historiques. Les fichiers et leurs SHA sont consignés dans les [preuves de validation](docs/qa/validation.json) ; le [suivi par références](docs/meshy/reference-generation.json) conserve les tâches et vérifications. Une fidélité exacte « 1:1 » n'est pas établie.


La passe City Hunter du 23/10/2026 ajoute un corps Meshy corrigé et un masque séparé, avec textures jusqu’à 4096² et deux mèches articulées. Voir la [fiche City Hunter](docs/meshy/CITY-HUNTER.md) et le [rapport de validation dédié](docs/qa/city-hunter-validation.json). Les fichiers marche/course du fournisseur sont destinés à la retouche. La reprise du 24 octobre articule la [console gauche](docs/meshy/CITY-HUNTER-CONSOLE.md) ; les lames et le gantelet droit restent fixes. Cette reconstruction ne valide pas une fidélité 1:1.

La reprise poursuit également la [queue du Big Chap à neuf os](docs/BIG-CHAP-TAIL.md), le [contact visuel et la locomotion du joueur](docs/LOCOMOTION.md), ainsi que le [M577 APC et sa tourelle sur rail](docs/APC.md). Aucun nouveau crédit Meshy n'est consommé par ces corrections locales.

Le build du 24 octobre est validé localement : 336 tests CPU, contrôles navigateur et 19 captures des modèles réels. **Sa publication reste bloquée par le quota quotidien Vercel** ; le domaine public conserve la version précédente. Voir le [bilan et les captures](docs/qa/open-work/README.md), le [rapport de validation](docs/qa/open-work-validation.json) et les [instructions de reprise de publication](scripts/README-publication.md).


La chasse et la campagne utilisent désormais [six territoires reliés par des couloirs](docs/BATTLEFIELDS.md), avec portes ouvertes par éliminations, commandants vaincus ou activation puis défense d’un relais. Le départ laisse sept secondes de préparation après l’insertion ; six ennemis arrivent d’abord, puis les renforts sont échelonnés. Les attaques sont préparées et limitées par joueur, et les Marines soutiennent le combat contre la ruche. La [validation initiale](docs/qa/musou-battlefield-validation.json) suit la première publication ; les nouvelles passes sont distinguées dans [QA.md](QA.md).
