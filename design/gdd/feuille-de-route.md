# Feuille de route

> Bible du jeu, document 5. Décisions HW-DEC-33 à 47.
> Statut : **ordre validé par l'auteur le 13 novembre 2026** (HW-DEC-40).

## 1. L'écart à regarder en face

Les décisions prises décrivent un jeu bien plus vaste que le code actuel.

| | Aujourd'hui dans le code | Décidé |
|---|---|---|
| Lieux | 8 arènes, sur un même plan de 150 m | 8 chasses sur cartes à zones, plus 19 lieux futurs |
| Personnages jouables | 7 chasseurs | 7, plus 19 personnages de La Longue Chasse, plus 21 entrées de chasseurs de la saga |
| But d'une chasse | Survivre à des vagues, sans victoire | Conquérir des zones, exécuter le boss |
| Progression | 2 améliorations de forge | Niveaux, armes à attributs, sept rangs, trophées à effets |
| Modes | Une mission, sans fin par défaut | Campagne, sans fin, libre, défis, 3 ou 4 difficultés, classement |
| En ligne | Rien | Compte, sauvegarde, déblocages, classement |

Et le point de départ : le jeu ne se chargeait plus depuis la v34, il a été remis en marche les 12 et 13 novembre 2026, et aucun boss n'a encore été vu en jeu.

Entre la v34 et la v58, 25 versions ont ajouté du contenu sans qu'aucune ne tourne. La règle de cette feuille de route en découle : **une phase ne commence que lorsque la précédente a été jouée dans un navigateur**, de bout en bout.

## 2. Les phases

### Phase 0 — Remettre debout (en cours)
Fait : le jeu se construit, se lance, affiche la 3D, enchaîne les vagues et la défaite dans les 8 arènes.
Reste : les défauts P0 de l'onglet `11_P0_Defauts` (boss qui ne meurent pas par les dégâts, ennemis à zéro point de vie encore actifs, `window.gameInstance` jamais défini).
**Sortie** : une chasse complète, boss compris, sans erreur en console.

### Phase 1 — Une boucle qui se termine
Victoire par exécution du boss d'arène, pause, retour au menu, trois boss manquants, décor générique rendu à son arène, soutiens selon l'arène, Garde nationale à Gunnison, armes humaines ramassées, numéro de version unique.
**Sortie** : les 8 chasses se gagnent et se perdent.

### Phase 2 — Le combat
Tronc commun et quatre emplacements, Musou par chasseur, conflits de touches levés, puis les quatre ajouts décidés (HW-DEC-35) :
- **verrouillage de cible**, ce qui suppose d'abord une caméra pilotée à la souris ;
- **changement d'arme en combo** : la fonction existe déjà, sans touche depuis la v51 ;
- **mises à mort contextuelles** sur les élites, puis sur la masse ;
- **furtivité d'ouverture** : camouflage, perchoirs et élimination furtive existent déjà dans le code, sans accès.

**Sortie** : les sept chasseurs se jouent différemment, sans touche en conflit.

### Phase 3 — La carte à zones
C'est le plus gros chantier (HW-DEC-33). Les cartes à zones portent la campagne ; les arènes fermées actuelles restent pour le mode sans fin et les défis (HW-DEC-41). On commence par **une chasse pilote**, décrite en section 5 (HW-DEC-44).
- Carte plus grande, découpée en zones.
- Chaque zone est tenue par un officier de ruche ; l'abattre la fait basculer.
- Les zones prises tarissent les renforts ; la dernière fait sortir le boss.
- La jauge de moral existante devient la mesure de la conquête.
- Préalable technique : plafond d'ennemis et mise en commun des maillages, sans quoi une grande carte ne tiendra pas.

**Sortie** : une chasse pilote jouée et jugée, puis les sept autres sur le même modèle.

### Phase 4 — La progression
Niveaux de chasseur, armes à attributs avec une forge unique, sept rangs Yautja, trophées à effets (HW-DEC-34). Les rangs sont propres à Hive Warriors : mêmes sept noms que La Longue Chasse, gagnés ici par les trophées de boss (HW-DEC-42).
À surveiller : quatre systèmes de progression qui s'additionnent peuvent rendre le chasseur invincible. Leur cumul doit être plafonné et réglé ensemble, pas un par un.
**Sortie** : rejouer une chasse rapporte quelque chose, sans casser la difficulté.

### Phase 5 — Les modes
Trois ou quatre niveaux de difficulté, mode libre, défis de chasse (HW-DEC-36).
**Sortie** : une raison de revenir une fois la campagne finie.

### Phase 6 — L'univers
Récit d'introduction et de conclusion par chasse, codex complet débloqué en jouant, citadelle à parcourir, un thème musical par lieu et un thème de boss (HW-DEC-39). Le codex corrige au passage les erreurs relevées dans `canon-et-regles-editoriales.md`.
**Sortie** : chaque chasse a un début, une fin et une trace.

### Phase 7 — En ligne
Compte Supabase existant, sauvegarde en ligne, lecture de la progression de La Longue Chasse, déblocage de ses 19 personnages, classement.
Préalables : vérifier les règles d'accès de la table de sauvegarde ; décider du comportement sur deux appareils.

