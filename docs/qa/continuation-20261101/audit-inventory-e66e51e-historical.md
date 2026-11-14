# Inventaire de reprise — 1er novembre 2026

Photographie en lecture seule du registre et du classeur sur `e66e51e9759db970dec30fba51bade16c0873d26` : **67 terminés, 44 à valider, 15 en cours**, soit **59 ouverts**. Les 126 critères d’acceptation et les 126 cellules de suivi concordent exactement avec le classeur. Le fichier JSON adjacent conserve chaque critère ouvert mot pour mot. Aucun état n’est changé par cet inventaire.

## Lots prioritaires sans génération payante

| Lot | Critères | Travail concret et limite de la preuve |
| --- | --- | --- |
| Groupes humains et synthétiques | 021, 025–028, 031 | `ColonialMarines.spawnBattleUnit` ramène actuellement marine/human/smartgunner au même acteur smartgunner ; seul flametrooper diffère. `Synthetics` différencie fusil WY et mêlée Joe mais ne définit pas de réaction d’intrusion/territoire distincte. Développer les rôles/limites réellement exécutés et silhouettes sans dépendre seulement des couleurs. Les 115 profils source ne sont pas 115 modèles rendus. |
| Chasse et états de combat | 080, 086–091 | Vérifier le filtrage de perception dans `BattleActorSupport.selectBattleTarget` : aucune condition isCloaked dans le code inventorié. Donner un avantage furtif mesurable, des coûts affichés et une sortie bornée aux effets combinés, sans faire du camouflage une invulnérabilité. Tests des vrais managers et des états hérités nécessaires. |
| Boss | 066, 075, 076, 079, 124 | Les 18 entrées de `BossCombatPatterns` ont déjà lecture et réponse ; produire une matrice par boss et vérifier l’effet réel, pas seulement les textes. Singularité Feral joueur/boss, échelle et justification de sélection restent à examiner. Canon externe/1:1 non déductibles de tests CPU. |
| Carte, renseignement et accessibilité | 020, 030, 032, 034, 036, 037, 042, 050, 053, 099, 103, 104 | Capturer le produit réel : ordres, âge/incertitude des rapports, pertes/défense autonomes, coopération, profils visuels, dangers et voies physiques. Une structure de données testée seule ne prouve pas la compréhension ni deux combats visibles. |
| Level design et cohérence | 055, 057, 059, 060, 063, 067, 069, 070, 097, 112 | Mesurer distances/temps/capacités/repères par zone ; stress des goulets en sens inverse ; 3 zones GPU puis retour avec états préservés. Distinguer extensions originales, mesures en unités et ancrages sourcés. |
| Validation de parcours et sauvegarde | 011, 013, 014, 019, 024, 028, 047, 051, 087, 094, 108, 109, 115, 118, 121 | AUD-115 exige victoire ET défaite récente pour chaque carte : les 11 victoires finales 5089228 et les défaites a225 ne sont pas une preuve commune. Tester migrations anciennes/partielles/invalides et conservation des trophées valides. Session longue instrumentée et empreinte de source stables. |
| Livraison publique | 004 | Vérifier l’état Vercel avant toute action ; quota et preview QUEUED historiques ne prouvent ni l’état actuel ni une publication nouvelle. Conserver les registres de tentative et ne pas contourner la garde de doublons. |

## Points qui restent dépendants de preuves externes

- AUD-010, 106 et 113 demandent des mesures reproductibles sur les matériels/profils visés. SwiftShader et compteurs CPU ne constituent pas ces mesures.
- AUD-021, 025, 026 et 031 restent partiels tant que profils, équipements et silhouettes requis ne sont pas réellement incarnés. Ajouter un catalogue ou de nouveaux polygones ne suffit pas.
- AUD-059 et 069 demandent des ancrages/rapports d’échelle documentés. Les dimensions actuelles en unités ne certifient pas une reproduction 1:1.
- AUD-079, 089, 123 et 124 demandent de distinguer source, interprétation et création. Les commentaires du code ne valent pas source externe.
- AUD-119 ne peut pas devenir un playtest humain par renommage de scénarios automatisés.
- AUD-109 et 121 ne sont pas clos par le seul passage de dix redémarrages : l’acceptation porte une bataille interactive prolongée.

