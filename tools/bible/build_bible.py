#!/usr/bin/env python3
"""Génère les tables de la bible Hive Warriors.

Source unique des tables : ce fichier. Il produit
- design/Yautja_HiveWarriors_V58_Bible.xlsx (un onglet par table)
- design/gdd/annexes-tables.md (les mêmes tables en Markdown)

Usage : python3 tools/bible/build_bible.py
"""
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parents[2]
XLSX = ROOT / "design" / "Yautja_HiveWarriors_V58_Bible.xlsx"
MD = ROOT / "design" / "gdd" / "annexes-tables.md"

# Vocabulaire de statut (voir canon-et-regles-editoriales.md §5)
V = "Vérifié en jeu (13 nov. 2026)"
S = "Écrit, socle ≤v38, non revérifié"
N = "Écrit v39+, jamais exécuté avant correctif"
D = "Décoratif (texte ou affichage seul)"
A = "Absent"

TABLES = {}

TABLES["00_Synthese"] = (
    "Synthèse",
    ["Rubrique", "Valeur"],
    [
        ["Jeu", "Predator: Hive Warriors (dépôt darknigthmare/yautja-hive-warriors)"],
        ["Nature", "Musou 3D navigateur, three.js 0.160, vite 5, audio 100 % procédural"],
        ["Place dans l'univers", "Jeu frère de « Yautja : La Longue Chasse » ; classé « chroniques légendaires », hors canon de la campagne commune"],
        ["Version du code", "v58.0 (git) ; titre de page v27.0 ; sous-titre v29.0 ; package.json 1.0.0"],
        ["Dernière version qui se chargeait", "v33.0 (erreurs de syntaxe de v34 à v58)"],
        ["État au 13 nov. 2026", "Se construit et se lance après 5 correctifs ; rendu 3D, vagues et défaite fonctionnent dans les 8 arènes ; aucune erreur en console sur 40 s"],
        ["Chasseurs jouables", "7"],
        ["Arènes", "8 (même plan 150×150 m, décor propre par arène)"],
        ["Boss codés", "10 identifiants + 1 gabarit par défaut ; 3 boss d'arène manquants"],
        ["Types d'ennemis", "10 types aléatoires + 16 unités fixes par vague"],
        ["Registre d'armes", "36 entrées, aucune équipable ; 17 ont un comportement réel"],
        ["Capacités au clavier", "environ 54, avec conflits de touches"],
        ["Condition de victoire", "Aucune dans le code ; cible : exécution du boss d'arène"],
        ["Certification 1:1", "0 élément certifié (règle héritée de La Longue Chasse)"],
    ],
)

TABLES["01_Decisions"] = (
    "Décisions prises avec l'auteur le 12 novembre 2026",
    ["ID", "Question", "Décision", "Conséquence pour la bible"],
    [
        ["HW-DEC-01", "Lien avec les classeurs Excel de La Longue Chasse", "Même univers", "Hérite du canon et des règles de preuve ; chaque écart est signalé"],
        ["HW-DEC-02", "Périmètre décrit", "Vision + état réel", "Chaque système porte un statut et une décision de tri"],
        ["HW-DEC-03", "Erreurs bloquantes", "Corriger", "5 correctifs minimaux livrés ; le reste est listé en P0"],
        ["HW-DEC-04", "Format", "Markdown + Excel", "Documents dans design/gdd et ce classeur"],
        ["HW-DEC-05", "Promesse centrale", "Musou d'abord", "Furtivité et factions sont des épices ; arbitre des conflits de conception"],
        ["HW-DEC-06", "Structure", "Campagne + sans fin", "8 chasses avec victoire par exécution du boss ; sans fin débloqué par arène"],
        ["HW-DEC-07", "Canon des films", "Chroniques légendaires", "Chasseurs et lieux de films conservés, « non certifié 1:1 », « et si… » assumé"],
        ["HW-DEC-08", "Kit du joueur", "Kit par chasseur", "Tronc commun + 4 emplacements + Musou propre à chaque chasseur"],
        ["HW-DEC-09", "Diffusion", "Projet de fan non commercial", "Noms et lieux de films conservés, vocabulaire « inspiré de » ; aucune monétisation"],
        ["HW-DEC-10", "Clan du joueur", "Clan anonyme", "Forge et coffre restent « du clan », sans nom ; aucun des 15 clans de la Bible V6 n'est imposé"],
        ["HW-DEC-11", "Bonus de combat des forges et bio-masques", "Conservés", "Écart assumé avec la règle « cosmétique sans bonus » de La Longue Chasse"],
        ["HW-DEC-13", "Obtention des armes humaines", "Ramassées", "Prises sur les marines tombés ou dans des caisses, munitions limitées ; plus de ravitaillement automatique par vague"],
        ["HW-DEC-14", "Présence des alliés, marines, blindé et frappes", "Selon l'arène", "Chaque arène reçoit les soutiens de son lieu : voir l'onglet 15_Soutiens"],
        ["HW-DEC-15", "Lien avec la sauvegarde de La Longue Chasse", "Lecture seule, avec déblocages", "Hive Warriors lit la progression de La Longue Chasse sans rien y écrire, et débloque du contenu propre à ce jeu, comme ses personnages originaux"],
        ["HW-DEC-16", "Ordre des 8 chasses", "Ordre proposé", "Val Verde, Los Angeles, Gunnison, pyramide, réserve, Charon, station, Xenomorph Prime ; PV des boss recalés en courbe croissante après essais"],
        ["HW-DEC-17", "Moyen de lecture de la progression de La Longue Chasse", "Compte en ligne", "Sauvegarde sur un serveur avec identification ; exige une base de données et une gestion de comptes dans les deux jeux"],
        ["HW-DEC-18", "Contenus de La Longue Chasse débloqués", "Personnages des six voies, habillages des 15 clans, arènes de Xeno Prime", "Les outils originaux ne sont pas repris"],
        ["HW-DEC-19", "Condition de déblocage", "Par étape franchie", "Chaque contenu est lié à une étape précise de La Longue Chasse"],
        ["HW-DEC-20", "Humains de la forêt de Gunnison", "Garde nationale", "Soldats contemporains à la place des marines coloniaux : même comportement, autre habillage et autres armes à ramasser"],
        ["HW-DEC-21", "Service de comptes", "Supabase, projet déjà en place", "Même projet que La Longue Chasse ; aucune nouvelle base à créer"],
        ["HW-DEC-22", "Rôle du compte", "Facultatif, avec sauvegarde en ligne", "On joue sans compte ; connecté, la progression de Hive Warriors est aussi conservée en ligne et retrouvée sur un autre appareil"],
        ["HW-DEC-23", "Identification", "Identique au système de comptes existant", "Aucune nouvelle méthode ; reprendre celle de La Longue Chasse telle quelle"],
        ["HW-DEC-24", "Personnages de La Longue Chasse jouables", "Tous, Mara Venn incluse", "19 personnages des six voies ; Mara Venn, humaine, est un personnage jouable à part"],
        ["HW-DEC-25", "Accès au dépôt de La Longue Chasse", "Oui, en lecture", "Méthode de connexion et format de sauvegarde relevés le 13 nov. 2026 ; rien n'y est modifié"],
        ["HW-DEC-26", "Table de la sauvegarde en ligne de Hive Warriors", "Table générique app_cloud_saves", "Rien à créer dans la base ; une ligne par compte et par application"],
        ["HW-DEC-27", "Mara Venn", "Deux variantes jouables", "Hors clan : kit humain propre. Équipée par les Yautja : matériel prêté, sans plasma d'épaule (précisé par HW-DEC-29)"],
        ["HW-DEC-28", "Fiches des 19 personnages", "Rédigées par Claude, validées par l'auteur", "Une fiche par personnage, à partir de la Bible V6"],
        ["HW-DEC-29", "Mara Venn équipée", "Alliée équipée, pas membre", "La seconde variante s'appelle « équipée par les Yautja » : matériel prêté le temps d'une chasse, elle reste extérieure au clan ; conforme à la Bible V6"],
        ["HW-DEC-30", "Saer", "Non jouable", "Il peut servir de voix du codex ou de la salle des trophées"],
        ["HW-DEC-31", "Espèce d'Esha", "Humaine (choix confié à Claude)", "Habitante du port de Namarra, monde de Mara Venn ; la Bible V6 ne la range jamais parmi les cohortes ou les rangs Yautja"],
        ["HW-DEC-32", "Arme de Mara Venn", "Fusil de traqueuse", "Fusil à verrou précis, lent, puissant sur les élites"],
        ["HW-DEC-33", "But d'une chasse", "Carte à zones", "Carte plus grande découpée en zones tenues par des officiers de ruche, à conquérir ; remplace l'arène fermée et ses seules vagues"],
        ["HW-DEC-34", "Progression", "Niveaux de chasseur, armes à attributs, rangs Yautja, trophées à effets", "Les quatre systèmes sont retenus"],
        ["HW-DEC-35", "Combat", "Verrouillage de cible, changement d'arme en combo, mises à mort contextuelles, furtivité d'ouverture", "Les quatre sont retenus"],
        ["HW-DEC-36", "Modes", "Niveaux de difficulté, mode libre, défis de chasse, classement en ligne", "Les quatre sont retenus"],
        ["HW-DEC-37", "Lieux futurs", "Tous les lieux iconiques manquants de la saga", "Liste dans l'onglet 18_LieuxFuturs"],
        ["HW-DEC-38", "Chasseurs futurs", "Tous les chasseurs iconiques manquants", "Liste dans l'onglet 19_ChasseursFuturs"],
        ["HW-DEC-39", "Vie de l'univers", "Récit par chasse, codex complet, citadelle vivante, musique par arène", "Les quatre sont retenus"],
        ["HW-DEC-40", "Ordre des chantiers", "Ordre de la feuille de route", "Neuf phases ; une phase ne commence que lorsque la précédente a été jouée dans un navigateur"],
        ["HW-DEC-41", "Cartes à zones et arènes fermées", "Les deux coexistent", "La campagne se joue en cartes à zones ; les arènes fermées restent pour le mode sans fin et les défis"],
        ["HW-DEC-42", "Rangs Yautja", "Propres à Hive Warriors", "Mêmes sept noms, gagnés par les trophées de boss ; indépendants du rang atteint dans La Longue Chasse"],
        ["HW-DEC-43", "Classement en ligne", "Vérifié", "Chaque partie est contrôlée côté serveur avant d'entrer au classement ; chantier à part entière"],
        ["HW-DEC-12", "Alliés Yautja, armes humaines, véhicules et soutiens, coopération locale", "Tous conservés", "Le champ de bataille est une guerre ; ces systèmes sont à réparer, pas à couper"],
    ],
)

