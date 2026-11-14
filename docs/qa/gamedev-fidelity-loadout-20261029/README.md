# Kits de référence, fiches et préparation — 29 octobre 2026

Base exacte : `59179bbac0a44a9e6b30ae1f7ce8fc1b3f9da27a`, PR #5,
branche `codex/gamedev-guides-20261029`.

## Correctifs appliqués

Les quatre champs d’équipement des sept fiches jouables proviennent maintenant du
même registre que le résolveur du joueur. Jungle Hunter ne présente plus une hache
comme secondaire ni des mines dans son kit ; City Hunter affiche son canon
d’épaule, pas le pistolet de Wolf. Feral affiche un lance-projectiles guidés et
Viking sa hache de Hunting Grounds. Les identifiants internes restent inchangés.
Les capacités Musou sont explicitement des adaptations de gameplay.

La préparation utilise les permissions et les valeurs par défaut de ce même
registre. Ses boutons manquants sont créés dans les conteneurs existants : dix
identifiants d’armes sélectionnables dans chaque emplacement en mode adapté et
six identifiants de gadgets, puis filtrage immédiat en mode de référence.
Cela ne signifie pas dix nouvelles armes ou six nouveaux gadgets implémentés.
Les tirs dédiés restent distincts des emplacements d’armes.

Le changement de mode ou de chasseur conserve une sélection propre à chaque
contexte. L’ouverture de l’écran, y compris après replay/campagne, déclenche une
synchronisation par observation de visibilité, sans lecture à chaque image.
Les clics synthétiques sont aussi filtrés, deux gadgets maximum restent autorisés,
le focus quitte une option devenue interdite et la confirmation vérifie à nouveau
le kit. Une double confirmation ne relance pas la mission. Un refus de déploiement
conserve le kit et son message de réessai. Les écouteurs sont libérables.

Le résolveur refuse les identifiants hérités tels que `constructor` ou `__proto__`
et les valeurs d’armes non textuelles sans exécuter leur conversion en chaîne.
Une référence inconnue ne peut pas être présentée comme un kit fidèle prêt à lancer.

## Sources et portée de la fidélité

Les sources déjà associées à Jungle Hunter, City Hunter, Wolf et Feral restent
présentes. Les liens officiels Hunting Grounds/PlayStation complètent les profils
Alpha, Samurai et Viking. Les fiches distinguent les incarnations PHG des films et
ne transforment pas le mode référence en certification de tous les mouvements.

Références contrôlées pour cette passe :

- NECA, Jungle Hunter : https://store.necaonline.com/products/predator-ultimate-jungle-hunter-7-scale-action-figure
- NECA, City Hunter : https://store.necaonline.com/blogs/news/shipping-this-week-predator-2-ultimate-city-hunter-action-figure
- Prime 1 Studio, Wolf : https://www.prime1studio.com/avpr-wolf-predator/REMAVP-01DXS.html
- Prime 1 Studio, Feral : https://www.prime1studio.com/fp-feral-predator/MMPR-07DXS.html
- IllFonic, classes Samurai/Viking/City : https://predator.illfonic.com/
- PlayStation/IllFonic, Alpha et sa faucille : https://blog.playstation.com/2020/07/17/july-free-update-comes-to-predator-hunting-grounds/

Ces références de produits sous licence et d’équipements de jeu corroborent des
éléments du kit. Elles ne constituent ni un inventaire exhaustif des scènes ni des
mesures des accessoires de tournage. Les anciennes listes de permissions sont
préservées, pas nouvellement certifiées dans leur exhaustivité. Les autres origines
textuelles du catalogue de 36 objets restent déclarées et non revérifiées ici.

Guide utilisé : `game-ui-ux`, révision épinglée
`19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9` du dépôt
`gamedev-skills/awesome-gamedev-agent-skills`. Application : affichage lié aux données,
changements événementiels, état de sélection et focus cohérents.

## Vérifications exécutées maintenant