## Dette documentaire constatée

AUD-047 parle encore de grâce fixe de 30 s dans ses notes, tandis que `BattleSimulation._criticalReturnWindow` calcule déjà trajet de retour/recapture et étend le délai lors des changements de routes. Cette divergence justifie une revue des raccordements et du retour en jeu, puis une correction des notes ; elle ne prouve pas à elle seule le passage de l’acceptation.

## Liste exhaustive des 59 critères ouverts

### AUD-004 — Tracer le SHA du code servi en production

P1 · À valider · Versions et fiabilité

**Critère inchangé :** L’URL publique et la preview de PR exposent un manifeste reproductible; la correspondance HTML documentée demeure vérifiable.

**État déclaré au départ :** La chaîne de publication/manifeste est préservée. La correspondance du nouveau contenu avec URL publique et preview de PR n’a pas encore été vérifiée.

### AUD-010 — Établir des budgets d’agents par plateforme

P1 · En cours · Effectifs et foule

**Critère inchangé :** Chaque profil tient sa cible de frame time dans une scène comparable; le nombre réellement actif est enregistré.

**État déclaré au départ :** Plafond provisoire32 et budgets par faction appliqués, surplus distant sans perte d’identité. Télémétrie et compteurs scèneentière existent ; aucun profil matériel cible validé.

### AUD-011 — Densifier sans infliger toutes les attaques simultanément

P1 · À valider · Effectifs et foule

**Critère inchangé :** La foule augmente sans chaînes de coups impossibles à éviter ni ennemi invisible capable de tuer.

**État déclaré au départ :** Grâce d’entrée et directeur d’engagement couvrent toutes factions. Les démarrages gardent1000HP ; densité et difficulté humaines ne sont pas mesurées.

### AUD-013 — Faire entrer les renforts par des accès plausibles

P1 · À valider · Effectifs et foule

**Critère inchangé :** Aucun spawn dans une paroi, le champ proche ou un secteur sans accès; une arrivée visible précède le contact.

**État déclaré au départ :** Les groupes suivent des voies physiques et se matérialisent hors de la proximité des deux joueurs ; vérification visuelle des arrivées et collisions requise.

### AUD-014 — Éviter la disparition des survivants entre rencontres

P1 · À valider · Effectifs et foule

**Critère inchangé :** Traverser un passage n’efface ni poursuivant, ni chef blessé, ni pertes déjà enregistrées.

**État déclaré au départ :** Persistance et culls sont testés ; retour/poursuite des survivants dans tous les passages réels à confirmer lors de parcours complets.

### AUD-019 — Introduire une représentation distante de la bataille

P1 · À valider · Effectifs et foule

**Critère inchangé :** Quitter puis rejoindre un front conserve effectifs, positions plausibles, moral et progression temporelle.

**État déclaré au départ :** Simulation distante, HP, moral, temps et identité sont persistants ; observation répétée de retours blessés sur plusieurs fronts en session complète encore requise.

### AUD-020 — Donner une échelle perceptible au champ de bataille

P2 · À valider · Effectifs et foule

**Critère inchangé :** Depuis les points hauts, le joueur identifie au moins deux combats réels et leurs voies d’accès.

**État déclaré au départ :** Les34terrains et plusieurs combats distants sont réels ; aucune capture de deux combats visibles depuis un point haut n’est fournie.

### AUD-021 — Créer des compositions de groupes par mission

P1 · En cours · Groupes et factions

**Critère inchangé :** Une même graine et un même profil produisent une composition autorisée; aucune caste exclue n’apparaît.

**État déclaré au départ :** 62modèles et27allocations sont consommables ; la réalisation actuelle utilise des archétypes adaptés explicites, pas les115silhouettes/castes différentes.

### AUD-024 — Donner une vraie réciprocité aux combats entre IA

P1 · À valider · Groupes et factions

**Critère inchangé :** Un combat observé sans joueur au contact change les pertes des deux camps, avec actions et impacts visibles.

**État déclaré au départ :** La réciprocité des pertes existe dans le moteur et les vrais managers ; une observation prolongée des impacts des deux camps sans joueur au contact reste à documenter.

### AUD-025 — Composer des unités xénomorphes biologiquement crédibles

P1 · En cours · Groupes et factions

