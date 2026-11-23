# Candidat de livraison du 23 novembre 2026 (mis à jour en fin de journée)

**L’auteur publie lui-même sur Vercel.** Ce document fige le candidat et ses preuves ; aucune action distante n’a été lancée depuis la session.

## Candidat

| Élément | Valeur |
| --- | --- |
| Branche source | `master` / `main` (avance rapide depuis `claude/fervent-volta-hmhdfw`) |
| Dernier commit de code vérifié | `1a95130` (corps des créatures fusionné) |
| Commits suivants | documentation seulement (notes et fiche) |
| Build | `vite build` (configuration `vercel.json` : `npm ci`, `npm run build`, sortie `dist`) |
| `dist/index.html` SHA-256 | `8038408baf2175f0114e160e55cadf93666e793289ab3dcda38e1eb441ef02ca` (build local de `1a95130`) |
| Taille de `dist` | 489 Mo, 70 fichiers, surtout des modèles GLB (dont le Runner de Fiorina, 18 Mo) |
| Plus gros fichier | `models/big-chap-rigged.glb`, 57 Mo |

**Les modèles ont grossi.** Ils passent d’environ 355 Mo à 490 Mo dans `public/models`, avec les modèles Meshy ajoutés du 16 au 22 novembre : meute, officier, corps sans masque et biomasques. Vérifier les limites du plan Vercel avant la publication.

Le contenu de `index.html` dépend de la version des outils de build. Une empreinte différente sur Vercel n’est donc pas en soi une anomalie. Comparer plutôt le commit déployé.

## Preuves sur le code livré (`1a95130`)

| Contrôle | Résultat |
| --- | --- |
| Suite Node complète | 1 716 réussis, 0 échec, 1 ignoré |
| Tests navigateur (`browser`, `gameplay`, `render-browser`) | 16 / 16 |
| Stress de contre-flux AUD-063 | 135 cas, 0 échec |
| Catalogue (`sync-battle-catalog --check`) | réussi |
| Chasses nouvelles lancées dans Chromium | LV-223, Hadley’s Hope, Fiorina 161, Nostromo, USM Auriga, Sevastopol, Gateway, Paradise, pyramide mise à jour : aucune erreur de page |
| Appuis d’époque dans Chromium | Huey à Val Verde, Black Hawk à Gunnison, refus à Fiorina |

Rapports détaillés :
- `docs/qa/hunts-hadley-fiorina-20261123/`
- `docs/qa/hunts-nostromo-auriga-20261123/`
- `docs/qa/era-support-20261123/`
- `docs/qa/boss-balance-20261123/`
- `docs/qa/draw-calls-20261123/`
- `docs/qa/hunts-sevastopol-gateway-paradise-20261123/`
- `docs/qa/bouvetoya-update-20261123/`
- `docs/meshy/runner/`
- `docs/qa/perf-pass-20261122/`

## Ce qui n’est pas prouvé

- Aucune partie complète jouée par un humain sur ces chasses.
- Aucun temps GPU ni nombre d’images par seconde sur matériel réel.
- Les réglages de jeu (Runner, Nostromo, Reine à 7 500 PV) restent à valider en partie réelle.

## Après publication : contrôle suggéré

1. Ouvrir le site publié et lancer une des nouvelles chasses, par exemple Hadley’s Hope.
2. Vérifier la console du navigateur : aucune erreur de page.
3. À l’insertion à Val Verde, le HUD doit afficher « APC INDISPONIBLE | HUEY ».