TABLES["02_Chasseurs"] = (
    "Chasseurs jouables (js/data/charactersData.js)",
    ["ID", "Nom affiché", "Source", "PV", "Vitesse", "Mêlée", "Plasma", "Coût plasma", "Musou annoncé", "Musou réel", "Kit cible proposé (4 emplacements)"],
    [
        ["jungle_hunter", "Jungle Hunter (1987)", "Predator 1987", 1000, 16, 120, 250, 20, "Surcharge Plasma Dévastatrice", "Commun à tous", "Combistick lancé · Leurre vocal · Mine · Nuke"],
        ["wolf_predator", "Wolf Predator", "AVP Requiem 2007", 1150, 17, 145, 280, 16, "Solvant d'Acide Liquéfacteur", "Commun à tous", "Fouet vertébral · Solvant · Pistolet plasma · Mine"],
        ["alpha_predator", "Alpha Predator", "Predator: Hunting Grounds", 1200, 18, 160, 220, 15, "Massacre Ancestral à la Faux", "Commun à tous", "Faux d'os · Arc · Piège à mâchoires · Cor de guerre"],
        ["feral_predator", "Feral Predator", "Prey 2022", 1000, 19, 135, 210, 15, "Charge de Bouclier Mutilante", "Commun à tous", "Bouclier · Fléchettes guidées · Bond · Leurre"],
        ["samurai_predator", "Samurai Predator", "Predator: Hunting Grounds", 1050, 19, 150, 200, 18, "Entaille du Dragon Ronin", "Commun à tous", "Iaijutsu · Disque · Piège à mâchoires · Ruée"],
        ["viking_predator", "Viking Predator", "Predator: Hunting Grounds", 1350, 14, 175, 260, 30, "Frénésie du Valhalla 360°", "Commun à tous", "Maul · Cor de guerre · Rugissement · Brûleur"],
        ["city_hunter", "City Hunter (1990)", "Predator 2", 850, 19, 100, 180, 15, "Tempête de Disques Boomerang", "Commun à tous", "Disque · Filet · Combistick lancé · Shuriken"],
    ],
)

ARM = [
    ("wristblades", "Lames de poignet doubles", "Mêlée", "Predator 1987", "Réel", "Tronc commun"),
    ("single_scythe", "Lame-faux simple", "Mêlée", "Predators 2010", "Aucun", "Couper ou habillage"),
    ("super_cleaver", "Super couperet", "Mêlée", "Concrete Jungle", "Aucun", "Couper"),
    ("tri_maul", "Maul à trois lames", "Mêlée", "Concrete Jungle", "Aucun (un maul distinct existe)", "Fusionner avec le maul codé"),
    ("broadsword", "Épée cérémonielle", "Mêlée", "AVP Extinction", "Aucun", "Couper"),
    ("katana", "Katana", "Mêlée", "Hunting Grounds", "Réel (bonus + Iaijutsu)", "Emplacement Samurai"),
    ("alpha_sickle", "Faux d'os Alpha", "Mêlée", "Hunting Grounds", "Réel (bonus + faux d'os)", "Emplacement Alpha"),
    ("viking_axe", "Hache viking", "Mêlée", "Hunting Grounds", "Aucun", "Habillage du Viking"),
    ("daggers", "Dagues cérémonielles", "Mêlée", "Predator 2", "Aucun", "Couper"),
    ("war_club", "Massue d'os", "Mêlée", "Hunting Grounds", "Aucun", "Couper"),
    ("feral_shield", "Bouclier Feral", "Mêlée", "Prey 2022", "Partiel (blocage seul)", "Emplacement Feral"),
    ("pirate_hook", "Crochet pirate", "Mêlée", "Hunting Grounds", "Aucun", "Couper"),
    ("combistick", "Combistick", "Allonge", "Predator 2", "Réel (lancer)", "Emplacement"),
    ("glaive", "Glaive", "Allonge", "Concrete Jungle", "Partiel (toupie plasma)", "Emplacement, à rééquilibrer (immunité totale)"),
    ("smart_disc", "Disque", "Lancer", "Predator 2", "Réel", "Emplacement"),
    ("shuriken", "Shuriken", "Lancer", "AVP 2004", "Réel", "Emplacement"),
    ("compound_bow", "Arc", "Tir", "Hunting Grounds", "Réel", "Emplacement"),
    ("crossbow", "Arbalète guidée", "Tir", "Prey 2022", "Aucun", "Fusionner avec les fléchettes"),
    ("speargun", "Speargun", "Tir", "Predator 2", "Réel (fléchettes)", "Emplacement"),
    ("plasma_caster", "Canon plasma d'épaule", "Plasma", "Predator 1987", "Réel", "Tronc commun"),
    ("dual_caster", "Double canon", "Plasma", "AVP Requiem", "Partiel (rayon de surcharge)", "Musou ou emplacement de Wolf"),
    ("plasma_pistol", "Pistolet plasma", "Plasma", "AVP Requiem", "Réel", "Emplacement"),
    ("gatling_plasma", "Gatling plasma", "Plasma", "Predators 2010", "Aucun", "Réserver au boss Berserker"),
    ("burner_rifle", "Brûleur", "Plasma", "AVP Extinction", "Réel", "Emplacement"),
    ("plasma_whip", "Fouet vertébral", "Plasma", "AVP Requiem", "Réel", "Emplacement Wolf"),
    ("netgun", "Lance-filet", "Piège", "Predator 2", "Réel", "Emplacement"),
    ("plasma_turret", "Tourelle plasma", "Piège", "AVP Extinction", "Aucun (une sentinelle USCM existe)", "Couper"),
    ("plasma_mines", "Mines de proximité", "Piège", "AVP 2010", "Réel (fil-piège)", "Emplacement"),
    ("emp_mine", "Mine EMP", "Piège", "The Predator 2018", "Partiel (EMP du gantelet)", "Emplacement"),
    ("bear_trap", "Piège à mâchoires", "Piège", "Hunting Grounds", "Réel (charges jamais consommées)", "Emplacement, corriger les charges"),
    ("audio_lure", "Leurre vocal", "Outil", "Predator 1987", "Réel (leurre)", "Emplacement"),
    ("medicomp", "Medicomp", "Outil", "Predator 1987", "Réel", "Tronc commun"),
    ("acid_solvent", "Solvant", "Outil", "AVP Requiem", "Réel", "Emplacement Wolf"),
    ("cloak", "Camouflage", "Outil", "Tous", "Partiel (code présent, aucune touche)", "Tronc commun, à rebrancher"),
    ("thermal_mask", "Masque de vision", "Outil", "Tous", "Réel (5 modes)", "Tronc commun"),
    ("nuke_gauntlet", "Autodestruction", "Outil", "Predator 1987", "Réel", "Emplacement ou dernier recours"),
]
TABLES["03_Arsenal36"] = (
    "Registre des 36 armes (ULTIMATE_YAUTJA_ARMORY) : aucune n'est équipable, le registre n'est lu par aucun code",
    ["N°", "ID", "Nom", "Famille", "Source annoncée", "Comportement dans le code", "Tri proposé"],
    [[i + 1, *r] for i, r in enumerate(ARM)],
)