**Critère inchangé :** Chaque groupe possède une raison de présence et des comportements cohérents; les parasites ne remplacent pas une ligne d’assaut permanente.

**État déclaré au départ :** Stades, espèces, exclusions et rares sont distingués. Tous les profils du registre n’ont pas encore acteur/comportement/silhouette distincts rendus.

### AUD-026 — Former des patrouilles Yautja adaptées au clan

P1 · En cours · Groupes et factions

**Critère inchangé :** Une cellule garde son identité et ses équipements; son effectif reste justifié par le scénario de chasse ou de guerre.

**État déclaré au départ :** Cellules et identité de clan sont persistantes et contextualisées ; les nombreux groupes proposés ne disposent pas tous d’équipement/modèle distinct fidèle.

### AUD-027 — Diversifier les groupes humains avec une structure réelle

P1 · En cours · Groupes et factions

**Critère inchangé :** La composition autorise couverture, progression et replis; aucun groupe entier n’est composé de la même arme lourde.

**État déclaré au départ :** Les compositions humaines et rôles existent ; les presets exécutables n’incarnent pas toutes les spécialisations sources et formations d’appui.

### AUD-028 — Séparer synthétiques militaires, industriels et civils

P1 · À valider · Groupes et factions

**Critère inchangé :** Un profil de sécurité et un profil industriel réagissent différemment à une intrusion et restent limités à leur lieu.

**État déclaré au départ :** Synthétiques militaires/industriels/civils sont contextualisés ; réactions distinctes et limites de lieu doivent encore être revues intégralement.

### AUD-030 — Préserver la guerre entre ruches comme scénario spécifique

P2 · À valider · Groupes et factions

**Critère inchangé :** Le joueur comprend quel groupe appartient à quelle ruche et peut exploiter un conflit déjà actif.

**État déclaré au départ :** Un scénario original de96identités Ambre/Obsidienne, territoires, réserves et hostilité de ruches est implémenté ; infight par couleur supprimé. AccèsUI/compréhension/affrontement visuel noncertifiés par les4smokes sélectionnés.

### AUD-031 — Distinguer silhouettes, rangs et équipements

P1 · En cours · Groupes et factions

**Critère inchangé :** Un test de silhouette identifie chef, appui, parasite et lourd sans dépendre uniquement de la couleur.

**État déclaré au départ :** Types/rangs équipés et chefs existent, mais test de silhouette sans couleur pour tous les rôles manque encore.

### AUD-032 — Conserver des identités de groupe persistantes

P1 · À valider · Groupes et factions

**Critère inchangé :** Le même groupe conserve son identité lors d’un passage proche/lointain et dans le bilan de bataille.

**État déclaré au départ :** IDs de groupes conservés dans moteur/LOD/checkpoints/journal ; leur suivi par le joueur sur l’ensemble des fronts/bilans reste à vérifier individuellement.

### AUD-034 — Déléguer un front à un capitaine

P1 · À valider · Alliés et commandement

**Critère inchangé :** Pendant que le joueur agit ailleurs, le capitaine peut défendre ou perdre un objectif selon des règles visibles.

**État déclaré au départ :** Délégation de capitaine et autonomie distante sont fonctionnelles et testées ; victoire/perte d’un front délégué observée dans le jeu complet encore à prouver.

### AUD-036 — Proposer des tactiques collectives Yautja

P1 · À valider · Alliés et commandement

**Critère inchangé :** La tactique repositionne les unités et produit un effet mesurable; elle peut échouer si ses conditions ne sont plus remplies.

**État déclaré au départ :** Quatre tactiques repositionnent les groupes, changent effets et refusent préconditions invalides. Leur lisibilité physique et usage UI répété restent à observer.

### AUD-037 — Rendre les compagnons spécialisés et équipables

P2 · À valider · Alliés et commandement

**Critère inchangé :** Deux compagnons de rôles différents modifient le plan de bataille; aucun n’accède à une arme hors profil sans choix explicite.

**État déclaré au départ :** Quatre kits de compagnons avec équipements autorisés, charges/cooldowns, marche, soins/recon/réparation/sabotage/suppression et checkpoints sont développés. Aucun parcours complet de deux rôles depuis les nouveauxmenus n’est revendiqué.

