# Stratégie, reconstitution et délais de réaction

Ce lot traite AUD016, AUD046, AUD047 et la partie CPU de AUD107. Il ne certifie ni une fidélité visuelle 1:1, ni des performances sur toutes les machines. Les preuves et leurs limites sont dans [le dossier de recette](qa/strategic-depth-20261028/README.md).

## Difficulté sans augmentation des effectifs

`applyBattleDifficulty(configuration, difficultyId)` dans `js/battlefield/BattleStrategy.js` retourne une copie de la configuration. Les identités, budgets, groupes, profils, PV et dégâts sont identiques. Un scénario dont l'IA est désactivée le reste.

| Identifiant | Libellé | Intervalle de décision | Groupes conservés en garnison | Rapport minimal attaquants/défenseurs | Cible préférée |
| --- | --- | ---: | ---: | ---: | --- |
| `cautious` | Prudent | 30 s | 2 | 1,4 | Front le moins défendu |
| `standard` | Équilibré | 20 s | 1 | 1 | Front le moins défendu |
| `aggressive` | Offensif | 10 s | 1 | 0,6 | Source de renforts adverse |

Ce sont des réglages de conception, sans revendication de mesure matérielle. Le profil est dans `configuration.difficulty`, sauvegardé avec la configuration, et exposé par `getHUDState().difficulty`. Reprendre une sauvegarde doit conserver sa configuration plutôt que réappliquer le sélecteur courant.

## Retraite et reconstitution finies

`issueOrder(groupId, { type: 'retreat', frontId })` impose le trajet physique vers le point de regroupement. Le groupe conserve ses survivants et ses morts. Une fois la retraite engagée, ses ordres de combat et ses tactiques offensives sont refusés avec `reconstitution_required`.

`requestReconstitutionSupport(groupId)` demande un groupe de réserve déjà alloué. Aucun soldat ni identifiant n'est créé. Un renfort automatique réellement arrivé après le début de cette retraite peut aussi être associé. Le groupe doit rejoindre le même front par les routes existantes, puis disposer pendant six secondes continues des conditions suivantes :

- Front détenu par son camp ou un allié, sans présence hostile prête au combat.
- Connexion ouverte vers une source de ravitaillement de son camp.
- Groupe de renfort distinct, arrivé au front et comptant au moins deux soldats aptes au combat.

Le renfort combat aux côtés des survivants ; les identités ne sont pas fusionnées et les PV, munitions et pertes du groupe initial ne sont pas recréés. Une simple remontée du moral ne libère pas le groupe. Une réserve épuisée, une source perdue ou un trajet coupé le maintient au regroupement. Le retour automatique exige en plus un officier disponible et une route vers l'ancien objectif.

`getGroup(id).reconstitution` et les directives exposent `required`, `supportGroupId`, `supportArrivedAt`, `recoverySeconds`, `readyAt` et `lastBlockedReason`. Ces données, les liens de soutien et les arrivées sont sauvegardés et validés à la reprise. Les événements `group_reconstitution_required`, `reconstitution_support_arrived`, `reconstitution_waiting` et `group_reconstituted` rendent la cause observable.

## Délais des fronts critiques

`calibrateDefeatWindow(configuration)` conserve la valeur initiale dans `objectives.defeatWindow.sourceGraceSeconds`. Il mesure les plus courts chemins sur les routes physiques ouvertes, retient le retour le plus long, ajoute l'approche locale et le temps de recapture. Le calcul utilise une marche prudente de 10 unités/s, un facteur de manœuvre de 1,2 et 12 secondes de réaction. Ces valeurs correspondent aux unités du jeu, sans prétendre mesurer les dimensions d'un film.

Chaque front perdu possède son propre `since`, `deadline` et `graceSeconds` dans `getHUDState().criticalFronts`. Une récupération annule seulement son propre compte à rebours. Le temps de simulation, la pause et la sauvegarde conservent ces délais.