TABLES["04_HorsRegistre"] = (
    "Capacités codées hors registre",
    ["Capacité", "Touche actuelle", "Chiffres", "Statut", "Tri proposé"],
    [
        ["Maul sismique", "Maj+1", "620, rayon 6,5, recharge 14 s", N, "Emplacement Viking"],
        ["Faux plasma", "Maj+6", "380, rayon 5,5, 25 énergie", N, "Couper (doublon de la faux d'os)"],
        ["Grenade M41A", "Maj+9", "420, rayon 7,5", N, "Garder, ramassée sur le champ de bataille (HW-DEC-13)"],
        ["Fusil Gauss M77", "Maj+7", "550, perforant", N, "Garder, ramassée sur le champ de bataille (HW-DEC-13)"],
        ["Pistolet à boulons Seegson", "Maj+3", "680", N, "Garder, ramassée sur le champ de bataille (HW-DEC-13)"],
        ["Lance de tireur", "Maj+Z puis clic droit", "1200, portée 42", N, "À décider"],
        ["Exosquelette", "O", "12 s, −85 % dégâts, recharge 45 s", N, "Couper ou récompense de fin"],
        ["Grappin du gantelet", "G (conflit)", "260 + 180", N, "Emplacement, après résolution du conflit"],
        ["Neurotoxine", "N", "recharge 30 s", N, "À décider"],
        ["Rayon du vaisseau éclaireur", "M", "850/s, recharge 32 s", N, "Soutien orbital de campagne"],
        ["Ruée d'ombre", "Alt", "0,35 s, recharge 1,8 s", N, "Tronc commun (esquive)"],
        ["Parade aux lames + riposte", "F", "fenêtre 0,42 s, riposte 550", N, "Tronc commun"],
        ["Rugissement", "H", "étourdit 2,2 s, rayon 14", N, "Emplacement"],
        ["Molosses", "Maj+H", "2 molosses, invulnérables", N, "À décider"],
        ["Bio-masques", "Maj+V", "6 masques, multiplicateurs", N, "Déblocage de progression"],
        ["Gelée royale", "0", "12 s de frénésie", S, "Ressource de campagne"],
        ["Cor de guerre", "K", "10 s, ×1,5 dégâts, sans recharge", S, "Emplacement, ajouter une recharge"],
        ["Métamorphose hybride", "Alt+M", "15 s invulnérable", S, "Couper : contredit le canon"],
    ],
)

TABLES["05_Controles"] = (
    "Tronc commun cible (proposition à valider) et état actuel",
    ["Action", "Touche cible", "Touche actuelle", "État actuel"],
    [
        ["Se déplacer", "ZQSD / WASD", "WASD", V],
        ["Attaque légère (5 temps)", "Clic gauche", "Clic gauche", V],
        ["Attaque lourde (finition C1 à C6)", "Clic droit", "Clic droit", S],
        ["Canon plasma, chargé à 0,55 s", "Maj gauche", "Maj gauche", S],
        ["Musou", "Espace", "Espace ou Q", S],
        ["Parade", "F", "F (et C pour le bouclier)", N],
        ["Esquive", "Alt", "Alt", N],
        ["Camouflage", "C", "Aucune (orphelin depuis v51)", "Code présent, inaccessible"],
        ["Vision", "V", "V (5 modes)", S],
        ["Medicomp", "Z", "Z", S],
        ["Interagir / exécuter", "E", "E (plus de 40 interactions en chaîne)", S],
        ["Emplacements 1 à 4", "1 2 3 4", "Sans objet", A],
        ["Pause", "Échap", "Aucune", A],
    ],
)

TABLES["06_Ennemis"] = (
    "Bestiaire xénomorphe (js/entities/XenomorphHorde.js)",
    ["Type", "Apparition", "PV", "Vitesse", "Dégâts", "Comportement", "Statut", "Dans la Bible V6"],
    [
        ["Drone", "Aléatoire (défaut)", 120, 11, 25, "22 % rôdent aux murs et tombent du plafond", S, "FAU-30"],
        ["Facehugger", "Aléatoire (13 %)", 40, 17, 15, "S'agrippe, épreuve de 5 pressions", S, "FAU-29"],
        ["Boiler", "Aléatoire", 80, 14, 50, "Explose à 3,2 m", S, "Non"],
        ["Néomorphe", "Aléatoire", 95, 19, 35, "Bond", S, "Non"],
        ["Praetomorphe", "Aléatoire", 160, 16, 42, "Saut", S, "Non"],
        ["Guerrier rouge", "Aléatoire", 140, 15.5, 34, "Combat les autres xénomorphes", S, "Non"],
        ["Cracheur", "Aléatoire", 110, 12, 30, "Mortier d'acide 36", S, "Non"],
        ["Coureur", "Aléatoire", 85, 21, 28, "", S, "Non"],
        ["Cryo-xénomorphe", "Aléatoire", 175, 14.5, 38, "Souffle de givre 24", N, "Non"],
        ["Cyber-xénomorphe", "Aléatoire", 220, 13, 44, "Dards, −35 % dégâts non lourds", N, "Non"],
        ["Œufs (6)", "Chaque vague", "", "", "", "Libèrent des facehuggers", S, "Non"],
        ["Broyeur", "Chaque vague", 750, 22, "", "Charge, −80 % de face", S, "Non"],
        ["Prétoriens (2)", "Chaque vague", 480, "", "", "Crachat, garde du boss", S, "Non"],
        ["Alien de la grille", "Chaque vague", 420, "", "", "Insensible au filet, flaque d'acide", S, "Non"],
        ["Officiers de ruche (2)", "Chaque vague", 350, "", "", "", S, "Non"],
        ["Alpha « Marvel »", "Chaque vague", 1800, "", "", "", N, "Non"],
        ["Micro-essaim", "Chaque vague", 150, "", 8, "", N, "Non"],
        ["Facehuggers royaux (2)", "Chaque vague", 140, "", 150, "Agrippe 5 s", N, "Non"],
        ["Traqueurs caméléons (2)", "Chaque vague", 420, "", "", "Visibles en vision EM", N, "Non"],
        ["Titan Deacon", "Chaque vague", 2400, "", "", "", N, "Non"],
        ["Mantas (2)", "Chaque vague", 320, "", 65, "Piqué", N, "Non"],
        ["Harpie prétorienne", "Chaque vague", 1200, "", 120, "Volante", N, "Non"],
        ["Titan Rogue King", "Chaque vague", 3200, "", "", "", N, "Non"],
        ["Raven", "Chaque vague", 2400, "", "", "", N, "Non"],
        ["Ancien Predalien", "Chaque vague", 3600, "", "", "", N, "Non"],
        ["Matriarche en gestation", "Chaque vague", 4200, "", "", "Pond des œufs de 180 PV", N, "Non"],
        ["Chestburster", "15 % à la mort d'un ennemi", 30, "", 12, "", S, "Non"],
    ],
)

