# Console du City Hunter — correction locale du 24 octobre 2026

La plaque `model_part11` du corps corrigé contient 740 triangles et 746 sommets. Tous sont pondérés à 100 % sur `LeftForeArm`. Cette propriété permet de remplacer son rendu skinné par la même géométrie rigide, attachée au même os, sans modifier sa surface fermée ni son mouvement avec le bras.

La conversion utilise exactement `inverseBindMatrix × bindMatrix` pour placer la surface dans le repère de l'os. Les indices, UV et matériau PBR de la plaque originale sont conservés. Le matériau est emprunté à l'instance du personnage ; ses textures de génération ne sont ni réencodées, ni remplacées, ni libérées par le mécanisme. Le mesh original est caché pendant l'ouverture du remplacement, puis restauré à la fermeture et au nettoyage.

La charnière est placée au bord supérieur mesuré de la plaque. Son axe suit le grand axe de la surface. Elle peut s'ouvrir d'environ 86 degrés. Un intérieur de console est ajouté derrière elle : support, rails, fixations, contacts, cinq touches et écran à segments lumineux. Cet intérieur ajoute **418 triangles et quatre maillages de rendu**, avec quatre matériaux et une petite texture locale de 256 × 128. Les détails fixes sont regroupés par matériau ; chaque touche ne crée pas un appel de dessin supplémentaire.

L'armure générée était pleine derrière la plaque et cachait l'écran quand elle s'ouvrait. Le mécanisme remplace donc la géométrie de la **seule coque `model_part7` par un clone privé**, dont 276 des 1 932 triangles sont retirés sous la plaque. Les positions, normales, UV et poids restent identiques ; l'index conserve les 1 656 autres triangles dans leur ordre d'origine. Les triangles retenus pour l'ouverture sont tous pondérés à 100 % sur `LeftForeArm`, dans l'empreinte mesurée du couvercle. Chaque sommet et le centroïde de chaque triangle sélectionné ont un impact de rayon sur la plaque fermée, au moins 0,001 unité devant eux. La peau `model_part15` est intégralement conservée. Le support opaque de la console ferme le fond de l'ouverture, devant la peau, sans découpe du bras.

À l'état exactement fermé (`amount === 0`), la vraie plaque et la géométrie originale complète de la coque sont rendues ; le remplacement articulé et l'intérieur sont cachés. Cette bascule évite qu'une petite languette de l'intérieur apparaisse à travers les irrégularités du bord généré. Le clone découpé n'est activé que pendant l'ouverture. La visibilité initiale de la plaque est respectée, y compris si elle était déjà cachée avant l'installation.

**La charnière et l'intérieur sont une interprétation de modélisation locale.** Le résultat ne constitue pas une récupération du mécanisme du film ni une fidélité « 1:1 » certifiée. La surface extérieure provient du véritable modèle Meshy ; les détails internes n'étaient pas présents dans la génération. Les wristblades restent fusionnées à la main : aucune région de pointe n'est déclarée comme une lame complète extraite.

## Utilisation dans le moteur

`installCityHunterMechanisms(adapter, { sourceSha256 })` s'installe sur l'adapter privé du personnage, après sa création. Il accepte uniquement le corps corrigé dont le SHA-256 est `0e297a50400f885f06595f2fb59c85aed5118517a03c140f0f3aefa5288b564b`.

- Identifiant du mécanisme : `city-left-console`.
- Pivot de la vraie plaque : `city-left-console-hinge`.
- Surface mobile : `city-left-console-lid-surface`.
- Intérieur fixe : `city-left-console-board`.
- `trigger('emp' | 'nuke' | 'heal' | 'scan', durée)` ouvre la console, choisit sa signalisation et commande sa fermeture après la durée de simulation.
- `setGauntletOpen('city-left-console', montant)` permet un contrôle explicite entre 0 et 1.
- `update(delta, { paused })` fait progresser le mécanisme ; la pause conserve exactement son état.
- `reset()` referme immédiatement le mécanisme ; `dispose()` restaure la visibilité de la plaque et la référence exacte de géométrie de la coque, puis ne libère que les ressources nouvellement créées.

Les quatre matériaux retournés par `materials` sont privés et doivent rejoindre le registre de camouflage de leur personnage. Le matériau de la plaque originale n'y figure pas : il est déjà possédé par l'adapter importé. Le contrôleur doit être libéré avant l'adapter.

## Contrôles géométriques et limites

`tests/city-hunter-mechanisms.test.js` charge la véritable géométrie et le squelette du GLB livré, en utilisant des textures de substitution pour les tests CPU. Ses huit cas vérifient :

1. Tous les sommets fermés, plusieurs poses du bras, les UV, indices et le matériau emprunté.
2. Le mouvement effectif de la plaque, avec bras et intérieur immobiles, puis son retour exact.
3. Les 276 seuls triangles d'armure ouverts, leurs limites et leur occultation par le couvercle fermé ; conservation de chaque attribut, des autres indices, de toute la peau et des sources en cache ; restauration de la géométrie originale.
4. La pause, les durées, le retour au repos et plusieurs fréquences de simulation.
5. L'indépendance de deux instances coop et l'absence de modification des données mises en cache.
6. Le nettoyage idempotent des seules ressources possédées, dont le clone de coque.
7. Le refus d'un mauvais asset, d'une plaque non rigide ou d'une installation dupliquée.
8. La conservation d'une plaque initialement cachée, au repos, pendant l'ouverture et après nettoyage.

La mesure CPU sur le modèle réel donne une erreur maximale de **4,894 × 10⁻⁸ unité** entre la plaque originale et son remplacement fermé, au repos comme après rotation du bras. Les huit tests passent. Ils vérifient la géométrie et la gestion des ressources ; ils ne remplacent pas un contrôle du rendu.

Le contrôle Chromium séparé charge le véritable `Player`, son corps corrigé, son masque distinct et les textures PBR originales. Sur le gros plan contrôlé, l'écran ouvert est entièrement visible, sans traversée évidente du bras ou de la plaque. La capture fermée et son témoin original après retrait du mécanisme donnent **zéro pixel différent sur 935 000**. Aucune erreur JavaScript n'est remontée. Cette vérification porte sur cette caméra et ces états ; elle ne certifie ni toutes les poses de combat ni une fidélité au film.

Preuves : [console fermée](../qa/city-hunter-console/closed.png), [console ouverte EMP](../qa/city-hunter-console/emp.png), [témoin original](../qa/city-hunter-console/original-closed.png), [rapport de rendu](../qa/city-hunter-console/render-report.json), [comparaison de pixels](../qa/city-hunter-console/closed-pixel-comparison.json), [mesures CPU](../qa/city-hunter-console/real-console-cpu-report.json) et [résultat des tests](../qa/city-hunter-console/tests.log).

Aucun fichier GLB, texture source ou crédit Meshy n'est modifié ou consommé par cette correction locale.
