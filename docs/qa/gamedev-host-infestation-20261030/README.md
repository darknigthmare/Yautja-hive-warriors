# Cycle d’hôte limité — Facehugger / Marine — 30 octobre 2026

## Sources et exactitude

Le manuel d’*Aliens versus Predator: Extinction* (2003) explique que
les Facehuggers infestent des hôtes et que l’espèce de l’hôte
détermine le transbreed obtenu. Les systèmes de capture et de
reproduction de ce RTS sont distincts de la chasse en 3D de
Yautja Hive Warriors.

Références :
- [Manuel Extinction, Alien reproduction et gathering hosts](https://db.hfsplay.fr/files/2019/09/19/Aliens_Versus_Predator_-_Extinction_001_kgcGTen.pdf)
- [GameSpot, critique de 2003 et espèces dérivées des hôtes](https://www.gamespot.com/reviews/aliens-versus-predator-extinction-review/1900-6072952/)
- [AvP Galaxy, formes et hôtes](https://www.avpgalaxy.net/games/avp-extinction/aliens/)

Les **8 secondes** d’incubation et les règles de portée sont des
choix du projet, pas des valeurs reprises du jeu. Une nouvelle
projection `HostParasiteAttachment.js` dessine sur le visage du
Marine une étude procédurale de Facehugger à huit doigts, queue
incurvée et carapace. Elle reste attachée après reprise de
checkpoint, sans duplication de maillage ; elle est détruite
avec l'acteur physique. **Ce n'est pas un scan ni une silhouette
1:1 vérifiée**. Le système
**ne génère pas encore de Chestburster ni d’adulte** : il retire
définitivement l’hôte au terme du délai, avec un événement
`adultGenerated:false`. Cela évite de créer un Alien gratuit
ou de recycler une unité de réserve déjà allouée comme
si elle venait de naître.

## Défaut corrigé

Dans l’ancien code, le Facehugger de la bataille détaillée
pouvait sauter sur un Marine, se retirer de sa collection de
rendu, mais **rester vivant dans la simulation stratégique**.
Un changement de caméra/LOD provoquait ensuite la
dématérialisation du groupe et le parasite était susceptible
de réapparaître comme s’il n’avait jamais été consommé.

De plus, l’immobilisation du Marine s’arrêtait après quatre
secondes sans état d’infection autoritaire et sauvegardé.

## Systèmes reliés

**Nouveau `js/battlefield/HostInfestation.js`** : seule une
unité source allouée de type `facehugger`, vivante, active,
hostile et à moins de cinq unités d’un **Marine humain
biologique** vivant et actif peut déclarer l’infestation.
Les synthétiques, Working Joes, Exosuits et Flametroopers
protégés sont exclus, de même que les ennemis neutres,
les hôtes déjà infestés et les hôtes hors de portée.

**`BattleSimulation`** :

- `beginHostInfestation(facehuggerId, hostId)` rend
  l’infection atomique et associe à l’hôte la source,
  la faction, la date de début et d’échéance.
- Le Facehugger est consommé comme **une perte réelle
  de son identité**, sans récompense de mise à mort
  ni régénération à la sortie de l’écran.
- L’hôte est marqué `incapacitated`, ne peut plus
  être utilisé comme soldat actif, puis finit par
  mourir de l’incubation au terme de huit secondes.
  Cette mort est créditée à la faction qui a
  réellement implanté le parasite, sous réserve des
  règles de faction déjà applicables.
- Toute mort anticipée nettoie l’infection en attente.
  La suite logique œuf et naissance d’un Alien
  **reste volontairement absente**, car son insertion
  doit découler d’une population et d’hôtes réels.

**`BattleActorSupport`** : le `targetView` du
Marine traite l’implantation avec les deux IDs du
combat, refuse les attaques interdites et conserve
une immobilisation de l’acteur physique pendant
l’incubation. Les immunités sont indiquées
explicitement sur le proxy.

**`XenomorphHorde`** : le Facehugger n’est
désormais consommé que si le receveur accepte
vraiment la tentative de latch. Un refus ne fait
pas disparaître le parasite.

**`BattleActorBridge`** : si la simulation a
déjà enregistré la mort d’une identité, son
ancien avatar physique est libéré ; aucun état
de son maillage ne peut ressusciter cette unité
ni faire désapparaître arbitrairement l’escouade.

## Sauvegarde et validation

Le champ `infection` appartient à l’identité
déjà connue de l’hôte et **ne change pas le
configDigest**, le nombre de groupes, les
budgets, le nombre de soldats ni la carte.

À la reprise, la simulation vérifie que :
- la source était un **Facehugger réellement
  alloué** et déjà consommé ;
- l’hôte était un humain biologique vulnérable,
  non un synthétique ou Exosuit ;
- la faction source correspond, les dates sont
  finies et le délai est compatible avec le temps
  du checkpoint ;
- l’hôte est vivant mais incapacitated tant que
  l’incubation n’est pas terminée.

Le test isolé V8 sur les vraies classes d’AFF-27
a confirmé :
- un Facehugger consommé définitivement ;
- un Marine immobilisé, puis mort à l’échéance ;
- **952 identités**, sans spawn ni duplication ;
- sauvegarde avec infection, reprise normale et
  reprise d’une sauvegarde antérieure sans le
  nouveau champ ;
- rejet d’une échéance falsifiée.

Des cas de synthétique, Flametrooper, Exosuit,
hostilité neutre, cible trop éloignée, gestion
des avatars obsolètes et anti-double-infection
sont encodés dans `tests/host-infestation.test.js`.

**Ces six tests Node/Three intégrés ne sont pas
déclarés réussis avant le nouveau job Actions.**
Ils s’ajoutent au workflow de la PR #6,
sans modifier les tests historiques.

## Prochains travaux pour une fidélité 1:1

1. Hôtes de formes diverses : Oswoc, Kurn/Krilitic,
   Marines, Yautja avec leurs résolutions
   biologiques distinctes, sans étiquettes inventées.
2. Capture non létale, déplacement physique des
   hôtes immobilisés, conduits, sécurisation
   et cocons persistants.
3. Production des œufs par la Reine déjà existante,
   sortie du Facehugger et implantation traçable.
4. Émergence d’un Chestburster et maturation avec
   un **quota de population cohérent** (pas de
   naissance à partir d’une unité de réserve
   combattante déjà active dans l’histoire).
5. Rendu des phases (facehugging, incubation,
   Chestburster, cocon) et animations vérifiées
   à partir de références multi-vues.
6. Rejeu des sauvegardes à travers tous les fronts,
   coopération locale et comportement environnemental.

La présente passe est **un correctif de continuité
et une première étape du cycle d’hôte**. Elle ne
constitue pas une reproduction mécanique ou
visuelle 1:1 complète du RTS source.

## Durcissement additionnel des checkpoints

Le journal de pertes doit désormais prouver la disparition du
Facehugger avec la cause exacte `facehugger-implantation`, la
bonne date et aucun auteur de kill. Plusieurs infections ne
peuvent pas réutiliser la même source. Ces vérifications
refusent la fabrication d'infections depuis un cadavre
d'origine différente.

## Exécution CI de la première version

Sur le commit `28289af1`, GitHub Actions a validé le build
Vite, le catalogue et le suivi d'audit ; **76 tests ciblés sur 77**
ont réussi. L'unique fixture défaillante créait un Marine sans
parent de scène, donc écarté à raison par `selectBattleTarget`.
La fixture est corrigée en ajoutant son maillage à une scène
réelle Three.js ; **aucune règle de filtrage n'est affaiblie**.
Le dernier état de la suite mise à jour sera pris dans
GitHub Actions, il n'est pas encore revendiqué réussi ici.

Les tests du lot passent de 6 à **8 scénarios écrits**
(visualisation procédurale et matérialisation après reprise).
Les deux tests additionnels de sécurité du journal de
consommation et d'anti-double-implantation sont intégrés au
scénario de checkpoint. Ces tests seront rejoués sur la PR #6.