TABLES["07_Boss"] = (
    "Boss (js/entities/Bosses.js)",
    ["ID", "PV", "Particularités", "Utilisé par", "Statut"],
    [
        ["predalien_matriarch_titan", 10000, "Phase 2 à 65 %, portée à 45 %, étourdi à 18 %", "Toutes les arènes, vague 5", N],
        ["rogue_king_prime", 9500, "Charge 380, phase 2 à 45 %", "Base Charon", N],
        ["berserker_super_predator", 8800, "Appelle une méthode absente (spawnAcidSpit) ; pas d'exécution dédiée", "Réserve de chasse", N],
        ["awakened_engineer", 8500, "Bouclier de 2000 PV en phase 2", "Sarcophage (toutes arènes)", N],
        ["imperial_queen", 8000, "Gabarit de reine", "Aucune arène", S],
        ["trilobite_prime", 7000, "Étreinte 95, vase 80", "Aucune arène", N],
        ["predalien_abomination", 6500, "", "Aucune arène", N],
        ["empress_matriarch", 6000, "Bourrasque d'ailes 70", "Xenomorph Prime ; bac à sable", S],
        ["predalien_queen", 5000, "Régurgite des chestbursters", "Gunnison", S],
        ["the_offspring", 4500, "Cri 60 et −25 énergie", "Station Renaissance", S],
        ["(défaut)", 3000, "Reine générique, étourdie 6 s à 30 %", "xenomorph_queen, predalien, praetorian", S],
    ],
)

TABLES["08_Arenes"] = (
    "Arènes et campagne cible (8 chasses)",
    ["Ordre cible", "ID", "Nom", "Source", "Météo", "Vagues", "Boss déclaré", "Boss réellement codé", "Décor propre", "Action requise"],
    [
        [1, "val_verde_jungle", "Jungle de Val Verde", "Predator 1987", "Brume humide", 5, "praetorian", "Non (défaut 3000 PV)", "11 éléments : épave du Huey, piège à rondins, pont de Billy, mirador, « Old Painless », cascade", "Créer le boss Prétorien"],
        [2, "la_rooftops", "Toits de Los Angeles", "Predator 2", "Tempête", 5, "predalien", "Non (défaut 3000 PV)", "Héliport, château d'eau, nacelle, nuage de fréon", "Brancher predalien_abomination"],
        [3, "gunnison_forest", "Forêt de Gunnison", "AVP Requiem", "Pluie", 5, "predalien_queen", "Oui (5000 PV)", "Vaisseau éclaireur écrasé, crypte, pylône, 16 arbres perchoirs", "Aucune"],
        [4, "antarctic_pyramid", "Pyramide antarctique", "AVP 2004", "Aucune", 5, "xenomorph_queen", "Non (défaut 3000 PV)", "Dalles coulissantes, autel, pièges à faux", "Brancher imperial_queen"],
        [5, "game_preserve_planet", "Réserve de chasse", "Predators 2010", "Aucune", 6, "berserker_super_predator", "Oui (8800 PV), incomplet", "Totem du Predator crucifié, perchoir, chutes de rochers", "Corriger la méthode absente, ajouter l'exécution"],
        [6, "charon_rogue_base", "Base Charon", "Aliens: Rogue 1993", "Aucune", 6, "rogue_king_prime", "Oui (9500 PV)", "Incubateurs, console de Kleist, passerelle, pylônes inhibiteurs", "Ajouter le thème aux garde-fous de décor"],
        [7, "romulus_station", "Station Renaissance", "Alien: Romulus 2024", "Apesanteur cryo", 6, "the_offspring", "Oui (4500 PV)", "Sas en apesanteur, console de Rook, centrifugeuse Z-01", "Revoir les PV (trop bas pour une 7e chasse)"],
        [8, "xenomorph_prime", "Monde-ruche Xenomorph Prime", "Univers étendu ; PLAN08 de la Bible V6", "Spores toxiques", 6, "empress_matriarch", "Oui (6000 PV)", "Piliers de résine, ponts de chitine, nids, nœuds de gelée royale", "Aligner sur les 12 secteurs XP-Z01 à Z12 ; revoir les PV"],
    ],
)

TABLES["09_Factions"] = (
    "Factions et soutiens",
    ["Faction", "Apparition", "Chiffres", "Comportement", "Défaut constaté", "Tri"],
    [
        ["Marines coloniaux", "4 au départ", "150 PV, 20 à 35 dégâts", "Visent les xénomorphes, puis le joueur", "Rien ne les blesse", "Garder, les rendre mortels"],
        ["Garde nationale", "Absente du code", "À définir", "Comme les marines, à Gunnison seulement (HW-DEC-20)", "À créer", "Créer par habillage des marines"],
        ["Synthétiques", "3 au départ", "280 à 340 PV", "Idem ; coupés en deux à 0 PV", "", "Garder en arènes Weyland-Yutani seulement"],
        ["Alliés Yautja", "3 au départ", "950 PV", "Combattent aux côtés du joueur", "Invulnérables", "Garder (HW-DEC-12), les rendre mortels"],
        ["Bad Blood", "Vague 3", "2200 PV", "Duel en 3 épreuves sous 850 PV", "Insensible à la plupart des armes", "Garder comme mini-boss d'une chasse"],
        ["Molosses", "Maj+H", "600 PV", "Alliés invoqués", "Invulnérables", "À décider"],
        ["Tourelle sentinelle", "Touche 4 ou vague 2", "500 munitions", "Tir automatique", "Doublon dans ColonialMarines.js", "Garder (HW-DEC-12), supprimer le doublon"],
        ["Drone faucon", "Touche 5", "26 s", "Marque les cibles", "", "Emplacement possible"],
        ["Blindé M577", "Vague 3", "260 dégâts", "Vise le boss", "PV jamais réduits", "Garder (HW-DEC-12), rendre destructible"],
        ["Cheyenne", "Vagues 2 et 4", "Roquettes 340 à 550", "Frappe aérienne", "", "Garder (HW-DEC-12)"],
        ["Planeur Yautja", "G", "Vitesse 32", "Monture", "Conflit de touche G", "Garder (HW-DEC-12), résoudre le conflit de touche"],
    ],
)

TABLES["10_Progression"] = (
    "Progression et économie",
    ["Système", "Monnaie", "Contenu", "Sauvegardé", "Défaut constaté", "Statut"],
    [
        ["Forge du menu", "Total d'éliminations × 100", "PV +200 et dégâts +25 % par niveau, 5 niveaux, 3 couleurs de laser", "Oui", "La monnaie n'est jamais débitée ; la croix de fermeture est sans effet", S],
        ["Loadout", "Aucune", "4 armes principales, 4 secondaires, 2 gadgets parmi 5", "Non", "4 bonus jamais lus ; tout est débloqué", S],
        ["Salle des trophées", "Aucune", "4 succès (50, 500, 1500 éliminations ; combo de 50)", "Oui", "", S],
        ["Forge de clan (F3)", "Score de session + gelée royale", "9 améliorations, 1500 à 4000 points et 2 à 6 gelées", "Oui", "Sa fermeture renvoie au menu principal", N],
        ["Passerelle du vaisseau-mère (F4)", "Score de session", "Barrage 4000, capsule 2500, bénédiction 3000", "Non", "Ordre des arguments incorrect pour la capsule", N],
        ["Coffre d'honneur (F2)", "Aucune", "Honneur, crânes, meilleur combo, vague maximale", "Oui", "Affiche 3 faux trophées quand il est vide", N],
        ["Bio-masques", "Aucune", "6 masques à multiplicateurs", "Non", "Tous disponibles d'emblée", N],
        ["Campagne", "Aucune", "5 chapitres", "Non", "4 niveaux sur 5 n'existent pas ; aucune progression lue", D],
    ],
)