**Classement vérifié par vraisemblance (HW-DEC-43 et 45).** Le jeu envoie avec son score un résumé minute par minute : éliminations, dégâts infligés et reçus, vague ou zone atteinte, durée. Le serveur rejette ce qui est impossible et n'inscrit que le reste. Cela arrête la triche grossière, pas un tricheur patient ; un rejeu complet a été écarté. Il faut, dans l'ordre :
1. le résumé de partie, produit pendant le jeu ;
2. les bornes de vraisemblance, tirées des chiffres réels du jeu une fois l'équilibrage fait ;
3. le contrôle côté serveur ;
4. la table de scores et son affichage.

Aucun classement n'est publié avant.

**Sortie** : un joueur de La Longue Chasse retrouve ses personnages dans Hive Warriors.

### Phase 8 — Extensions
Les 19 lieux de l'onglet `18_LieuxFuturs` et les chasseurs de l'onglet `19_ChasseursFuturs`, par lots thématiques.

Lots proposés, dans l'ordre :
1. **Ce que le code contient déjà à moitié** : LV-223 (Ingénieur, urnes, Trilobite et Deacon déjà codés), Hadley's Hope (marines, sentinelles, blindé, chargeur déjà codés), Fiorina 161 (fonderie déjà codée).
2. **Les chasseurs liés aux arènes existantes** : Scar, Celtic et Chopper pour la pyramide ; Berserker, Tracker et Falconer pour la réserve de chasse.
3. **Prey** : les Grandes Plaines, l'arène qui manque au Feral Predator.
4. **Le reste**, lieu par lieu.

## 3. Ce que cette feuille de route refuse

- Ajouter un lieu ou un chasseur avant la fin de la phase 1.
- Refaire les huit cartes avant d'avoir jugé le pilote.
- Publier un classement non vérifié.
- Annoncer « 1:1 » quoi que ce soit.
- Compter une fonction écrite comme une fonction livrée : seul compte ce qui a été joué.

## 4. Prudence sur les œuvres récentes

Les entrées tirées de *Predator: Badlands* et de *Killer of Killers* (2025) reprennent les noms présents dans le catalogue des 54 gantelets de La Longue Chasse. Leurs détails (lieux, époques, noms de chasseurs) sont à vérifier sur les œuvres avant toute écriture ; les onglets 18 et 19 les marquent « à définir ».

## 5. La chasse pilote : l'épreuve de la meute

> Décision HW-DEC-44. Votre réponse était : une chasse inscrite dans l'univers, par meute d'Unblooded, avec un Adjutant et un Elite qui surveillent et guident, contre la faune extraterrestre. Ce qui suit est mon interprétation, à confirmer (question Q34).

### Pourquoi elle convient
- **Elle est conforme à la Bible V6.** Avant le rang Blooded, tout se passe sur le Homeworld ; Adjutant est une fonction, pas un rang ; la faune y compte 28 espèces originales. Aucun personnage ni lieu de film n'est nécessaire.
- **Elle sert de prologue.** C'est la chasse numéro zéro : le joueur apprend le jeu avant les Xénomorphes.
- **Elle justifie les alliés.** La meute d'Unblooded reprend les alliés Yautja déjà codés, ici à leur place.

### Déroulement
- **Lieu** : une région du Homeworld. Je propose la Jungle des Piliers ; à confirmer (question Q35).
- **Le joueur** : un Unblooded parmi une meute de trois ou quatre.
- **L'Elite** surveille depuis les hauteurs. Il n'intervient que si un Unblooded tombe : il le relève une fois, et la chasse perd alors son meilleur rang de récompense.
- **L'Adjutant** guide : il annonce les zones, désigne la proie suivante, commente les fautes. C'est la voix du tutoriel.
- **Les zones** : trois ou quatre territoires de troupeau. Chaque zone est tenue par un meneur de harde ; l'abattre fait fuir le troupeau et ouvre la suivante.
- **La grande proie** : la dernière zone abrite un spécimen dominant. Le faire chanceler, puis l'exécuter, termine l'épreuve.
- **La règle d'honneur** : les petits et les bêtes qui fuient ne comptent pas. La Bible V6 demande de lire la « capacité de riposte » de la proie ; ici, frapper une bête qui fuit ne rapporte rien.

### Ce qu'elle teste
1. Le découpage en zones et leur bascule.
2. Le meneur de zone, modèle des futurs officiers de ruche.
3. Les alliés qui combattent sans voler la chasse au joueur.
4. Une carte plus grande que 150 m, donc le plafond d'ennemis et la mise en commun des maillages.

### Ce qui manque pour l'écrire
- Les noms et comportements de la faune : l'onglet « Faune et adversaires » de la Bible V6 en liste 28, dont je ne connais que sept noms (Briseur de basalte, Fouisseur de verre, Chasseur de canopée, Dents de neige, Traqueur des lisières, Faucheur de Vara-Kesh, Pisteur de chenil). Le classeur n'est plus accessible depuis le dernier redémarrage de la session.
- Le titre « Hive Warriors » : cette chasse n'a ni ruche ni Xénomorphe. Elle est un prologue, pas une chasse de campagne.
