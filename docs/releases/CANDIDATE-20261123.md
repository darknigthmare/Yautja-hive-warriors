# Candidat de livraison du 23 novembre 2026 (mis à jour en fin de journée)

**L’auteur publie lui-même sur Vercel.** Ce document fige le candidat et ses preuves ; aucune action distante n’a été lancée depuis la session.

## Candidat

| Élément | Valeur |
| --- | --- |
| Branche source | `master` / `main` (avance rapide depuis `claude/fervent-volta-hmhdfw`) |
| Dernier commit de code vérifié | `ab219c3` (appels de dessin) |
| Commits suivants | `9ade35b`, `816cbcb`, `ad8a136` : documentation et références Meshy, sans code de jeu |
| Build | `vite build` (configuration `vercel.json` : `npm ci`, `npm run build`, sortie `dist`) |
| `dist/index.html` SHA-256 | `001a62d5efd7f4d2a538b4853710c4fde06efb6f2226597ebe38ba02214e5782` (build local du 23 novembre) |
| Taille de `dist` | 472 Mo, 67 fichiers, dont 468 Mo de modèles GLB |
| Plus gros fichier | `models/big-chap-rigged.glb`, 57 Mo |

**Les modèles ont grossi.** Ils passent d’environ 355 Mo à 490 Mo dans `public/models`, avec les modèles Meshy ajoutés du 16 au 22 novembre : meute, officier, corps sans masque et biomasques. Vérifier les limites du plan Vercel avant la publication.

Le contenu de `index.html` dépend de la version des outils de build. Une empreinte différente sur Vercel n’est donc pas en soi une anomalie. Comparer plutôt le commit déployé.

## Preuves sur le code livré (`ab219c3`)

| Contrôle | Résultat |
| --- | --- |
| Suite Node complète | 1 689 réussis, 0 échec, 1 ignoré |
| Tests navigateur (`browser`, `gameplay`, `render-browser`) | 16 / 16 |
| Stress de contre-flux AUD-063 | 114 cas, 0 échec |
| Catalogue (`sync-battle-catalog --check`) | réussi |
| Chasses nouvelles lancées dans Chromium | LV-223, Hadley’s Hope, Fiorina 161, Nostromo, USM Auriga : aucune erreur de page |
| Appuis d’époque dans Chromium | Huey à Val Verde, Black Hawk à Gunnison, refus à Fiorina |

Rapports détaillés :
- `docs/qa/hunts-hadley-fiorina-20261123/`
- `docs/qa/hunts-nostromo-auriga-20261123/`
- `docs/qa/era-support-20261123/`
- `docs/qa/boss-balance-20261123/`
- `docs/qa/draw-calls-20261123/`
- `docs/qa/perf-pass-20261122/`

## Ce qui n’est pas prouvé

- Aucune partie complète jouée par un humain sur ces chasses.
- Aucun temps GPU ni nombre d’images par seconde sur matériel réel.
- Les réglages de jeu (Runner, Nostromo, Reine à 7 500 PV) restent à valider en partie réelle.

## Après publication : contrôle suggéré

1. Ouvrir le site publié et lancer une des nouvelles chasses, par exemple Hadley’s Hope.
2. Vérifier la console du navigateur : aucune erreur de page.
3. À l’insertion à Val Verde, le HUD doit afficher « APC INDISPONIBLE | HUEY ».