TABLES["11_P0_Defauts"] = (
    "Défauts bloquants et écarts (priorité de correction)",
    ["ID", "Priorité", "Défaut", "Où", "État"],
    [
        ["HW-BUG-01", "P0", "Accolade manquante : le module ne se chargeait pas (depuis v39)", "js/engine/GoreEngine.js:356", "Corrigé le 12 nov."],
        ["HW-BUG-02", "P0", "Variable isNearCrypt déclarée deux fois (depuis v57)", "js/main.js:3071", "Corrigé le 12 nov."],
        ["HW-BUG-03", "P0", "Nom « synthetics » non défini à chaque image", "js/entities/Player.js:2202", "Corrigé le 12 nov."],
        ["HW-BUG-04", "P0", "Nom « particles » non défini à chaque image", "js/entities/Environment.js:1083", "Corrigé le 12 nov."],
        ["HW-BUG-05", "P0", "Champ inexistant (switchPos) : chaque image s'arrêtait avant le rendu 3D, les vagues et la défaite", "js/main.js:2973", "Corrigé le 13 nov."],
        ["HW-BUG-06", "P0", "window.gameInstance est lu 182 fois et n'est jamais défini (l'objet s'appelle window.game)", "6 fichiers d'entités", "Ouvert"],
        ["HW-BUG-07", "P0", "Aucune condition de victoire : endGame(true) n'est jamais appelé", "js/main.js", "Ouvert"],
        ["HW-BUG-08", "P0", "Un boss ne meurt pas par les dégâts ; seule l'exécution le retire et il bloque les vagues", "js/entities/Bosses.js", "Ouvert"],
        ["HW-BUG-09", "P0", "Les ennemis à 0 PV restent actifs hors coups de mêlée", "js/entities/XenomorphHorde.js", "Ouvert"],
        ["HW-BUG-10", "P1", "Camouflage et changement d'arme sans touche depuis v51", "js/main.js", "Ouvert"],
        ["HW-BUG-11", "P1", "Conflits de touches : G, 6, Maj+4, Maj+8, Espace, Alt+M, Z", "js/main.js:242-886", "Ouvert"],
        ["HW-BUG-12", "P1", "Cartes d'arène affichant « undefined » (champs icon, difficulty, description absents)", "js/ui/UIManager.js:124", "Ouvert"],
        ["HW-BUG-13", "P1", "Pas de pause, pas de retour au menu depuis l'écran de défaite", "js/main.js:204", "Ouvert"],
        ["HW-BUG-14", "P1", "Boss de vague 5 identique dans toutes les arènes", "js/main.js:3122", "Ouvert"],
        ["HW-BUG-15", "P1", "Environ 45 éléments de décor construits dans toutes les arènes (réacteur et Space Jockey à Val Verde)", "js/entities/Environment.js:606", "Ouvert"],
        ["HW-BUG-16", "P2", "Méthodes appelées mais absentes : setLaserColor, emitExplosion, emitAlienBloodSpurt, spawnAcidSpit, 10 sons", "Plusieurs", "Ouvert"],
        ["HW-BUG-17", "P1", "Coopération (conservée, HW-DEC-12) : le joueur 2 ne peut pas attaquer", "js/main.js:2369", "Ouvert"],
        ["HW-BUG-18", "P2", "Numéros de version discordants (v6, v12, v27, v29, v58, 1.0.0)", "index.html, main.js, package.json", "Ouvert"],
        ["HW-BUG-19", "P2", "Aucune limite d'ennemis ni mise en commun des maillages : la vague N crée 45 + 15N objets", "js/entities/XenomorphHorde.js", "Ouvert"],
        ["HW-BUG-20", "P2", "Liste des commandes des options figée vers v29", "index.html", "Ouvert"],
        ["HW-BUG-21", "P1", "Le chasseur meurt en moins de 40 s sous des saisies automatiques dans les 8 arènes ; équilibrage à mesurer avec un vrai joueur", "Essai du 13 nov.", "Ouvert"],
        ["HW-BUG-22", "P2", "Des confettis sont tirés sur l'écran de défaite et le filtre de vision reste affiché", "Essai du 13 nov.", "Ouvert"],
    ],
)

TABLES["12_Canon"] = (
    "Règles héritées de La Longue Chasse et écarts de Hive Warriors",
    ["ID", "Règle ou fait de la source", "Source (classeur · onglet)", "Situation dans Hive Warriors", "Traitement"],
    [
        ["HW-CAN-01", "Les personnages de films restent dans des chroniques séparées", "Bible V6 · Chroniques cinéma", "7 chasseurs de films et de jeux jouables", "Tout le jeu est classé « chroniques légendaires »"],
        ["HW-CAN-02", "Sept rangs : Youngling, Unblooded, Young Blood, Blooded, Elite, Elder, Ancient", "Bible V6 · Rangs et fonctions", "Le codex liste 6 entrées dont Bad Blood et « Clan Leader & Elder »", "Réécrire le codex : Bad Blood est un statut, pas un rang"],
        ["HW-CAN-03", "Aucun code d'honneur universel n'est affirmé", "Bible V6 · Justice et Enforcers", "Le codex présente 5 lois comme universelles", "Présenter ces lois comme la tradition rapportée par les chroniques"],
        ["HW-CAN-04", "Bestiaire xénomorphe : Facehugger, Drone, Guerrier, Reine active", "Bible V6 · Faune et adversaires", "Environ 26 types et 10 boss", "Autorisé en chronique ; chaque type porte sa source et « non certifié 1:1 »"],
        ["HW-CAN-05", "Xeno Prime (PLAN08) : 12 secteurs XP-Z01 à Z12, arène de la reine active", "Bible V6 · Xeno Prime", "Une arène « xenomorph_prime » sans lien", "La 8e chasse reprend les noms de secteurs"],
        ["HW-CAN-06", "Échelle contenue : pas de nouvelle population à chaque visite", "Bible V6 · Méthode de guerre", "Des centaines d'ennemis par chasse", "Écart assumé : la démesure est le propre des chroniques"],
        ["HW-CAN-07", "Aucun bonus de combat par les cosmétiques", "Gauntlets V142 · 09_Lore_Equilibre", "Les bio-masques donnent des multiplicateurs", "Écart assumé (HW-DEC-11)"],
        ["HW-CAN-08", "Son original seulement, aucun son de film", "Gauntlets V142 · B-18", "Audio 100 % procédural", "Conforme"],
        ["HW-CAN-09", "Droits et licences requis avant toute diffusion commerciale", "Gauntlets V142 · B-17", "Noms, personnages et lieux de films", "Projet de fan non commercial (HW-DEC-09)"],
        ["HW-CAN-10", "Un dessin ou un élément jouable ne certifie pas une fidélité 1:1", "THE PIT V62 ; PHG Fidélité V137", "Les messages de version annoncent « 1:1 »", "Remplacer par « inspiré de » ; 0 élément certifié"],
        ["HW-CAN-11", "Ne jamais changer arbitrairement une caste xénomorphe", "YAUTJA_V100_SUIVI", "3 boss déclarés retombent sur une reine générique", "Créer les boss manquants avant de les annoncer"],
        ["HW-CAN-12", "Lex Woods n'est pas épargnée pour grossesse dans AVP 2004 : elle est honorée comme combattante", "Film AVP 2004", "Le codex affirme l'inverse", "Corriger l'entrée du codex"],
        ["HW-CAN-13", "Le Predalien est classé xénomorphe hybride, pas Yautja", "Catalogue tous médias · Exclusions", "Conforme dans le codex", "Aucun"],
        ["HW-CAN-14", "Les 15 clans de la Bible V6 sont des créations du projet", "Bible V6 · Identités des clans", "Aucun clan nommé ; « Forge de clan », « Coffre d'honneur du clan »", "Le clan du joueur reste anonyme (HW-DEC-10)"],
    ],
)

