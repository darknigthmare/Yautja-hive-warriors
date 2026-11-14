# Annexes : tables de la bible Hive Warriors

Fichier généré par `tools/bible/build_bible.py` ; ne pas le modifier à la main.
Les mêmes tables sont dans `design/Yautja_HiveWarriors_V58_Bible.xlsx`.

## 00_Synthese — Synthèse

| Rubrique | Valeur |
|---|---|
| Jeu | Predator: Hive Warriors (dépôt darknigthmare/yautja-hive-warriors) |
| Nature | Musou 3D navigateur, three.js 0.160, vite 5, audio 100 % procédural |
| Place dans l'univers | Jeu frère de « Yautja : La Longue Chasse » ; classé « chroniques légendaires », hors canon de la campagne commune |
| Version du code | v58.1 (titre, sous-titre et package.json alignés le 13 nov.) |
| Dernière version qui se chargeait | v33.0 (erreurs de syntaxe de v34 à v58) |
| État au 13 nov. 2026 | Phases 0 et 1 codées : les 8 chasses se gagnent par exécution du boss d'arène et se perdent, avec pause et retour au menu ; aucune erreur en console ; pas encore jouées par un humain |
| Chasseurs jouables | 7 |
| Arènes | 8 (même plan 150×150 m, décor propre par arène) |
| Boss codés | 11 identifiants + 1 gabarit par défaut ; chaque arène a son boss et sa valeur de PV de campagne |
| Types d'ennemis | 10 types aléatoires + 16 unités fixes par vague |
| Registre d'armes | 36 entrées, aucune équipable ; 17 ont un comportement réel |
| Capacités au clavier | environ 54, avec conflits de touches |
| Condition de victoire | Exécution du boss d'arène, codée le 13 nov. ; mode sans fin sur Maj+M |
| Certification 1:1 | 0 élément certifié (règle héritée de La Longue Chasse) |

## 01_Decisions — Décisions prises avec l'auteur le 12 novembre 2026