### AUD-042 — Simuler plusieurs combats simultanés

P1 · À valider · Fronts et objectifs

**Critère inchangé :** Un enregistrement montre combat et décisions simultanés sur plusieurs fronts; éloigner le joueur ne fige pas le résultat.

**État déclaré au départ :** Plusieurs fronts combattent à distance simultanément et conservent leurs résultats ; enregistrement visuel montrant deux combats/choix simultanés absent.

### AUD-047 — Créer des conditions de défaite stratégiques

P1 · À valider · Fronts et objectifs

**Critère inchangé :** La défaite affiche sa cause vérifiable et laisse un temps de réaction cohérent avec la distance.

**État déclaré au départ :** Défaites causales, fronts critiques et grâce sont testés ; la grâce fixe30s n’est pas encore calibrée aux retours depuis toutes les grandes cartes.

### AUD-050 — Gérer lignes de ravitaillement et isolement

P2 · À valider · Fronts et objectifs

**Critère inchangé :** Couper une route réduit un type de renfort et le camp signale comment la rétablir.

**État déclaré au départ :** Origines de réserve, routes et ponts conditionnent réellement le ravitaillement. La lisibilité de toutes les causes et réparations possibles dans une session complète reste à confirmer.

### AUD-051 — Permettre victoire par plusieurs stratégies

P2 · À valider · Fronts et objectifs

**Critère inchangé :** Deux parcours gagnants mobilisent des objectifs différents avec conséquences et durées comparables.

**État déclaré au départ :** Plusieurs stratégies réelles sont exécutables et testées ; durées et conséquences comparables en jeu humain ne sont pas mesurées.

### AUD-053 — Ajouter renseignement et brouillard tactique

P2 · À valider · Fronts et objectifs

**Critère inchangé :** Une unité hors contact n’est pas suivie avec précision absolue; le joueur connaît l’âge de son dernier rapport.

**État déclaré au départ :** Intel respecte murs, vue des deuxjoueurs, rapports retardés, incertitude, ancienneté et reconnaissance temporaire. Lisibilité de tous ces états sur la carte tactique en session complète à confirmer.

### AUD-055 — Agrandir le terrain par des zones à fonctions distinctes

P1 · À valider · Level design

**Critère inchangé :** Chaque zone a rôle, capacité, au moins deux repères et passages dimensionnés; les dimensions sont exprimées en unités tant que l’échelle n’est pas calibrée.

**État déclaré au départ :** Secteurs, capacités, objectifs, repères et dimensions en unités sont construits. Rôle perceptible et deuxrepères utiles dans chaque zone n’ont pas tous été recensés visuellement.

### AUD-057 — Définir des échelles de bataille compatibles avec le lieu

P1 · En cours · Level design

**Critère inchangé :** Les grandes cartes possèdent distance, densité et temps de déplacement justifiés; aucun couloir de station n’accueille une armée impossible.

**État déclaré au départ :** Distances/populations/corridors sont explicites ; justification et validation de densité/temps de déplacement pour chaque lieu restent partielles.

### AUD-059 — Conserver des ancrages fixes pour les lieux iconiques

P1 · En cours · Level design

**Critère inchangé :** Chaque zone distingue reproduction documentée et extension originale; une variation ne déplace pas arbitrairement un repère essentiel.

**État déclaré au départ :** Les extensions sont déclarées originales et nonmesurées ; ancrages géographiques précis des lieux iconiques noncertifiés.

### AUD-060 — Filtrer les installations par cohérence de lieu

P1 · À valider · Level design

**Critère inchangé :** La jungle 1987 ne reçoit pas automatiquement un laboratoire spatial ou une matriarche; les exceptions sont des missions alternatives identifiées.

**État déclaré au départ :** Le filtrage des mécanismes par contexte empêche les installations futuristes automatiques dePrey ; revue de tous décors/groupes/objets par contexte encore nécessaire.

### AUD-063 — Gérer l’encombrement aux portes et ponts

P1 · À valider · Level design

**Critère inchangé :** Un flot d’assaut traverse un goulet et une évacuation inverse reste possible; aucun blocage prolongé.

**État déclaré au départ :** Détours, formations et navigation évitent les blocages structurels ; aucun stress test exhaustif d’assaut/évacuation opposés aux goulets n’est fourni.