TABLES["13_Questions"] = (
    "Questions ouvertes pour l'auteur (les autres ont été tranchées : voir HW-DEC-09 à 43)",
    ["ID", "Question", "Pourquoi elle compte", "Défaut retenu en attendant"],
    [
        ["Q14", "Valeurs de PV des 8 boss", "La courbe doit croître de la 1re à la 8e chasse", "À régler après essais avec un vrai joueur"],
        ["Q23", "Que faire si le joueur joue à Hive Warriors sur deux appareils ?", "La table générique n'a pas de numéro de révision : la dernière écriture écrase l'autre", "Garder la sauvegarde la plus récente et prévenir le joueur"],
        ["Q24", "Les règles d'accès de la table app_cloud_saves", "Elles n'ont pas été lues ; il faut vérifier que chaque joueur n'accède qu'à sa ligne", "À vérifier avant tout développement"],
        ["Q32", "Comment vérifier une partie côté serveur ?", "Le jeu calcule tout dans le navigateur, avec du hasard non reproductible ; rejouer une partie suppose un tirage à graine fixe et un journal des saisies", "Étude à mener avant la phase 7 ; aucun classement publié avant"],
        ["Q33", "Quelle chasse sert de pilote à la carte à zones ?", "Elle fixera le modèle des sept autres", "Xenomorph Prime, dont la Bible V6 décrit déjà 12 secteurs"],
        ["Q22", "Valider les fiches de personnages", "Statistiques, kits et Musou sont des propositions", "Fiches de personnages-longue-chasse.md"],
    ],
)

TABLES["15_Soutiens"] = (
    "Soutiens par arène (proposition découlant de HW-DEC-14 ; aujourd'hui tout apparaît partout)",
    ["Ordre", "Arène", "Alliés Yautja", "Marines", "Synthétiques", "Blindé M577", "Frappe Cheyenne", "Armes humaines à ramasser", "Raison"],
    [
        [1, "Jungle de Val Verde", "Non", "Non", "Non", "Non", "Non", "Non", "1987 : le chasseur est seul ; aucun matériel du futur"],
        [2, "Toits de Los Angeles", "Oui", "Non", "Non", "Non", "Non", "Non", "1990 : le clan est présent à la fin de Predator 2"],
        [3, "Forêt de Gunnison", "Non", "Garde nationale (HW-DEC-20)", "Non", "Non", "Non", "Oui, armes contemporaines", "Époque contemporaine : soldats de la Garde nationale, à créer"],
        [4, "Pyramide antarctique", "Oui", "Non", "Non", "Non", "Non", "Non", "Rite de passage mené à plusieurs"],
        [5, "Réserve de chasse", "Non", "Non", "Non", "Non", "Non", "Oui", "Terrain d'un clan hostile ; armes des proies humaines"],
        [6, "Base Charon", "Non", "Oui", "Oui", "Oui", "Oui", "Oui", "Complexe militaire et scientifique"],
        [7, "Station Renaissance", "Non", "Oui", "Oui", "Non", "Non", "Oui", "Station Weyland-Yutani"],
        [8, "Xenomorph Prime", "Oui", "Non", "Non", "Non", "Non", "Non", "Assaut du clan sur le monde-ruche"],
    ],
)

TABLES["16_Deblocages"] = (
    "Déblocages lus dans La Longue Chasse par compte en ligne, étape par étape (HW-DEC-15, 17 à 19, 24 ; noms tirés de la Bible V6, onglet « Les six voies »)",
    ["Contenu débloqué dans Hive Warriors", "Nature", "Origine dans La Longue Chasse", "Rôle connu", "Condition", "Statut"],
    [
        ["Varek", "Personnage jouable, création du projet", "O1 Rejeté du clan", "Père hostile", "Une fin de la voie O1 (proposé)", "Fiche proposée, à valider"],
        ["Dhera", "Personnage jouable, création du projet", "O1 Rejeté du clan", "Instructrice", "Mission O1-M25 (proposé)", "Fiche proposée, à valider"],
        ["Ruun", "Personnage jouable, création du projet", "O1 Rejeté du clan", "Frère du joueur", "Mission O1-M21 (proposé)", "Fiche proposée, à valider"],
        ["Sael", "Personnage jouable, création du projet", "O2 Héritier du masque", "Gardienne du masque", "Une fin de la voie O2 (proposé)", "Fiche proposée, à valider"],
        ["Khor", "Personnage jouable, création du projet", "O2 Héritier du masque", "Descendant d'un pisteur", "Mission O2-M32 (proposé)", "Fiche proposée, à valider"],
        ["Orha", "Personnage jouable, création du projet", "O2 Héritier du masque", "Artisane des supports", "Mission O2-M28 (proposé)", "Fiche proposée, à valider"],
        ["Tava", "Personnage jouable, création du projet", "O3 Porteur des derniers noms", "Passeuse survivante", "Une fin de la voie O3 (proposé)", "Fiche proposée, à valider"],
        ["Orem", "Personnage jouable, création du projet", "O3 Porteur des derniers noms", "Jeune compagnon de cohorte", "Mission O3-M32 (proposé)", "Fiche proposée, à valider"],
        ["Vesha", "Personnage jouable, création du projet", "O3 Porteur des derniers noms", "Artisane survivante", "Mission O3-M26 (proposé)", "Fiche proposée, à valider"],
        ["Drek", "Personnage jouable, création du projet", "O4 Nom entaché", "Parent du joueur", "Mission O4-M23 (proposé)", "Fiche proposée, à valider"],
        ["Isha", "Personnage jouable, création du projet", "O4 Nom entaché", "Descendante lésée", "Mission O4-M33 (proposé)", "Fiche proposée, à valider"],
        ["Evar", "Personnage jouable, création du projet", "O4 Nom entaché", "Enforcer local", "Une fin de la voie O4 (proposé)", "Fiche proposée, à valider"],
        ["Mara Venn", "Personnage jouable, création du projet", "O5 Dette envers l'Étranger", "Traqueuse humaine ; deux variantes (HW-DEC-27 et 29)", "Hors clan : mission O5-M24 ; équipée par les Yautja : fin O5-E1 (proposé)", "Fiche proposée, à valider"],
        ["Esha", "Personnage jouable, création du projet", "O5 Dette envers l'Étranger", "Réparatrice du port de Namarra", "Mission O5-M22 (proposé)", "Fiche proposée, à valider"],
        ["Keth", "Personnage jouable, création du projet", "O5 Dette envers l'Étranger", "Chasseur qui sous-estime l'humaine", "Mission O5-M25 (proposé)", "Fiche proposée, à valider"],
        ["Saar", "Personnage jouable, création du projet", "O6 La Longue Chasse", "Instructeur de cohorte", "Une fin de la voie O6 (proposé)", "Fiche proposée, à valider"],
        ["Harek", "Personnage jouable, création du projet", "O6 La Longue Chasse", "Rival de cohorte", "Mission O6-M33 (proposé)", "Fiche proposée, à valider"],
        ["Yena", "Personnage jouable, création du projet", "O6 La Longue Chasse", "Camarade de cohorte", "Mission O6-M27 (proposé)", "Fiche proposée, à valider"],
        ["Tov", "Personnage jouable, création du projet", "O6 La Longue Chasse", "Camarade de cohorte", "Mission O6-M27 (proposé)", "Fiche proposée, à valider"],
        ["Saer", "Non jouable (HW-DEC-30)", "O4 Nom entaché", "Archiviste local", "Sans objet", "Voix possible du codex"],
        ["Habillages des 15 clans", "Couleurs d'armure et de masque", "Identités des clans CL1 à CL15", "", "Appartenir au clan dans La Longue Chasse", "Décidé (HW-DEC-18), condition proposée"],
        ["Arène « Arène de la reine active »", "Variante de la 8e chasse", "Xeno Prime, secteur XP-Z12", "", "Avoir vaincu la première reine (mission R2-M026)", "Décidé (HW-DEC-18), condition proposée"],
        ["Arène « Tête de reine géante au sol »", "Arène supplémentaire", "Xeno Prime, secteur XP-Z09", "", "Avoir préparé Xeno Prime (mission R2-M025)", "Décidé (HW-DEC-18), condition proposée"],
    ],
)