| ID | Question | Décision | Conséquence pour la bible |
|---|---|---|---|
| HW-DEC-01 | Lien avec les classeurs Excel de La Longue Chasse | Même univers | Hérite du canon et des règles de preuve ; chaque écart est signalé |
| HW-DEC-02 | Périmètre décrit | Vision + état réel | Chaque système porte un statut et une décision de tri |
| HW-DEC-03 | Erreurs bloquantes | Corriger | 5 correctifs minimaux livrés ; le reste est listé en P0 |
| HW-DEC-04 | Format | Markdown + Excel | Documents dans design/gdd et ce classeur |
| HW-DEC-05 | Promesse centrale | Musou d'abord | Furtivité et factions sont des épices ; arbitre des conflits de conception |
| HW-DEC-06 | Structure | Campagne + sans fin | 8 chasses avec victoire par exécution du boss ; sans fin débloqué par arène |
| HW-DEC-07 | Canon des films | Chroniques légendaires | Chasseurs et lieux de films conservés, « non certifié 1:1 », « et si… » assumé |
| HW-DEC-08 | Kit du joueur | Kit par chasseur | Tronc commun + 4 emplacements + Musou propre à chaque chasseur |
| HW-DEC-09 | Diffusion | Projet de fan non commercial | Noms et lieux de films conservés, vocabulaire « inspiré de » ; aucune monétisation |
| HW-DEC-10 | Clan du joueur | Clan anonyme | Forge et coffre restent « du clan », sans nom ; aucun des 15 clans de la Bible V6 n'est imposé |
| HW-DEC-11 | Bonus de combat des forges et bio-masques | Conservés | Écart assumé avec la règle « cosmétique sans bonus » de La Longue Chasse |
| HW-DEC-13 | Obtention des armes humaines | Ramassées | Prises sur les marines tombés ou dans des caisses, munitions limitées ; plus de ravitaillement automatique par vague |
| HW-DEC-14 | Présence des alliés, marines, blindé et frappes | Selon l'arène | Chaque arène reçoit les soutiens de son lieu : voir l'onglet 15_Soutiens |
| HW-DEC-15 | Lien avec la sauvegarde de La Longue Chasse | Lecture seule, avec déblocages | Hive Warriors lit la progression de La Longue Chasse sans rien y écrire, et débloque du contenu propre à ce jeu, comme ses personnages originaux |
| HW-DEC-16 | Ordre des 8 chasses | Ordre proposé | Val Verde, Los Angeles, Gunnison, pyramide, réserve, Charon, station, Xenomorph Prime ; PV des boss recalés en courbe croissante après essais |
| HW-DEC-17 | Moyen de lecture de la progression de La Longue Chasse | Compte en ligne | Sauvegarde sur un serveur avec identification ; exige une base de données et une gestion de comptes dans les deux jeux |
| HW-DEC-18 | Contenus de La Longue Chasse débloqués | Personnages des six voies, habillages des 15 clans, arènes de Xeno Prime | Les outils originaux ne sont pas repris |
| HW-DEC-19 | Condition de déblocage | Par étape franchie | Chaque contenu est lié à une étape précise de La Longue Chasse |
| HW-DEC-20 | Humains de la forêt de Gunnison | Garde nationale | Soldats contemporains à la place des marines coloniaux : même comportement, autre habillage et autres armes à ramasser |
| HW-DEC-21 | Service de comptes | Supabase, projet déjà en place | Même projet que La Longue Chasse ; aucune nouvelle base à créer |
| HW-DEC-22 | Rôle du compte | Facultatif, avec sauvegarde en ligne | On joue sans compte ; connecté, la progression de Hive Warriors est aussi conservée en ligne et retrouvée sur un autre appareil |
| HW-DEC-23 | Identification | Identique au système de comptes existant | Aucune nouvelle méthode ; reprendre celle de La Longue Chasse telle quelle |
| HW-DEC-24 | Personnages de La Longue Chasse jouables | Tous, Mara Venn incluse | 19 personnages des six voies ; Mara Venn, humaine, est un personnage jouable à part |
| HW-DEC-25 | Accès au dépôt de La Longue Chasse | Oui, en lecture | Méthode de connexion et format de sauvegarde relevés le 13 nov. 2026 ; rien n'y est modifié |
| HW-DEC-26 | Table de la sauvegarde en ligne de Hive Warriors | Table générique app_cloud_saves | Rien à créer dans la base ; une ligne par compte et par application |
| HW-DEC-27 | Mara Venn | Deux variantes jouables | Hors clan : kit humain propre. Équipée par les Yautja : matériel prêté, sans plasma d'épaule (précisé par HW-DEC-29) |
| HW-DEC-28 | Fiches des 19 personnages | Rédigées par Claude, validées par l'auteur | Une fiche par personnage, à partir de la Bible V6 |
| HW-DEC-29 | Mara Venn équipée | Alliée équipée, pas membre | La seconde variante s'appelle « équipée par les Yautja » : matériel prêté le temps d'une chasse, elle reste extérieure au clan ; conforme à la Bible V6 |
| HW-DEC-30 | Saer | Non jouable | Il peut servir de voix du codex ou de la salle des trophées |
| HW-DEC-31 | Espèce d'Esha | Humaine (choix confié à Claude) | Habitante du port de Namarra, monde de Mara Venn ; la Bible V6 ne la range jamais parmi les cohortes ou les rangs Yautja |
| HW-DEC-32 | Arme de Mara Venn | Fusil de traqueuse | Fusil à verrou précis, lent, puissant sur les élites |
| HW-DEC-33 | But d'une chasse | Carte à zones | Carte plus grande découpée en zones tenues par des officiers de ruche, à conquérir ; remplace l'arène fermée et ses seules vagues |
| HW-DEC-34 | Progression | Niveaux de chasseur, armes à attributs, rangs Yautja, trophées à effets | Les quatre systèmes sont retenus |
| HW-DEC-35 | Combat | Verrouillage de cible, changement d'arme en combo, mises à mort contextuelles, furtivité d'ouverture | Les quatre sont retenus |
| HW-DEC-36 | Modes | Niveaux de difficulté, mode libre, défis de chasse, classement en ligne | Les quatre sont retenus |
| HW-DEC-37 | Lieux futurs | Tous les lieux iconiques manquants de la saga | Liste dans l'onglet 18_LieuxFuturs |
| HW-DEC-38 | Chasseurs futurs | Tous les chasseurs iconiques manquants | Liste dans l'onglet 19_ChasseursFuturs |
| HW-DEC-39 | Vie de l'univers | Récit par chasse, codex complet, citadelle vivante, musique par arène | Les quatre sont retenus |
| HW-DEC-40 | Ordre des chantiers | Ordre de la feuille de route | Neuf phases ; une phase ne commence que lorsque la précédente a été jouée dans un navigateur |
| HW-DEC-41 | Cartes à zones et arènes fermées | Les deux coexistent | La campagne se joue en cartes à zones ; les arènes fermées restent pour le mode sans fin et les défis |
| HW-DEC-42 | Rangs Yautja | Propres à Hive Warriors | Mêmes sept noms, gagnés par les trophées de boss ; indépendants du rang atteint dans La Longue Chasse |
| HW-DEC-43 | Classement en ligne | Vérifié | Chaque partie est contrôlée côté serveur avant d'entrer au classement ; chantier à part entière |
| HW-DEC-44 | Chasse pilote de la carte à zones | Une chasse inscrite dans l'univers : une meute d'Unblooded, guidée et surveillée par un Adjutant et un Elite, chasse la faune extraterrestre | Nouvelle chasse, hors des 8 existantes ; fiche dans feuille-de-route.md, section « La chasse pilote » |
| HW-DEC-45 | Vérification du classement | Contrôle de vraisemblance | Le serveur reçoit un résumé minute par minute et rejette l'impossible ; pas de rejeu complet |
| HW-DEC-46 | Fiches des 19 personnages | Validées en bloc | Elles font référence ; les chiffres seront ajustés après essais |
| HW-DEC-47 | Points de vie des boss | Courbe provisoire | Courbe croissante de l'onglet 21_CourbeBoss, à corriger après essais avec un vrai joueur |
| HW-DEC-48 | Place des chasses de faune en meute | C'est la campagne | Toute la progression d'Unblooded à Blooded passe par ces chasses ; les Xénomorphes n'arrivent qu'au rite de passage. Remplace HW-DEC-44 (simple prologue) et précise HW-DEC-06 et 16 |
| HW-DEC-49 | Lieu des chasses de faune | Une planète dédiée, pas le Homeworld | Écart avec la Bible V6, qui place tout sur le Homeworld avant Blooded ; assumé par le statut hors canon |
| HW-DEC-50 | Personnage joué en meute | Un Unblooded, armé d'un brûleur | Lames de poignet, combistick et brûleur ; pas de canon d'épaule avant le rang Blooded |
| HW-DEC-51 | Terrains des chasses de faune | Plusieurs régions | Une chasse par région de la planète dédiée, débloquées l'une après l'autre |
| HW-DEC-52 | Suite du travail | Phase 0 : corriger le code | Défauts bloquants d'abord |
| HW-DEC-53 | Nature de la planète dédiée | Monde sauvage | Planète naturelle, hostile, jamais domptée par le clan ; les Unblooded y sont largués |
| HW-DEC-54 | Régions des chasses de faune | Huit milieux, ceux de La Longue Chasse | Jungle, désert, océan, fongique, volcan, glace, marais, ruines : onglet 22_RegionsFaune |
| HW-DEC-55 | Rite de passage | Triade dans la pyramide | Trois Unblooded, armes à énergie exclues ; tuer son premier Xénomorphe donne le rang Blooded |
| HW-DEC-56 | Les 8 chasses de films | Chroniques ouvertes au rang Blooded | Jouées avec les chasseurs de films, dans l'ordre décidé (HW-DEC-16) |
| HW-DEC-57 | Nom du monde sauvage | Un des 24 mondes de l'atlas de la Bible V6 | Choix à faire quand le classeur sera de nouveau lisible ; candidats et exclusions dans feuille-de-route.md |
| HW-DEC-58 | Le Bad Blood du volcan | L'Elite s'en charge | Le Bad Blood rôde ; l'Elite l'affronte pendant que la meute survit et chasse une bête du volcan. Les Unblooded ne tuent pas un Yautja |
| HW-DEC-59 | La ruche tardive | Chasses courtes et traces annonciatrices | Chasses de faune de cinq à huit minutes ; mues, résine et carcasses dès les dernières régions |
| HW-DEC-60 | Ordre des huit régions | Jungle, marais, désert, fongique, glace, océan, volcan, ruines | Du plus lisible au plus étrange ; première vraie horde au quatrième rang |
| HW-DEC-61 | Monde et faune sans accès à la Bible V6 | Claude invente, l'auteur corrige | Vara-Kesh retenu ; faune originale marquée « création Hive Warriors », à rapprocher de la Bible V6 |
| HW-DEC-62 | La meute du joueur | La cohorte de la voie O6 | Harek le rival, Yena et Tov ; Saar comme instructeur et guide |
| HW-DEC-63 | Récompense par région | Un outil par région | Le kit de l'Unblooded grandit de chasse en chasse |
| HW-DEC-64 | Suite du travail | Phase 1 dans le code | Donner une fin aux 8 chasses existantes |
| HW-DEC-65 | Saar comme guide de la meute | Oui | Saar tient la fonction d'Adjutant pendant les chasses de faune ; Adjutant est une fonction, pas un rang |
| HW-DEC-66 | La campagne inventée | Validée | Vara-Kesh, la faune, les terrains, la répartition des outils et les traces de Xénomorphes font référence ; à rapprocher de la Bible V6 quand le classeur sera lisible |
| HW-DEC-67 | Sauvegarde sur deux appareils et règles d'accès | Oui aux choix proposés | La sauvegarde la plus récente l'emporte et le joueur est prévenu ; les règles d'accès de la table sont à vérifier avant tout développement |
| HW-DEC-68 | Suite du travail | Les trois en parallèle | Rapprochement avec la Bible V6, vérification Supabase, reste de la phase 1 |
| HW-DEC-69 | Conflit entre la Bible V6 et la campagne validée | La Bible V6 l'emporte | Ses mondes et espèces sont repris là où ils existent ; l'invention ne comble que les trous |
| HW-DEC-70 | Boss de Val Verde | Prétorien de garde | Collerette blindée qui encaisse de face, charges, dos exposé ; codé le 13 nov. |
| HW-DEC-71 | Décor générique | Rendu à son arène | Chaque élément n'apparaît que dans l'arène qui lui correspond ; ceux sans arène attendent les lieux futurs ; codé le 13 nov. |
| HW-DEC-72 | Unblooded hors du Homeworld | Emmenés par le vaisseau de leur Elite et de leur Adjutant | Les Unblooded ne voyagent pas par eux-mêmes et ne prennent pas la place de leur chef ; écart assumé avec la lettre de CORE-R05 |
| HW-DEC-73 | Monde de chaque région | Un monde de l'atlas par région (lecture de Claude) | Vara-Kesh, Eshra, Kharuun, Terek-Va, Nereth, Oshara, Rukh Tal, Dharos ; remplace le monde unique de HW-DEC-53 et 61 |
| HW-DEC-74 | Quatrième région | Grottes Thermiques | Hors du Homeworld : Terek-Va, monde de cavernes de l'atlas |
| HW-DEC-75 | Grandes proies | Espèces de la Bible V6 | Proie de réserve du monde quand elle existe ; création sinon (Eshra, Kharuun, Terek-Va) |
| HW-DEC-76 | Droit TRUNCATE sur app_cloud_saves | Retiré | Fait le 13 nov. sur la base partagée ; lecture et écriture inchangées |
| HW-DEC-77 | Un monde par chasse | Confirmé | Vara-Kesh, Eshra, Kharuun, Terek-Va, Nereth, Oshara, Rukh Tal, Dharos |
| HW-DEC-78 | Vaisseau de la meute | Le vaisseau de l'Elite | Sert de base entre deux chasses ; nom proposé : La Lame Patiente |
| HW-DEC-79 | L'Elite | Personnage nouveau | Kaedh, rédigé par Claude, à valider |
| HW-DEC-80 | Équilibrage | Version en ligne | Vercel a refusé la création du projet à ce connecteur ; aperçu jouable servi depuis la session en attendant |
| HW-DEC-81 | Branche de référence | codex/fidelity-20261109 (v70) | Fusionnée dans claude/fervent-volta-hmhdfw le 14 nov. ; son code de jeu fait foi ; le travail v58 de la session est archivé |
| HW-DEC-82 | Excel qui font foi | Ceux du dépôt d'abord, puis ceux du Drive | Audit Dynasty Warriors (26 oct.) et contrôle de complétude (27 oct.) pour le jeu ; Bible V6 de La Longue Chasse pour l'univers partagé |
| HW-DEC-83 | Portage du travail v58 | Au cas par cas | Rien de ce qui contredit le contrat Musou n'est porté sans accord |
| HW-DEC-84 | Pull requests | Proposer fidelity → master | Une PR de la branche de travail vers master ; l'auteur fusionne |
| HW-DEC-85 | Commandes | Garder celles de la v70, avec ajouts | Musou distinct par chasseur ; caméra à la souris et verrouillage sur une touche libre, sans casser coop ni manette |
| HW-DEC-86 | Campagne de l'Unblooded | Mode à part, après les P0 et P1 | « Ascension », à côté de la campagne v70, conforme au contrat Musou (32 acteurs détaillés, morts enregistrées) |
| HW-DEC-87 | Ajouts à porter | Ouverture furtive, Garde nationale à Gunnison, armes humaines en caisses | Refaits sur les systèmes v70 |
| HW-DEC-88 | Clôture des P0 du dépôt | Automatiser les preuves des recettes | REC-021, REC-022 (matériel réel) et REC-008 (validation humaine) restent à l'auteur |
| HW-DEC-12 | Alliés Yautja, armes humaines, véhicules et soutiens, coopération locale | Tous conservés | Le champ de bataille est une guerre ; ces systèmes sont à réparer, pas à couper |

## 02_Chasseurs — Chasseurs jouables (js/data/charactersData.js) ; Musou et kits codés le 14 nov. (js/systems/HunterKit.js, executeHunterMusou)