### AUD-066 — Dimensionner des espaces spécifiques aux boss

P1 · À valider · Level design

**Critère inchangé :** Aucune attaque ou caméra traverse un volume majeur; le joueur peut lire le boss et se déplacer durant toutes ses phases.

**État déclaré au départ :** Géométries et hauteurs de boss sont bornées et la caméra est physique ; chaque phase/caméra des18affrontements complets reste à examiner.

### AUD-067 — Guider par le décor et les lignes de vue

P2 · À valider · Level design

**Critère inchangé :** Un joueur peut repérer la route principale et un contournement sans suivre uniquement un marqueur HUD.

**État déclaré au départ :** Contournements/repères sont construits ; guidage des joueurs sans marqueurs HUD nonévalué.

### AUD-069 — Calibrer les dimensions des acteurs et des lieux

P1 · En cours · Level design

**Critère inchangé :** Un tableau de mesures prouve les rapports d’échelle; chaque exception artistique est documentée.

**État déclaré au départ :** Hauteurs de boss et dimensions de terrain sont mesurées en unités de jeu. Rapports d’échelle source/costume/acteur1:1 nonétablis.

### AUD-070 — Valider la densité utile de chaque grande zone

P2 · En cours · Level design

**Critère inchangé :** La mesure distingue zones calmes, fronts denses et points de décision; aucune grande extension ne reste vide sans fonction.

**État déclaré au départ :** Les fonctions de fronts existent ; mesure de densité utile et zones calmes pour chaque grande extension nonréalisée.

### AUD-075 — Distinguer élite, mini-boss et boss

P1 · À valider · Boss et mini-boss

**Critère inchangé :** Le joueur reconnaît une escalade et bénéficie de respiration; les élites ne remplacent pas la majorité de l’armée.

**État déclaré au départ :** Élites/mini-boss/boss sont catégorisés et bornés ; escalade perceptible et respiration en combat complet nonmesurées.

### AUD-076 — Rendre chaque affrontement mécaniquement distinct

P1 · À valider · Boss et mini-boss

**Critère inchangé :** Chaque boss exige au moins une lecture et une réponse distinctes; aucune différence limitée aux PV et à la couleur.

**État déclaré au départ :** Plusieurs contre-jeux sont réels ; aucune revue individuelle des18lectures/réponses de boss n’est revendiquée.

### AUD-079 — Vérifier les boss hybrides et titres revendiqués canon

P1 · À valider · Boss et mini-boss

**Critère inchangé :** Chaque fiche distingue confirmé, interprétation et invention; aucun commentaire source n’est utilisé comme preuve externe.

**État déclaré au départ :** Les39fiches distinguent sources/adaptations/titres ; vérification externe individuelle des revendications canoniques encore partielle.

### AUD-080 — Intégrer les exécutions sans bloquer la bataille

P1 · À valider · Boss et mini-boss

**Critère inchangé :** Une exécution ne tue pas le joueur hors champ, n’efface pas le boss d’un autre front et ne répète pas son trophée.

**État déclaré au départ :** Exécution portée/armure/idempotence est testée ; sécurité horschamp et coexistence de tous boss pendant cinématique restent à confirmer.

### AUD-086 — Gérer ressources et fenêtres des attaques de masse

P1 · À valider · Combat et rôles

**Critère inchangé :** Un enchaînement dominant ne rend pas tous les groupes inoffensifs en permanence; les coûts sont visibles avant l’action.

**État déclaré au départ :** Endurance, cooldowns et impacts finis empêchent les enchaînements gratuits dans les tests ; visibilité préalable de tous coûts et absence de domination permanente restent à observer.

### AUD-087 — Créer des réponses adaptées aux formations

P2 · À valider · Combat et rôles

**Critère inchangé :** Une même compétence est efficace contre une ligne mais moins contre un groupe dispersé; l’IA réagit de manière lisible.

**État déclaré au départ :** Formations à vrais slots, cohésion/root, dégâts différenciés ligne/dispersé et contre-jeu sont implémentés/testés ; présentation lisible de toutes les réponses en jeu encore noncertifiée.

### AUD-088 — Conserver la spécificité de la chasse dans les batailles

P1 · En cours · Combat et rôles