TABLES["17_Comptes"] = (
    "Système de comptes existant (projet Supabase commun, lu le 13 novembre 2026 en lecture seule)",
    ["Élément", "Constat", "Usage pour Hive Warriors"],
    [
        ["Projet", "Un projet Supabase commun à plusieurs applications de l'auteur, région eu-west-1", "Réutilisé tel quel (HW-DEC-21)"],
        ["Comptes", "Table d'utilisateurs du service d'identification de Supabase ; toutes les tables de sauvegarde y sont rattachées", "Même compte pour La Longue Chasse et Hive Warriors"],
        ["yautja_cloud_saves", "Une ligne par compte : révision, instantané complet (20 Mo au plus), date ; décrite comme l'espace Yautja complet, synchronisé entre mobile et bureau ; 1 ligne présente", "Lue seulement, pour connaître les étapes franchies (HW-DEC-15)"],
        ["app_cloud_saves", "Une ligne par compte et par application : clé d'application, contenu, date ; décrite comme un instantané du stockage local par application ; vide", "Candidate pour la sauvegarde de Hive Warriors (Q20)"],
        ["Protection", "Sécurité par ligne activée sur toutes les tables", "Chaque joueur ne lit que sa propre sauvegarde ; les règles exactes restent à vérifier"],
        ["Méthode d'identification", "Adresse e-mail et mot de passe, par le service d'identification de Supabase (inscription, connexion, renouvellement de session, déconnexion) ; relevé dans app/game/systems/cloudAccountRestV71.ts de La Longue Chasse", "Reprise à l'identique (HW-DEC-23)"],
        ["Écriture de la sauvegarde de La Longue Chasse", "Révision optimiste : chaque écriture doit porter la révision précédente + 1, vérifiée par un déclencheur ; un conflit entre deux appareils est signalé au joueur", "Hive Warriors ne l'écrit jamais ; il lit l'instantané"],
        ["Sauvegarde de Hive Warriors", "Table app_cloud_saves retenue (HW-DEC-26) ; elle n'a pas de numéro de révision", "Le dernier appareil qui écrit l'emporte : risque à traiter (Q23)"],
        ["Dans Hive Warriors", "Aucun code de compte ni de sauvegarde en ligne ; 6 clés de stockage local", "Tout est à écrire"],
    ],
)

TABLES["18_LieuxFuturs"] = (
    "Lieux futurs (HW-DEC-37) : aucun n'est dans le code ; dates et détails à vérifier avant écriture",
    ["Lieu", "Œuvre", "Idée de chasse", "Boss pressenti", "Déjà dans le code", "Priorité proposée"],
    [
        ["Hadley's Hope, LV-426", "Aliens (1986)", "Colonie, centre d'opérations, puis le nid sous le processeur atmosphérique", "Reine", "Marines, sentinelles, blindé M577, Cheyenne, chargeur", "1"],
        ["Épave des Ingénieurs, LV-426", "Alien (1979)", "Salle du pilote et cale aux œufs", "À définir", "Estrade du Space Jockey, chambre de l'épave", "2"],
        ["Fiorina 161", "Alien 3 (1992)", "Prison-fonderie, couloirs, moule à plomb", "Coureur quadrupède", "Fonderie de plomb (décor générique)", "1"],
        ["Grandes Plaines, 1719", "Prey (2022)", "Forêt, clairière brûlée, camp des trappeurs", "À définir (« et si… »)", "Feral Predator jouable, sans arène à lui", "1"],
        ["Yautja Prime", "Univers étendu ; Homeworld de la Bible V6", "Arène rituelle de la cité", "Reine d'épreuve", "Citadelle du menu", "2"],
        ["Genna", "Predator: Badlands (2025)", "Planète hostile, faune géante", "À définir", "Non", "2"],
        ["Scandinavie viking", "Killer of Killers (2025)", "Premier récit du film", "À définir", "Viking Predator jouable (celui de Hunting Grounds, distinct)", "3"],
        ["Japon féodal", "Killer of Killers (2025)", "Deuxième récit du film", "À définir", "Samurai Predator jouable (celui de Hunting Grounds, distinct)", "3"],
        ["Pacifique, Seconde Guerre mondiale", "Killer of Killers (2025)", "Troisième récit du film", "À définir", "Non", "3"],
        ["Arène du roi Grendel", "Killer of Killers (2025)", "Combat d'arène final", "Roi Grendel", "Non", "3"],
        ["Nostromo", "Alien (1979)", "Huis clos : un seul xénomorphe, puis l'essaim « et si… »", "À définir", "Non", "3"],
        ["Station Sevastopol", "Alien: Isolation (2014)", "Station en ruine, synthétiques Working Joe", "À définir", "Working Joe déjà codé", "2"],
        ["LV-223", "Prometheus (2012)", "Dôme des Ingénieurs, urnes", "Ingénieur éveillé", "Ingénieur éveillé, urnes, Trilobite, Deacon déjà codés", "1"],
        ["Planète 4", "Alien: Covenant (2017)", "Cité morte des Ingénieurs", "À définir", "Ruines de la Planète 4, néomorphe, praetomorphe déjà codés", "2"],
        ["USM Auriga", "Alien, la résurrection (1997)", "Vaisseau-laboratoire, bassin inondé", "À définir", "Bassin de l'Auriga (décor générique)", "2"],
        ["Île Bouvet, station baleinière", "AVP (2004)", "La surface au-dessus de la pyramide", "À définir", "Non", "3"],
        ["BG-386", "Aliens vs. Predator (jeu, 2010)", "Colonie, jungle, ruines Yautja", "À définir", "Non", "3"],
        ["Ryushi", "Aliens vs. Predator (comics, 1989)", "Colonie d'élevage en plein désert, la toute première rencontre des deux espèces", "Reine", "Non", "2"],
        ["Abattoir et métro de Los Angeles", "Predator 2 (1990)", "Suite de la chasse des toits", "À définir", "Toits de Los Angeles", "3"],
    ],
)

TABLES["19_ChasseursFuturs"] = (
    "Chasseurs futurs (HW-DEC-38) : aucun n'est dans le code ; noms repris du catalogue des 54 gantelets de La Longue Chasse",
    ["Chasseur", "Œuvre", "Trait de jeu pressenti", "Lié à", "Priorité proposée"],
    [
        ["Scar", "AVP (2004)", "Équilibré ; shuriken et combistick", "Pyramide antarctique", "1"],
        ["Celtic", "AVP (2004)", "Puissant ; filet", "Pyramide antarctique", "1"],
        ["Chopper", "AVP (2004)", "Lames de bras longues", "Pyramide antarctique", "1"],
        ["Berserker (Mr. Black)", "Predators (2010)", "Lourd ; aujourd'hui seulement boss", "Réserve de chasse", "1"],
        ["Tracker", "Predators (2010)", "Molosses", "Réserve de chasse", "1"],
        ["Falconer", "Predators (2010)", "Drone faucon", "Réserve de chasse", "1"],
        ["Classic (le Predator crucifié)", "Predators (2010)", "Chasseur classique libéré", "Réserve de chasse", "2"],
        ["Fugitive", "The Predator (2018)", "Rapide, léger", "Aucune arène", "2"],
        ["Upgrade", "The Predator (2018)", "Géant sans armure", "Aucune arène", "2"],
        ["Dek", "Predator: Badlands (2025)", "Jeune chasseur", "Genna", "2"],
        ["Kwei et Njohrr", "Predator: Badlands (2025)", "À définir", "Genna", "3"],
        ["Chasseur du récit viking", "Killer of Killers (2025)", "À définir ; distinct du Viking de Hunting Grounds", "Scandinavie viking", "3"],
        ["Chasseur du récit ninja", "Killer of Killers (2025)", "À définir", "Japon féodal", "3"],
        ["Chasseur du récit du pilote", "Killer of Killers (2025)", "À définir", "Pacifique", "3"],
        ["Greyback, l'Ancien", "Predator 2 (1990)", "Ancien ; épée", "Toits de Los Angeles", "2"],
        ["L'Ancien d'AVP", "AVP (2004)", "Distinct de Greyback", "Pyramide antarctique", "3"],
        ["La Tribu perdue (Boar, Shaman, Guardian, Stalker, Snake, Warrior, Scout)", "Predator 2 (1990)", "Sept habillages et variantes", "Toits de Los Angeles", "3"],
        ["Dark", "Aliens vs. Predator (jeu, 2010)", "À définir", "BG-386", "3"],
        ["Scarface", "Predator: Concrete Jungle (2005)", "À définir", "Aucune arène", "3"],
        ["Ahab", "Comics et figurines", "Ancien chasseur d'Ingénieurs", "LV-223", "3"],
        ["Classes de Hunting Grounds (Scout, Berserker, Valkyrie, Exiled, Pirate…)", "Predator: Hunting Grounds (2020)", "Variantes de classe", "Aucune arène", "3"],
    ],
)