| Vérification | Résultat |
|---|---:|
| Tests Node du registre, des fiches et des invariants | 36/36 |
| Scénarios Chromium du panneau isolé | 20/20 |
| Contrôles de syntaxe JS/MJS | 6/6 |
| Inventaire déterministe et contrôle `--check` | Réussis |
| Conservation des profils d’armes, permissions, valeurs par défaut et gardes d’actions | Réussie |

Les 36 tests Node rejoués sur les trois fichiers exacts de la base produisent
15 réussites et 21 échecs. Les 20 scénarios de panneau sur cette base échouent,
notamment sur les comportements et API qui n’existaient pas encore. Ce ne sont
pas 41 bugs indépendants. Les tests historiques des armes lourdes ne sont pas
additionnés : ils n’ont pas été rejoués dans cette passe.

Une première exécution DOM a trouvé un vrai défaut du correctif : le message d’échec
de déploiement était effacé par le MutationObserver. Il est corrigé et le scénario
passe désormais. Le premier rapport est conservé dans le paquet de preuves.

Environnement : Node 22.16.0, Chromium 144.0.7559.96, pilote Playwright 1.57.0
préinstallé. Ce pilote n’est pas la version 1.64.1 verrouillée du projet. La
navigation HTTP locale a été refusée par la politique de Chromium
(`ERR_BLOCKED_BY_ADMINISTRATOR`). Les tests DOM ont ensuite chargé les modules
en mémoire : seuls leurs spécificateurs d’import ont été remplacés par des URL
Blob. Les corps du résolveur et de LoadoutScreen sont les sources testées, non des
mocks. Aucune politique réseau n’a été désactivée. La fixture conserve la structure
HTML du panneau existant mais pas l’intégralité du CSS ni du jeu.

## Reproduction

Après installation des dépendances verrouillées dans un checkout complet :

```sh
node --test tests/hunter-reference-preparation.test.js
node scripts/audit-hunter-reference-kits.mjs --check
node scripts/qa-hunter-loadout.mjs
npm run build
```

Le runner de navigateur accepte `YHW_BROWSER_TRANSPORT=memory` pour le test DOM
sans navigation réseau. Les chemins du pilote et du navigateur peuvent être
explicités par `YHW_PLAYWRIGHT_MODULE` et `YHW_CHROMIUM_EXECUTABLE` ; ils sont
consignés dans le rapport. `YHW_FIDELITY_SOURCE` permet le rejeu sur une autre
copie exacte sans modifier ses sources. Il ne sélectionne pas une version de dépendance.

## Inventaire et limites restantes

`kit-inventory.json` est généré à partir du code : sept kits, leurs choix,
leurs sources, les 36 entrées de l’index et cinq chantiers encore ouverts.
Un nom dans cet index, une garde d’action ou un bouton ne prouve pas une action
complète ou une fidélité visuelle. Les alias historiques de certains objets ne
sont pas confondus avec une absence d’implémentation.

Seuls trois fichiers de production changent. Aucun modèle, texture, rig,
animation, faction, boss ou carte supplémentaire n’est livré par ce lot.
Les modèles et costumes doivent encore être comparés à leurs incarnations ; les
cartes musou restent des adaptations dont la topologie 1:1 n’est pas mesurée.
La projection des castes/forces humaines/synthétiques et les actions de combat
restent à auditer séparément. Les 126 statuts historiques ne sont pas modifiés.

Le build local a été tenté sur le snapshot partiel et reste bloqué par
`vite: not found` (127). Il n’y a pas eu de `npm ci` complet. La tentative de créer
un environnement Vercel Sandbox a été refusée pour quota Hobby (402), avec
réinitialisation annoncée au 1er novembre 2026, 00:00 UTC. Aucun sandbox n’a été
créé, aucun abonnement modifié et aucun quota contourné.

Les scénarios ci-dessus valident le panneau isolé, pas une partie 3D, les
sauvegardes de campagne, la coopération, la manette ou le responsive complet.
Aucun testeur humain ni revue indépendante n’est revendiqué. La PR doit rester en
brouillon tant que le build verrouillé et la recette du jeu complet restent à faire.
`fidelity1to1Verified` reste **false**.