**Critère inchangé :** Une approche furtive ouvre un avantage concret sans rendre obligatoire le combat frontal de toutes les unités.

**État déclaré au départ :** Fcamouflage est rétabli et testé réellement. Bonus/backstab/résistance existent ; une approche furtive transformant concrètement tous les plans de masse reste à valider.

### AUD-089 — Réviser pouvoirs et gadgets extrapolés

P2 · À valider · Combat et rôles

**Critère inchangé :** Aucune capacité originale ne porte une certification 1:1 sans référence et comparaison; les collisions et contre-effets sont testés.

**État déclaré au départ :** Les nouveaux profils annoncent adaptations et fidélité noncertifiée ; collisions/contre-effets de chaque ancien gadget extrapolé ne sont pas tous certifiés.

### AUD-090 — Rendre coups et tirs respectueux du décor

P1 · À valider · Combat et rôles

**Critère inchangé :** Un tir ordinaire ne traverse pas une paroi; une arme perforante le fait seulement dans ses limites annoncées.

**État déclaré au départ :** Murs et couverts partagés arrêtent mêlée/tirs/projectiles, ycompris NPC. Les limites de perforation de toutes les armes ne sont pas encore certifiées.

### AUD-091 — Éviter les effets superposés incontrôlables

P1 · À valider · Combat et rôles

**Critère inchangé :** Aucune combinaison ne laisse le personnage bloqué indéfiniment; chaque état possède une indication et une issue.

**État déclaré au départ :** États et effets temporaires sont bornés dans les tests ; aucune matrice exhaustive des combinaisons de tous pouvoirs hérités n’est fournie.

### AUD-094 — Donner aux personnages des enjeux et conséquences

P2 · À valider · Campagne et progression

**Critère inchangé :** Le briefing et le débrief réagissent au personnage et aux événements réellement accomplis.

**État déclaré au départ :** Reconnaissances, données de briefing/débrief et arc réagissent au personnage/événements ; présentation complète des enjeux de tous personnages reste à vérifier.

### AUD-097 — Faire varier la rejouabilité par conditions

P2 · À valider · Campagne et progression

**Critère inchangé :** Deux variantes d’une même carte demandent des décisions différentes tout en respectant la table de cohérence.

**État déclaré au départ :** Variantes/cartes/plans ont conditions distinctes et cohérentes ; comparaison en jeu de deux variantes d’une même carte à documenter.

### AUD-099 — Créer une carte de commandement complète

P1 · À valider · HUD et lisibilité

**Critère inchangé :** Le joueur peut comparer les fronts et envoyer une unité depuis la carte sans perdre la compréhension de la situation.

**État déclaré au départ :** Carte réelle zoom/pan, sélection groupe/front, ordres, tactiques, délégation et journal. Le clic transmettre est validé ; toutes les combinaisons de choix/trajectoires depuis la carte ne sont pas parcourues.

### AUD-103 — Préserver la lisibilité pour tous les profils visuels

P2 · À valider · HUD et lisibilité

**Critère inchangé :** Les objectifs et dangers restent distinguables avec couleurs simulées et effets réduits.

**État déclaré au départ :** Contraste, focus, textes et effets réduits sont développés ; simulation complète des profils visuels et lecture des dangers noncertifiées.

### AUD-104 — Adapter la caméra aux combats et au commandement

P1 · À valider · HUD et lisibilité

**Critère inchangé :** Le joueur et le danger principal restent visibles dans chaque scénario; la caméra ne traverse pas les parois.

**État déclaré au départ :** La caméra résout les volumes physiques, bornes de cadrage et proximité ; visibilité du joueur/danger dans chaque phase et scénario reste à contrôler.

### AUD-106 — Établir un budget de rendu des armées

P1 · En cours · Performance et QA

**Critère inchangé :** L’augmentation du nombre d’unités suit les budgets mesurés et conserve la silhouette de chaque rôle.

**État déclaré au départ :** Le rendu respecte capprovisoire32 etLOD ; budget de rendu/silhouettes sur matériels cibles nonmesuré.

### AUD-108 — Gérer deux fronts visibles en coopération

P1 · À valider · Performance et QA

**Critère inchangé :** P1 etP2 peuvent combattre sur deux fronts avec menaces équitables, objectifs partagés et budget mesuré.