| ID | Nom affiché | Source | PV | Vitesse | Mêlée | Plasma | Coût plasma | Musou annoncé | Musou propre | Kit (4 emplacements) |
|---|---|---|---|---|---|---|---|---|---|---|
| jungle_hunter | Jungle Hunter (1987) | Predator 1987 | 1000 | 16 | 120 | 250 | 20 | Surcharge Plasma Dévastatrice | Codé le 14 nov. | Combistick lancé · Leurre vocal · Mine · Nuke |
| wolf_predator | Wolf Predator | AVP Requiem 2007 | 1150 | 17 | 145 | 280 | 16 | Solvant d'Acide Liquéfacteur | Codé le 14 nov. | Fouet vertébral · Solvant · Pistolet plasma · Mine |
| alpha_predator | Alpha Predator | Predator: Hunting Grounds | 1200 | 18 | 160 | 220 | 15 | Massacre Ancestral à la Faux | Codé le 14 nov. | Faux d'os · Arc · Piège à mâchoires · Cor de guerre |
| feral_predator | Feral Predator | Prey 2022 | 1000 | 19 | 135 | 210 | 15 | Charge de Bouclier Mutilante | Codé le 14 nov. | Bouclier · Fléchettes guidées · Bond · Leurre |
| samurai_predator | Samurai Predator | Predator: Hunting Grounds | 1050 | 19 | 150 | 200 | 18 | Entaille du Dragon Ronin | Codé le 14 nov. | Iaijutsu · Disque · Piège à mâchoires · Ruée |
| viking_predator | Viking Predator | Predator: Hunting Grounds | 1350 | 14 | 175 | 260 | 30 | Frénésie du Valhalla 360° | Codé le 14 nov. | Maul · Cor de guerre · Rugissement · Brûleur |
| city_hunter | City Hunter (1990) | Predator 2 | 850 | 19 | 100 | 180 | 15 | Tempête de Disques Boomerang | Codé le 14 nov. | Disque · Filet · Combistick lancé · Shuriken |

## 03_Arsenal36 — Registre des 36 armes (ULTIMATE_YAUTJA_ARMORY) : aucune n'est équipable, le registre n'est lu par aucun code

| N° | ID | Nom | Famille | Source annoncée | Comportement dans le code | Tri proposé |
|---|---|---|---|---|---|---|
| 1 | wristblades | Lames de poignet doubles | Mêlée | Predator 1987 | Réel | Tronc commun |
| 2 | single_scythe | Lame-faux simple | Mêlée | Predators 2010 | Aucun | Couper ou habillage |
| 3 | super_cleaver | Super couperet | Mêlée | Concrete Jungle | Aucun | Couper |
| 4 | tri_maul | Maul à trois lames | Mêlée | Concrete Jungle | Aucun (un maul distinct existe) | Fusionner avec le maul codé |
| 5 | broadsword | Épée cérémonielle | Mêlée | AVP Extinction | Aucun | Couper |
| 6 | katana | Katana | Mêlée | Hunting Grounds | Réel (bonus + Iaijutsu) | Emplacement Samurai |
| 7 | alpha_sickle | Faux d'os Alpha | Mêlée | Hunting Grounds | Réel (bonus + faux d'os) | Emplacement Alpha |
| 8 | viking_axe | Hache viking | Mêlée | Hunting Grounds | Aucun | Habillage du Viking |
| 9 | daggers | Dagues cérémonielles | Mêlée | Predator 2 | Aucun | Couper |
| 10 | war_club | Massue d'os | Mêlée | Hunting Grounds | Aucun | Couper |
| 11 | feral_shield | Bouclier Feral | Mêlée | Prey 2022 | Partiel (blocage seul) | Emplacement Feral |
| 12 | pirate_hook | Crochet pirate | Mêlée | Hunting Grounds | Aucun | Couper |
| 13 | combistick | Combistick | Allonge | Predator 2 | Réel (lancer) | Emplacement |
| 14 | glaive | Glaive | Allonge | Concrete Jungle | Partiel (toupie plasma) | Emplacement, à rééquilibrer (immunité totale) |
| 15 | smart_disc | Disque | Lancer | Predator 2 | Réel | Emplacement |
| 16 | shuriken | Shuriken | Lancer | AVP 2004 | Réel | Emplacement |
| 17 | compound_bow | Arc | Tir | Hunting Grounds | Réel | Emplacement |
| 18 | crossbow | Arbalète guidée | Tir | Prey 2022 | Aucun | Fusionner avec les fléchettes |
| 19 | speargun | Speargun | Tir | Predator 2 | Réel (fléchettes) | Emplacement |
| 20 | plasma_caster | Canon plasma d'épaule | Plasma | Predator 1987 | Réel | Tronc commun |
| 21 | dual_caster | Double canon | Plasma | AVP Requiem | Partiel (rayon de surcharge) | Musou ou emplacement de Wolf |
| 22 | plasma_pistol | Pistolet plasma | Plasma | AVP Requiem | Réel | Emplacement |
| 23 | gatling_plasma | Gatling plasma | Plasma | Predators 2010 | Aucun | Réserver au boss Berserker |
| 24 | burner_rifle | Brûleur | Plasma | AVP Extinction | Réel | Emplacement |
| 25 | plasma_whip | Fouet vertébral | Plasma | AVP Requiem | Réel | Emplacement Wolf |
| 26 | netgun | Lance-filet | Piège | Predator 2 | Réel | Emplacement |
| 27 | plasma_turret | Tourelle plasma | Piège | AVP Extinction | Aucun (une sentinelle USCM existe) | Couper |
| 28 | plasma_mines | Mines de proximité | Piège | AVP 2010 | Réel (fil-piège) | Emplacement |
| 29 | emp_mine | Mine EMP | Piège | The Predator 2018 | Partiel (EMP du gantelet) | Emplacement |
| 30 | bear_trap | Piège à mâchoires | Piège | Hunting Grounds | Réel (charges jamais consommées) | Emplacement, corriger les charges |
| 31 | audio_lure | Leurre vocal | Outil | Predator 1987 | Réel (leurre) | Emplacement |
| 32 | medicomp | Medicomp | Outil | Predator 1987 | Réel | Tronc commun |
| 33 | acid_solvent | Solvant | Outil | AVP Requiem | Réel | Emplacement Wolf |
| 34 | cloak | Camouflage | Outil | Tous | Partiel (code présent, aucune touche) | Tronc commun, à rebrancher |
| 35 | thermal_mask | Masque de vision | Outil | Tous | Réel (5 modes) | Tronc commun |
| 36 | nuke_gauntlet | Autodestruction | Outil | Predator 1987 | Réel | Emplacement ou dernier recours |

## 04_HorsRegistre — Capacités codées hors registre