Une modification des routes recalcule le retour avec les routes alors ouvertes. Un détour peut prolonger l'échéance à partir de la perte initiale ; rouvrir puis refermer une route ne réinitialise pas le compteur. Les événements `critical_front_lost` et `critical_return_route_changed` fournissent les échéances et le temps de trajet. Une défaite cite les fronts dont le délai a effectivement expiré.

Un front complètement déconnecté est explicitement signalé par `critical_return_route_blocked` et `unreachableFrontIds`. Son délai conservateur subsiste ; le joueur doit rétablir un passage. Ce cas ne prouve pas qu'un retour soit réalisable tant que la déconnexion demeure.

## Blessés, officiers et coordination de la ruche

`setUnitIncapacitated(unitId, boolean)` ne change ni l'identité, ni l'allocation, ni les totaux militaires. Une unité à terre conserve sa position ; elle ne contribue plus aux attaques, captures, déplacements, formations ou décisions d'officier. Elle peut être achevée. Le booléen est sauvegardé et validé. La mort, l'évacuation et les états terminaux effacent cette incapacité.

La proximité d'un blessé allié compte dans la matérialisation. Le groupe allié préexistant peut réapparaître autour de son blessé, même dans la distance normalement interdite aux nouvelles apparitions ; ses camarades gardent leurs identités et le plafond détaillé global reste 32. Cette exception ne s'applique pas aux ennemis. Le Bridge doit vérifier le dossier de secours légitime avant sa propre exception de distance.

La perte réelle d'un contrôleur de ruche fixe `group.coordinationStrength` à `0.65`, persistant à la reprise. Ce facteur réduit dégâts et capture ; il ne simule pas une peur humaine. `getGroup`, les directives et les renseignements connus exposent cette coordination. La pression de source reste indépendante : 70 si la source est intacte, 45 si elle est neutralisée. La perturbation de source et celle du contrôleur peuvent se cumuler.

Pour le combat détaillé, les acteurs reçoivent la coordination de leur directive. La vue de cible applique le facteur une seule fois aux coups PNJ→PNJ ; les coups PNJ→joueur doivent recevoir le même facteur dans leur propre appelant. Ne pas appliquer deux fois le même facteur.

## Recherche de cibles et coût CPU

Le moteur distant regroupe une fois les groupes par front et réutilise les index de force, garnison et observation. Les graines d'attaque dérivées des identités sont calculées une fois ; les résultats déterministes restent inchangés dans le benchmark comparé à la base.

Le combat détaillé indexe les candidats par faction une fois par horloge de manager. Les PV, positions et relations diplomatiques sont lus en direct ; l'ordre du fournisseur départage toujours les distances égales. Les changements de fournisseur, apparitions et retraits invalident les index partagés. Sans horloge, la sélection reste sans cache.

Le cache conserve une `WeakRef` vers l'ensemble temporaire de l'index, et des références faibles vers le fournisseur et la simulation. Il ne doit pas conserver fortement les acteurs d'une ancienne mission. Cela borne ce cache précis ; ce n'est pas une certification générale de l'absence de fuite mémoire.

Le benchmark distingue le temps de **tout le combat distant** (`remoteCombatMs`, y compris dégâts et morts) de la part de **recherche détaillée** (`targetSearch`, profil CPU inclusif de `selectBattleTarget`). Voir la recette pour les chiffres et les limites.

## État des rencontres de boss

`syncUnit(id, { encounterState })` accepte les métadonnées uniquement pour une unité boss déclarée et validée par `validateBossCombatState`. Le moteur conserve un clone et valide les données à la reprise. Les PV du moteur restent autoritaires : les PV d'une ancienne photo de rencontre ne les remplacent pas. L'état est effacé à la mort. Le gestionnaire de boss et le Bridge assurent la capture et la restauration des phases et délais ; les projectiles en vol ne sont pas persistés.