**État déclaré au départ :** Budgets communs et acteurs des deuxjoueurs sont testés côté moteur/contrôles ; deuxfronts réellement visibles en coopération avec mesures restent à vérifier.

### AUD-109 — Borner les effets secondaires et cadavres

P1 · À valider · Performance et QA

**Critère inchangé :** Une bataille prolongée garde une mémoire stable et les effets obligatoires restent lisibles quand le budget est atteint.

**État déclaré au départ :** Événements/effets/cadavres ont plafonds et cleanup ; stabilité mémoire d’une bataille interactive prolongée noncertifiée.

### AUD-112 — Préparer un chargement par zones

P2 · À valider · Performance et QA

**Critère inchangé :** Le franchissement ne provoque ni terrain absent ni arrêt prolongé; revenir conserve objectifs et destructions.

**État déclaré au départ :** Le streaming libère réellement les allocations de géométrie/instances en gardant les modèlesCPU et états du monde. ParcoursGPU de3zones puisretour et mesure de pause au franchissement restent à documenter.

### AUD-113 — Créer une mesure réelle des performances

P1 · En cours · Performance et QA

**Critère inchangé :** Les promesses d’effectifs reposent sur une capture mesurée et reproductible, pas sur le seul nombre de triangles.

**État déclaré au départ :** Télémétrie distingue duréeCPU, intervalles d’affichage, compteurs scèneentière et absence de timerGPU ; les captures SwiftShader ne valident pas les performances sur matériels cibles.

### AUD-115 — Vérifier les dix parcours complets

P1 · À valider · Performance et QA

**Critère inchangé :** Un rapport récent relie chaque carte au SHA et prouve au moins une victoire et une défaite cohérentes.

**État déclaré au départ :** 11démarrages/insertion/nettoyage et4smokes opération passent ; il ne s’agit pas de11parcours complets chacun victoire/défaite.

### AUD-118 — Vérifier les sauvegardes et migrations

P1 · À valider · Performance et QA

**Critère inchangé :** Une sauvegarde ancienne, partielle ou invalide ne bloque pas le lancement et n’efface pas silencieusement des trophées valides.

**État déclaré au départ :** Checkpoints, incompatibilités, corruption et reçus ont tests ; toutes les migrations d’anciennes sauvegardes/trophées valides restent à vérifier.

### AUD-119 — Mesurer lisibilité et difficulté lors de playtests

P2 · À valider · Performance et QA

**Critère inchangé :** Le rapport cite version, durée et problèmes observés; les conclusions ne prétendent pas mesurer ce qui n’a pas été testé.

**État déclaré au départ :** Le rapport automatique cite source/version/durée/assistances et défauts observés ;0testeurhumain. Lisibilité/difficulté humaines nonmesurées.

### AUD-121 — Stabiliser l’expérience de bataille longue

P1 · À valider · Performance et QA

**Critère inchangé :** Aucune croissance mémoire continue, objectif bloqué ou perte de commandes; les incidents sont liés à une chronologie reproductible.

**État déclaré au départ :** 20minutes simulées et smokes interactifs bornés passent ; aucune session interactive instrumentée60minutes n’est revendiquée.

### AUD-123 — Définir le scénario Prey de 1719 et ses groupes autorisés

P1 · En cours · Groupes et factions

**Critère inchangé :** La version fidèle ne charge aucun groupe ou objet exclu par le profil 1719 ; les rencontres sont compatibles avec le lieu et leur source. Les variantes adaptées sont nommées dans la sélection.

**État déclaré au départ :** Contexte1719 et filtrage des éléments sont explicités ; les batailles sont adaptées. Une reconstitution fidèle complète avec groupes/objets tousvalidés n’est pas fournie.

### AUD-124 — Préserver la singularité du Feral entre personnage et boss

P1 · En cours · Boss et mini-boss

**Critère inchangé :** La mission Prey se conclut avec le boss prévu ; le choix du chasseur possède une justification cohérente ou une restriction explicite. Le modèle est mesuré par rapport au joueur et aux accès, sans déduire sa taille d’un commentaire.

**État déclaré au départ :** Feralboss/personnage et équipements sont distincts ; modèle/échelle par références, accès et justification de sélection pour tous modes restent à compléter.