| Capacité | Touche actuelle | Chiffres | Statut | Tri proposé |
|---|---|---|---|---|
| Maul sismique | Maj+1 | 620, rayon 6,5, recharge 14 s | Écrit v39+, jamais exécuté avant correctif | Emplacement Viking |
| Faux plasma | Maj+6 | 380, rayon 5,5, 25 énergie | Écrit v39+, jamais exécuté avant correctif | Couper (doublon de la faux d'os) |
| Grenade M41A | Maj+9 | 420, rayon 7,5 | Écrit v39+, jamais exécuté avant correctif | Garder, ramassée sur le champ de bataille (HW-DEC-13) |
| Fusil Gauss M77 | Maj+7 | 550, perforant | Écrit v39+, jamais exécuté avant correctif | Garder, ramassée sur le champ de bataille (HW-DEC-13) |
| Pistolet à boulons Seegson | Maj+3 | 680 | Écrit v39+, jamais exécuté avant correctif | Garder, ramassée sur le champ de bataille (HW-DEC-13) |
| Lance de tireur | Maj+Z puis clic droit | 1200, portée 42 | Écrit v39+, jamais exécuté avant correctif | À décider |
| Exosquelette | O | 12 s, −85 % dégâts, recharge 45 s | Écrit v39+, jamais exécuté avant correctif | Couper ou récompense de fin |
| Grappin du gantelet | G (conflit) | 260 + 180 | Écrit v39+, jamais exécuté avant correctif | Emplacement, après résolution du conflit |
| Neurotoxine | N | recharge 30 s | Écrit v39+, jamais exécuté avant correctif | À décider |
| Rayon du vaisseau éclaireur | M | 850/s, recharge 32 s | Écrit v39+, jamais exécuté avant correctif | Soutien orbital de campagne |
| Ruée d'ombre | Alt | 0,35 s, recharge 1,8 s | Écrit v39+, jamais exécuté avant correctif | Tronc commun (esquive) |
| Parade aux lames + riposte | F | fenêtre 0,42 s, riposte 550 | Écrit v39+, jamais exécuté avant correctif | Tronc commun |
| Rugissement | H | étourdit 2,2 s, rayon 14 | Écrit v39+, jamais exécuté avant correctif | Emplacement |
| Molosses | Maj+H | 2 molosses, invulnérables | Écrit v39+, jamais exécuté avant correctif | À décider |
| Bio-masques | Maj+V | 6 masques, multiplicateurs | Écrit v39+, jamais exécuté avant correctif | Déblocage de progression |
| Gelée royale | 0 | 12 s de frénésie | Écrit, socle ≤v38, non revérifié | Ressource de campagne |
| Cor de guerre | K | 10 s, ×1,5 dégâts, sans recharge | Écrit, socle ≤v38, non revérifié | Emplacement, ajouter une recharge |
| Métamorphose hybride | Alt+M | 15 s invulnérable | Écrit, socle ≤v38, non revérifié | Couper : contredit le canon |

## 05_Controles — Commandes du chasseur, codées le 14 nov. (js/systems/HunterKit.js) ; les anciennes touches restent dans le code, désactivées

| Action | Touche | Remarque | État |
|---|---|---|---|
| Se déplacer | WASD |  | Codé et vérifié le 14 nov. |
| Attaque légère (5 temps) | Clic gauche | Riposte après une parade réussie | Codé et vérifié le 14 nov. |
| Attaque lourde (finition C1 à C6) | Clic droit |  | Codé et vérifié le 14 nov. |
| Canon plasma, chargé à 0,55 s | Maj gauche maintenue |  | Codé et vérifié le 14 nov. |
| Musou propre au chasseur | Espace | Débat contre un facehugger royal agrippé | Codé et vérifié le 14 nov. |
| Parade | F |  | Codé et vérifié le 14 nov. |
| Esquive | Alt |  | Codé et vérifié le 14 nov. |
| Camouflage | C | Le retirer alerte la ruche pendant l'ouverture furtive | Codé et vérifié le 14 nov. |
| Changer d'arme | Q | Garde l'enchaînement en cours | Codé et vérifié le 14 nov. |
| Verrouiller une cible | Tab | Boss, sinon élite la plus forte, sinon ennemi le plus proche ; le chasseur se tourne vers elle | Codé et vérifié le 14 nov. |
| Vision | V | 5 modes ; Maj+V change de bio-masque | Codé et vérifié le 14 nov. |
| Medicomp | Z |  | Codé et vérifié le 14 nov. |
| Interagir, mise à mort, exécution | E | Mise à mort silencieuse camouflé ; exécution d'une élite à 25 % ; monter sur le planeur | Codé et vérifié le 14 nov. |
| Arme humaine ramassée | G | Gauss, puis Seegson, puis M41A, selon les munitions | Codé et vérifié le 14 nov. |
| Emplacements 1 à 4 | 1 2 3 4 | Kit par chasseur, onglet 02_Chasseurs | Codé et vérifié le 14 nov. |
| Pause | Échap |  | Codé et vérifié le 14 nov. |
| Mode sans fin | Maj+M |  | Codé et vérifié le 14 nov. |

## 06_Ennemis — Bestiaire xénomorphe (js/entities/XenomorphHorde.js)

| Type | Apparition | PV | Vitesse | Dégâts | Comportement | Statut | Dans la Bible V6 |
|---|---|---|---|---|---|---|---|
| Drone | Aléatoire (défaut) | 120 | 11 | 25 | 22 % rôdent aux murs et tombent du plafond | Écrit, socle ≤v38, non revérifié | FAU-30 |
| Facehugger | Aléatoire (13 %) | 40 | 17 | 15 | S'agrippe, épreuve de 5 pressions | Écrit, socle ≤v38, non revérifié | FAU-29 |
| Boiler | Aléatoire | 80 | 14 | 50 | Explose à 3,2 m | Écrit, socle ≤v38, non revérifié | Non |
| Néomorphe | Aléatoire | 95 | 19 | 35 | Bond | Écrit, socle ≤v38, non revérifié | Non |
| Praetomorphe | Aléatoire | 160 | 16 | 42 | Saut | Écrit, socle ≤v38, non revérifié | Non |
| Guerrier rouge | Aléatoire | 140 | 15.5 | 34 | Combat les autres xénomorphes | Écrit, socle ≤v38, non revérifié | Non |
| Cracheur | Aléatoire | 110 | 12 | 30 | Mortier d'acide 36 | Écrit, socle ≤v38, non revérifié | Non |
| Coureur | Aléatoire | 85 | 21 | 28 |  | Écrit, socle ≤v38, non revérifié | Non |
| Cryo-xénomorphe | Aléatoire | 175 | 14.5 | 38 | Souffle de givre 24 | Écrit v39+, jamais exécuté avant correctif | Non |
| Cyber-xénomorphe | Aléatoire | 220 | 13 | 44 | Dards, −35 % dégâts non lourds | Écrit v39+, jamais exécuté avant correctif | Non |
| Œufs (6) | Chaque vague |  |  |  | Libèrent des facehuggers | Écrit, socle ≤v38, non revérifié | Non |
| Broyeur | Chaque vague | 750 | 22 |  | Charge, −80 % de face | Écrit, socle ≤v38, non revérifié | Non |
| Prétoriens (2) | Chaque vague | 480 |  |  | Crachat, garde du boss | Écrit, socle ≤v38, non revérifié | Non |
| Alien de la grille | Chaque vague | 420 |  |  | Insensible au filet, flaque d'acide | Écrit, socle ≤v38, non revérifié | Non |
| Officiers de ruche (2) | Chaque vague | 350 |  |  |  | Écrit, socle ≤v38, non revérifié | Non |
| Alpha « Marvel » | Chaque vague | 1800 |  |  |  | Écrit v39+, jamais exécuté avant correctif | Non |
| Micro-essaim | Chaque vague | 150 |  | 8 |  | Écrit v39+, jamais exécuté avant correctif | Non |
| Facehuggers royaux (2) | Chaque vague | 140 |  | 150 | Agrippe 5 s | Écrit v39+, jamais exécuté avant correctif | Non |
| Traqueurs caméléons (2) | Chaque vague | 420 |  |  | Visibles en vision EM | Écrit v39+, jamais exécuté avant correctif | Non |
| Titan Deacon | Chaque vague | 2400 |  |  |  | Écrit v39+, jamais exécuté avant correctif | Non |
| Mantas (2) | Chaque vague | 320 |  | 65 | Piqué | Écrit v39+, jamais exécuté avant correctif | Non |
| Harpie prétorienne | Chaque vague | 1200 |  | 120 | Volante | Écrit v39+, jamais exécuté avant correctif | Non |
| Titan Rogue King | Chaque vague | 3200 |  |  |  | Écrit v39+, jamais exécuté avant correctif | Non |
| Raven | Chaque vague | 2400 |  |  |  | Écrit v39+, jamais exécuté avant correctif | Non |
| Ancien Predalien | Chaque vague | 3600 |  |  |  | Écrit v39+, jamais exécuté avant correctif | Non |
| Matriarche en gestation | Chaque vague | 4200 |  |  | Pond des œufs de 180 PV | Écrit v39+, jamais exécuté avant correctif | Non |
| Chestburster | 15 % à la mort d'un ennemi | 30 |  | 12 |  | Écrit, socle ≤v38, non revérifié | Non |

## 07_Boss — Boss (js/entities/Bosses.js)

| ID | PV | Particularités | Utilisé par | Statut |
|---|---|---|---|---|
| predalien_matriarch_titan | 10000 | Phase 2 à 65 %, portée à 45 %, étourdi à 18 % | Toutes les arènes, vague 5 | Écrit v39+, jamais exécuté avant correctif |
| rogue_king_prime | 9500 | Charge 380, phase 2 à 45 % | Base Charon | Écrit v39+, jamais exécuté avant correctif |
| berserker_super_predator | 8800 | Appelle une méthode absente (spawnAcidSpit) ; pas d'exécution dédiée | Réserve de chasse | Écrit v39+, jamais exécuté avant correctif |
| awakened_engineer | 8500 | Bouclier de 2000 PV en phase 2 | Sarcophage (toutes arènes) | Écrit v39+, jamais exécuté avant correctif |
| imperial_queen | 8000 | Gabarit de reine | Aucune arène | Écrit, socle ≤v38, non revérifié |
| trilobite_prime | 7000 | Étreinte 95, vase 80 | Aucune arène | Écrit v39+, jamais exécuté avant correctif |
| predalien_abomination | 6500 |  | Aucune arène | Écrit v39+, jamais exécuté avant correctif |
| empress_matriarch | 6000 | Bourrasque d'ailes 70 | Xenomorph Prime ; bac à sable | Écrit, socle ≤v38, non revérifié |
| predalien_queen | 5000 | Régurgite des chestbursters | Gunnison | Écrit, socle ≤v38, non revérifié |
| the_offspring | 4500 | Cri 60 et −25 énergie | Station Renaissance | Écrit, socle ≤v38, non revérifié |
| (défaut) | 3000 | Reine générique, étourdie 6 s à 30 % | xenomorph_queen, predalien, praetorian | Écrit, socle ≤v38, non revérifié |

## 08_Arenes — Arènes et campagne cible (8 chasses)

| Ordre cible | ID | Nom | Source | Météo | Vagues | Boss déclaré | Boss réellement codé | Décor propre | Action requise |
|---|---|---|---|---|---|---|---|---|---|
| 1 | val_verde_jungle | Jungle de Val Verde | Predator 1987 | Brume humide | 5 | praetorian | Oui : Prétorien de garde, codé le 13 nov. | 11 éléments : épave du Huey, piège à rondins, pont de Billy, mirador, « Old Painless », cascade | Aucune |
| 2 | la_rooftops | Toits de Los Angeles | Predator 2 | Tempête | 5 | predalien | Oui : predalien_abomination (6500 PV), branché le 13 nov. | Héliport, château d'eau, nacelle, nuage de fréon | Aucune |
| 3 | gunnison_forest | Forêt de Gunnison | AVP Requiem | Pluie | 5 | predalien_queen | Oui (5000 PV) | Vaisseau éclaireur écrasé, crypte, pylône, 16 arbres perchoirs | Aucune |
| 4 | antarctic_pyramid | Pyramide antarctique | AVP 2004 | Aucune | 5 | xenomorph_queen | Oui : imperial_queen (8000 PV), branché le 13 nov. | Dalles coulissantes, autel, pièges à faux | Aucune |
| 5 | game_preserve_planet | Réserve de chasse | Predators 2010 | Aucune | 6 | berserker_super_predator | Oui (8800 PV), incomplet | Totem du Predator crucifié, perchoir, chutes de rochers | Corriger la méthode absente, ajouter l'exécution |
| 6 | charon_rogue_base | Base Charon | Aliens: Rogue 1993 | Aucune | 6 | rogue_king_prime | Oui (9500 PV) | Incubateurs, console de Kleist, passerelle, pylônes inhibiteurs | Ajouter le thème aux garde-fous de décor |
| 7 | romulus_station | Station Renaissance | Alien: Romulus 2024 | Apesanteur cryo | 6 | the_offspring | Oui (4500 PV) | Sas en apesanteur, console de Rook, centrifugeuse Z-01 | Revoir les PV (trop bas pour une 7e chasse) |
| 8 | xenomorph_prime | Monde-ruche Xenomorph Prime | Univers étendu ; PLAN08 de la Bible V6 | Spores toxiques | 6 | empress_matriarch | Oui (6000 PV) | Piliers de résine, ponts de chitine, nids, nœuds de gelée royale | Aligner sur les 12 secteurs XP-Z01 à Z12 ; revoir les PV |

## 09_Factions — Factions et soutiens

| Faction | Apparition | Chiffres | Comportement | Défaut constaté | Tri |
|---|---|---|---|---|---|
| Marines coloniaux | 4 au départ | 150 PV, 20 à 35 dégâts | Visent les xénomorphes, puis le joueur | Rien ne les blesse | Garder, les rendre mortels |
| Garde nationale | Gunnison | Comme les marines | Comme les marines, à Gunnison seulement (HW-DEC-20) | Rien ne les blesse | Codée le 13 nov. par habillage des marines |
| Synthétiques | 3 au départ | 280 à 340 PV | Idem ; coupés en deux à 0 PV |  | Garder en arènes Weyland-Yutani seulement |
| Alliés Yautja | 3 au départ | 950 PV | Combattent aux côtés du joueur | Invulnérables | Garder (HW-DEC-12), les rendre mortels |
| Bad Blood | Vague 3 | 2200 PV | Duel en 3 épreuves sous 850 PV | Insensible à la plupart des armes | Garder comme mini-boss d'une chasse |
| Molosses | Maj+H | 600 PV | Alliés invoqués | Invulnérables | À décider |
| Tourelle sentinelle | Touche 4 ou vague 2 | 500 munitions | Tir automatique | Doublon dans ColonialMarines.js | Garder (HW-DEC-12), supprimer le doublon |
| Drone faucon | Touche 5 | 26 s | Marque les cibles |  | Emplacement possible |
| Blindé M577 | Vague 3 | 260 dégâts | Vise le boss | PV jamais réduits | Garder (HW-DEC-12), rendre destructible |
| Cheyenne | Vagues 2 et 4 | Roquettes 340 à 550 | Frappe aérienne |  | Garder (HW-DEC-12) |
| Planeur Yautja | G | Vitesse 32 | Monture | Conflit de touche G | Garder (HW-DEC-12), résoudre le conflit de touche |

## 10_Progression — Progression et économie

| Système | Monnaie | Contenu | Sauvegardé | Défaut constaté | Statut |
|---|---|---|---|---|---|
| Forge du menu | Total d'éliminations × 100 | PV +200 et dégâts +25 % par niveau, 5 niveaux, 3 couleurs de laser | Oui | La monnaie n'est jamais débitée ; la croix de fermeture est sans effet | Écrit, socle ≤v38, non revérifié |
| Loadout | Aucune | 4 armes principales, 4 secondaires, 2 gadgets parmi 5 | Non | 4 bonus jamais lus ; tout est débloqué | Écrit, socle ≤v38, non revérifié |
| Salle des trophées | Aucune | 4 succès (50, 500, 1500 éliminations ; combo de 50) | Oui |  | Écrit, socle ≤v38, non revérifié |
| Forge de clan (F3) | Score de session + gelée royale | 9 améliorations, 1500 à 4000 points et 2 à 6 gelées | Oui | Sa fermeture renvoie au menu principal | Écrit v39+, jamais exécuté avant correctif |
| Passerelle du vaisseau-mère (F4) | Score de session | Barrage 4000, capsule 2500, bénédiction 3000 | Non | Ordre des arguments incorrect pour la capsule | Écrit v39+, jamais exécuté avant correctif |
| Coffre d'honneur (F2) | Aucune | Honneur, crânes, meilleur combo, vague maximale | Oui | Affiche 3 faux trophées quand il est vide | Écrit v39+, jamais exécuté avant correctif |
| Bio-masques | Aucune | 6 masques à multiplicateurs | Non | Tous disponibles d'emblée | Écrit v39+, jamais exécuté avant correctif |
| Campagne | Aucune | 5 chapitres | Non | 4 niveaux sur 5 n'existent pas ; aucune progression lue | Décoratif (texte ou affichage seul) |

## 11_P0_Defauts — Défauts bloquants et écarts (priorité de correction)

| ID | Priorité | Défaut | Où | État |
|---|---|---|---|---|
| HW-BUG-01 | P0 | Accolade manquante : le module ne se chargeait pas (depuis v39) | js/engine/GoreEngine.js:356 | Corrigé le 12 nov. |
| HW-BUG-02 | P0 | Variable isNearCrypt déclarée deux fois (depuis v57) | js/main.js:3071 | Corrigé le 12 nov. |
| HW-BUG-03 | P0 | Nom « synthetics » non défini à chaque image | js/entities/Player.js:2202 | Corrigé le 12 nov. |
| HW-BUG-04 | P0 | Nom « particles » non défini à chaque image | js/entities/Environment.js:1083 | Corrigé le 12 nov. |
| HW-BUG-05 | P0 | Champ inexistant (switchPos) : chaque image s'arrêtait avant le rendu 3D, les vagues et la défaite | js/main.js:2973 | Corrigé le 13 nov. |
| HW-BUG-06 | P0 | window.gameInstance est lu 182 fois et n'est jamais défini (l'objet s'appelle window.game) | 6 fichiers d'entités | Corrigé le 13 nov. : alias défini dans js/main.js |
| HW-BUG-07 | P0 | Aucune condition de victoire : endGame(true) n'était jamais appelé | js/main.js | Corrigé le 13 nov. : l'exécution du boss d'arène gagne la chasse ; vérifié dans les 8 arènes |
| HW-BUG-08 | P0 | Un boss ne meurt pas par les dégâts ; seule l'exécution le retire et il bloque les vagues | js/entities/Bosses.js | Corrigé le 13 nov. : à zéro, le boss reste à terre à 1 PV jusqu'à l'exécution ; vérifié sur les 11 types |
| HW-BUG-09 | P0 | Les ennemis à 0 PV restent actifs hors coups de mêlée | js/entities/XenomorphHorde.js | Corrigé le 13 nov. : balayage à chaque image |
| HW-BUG-10 | P1 | Camouflage et changement d'arme sans touche depuis v51 | js/main.js | Corrigé le 14 nov. : C et Q |
| HW-BUG-11 | P1 | Conflits de touches : G, 6, Maj+4, Maj+8, Espace, Alt+M, Z | js/main.js:242-886 | Corrigé le 14 nov. : le kit du chasseur remplace les anciennes touches |
| HW-BUG-12 | P1 | Cartes d'arène affichant « undefined » (champs icon, difficulty, description absents) | js/ui/UIManager.js:124 | Corrigé le 13 nov. : nombre de vagues et description affichés |
| HW-BUG-13 | P1 | Pas de pause, pas de retour au menu depuis l'écran de défaite | js/main.js:204 | Corrigé le 13 nov. : pause par Échap, abandon, retour au menu |
| HW-BUG-14 | P1 | Boss de vague 5 identique dans toutes les arènes | js/main.js:3122 | Corrigé le 13 nov. : chaque arène a son boss ; la Matriarche titan est réservée au mode sans fin |
| HW-BUG-15 | P1 | Environ 45 éléments de décor construits dans toutes les arènes (réacteur et Space Jockey à Val Verde) | js/entities/Environment.js:606 | Corrigé le 13 nov. : décor rendu à son arène (HW-DEC-71) |
| HW-BUG-16 | P2 | Méthodes appelées mais absentes : setLaserColor, emitExplosion, emitAlienBloodSpurt, spawnAcidSpit, 10 sons | Plusieurs | Ouvert |
| HW-BUG-17 | P1 | Coopération (conservée, HW-DEC-12) : le joueur 2 ne peut pas attaquer | js/main.js:2369 | Ouvert |
| HW-BUG-18 | P2 | Numéros de version discordants (v6, v12, v27, v29, v58, 1.0.0) | index.html, main.js, package.json | Corrigé en partie le 13 nov. : v58.1 dans le titre, le sous-titre et package.json ; les commentaires de fichiers restent |
| HW-BUG-19 | P2 | Aucune limite d'ennemis ni mise en commun des maillages : la vague N crée 45 + 15N objets | js/entities/XenomorphHorde.js | Atténué le 14 nov. : 120 ennemis aléatoires au plus par vague ; mise en commun des maillages non faite |
| HW-BUG-20 | P2 | Liste des commandes des options figée vers v29 | index.html | Corrigé le 14 nov. : options et aide F1 décrivent le kit |
| HW-BUG-25 | P1 | Codex, bac à sable, forge, trophées, options et mode photo s'ouvraient vides depuis le menu : ils étaient imbriqués dans l'interface de jeu, masquée avec elle | index.html | Corrigé le 14 nov. |
| HW-BUG-21 | P1 | Le chasseur meurt en moins de 40 s sous des saisies automatiques dans les 8 arènes ; équilibrage à mesurer avec un vrai joueur | Essai du 13 nov. | Ouvert |
| HW-BUG-23 | P1 | Depuis que l'objet de jeu est correctement nommé, des systèmes jamais exécutés tournent : 5 vagues et 490 éliminations en 45 s sous saisies automatiques | Essai du 13 nov. | Ouvert : équilibrage à reprendre |
| HW-BUG-24 | P0 | La rafale du Berserker appelait une fonction absente (spawnAcidSpit) | js/entities/Bosses.js | Corrigé le 13 nov. : fonction écrite, 60 de dégâts par tir, valeur provisoire |
| HW-BUG-22 | P2 | Des confettis étaient tirés sur l'écran de défaite ; le filtre de vision reste affiché | Essai du 13 nov. | Confettis corrigés le 13 nov. (victoire seulement) ; filtre de vision ouvert |

## 12_Canon — Règles héritées de La Longue Chasse et écarts de Hive Warriors

| ID | Règle ou fait de la source | Source (classeur · onglet) | Situation dans Hive Warriors | Traitement |
|---|---|---|---|---|
| HW-CAN-01 | Les personnages de films restent dans des chroniques séparées | Bible V6 · Chroniques cinéma | 7 chasseurs de films et de jeux jouables | Tout le jeu est classé « chroniques légendaires » |
| HW-CAN-02 | Sept rangs : Youngling, Unblooded, Young Blood, Blooded, Elite, Elder, Ancient | Bible V6 · Rangs et fonctions | Le codex liste 6 entrées dont Bad Blood et « Clan Leader & Elder » | Réécrire le codex : Bad Blood est un statut, pas un rang |
| HW-CAN-03 | Aucun code d'honneur universel n'est affirmé | Bible V6 · Justice et Enforcers | Le codex présente 5 lois comme universelles | Présenter ces lois comme la tradition rapportée par les chroniques |
| HW-CAN-04 | Bestiaire xénomorphe : Facehugger, Drone, Guerrier, Reine active | Bible V6 · Faune et adversaires | Environ 26 types et 10 boss | Autorisé en chronique ; chaque type porte sa source et « non certifié 1:1 » |
| HW-CAN-05 | Xeno Prime (PLAN08) : 12 secteurs XP-Z01 à Z12, arène de la reine active | Bible V6 · Xeno Prime | Une arène « xenomorph_prime » sans lien | La 8e chasse reprend les noms de secteurs |
| HW-CAN-06 | Échelle contenue : pas de nouvelle population à chaque visite | Bible V6 · Méthode de guerre | Des centaines d'ennemis par chasse | Écart assumé : la démesure est le propre des chroniques |
| HW-CAN-07 | Aucun bonus de combat par les cosmétiques | Gauntlets V142 · 09_Lore_Equilibre | Les bio-masques donnent des multiplicateurs | Écart assumé (HW-DEC-11) |
| HW-CAN-08 | Son original seulement, aucun son de film | Gauntlets V142 · B-18 | Audio 100 % procédural | Conforme |
| HW-CAN-09 | Droits et licences requis avant toute diffusion commerciale | Gauntlets V142 · B-17 | Noms, personnages et lieux de films | Projet de fan non commercial (HW-DEC-09) |
| HW-CAN-10 | Un dessin ou un élément jouable ne certifie pas une fidélité 1:1 | THE PIT V62 ; PHG Fidélité V137 | Les messages de version annoncent « 1:1 » | Remplacer par « inspiré de » ; 0 élément certifié |
| HW-CAN-11 | Ne jamais changer arbitrairement une caste xénomorphe | YAUTJA_V100_SUIVI | 3 boss déclarés retombent sur une reine générique | Créer les boss manquants avant de les annoncer |
| HW-CAN-12 | Lex Woods n'est pas épargnée pour grossesse dans AVP 2004 : elle est honorée comme combattante | Film AVP 2004 | Le codex affirme l'inverse | Corriger l'entrée du codex |
| HW-CAN-13 | Le Predalien est classé xénomorphe hybride, pas Yautja | Catalogue tous médias · Exclusions | Conforme dans le codex | Aucun |
| HW-CAN-14 | Les 15 clans de la Bible V6 sont des créations du projet | Bible V6 · Identités des clans | Aucun clan nommé ; « Forge de clan », « Coffre d'honneur du clan » | Le clan du joueur reste anonyme (HW-DEC-10) |

## 13_Questions — Questions ouvertes pour l'auteur (les autres ont été tranchées : voir HW-DEC-09 à 80)

| ID | Question | Pourquoi elle compte | Défaut retenu en attendant |
|---|---|---|---|
| Q50 | Kaedh et La Lame Patiente vous conviennent-ils ? | Personnage et vaisseau inventés par Claude | Fiche de campagne-unblooded.md |
| Q51 | Version en ligne durable | Le connecteur Vercel n'a pas le droit de créer un projet ; l'aperçu servi depuis la session s'arrête avec elle | Importer le dépôt dans Vercel depuis votre compte : chaque push donnera une adresse de prévisualisation privée |

## 15_Soutiens — Soutiens par arène (proposition découlant de HW-DEC-14 ; aujourd'hui tout apparaît partout)

| Ordre | Arène | Alliés Yautja | Marines | Synthétiques | Blindé M577 | Frappe Cheyenne | Armes humaines à ramasser | Raison |
|---|---|---|---|---|---|---|---|---|
| 1 | Jungle de Val Verde | Non | Non | Non | Non | Non | Non | 1987 : le chasseur est seul ; aucun matériel du futur |
| 2 | Toits de Los Angeles | Oui | Non | Non | Non | Non | Non | 1990 : le clan est présent à la fin de Predator 2 |
| 3 | Forêt de Gunnison | Non | Garde nationale (HW-DEC-20) | Non | Non | Non | Oui, armes contemporaines | Époque contemporaine : soldats de la Garde nationale, à créer |
| 4 | Pyramide antarctique | Oui | Non | Non | Non | Non | Non | Rite de passage mené à plusieurs |
| 5 | Réserve de chasse | Non | Non | Non | Non | Non | Oui | Terrain d'un clan hostile ; armes des proies humaines |
| 6 | Base Charon | Non | Oui | Oui | Oui | Oui | Oui | Complexe militaire et scientifique |
| 7 | Station Renaissance | Non | Oui | Oui | Non | Non | Oui | Station Weyland-Yutani |
| 8 | Xenomorph Prime | Oui | Non | Non | Non | Non | Non | Assaut du clan sur le monde-ruche |

## 16_Deblocages — Déblocages lus dans La Longue Chasse par compte en ligne, étape par étape (HW-DEC-15, 17 à 19, 24 ; noms tirés de la Bible V6, onglet « Les six voies »)

| Contenu débloqué dans Hive Warriors | Nature | Origine dans La Longue Chasse | Rôle connu | Condition | Statut |
|---|---|---|---|---|---|
| Varek | Personnage jouable, création du projet | O1 Rejeté du clan | Père hostile | Une fin de la voie O1 (proposé) | Validée (HW-DEC-46), chiffres à ajuster après essais |
| Dhera | Personnage jouable, création du projet | O1 Rejeté du clan | Instructrice | Mission O1-M25 (proposé) | Validée (HW-DEC-46), chiffres à ajuster après essais |
| Ruun | Personnage jouable, création du projet | O1 Rejeté du clan | Frère du joueur | Mission O1-M21 (proposé) | Validée (HW-DEC-46), chiffres à ajuster après essais |
| Sael | Personnage jouable, création du projet | O2 Héritier du masque | Gardienne du masque | Une fin de la voie O2 (proposé) | Validée (HW-DEC-46), chiffres à ajuster après essais |
| Khor | Personnage jouable, création du projet | O2 Héritier du masque | Descendant d'un pisteur | Mission O2-M32 (proposé) | Validée (HW-DEC-46), chiffres à ajuster après essais |
| Orha | Personnage jouable, création du projet | O2 Héritier du masque | Artisane des supports | Mission O2-M28 (proposé) | Validée (HW-DEC-46), chiffres à ajuster après essais |
| Tava | Personnage jouable, création du projet | O3 Porteur des derniers noms | Passeuse survivante | Une fin de la voie O3 (proposé) | Validée (HW-DEC-46), chiffres à ajuster après essais |
| Orem | Personnage jouable, création du projet | O3 Porteur des derniers noms | Jeune compagnon de cohorte | Mission O3-M32 (proposé) | Validée (HW-DEC-46), chiffres à ajuster après essais |
| Vesha | Personnage jouable, création du projet | O3 Porteur des derniers noms | Artisane survivante | Mission O3-M26 (proposé) | Validée (HW-DEC-46), chiffres à ajuster après essais |
| Drek | Personnage jouable, création du projet | O4 Nom entaché | Parent du joueur | Mission O4-M23 (proposé) | Validée (HW-DEC-46), chiffres à ajuster après essais |
| Isha | Personnage jouable, création du projet | O4 Nom entaché | Descendante lésée | Mission O4-M33 (proposé) | Validée (HW-DEC-46), chiffres à ajuster après essais |
| Evar | Personnage jouable, création du projet | O4 Nom entaché | Enforcer local | Une fin de la voie O4 (proposé) | Validée (HW-DEC-46), chiffres à ajuster après essais |
| Mara Venn | Personnage jouable, création du projet | O5 Dette envers l'Étranger | Traqueuse humaine ; deux variantes (HW-DEC-27 et 29) | Hors clan : mission O5-M24 ; équipée par les Yautja : fin O5-E1 (proposé) | Validée (HW-DEC-46), chiffres à ajuster après essais |
| Esha | Personnage jouable, création du projet | O5 Dette envers l'Étranger | Réparatrice du port de Namarra | Mission O5-M22 (proposé) | Validée (HW-DEC-46), chiffres à ajuster après essais |
| Keth | Personnage jouable, création du projet | O5 Dette envers l'Étranger | Chasseur qui sous-estime l'humaine | Mission O5-M25 (proposé) | Validée (HW-DEC-46), chiffres à ajuster après essais |
| Saar | Personnage jouable, création du projet | O6 La Longue Chasse | Instructeur de cohorte | Une fin de la voie O6 (proposé) | Validée (HW-DEC-46), chiffres à ajuster après essais |
| Harek | Personnage jouable, création du projet | O6 La Longue Chasse | Rival de cohorte | Mission O6-M33 (proposé) | Validée (HW-DEC-46), chiffres à ajuster après essais |
| Yena | Personnage jouable, création du projet | O6 La Longue Chasse | Camarade de cohorte | Mission O6-M27 (proposé) | Validée (HW-DEC-46), chiffres à ajuster après essais |
| Tov | Personnage jouable, création du projet | O6 La Longue Chasse | Camarade de cohorte | Mission O6-M27 (proposé) | Validée (HW-DEC-46), chiffres à ajuster après essais |
| Saer | Non jouable (HW-DEC-30) | O4 Nom entaché | Archiviste local | Sans objet | Voix possible du codex |
| Habillages des 15 clans | Couleurs d'armure et de masque | Identités des clans CL1 à CL15 |  | Appartenir au clan dans La Longue Chasse | Décidé (HW-DEC-18), condition proposée |
| Arène « Arène de la reine active » | Variante de la 8e chasse | Xeno Prime, secteur XP-Z12 |  | Avoir vaincu la première reine (mission R2-M026) | Décidé (HW-DEC-18), condition proposée |
| Arène « Tête de reine géante au sol » | Arène supplémentaire | Xeno Prime, secteur XP-Z09 |  | Avoir préparé Xeno Prime (mission R2-M025) | Décidé (HW-DEC-18), condition proposée |

## 17_Comptes — Système de comptes existant (projet Supabase commun, lu le 13 novembre 2026 en lecture seule)

| Élément | Constat | Usage pour Hive Warriors |
|---|---|---|
| Projet | Un projet Supabase commun à plusieurs applications de l'auteur, région eu-west-1 | Réutilisé tel quel (HW-DEC-21) |
| Comptes | Table d'utilisateurs du service d'identification de Supabase ; toutes les tables de sauvegarde y sont rattachées | Même compte pour La Longue Chasse et Hive Warriors |
| yautja_cloud_saves | Une ligne par compte : révision, instantané complet (20 Mo au plus), date ; décrite comme l'espace Yautja complet, synchronisé entre mobile et bureau ; 1 ligne présente | Lue seulement, pour connaître les étapes franchies (HW-DEC-15) |
| app_cloud_saves | Une ligne par compte et par application : clé d'application, contenu, date ; décrite comme un instantané du stockage local par application ; vide | Candidate pour la sauvegarde de Hive Warriors (Q20) |
| Protection | Vérifiée le 13 nov. en lecture seule : sur app_cloud_saves et yautja_cloud_saves, lecture, écriture et modification sont limitées à la ligne du joueur connecté ; app_cloud_saves autorise aussi la suppression de sa propre ligne | Conforme à HW-DEC-67 |
| Point d'attention | Le rôle « authenticated » détient aussi le droit TRUNCATE sur app_cloud_saves, qui échappe à la sécurité par ligne. L'API REST de Supabase n'expose pas TRUNCATE, donc le risque est faible ; une fonction SQL exposée pourrait toutefois vider la table de toutes les applications | Retiré le 13 nov. (HW-DEC-76) ; vérifié : le rôle garde lecture, écriture, modification et suppression de sa propre ligne |
| Méthode d'identification | Adresse e-mail et mot de passe, par le service d'identification de Supabase (inscription, connexion, renouvellement de session, déconnexion) ; relevé dans app/game/systems/cloudAccountRestV71.ts de La Longue Chasse | Reprise à l'identique (HW-DEC-23) |
| Écriture de la sauvegarde de La Longue Chasse | Révision optimiste : chaque écriture doit porter la révision précédente + 1, vérifiée par un déclencheur ; un conflit entre deux appareils est signalé au joueur | Hive Warriors ne l'écrit jamais ; il lit l'instantané |
| Sauvegarde de Hive Warriors | Table app_cloud_saves retenue (HW-DEC-26) ; elle n'a pas de numéro de révision | Le dernier appareil qui écrit l'emporte : risque à traiter (Q23) |
| Dans Hive Warriors | Aucun code de compte ni de sauvegarde en ligne ; 6 clés de stockage local | Tout est à écrire |

## 18_LieuxFuturs — Lieux futurs (HW-DEC-37) : aucun n'est dans le code ; dates et détails à vérifier avant écriture

| Lieu | Œuvre | Idée de chasse | Boss pressenti | Déjà dans le code | Priorité proposée |
|---|---|---|---|---|---|
| Hadley's Hope, LV-426 | Aliens (1986) | Colonie, centre d'opérations, puis le nid sous le processeur atmosphérique | Reine | Marines, sentinelles, blindé M577, Cheyenne, chargeur | 1 |
| Épave des Ingénieurs, LV-426 | Alien (1979) | Salle du pilote et cale aux œufs | À définir | Estrade du Space Jockey, chambre de l'épave | 2 |
| Fiorina 161 | Alien 3 (1992) | Prison-fonderie, couloirs, moule à plomb | Coureur quadrupède | Fonderie de plomb (décor générique) | 1 |
| Grandes Plaines, 1719 | Prey (2022) | Forêt, clairière brûlée, camp des trappeurs | À définir (« et si… ») | Feral Predator jouable, sans arène à lui | 1 |
| Yautja Prime | Univers étendu ; Homeworld de la Bible V6 | Arène rituelle de la cité | Reine d'épreuve | Citadelle du menu | 2 |
| Genna | Predator: Badlands (2025) | Planète hostile, faune géante | À définir | Non | 2 |
| Scandinavie viking | Killer of Killers (2025) | Premier récit du film | À définir | Viking Predator jouable (celui de Hunting Grounds, distinct) | 3 |
| Japon féodal | Killer of Killers (2025) | Deuxième récit du film | À définir | Samurai Predator jouable (celui de Hunting Grounds, distinct) | 3 |
| Pacifique, Seconde Guerre mondiale | Killer of Killers (2025) | Troisième récit du film | À définir | Non | 3 |
| Arène du roi Grendel | Killer of Killers (2025) | Combat d'arène final | Roi Grendel | Non | 3 |
| Nostromo | Alien (1979) | Huis clos : un seul xénomorphe, puis l'essaim « et si… » | À définir | Non | 3 |
| Station Sevastopol | Alien: Isolation (2014) | Station en ruine, synthétiques Working Joe | À définir | Working Joe déjà codé | 2 |
| LV-223 | Prometheus (2012) | Dôme des Ingénieurs, urnes | Ingénieur éveillé | Ingénieur éveillé, urnes, Trilobite, Deacon déjà codés | 1 |
| Planète 4 | Alien: Covenant (2017) | Cité morte des Ingénieurs | À définir | Ruines de la Planète 4, néomorphe, praetomorphe déjà codés | 2 |
| USM Auriga | Alien, la résurrection (1997) | Vaisseau-laboratoire, bassin inondé | À définir | Bassin de l'Auriga (décor générique) | 2 |
| Île Bouvet, station baleinière | AVP (2004) | La surface au-dessus de la pyramide | À définir | Non | 3 |
| BG-386 | Aliens vs. Predator (jeu, 2010) | Colonie, jungle, ruines Yautja | À définir | Non | 3 |
| Ryushi | Aliens vs. Predator (comics, 1989) | Colonie d'élevage en plein désert, la toute première rencontre des deux espèces | Reine | Non | 2 |
| Abattoir et métro de Los Angeles | Predator 2 (1990) | Suite de la chasse des toits | À définir | Toits de Los Angeles | 3 |

## 19_ChasseursFuturs — Chasseurs futurs (HW-DEC-38) : aucun n'est dans le code ; noms repris du catalogue des 54 gantelets de La Longue Chasse

| Chasseur | Œuvre | Trait de jeu pressenti | Lié à | Priorité proposée |
|---|---|---|---|---|
| Scar | AVP (2004) | Équilibré ; shuriken et combistick | Pyramide antarctique | 1 |
| Celtic | AVP (2004) | Puissant ; filet | Pyramide antarctique | 1 |
| Chopper | AVP (2004) | Lames de bras longues | Pyramide antarctique | 1 |
| Berserker (Mr. Black) | Predators (2010) | Lourd ; aujourd'hui seulement boss | Réserve de chasse | 1 |
| Tracker | Predators (2010) | Molosses | Réserve de chasse | 1 |
| Falconer | Predators (2010) | Drone faucon | Réserve de chasse | 1 |
| Classic (le Predator crucifié) | Predators (2010) | Chasseur classique libéré | Réserve de chasse | 2 |
| Fugitive | The Predator (2018) | Rapide, léger | Aucune arène | 2 |
| Upgrade | The Predator (2018) | Géant sans armure | Aucune arène | 2 |
| Dek | Predator: Badlands (2025) | Jeune chasseur | Genna | 2 |
| Kwei et Njohrr | Predator: Badlands (2025) | À définir | Genna | 3 |
| Chasseur du récit viking | Killer of Killers (2025) | À définir ; distinct du Viking de Hunting Grounds | Scandinavie viking | 3 |
| Chasseur du récit ninja | Killer of Killers (2025) | À définir | Japon féodal | 3 |
| Chasseur du récit du pilote | Killer of Killers (2025) | À définir | Pacifique | 3 |
| Greyback, l'Ancien | Predator 2 (1990) | Ancien ; épée | Toits de Los Angeles | 2 |
| L'Ancien d'AVP | AVP (2004) | Distinct de Greyback | Pyramide antarctique | 3 |
| La Tribu perdue (Boar, Shaman, Guardian, Stalker, Snake, Warrior, Scout) | Predator 2 (1990) | Sept habillages et variantes | Toits de Los Angeles | 3 |
| Dark | Aliens vs. Predator (jeu, 2010) | À définir | BG-386 | 3 |
| Scarface | Predator: Concrete Jungle (2005) | À définir | Aucune arène | 3 |
| Ahab | Comics et figurines | Ancien chasseur d'Ingénieurs | LV-223 | 3 |
| Classes de Hunting Grounds (Scout, Berserker, Valkyrie, Exiled, Pirate…) | Predator: Hunting Grounds (2020) | Variantes de classe | Aucune arène | 3 |

## 20_GameplayCible — Systèmes de jeu retenus (HW-DEC-33 à 36 et 39) : état dans le code et phase proposée

| Système | Décision | Ce qui existe dans le code | Ce qui manque | Phase |
|---|---|---|---|---|
| Carte à zones (campagne) | HW-DEC-33 et 41 | Arène fermée de 150 m ; officiers de ruche (2 par vague) ; jauge de moral | Carte plus grande, zones, capture, renforts par zone, mini-carte de conquête | 3 |
| Verrouillage de cible | HW-DEC-35 | Codé le 14 nov. : Tab verrouille, le chasseur fait face | Caméra pilotée à la souris, bascule entre cibles | 2 |
| Changement d'arme en combo | HW-DEC-35 | Codé le 14 nov. : Q change d'arme et garde l'enchaînement | Finitions propres à la seconde arme | 2 |
| Mises à mort contextuelles | HW-DEC-35 | Codé le 14 nov. : E camouflé sur tout ennemi, E sur une élite à 25 % | Animations propres à chaque arme | 2 |
| Furtivité d'ouverture | HW-DEC-35 | Codé le 14 nov. : chasse camouflée au départ, ruche non alertée jusqu'à une attaque, au retrait du camouflage, à un contact ou après 25 s | Hardes de faune pour la campagne | 2 |
| Niveaux de chasseur | HW-DEC-34 | Aucun | Expérience, niveaux, finitions débloquées | 4 |
| Armes à attributs | HW-DEC-34 | Saignement, acide, givre existent comme effets isolés | Armes équipables, attributs, forge unique | 4 |
| Rangs Yautja | HW-DEC-34 | Insigne « blooded » dans l'interface ; codex des rangs | Sept rangs, conditions, contenu par rang | 4 |
| Trophées à effets | HW-DEC-34 | Compteur de crânes ; citadelle du menu ; 4 succès | Un trophée par boss, bonus au choix | 4 |
| Niveaux de difficulté | HW-DEC-36 | Aucun | Trois ou quatre difficultés, récompenses | 5 |
| Mode libre | HW-DEC-36 | Toutes les arènes et tous les chasseurs sont déjà ouverts | À réserver aux chasses terminées | 5 |
| Défis de chasse | HW-DEC-36 | Aucun | Épreuves à contrainte | 5 |
| Classement en ligne vérifié | HW-DEC-36, 43 et 45 | Aucun ; meilleur combo et vague maximale en local | Résumé de partie minute par minute, bornes de vraisemblance côté serveur, table de scores | 7 |
| Récit par chasse | HW-DEC-39 | Annonces à l'écran ; titres des 5 chapitres | Introduction et conclusion écrites par chasse | 6 |
| Codex complet | HW-DEC-39 | Codex en 4 onglets, 22 entrées, tout ouvert | Une fiche par ennemi, boss, arme et lieu, débloquée en jouant | 6 |
| Citadelle vivante | HW-DEC-39 | Citadelle 3D derrière le menu | Lieu à parcourir, forge, mur de crânes, table de chasse | 6 |
| Musique par arène | HW-DEC-39 | Un bourdon à 55 Hz | Un thème par lieu, un thème de boss, synthétisés | 6 |

## 21_CourbeBoss — Courbe provisoire des points de vie des boss de campagne (HW-DEC-47) ; à corriger après essais

| Ordre | Chasse | Boss | PV dans le code | PV provisoires | Remarque |
|---|---|---|---|---|---|
| 0 | Chasse pilote (Homeworld) | Grande proie de la faune | Absent | 2500 | Boss d'apprentissage |
| 1 | Jungle de Val Verde | Prétorien | Codé le 13 nov. | 3500 |  |
| 2 | Toits de Los Angeles | Predalien | 3000 (gabarit par défaut) ; predalien_abomination 6500 | 4500 | Brancher predalien_abomination |
| 3 | Forêt de Gunnison | Reine Predalien | 5000 | 5500 |  |
| 4 | Pyramide antarctique | Reine | 3000 (gabarit par défaut) ; imperial_queen 8000 | 6500 | Brancher imperial_queen |
| 5 | Réserve de chasse | Berserker | 8800 | 7500 | Abaissé |
| 6 | Base Charon | Rogue King | 9500 | 8500 | Abaissé |
| 7 | Station Renaissance | L'Offspring | 4500 | 9000 | Doublé |
| 8 | Xenomorph Prime | Impératrice matriarche | 6000 | 10000 | Boss final |
| — | Mode sans fin | Matriarche Predalien titan | 10000 | 10000 | Retirée de la vague 5 de la campagne ; réservée au mode sans fin |

## 22_RegionsFaune — Les huit chasses de l'Unblooded (HW-DEC-60, 72 à 75), rapprochées de la Bible V6 le 13 nov. ; « création » = inventé par Claude

| Ordre | Milieu | Monde (atlas Bible V6) | Harde | Meneur | Grande proie | Outil gagné | Trace de Xénomorphe |
|---|---|---|---|---|---|---|---|
| 1 | Jungle | Vara-Kesh (PLAN03) | Coureurs de lianes (création) | Mâle dominant (création) | Faucheur de Vara-Kesh (FAU-21) | Lance-filet |  |
| 2 | Marais | Eshra (PLAN11) | Rampeurs de vase (création) | Matrone de vase (création) | Hydre (création) | Piège à mâchoires |  |
| 3 | Désert | Kharuun (PLAN02) | Coureurs des canyons (création) | Fouisseur géant (création) | Gueule des sables (création) | Leurre sonore |  |
| 4 | Cavernes chaudes | Terek-Va (PLAN12) | Nuées des puits (création) | Nœuds de nuée (création) | Esprit de ruche des profondeurs (création) | Mines |  |
| 5 | Glace | Nereth (PLAN04) | Rôdeurs blancs (création) | Femelle alpha (création) | Mâchoire de Nereth (FAU-22) | Disque | Mue prise dans la glace |
| 6 | Océan | Oshara (PLAN05) | Pinces de récif (création) | Vieux mâle cuirassé (création) | Nageur d'Oshara (FAU-23) | Fléchettes | Résine dans une grotte côtière |
| 7 | Volcan | Rukh Tal (PLAN06) | Lézards de cendre (création) | Lézard cuirassé (création) | Éperon de Rukh Tal (FAU-24) | Camouflage | Carcasse ouverte de l'intérieur |
| 8 | Ruines | Dharos (PLAN09) | Charognards des rues (création) | Sentinelles (création) | Guetteur de Dharos (FAU-26) | Shuriken | Œuf éclos |
| 9 | Rite | Pyramide | Xénomorphes | — | Premier Xénomorphe | Canon d'épaule, rang Blooded | — |

## 14_Sources — Sources lues pour cette bible

| Source | Nature | Projet | Lecture |
|---|---|---|---|
| Dépôt yautja-hive-warriors, 60 commits jusqu'à v58.0 | Code | Hive Warriors | Audit complet par fichier ; vérification de syntaxe sur chaque commit |
| Essai en navigateur du 13 nov. 2026 | Preuve d'exécution | Hive Warriors | 8 arènes, 45 s chacune, saisies automatiques, jusqu'à la vague 5 ; 11 types de boss apparus par commande de test, combattus 25 s, mis à terre et exécutés |
| Yautja_V6_Bible_Cumulative_et_Dialogues.xlsx | Bible, 139 onglets | La Longue Chasse | Onglets de structure et de canon lus ; dialogues non lus |
| catalogue_yautja_tous_medias.xlsx | Catalogue, 255 désignations | Référence franchise | Lu |
| YAUTJA_V100_SUIVI.xlsx | Suivi, 27 onglets | La Longue Chasse | Parcouru par mots-clés |
| THE_PIT_STAGES_V60_SUIVI.xlsx | Suivi | La Longue Chasse | Lu |
| Yautja_Gauntlets_V142_Arsenal_Clans.xlsx et V144 | Suivi des 54 gantelets | La Longue Chasse | Lus ; grandes matrices par échantillon |
| Yautja_ClanWar_V151 et V152 | Recette des 4 modes de guerre | La Longue Chasse | Lus |
| YAUTJA_HOMEWORLD_AUDIT_354_CIBLES_20261103.xlsx | Audit de décors | La Longue Chasse | Lu ; matrice par échantillon |
| Yautja_PHG_*_V137 et QA V141 | Personnalisation, 323 éléments | La Longue Chasse | Lus ; grandes matrices par échantillon |
| Projet Supabase commun | Structure des tables | Plusieurs applications | Lue le 13 nov. 2026, en lecture seule ; aucun contenu de sauvegarde lu |
| Bible V5, classeurs Aliens Tantalus et SG2D | Autres | Autres projets | Non lus |