TABLES["20_GameplayCible"] = (
    "Systèmes de jeu retenus (HW-DEC-33 à 36 et 39) : état dans le code et phase proposée",
    ["Système", "Décision", "Ce qui existe dans le code", "Ce qui manque", "Phase"],
    [
        ["Carte à zones (campagne)", "HW-DEC-33 et 41", "Arène fermée de 150 m ; officiers de ruche (2 par vague) ; jauge de moral", "Carte plus grande, zones, capture, renforts par zone, mini-carte de conquête", "3"],
        ["Verrouillage de cible", "HW-DEC-35", "Caméra fixe derrière le chasseur, sans souris ; réticule à trois lasers", "Contrôle de caméra, verrouillage, bascule entre cibles", "2"],
        ["Changement d'arme en combo", "HW-DEC-35", "Fonction toggleWeaponSwap présente, sans touche depuis v51", "Seconde arme réelle, enchaînement prolongé", "2"],
        ["Mises à mort contextuelles", "HW-DEC-35", "Exécution des boss et sous-boss étourdis, des synthétiques ; plongeon depuis une passerelle", "Mises à mort sur les élites et la masse, selon l'arme", "2"],
        ["Furtivité d'ouverture", "HW-DEC-35", "Camouflage codé sans touche ; perchoir ; arbres perchoirs à Gunnison ; élimination furtive (×2,5)", "Début de chasse camouflé, horde non alertée", "2"],
        ["Niveaux de chasseur", "HW-DEC-34", "Aucun", "Expérience, niveaux, finitions débloquées", "4"],
        ["Armes à attributs", "HW-DEC-34", "Saignement, acide, givre existent comme effets isolés", "Armes équipables, attributs, forge unique", "4"],
        ["Rangs Yautja", "HW-DEC-34", "Insigne « blooded » dans l'interface ; codex des rangs", "Sept rangs, conditions, contenu par rang", "4"],
        ["Trophées à effets", "HW-DEC-34", "Compteur de crânes ; citadelle du menu ; 4 succès", "Un trophée par boss, bonus au choix", "4"],
        ["Niveaux de difficulté", "HW-DEC-36", "Aucun", "Trois ou quatre difficultés, récompenses", "5"],
        ["Mode libre", "HW-DEC-36", "Toutes les arènes et tous les chasseurs sont déjà ouverts", "À réserver aux chasses terminées", "5"],
        ["Défis de chasse", "HW-DEC-36", "Aucun", "Épreuves à contrainte", "5"],
        ["Classement en ligne vérifié", "HW-DEC-36 et 43", "Aucun ; meilleur combo et vague maximale en local ; hasard non reproductible", "Tirage à graine fixe, journal des saisies, contrôle côté serveur, table de scores", "7"],
        ["Récit par chasse", "HW-DEC-39", "Annonces à l'écran ; titres des 5 chapitres", "Introduction et conclusion écrites par chasse", "6"],
        ["Codex complet", "HW-DEC-39", "Codex en 4 onglets, 22 entrées, tout ouvert", "Une fiche par ennemi, boss, arme et lieu, débloquée en jouant", "6"],
        ["Citadelle vivante", "HW-DEC-39", "Citadelle 3D derrière le menu", "Lieu à parcourir, forge, mur de crânes, table de chasse", "6"],
        ["Musique par arène", "HW-DEC-39", "Un bourdon à 55 Hz", "Un thème par lieu, un thème de boss, synthétisés", "6"],
    ],
)

TABLES["14_Sources"] = (
    "Sources lues pour cette bible",
    ["Source", "Nature", "Projet", "Lecture"],
    [
        ["Dépôt yautja-hive-warriors, 60 commits jusqu'à v58.0", "Code", "Hive Warriors", "Audit complet par fichier ; vérification de syntaxe sur chaque commit"],
        ["Essai en navigateur du 13 nov. 2026", "Preuve d'exécution", "Hive Warriors", "8 arènes, 40 s chacune, saisies automatiques ; jusqu'à la vague 3 ; aucun boss atteint"],
        ["Yautja_V6_Bible_Cumulative_et_Dialogues.xlsx", "Bible, 139 onglets", "La Longue Chasse", "Onglets de structure et de canon lus ; dialogues non lus"],
        ["catalogue_yautja_tous_medias.xlsx", "Catalogue, 255 désignations", "Référence franchise", "Lu"],
        ["YAUTJA_V100_SUIVI.xlsx", "Suivi, 27 onglets", "La Longue Chasse", "Parcouru par mots-clés"],
        ["THE_PIT_STAGES_V60_SUIVI.xlsx", "Suivi", "La Longue Chasse", "Lu"],
        ["Yautja_Gauntlets_V142_Arsenal_Clans.xlsx et V144", "Suivi des 54 gantelets", "La Longue Chasse", "Lus ; grandes matrices par échantillon"],
        ["Yautja_ClanWar_V151 et V152", "Recette des 4 modes de guerre", "La Longue Chasse", "Lus"],
        ["YAUTJA_HOMEWORLD_AUDIT_354_CIBLES_20261103.xlsx", "Audit de décors", "La Longue Chasse", "Lu ; matrice par échantillon"],
        ["Yautja_PHG_*_V137 et QA V141", "Personnalisation, 323 éléments", "La Longue Chasse", "Lus ; grandes matrices par échantillon"],
        ["Projet Supabase commun", "Structure des tables", "Plusieurs applications", "Lue le 13 nov. 2026, en lecture seule ; aucun contenu de sauvegarde lu"],
        ["Bible V5, classeurs Aliens Tantalus et SG2D", "Autres", "Autres projets", "Non lus"],
    ],
)


def write_xlsx():
    wb = Workbook()
    wb.remove(wb.active)
    head_fill = PatternFill("solid", fgColor="1F2937")
    for name, (title, cols, rows) in TABLES.items():
        ws = wb.create_sheet(name[:31])
        ws.append([title])
        ws["A1"].font = Font(bold=True, size=13)
        ws.append([])
        ws.append(cols)
        for c in ws[3]:
            c.font = Font(bold=True, color="FFFFFF")
            c.fill = head_fill
            c.alignment = Alignment(wrap_text=True, vertical="top")
        for r in rows:
            ws.append(r)
        for i, col in enumerate(cols, 1):
            longest = max([len(str(col))] + [len(str(r[i - 1])) for r in rows])
            ws.column_dimensions[get_column_letter(i)].width = max(10, min(60, longest + 2))
        for row in ws.iter_rows(min_row=4):
            for c in row:
                c.alignment = Alignment(wrap_text=True, vertical="top")
        ws.freeze_panes = "A4"
        ws.auto_filter.ref = f"A3:{get_column_letter(len(cols))}{3 + len(rows)}"
    XLSX.parent.mkdir(parents=True, exist_ok=True)
    wb.save(XLSX)


def write_md():
    out = [
        "# Annexes : tables de la bible Hive Warriors",
        "",
        "Fichier généré par `tools/bible/build_bible.py` ; ne pas le modifier à la main.",
        "Les mêmes tables sont dans `design/Yautja_HiveWarriors_V58_Bible.xlsx`.",
        "",
    ]
    for name, (title, cols, rows) in TABLES.items():
        out += [f"## {name} — {title}", "", "| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
        for r in rows:
            out.append("| " + " | ".join(str(x).replace("|", "/") for x in r) + " |")
        out.append("")
    MD.parent.mkdir(parents=True, exist_ok=True)
    MD.write_text("\n".join(out), encoding="utf-8")


if __name__ == "__main__":
    for name, (_, cols, rows) in TABLES.items():
        for r in rows:
            assert len(r) == len(cols), (name, r)
    write_xlsx()
    write_md()
    print(f"{len(TABLES)} tables, {sum(len(t[2]) for t in TABLES.values())} lignes")
