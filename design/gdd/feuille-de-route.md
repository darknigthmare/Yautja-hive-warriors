# Feuille de route

> Bible du jeu, document 5. Décisions HW-DEC-33 à 64.
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

### Phase 0 — Remettre debout (presque terminée)
Fait : le jeu se construit, se lance, affiche la 3D, enchaîne les vagues et la défaite dans les 8 arènes ; les 11 types de boss combattent, tombent et se font exécuter ; aucune erreur en console.
Reste : une chasse jouée de bout en bout par un humain. Les essais sont automatiques, et les boss ont été appelés par une commande de test.
**Sortie** : vous jouez une chasse complète, boss compris, et vous me dites ce qui ne va pas.

### Phase 1 — Une boucle qui se termine (codée)
Fait : victoire par exécution du boss d'arène, pause, retour au menu, un boss propre à chaque arène dont le Prétorien de Val Verde, courbe de points de vie, soutiens selon l'arène, Garde nationale à Gunnison, armes humaines à ramasser, décor rendu à son arène, version v58.1.
Reste : l'équilibrage, qui demande un vrai joueur.
**Sortie** : les 8 chasses se gagnent et se perdent, jouées par un humain.

### Phase 2 — Le combat (codée en grande partie le 14 novembre)
Fait :
- **le kit du chasseur** : tronc commun identique pour tous, quatre emplacements par chasseur, barre d'emplacements avec recharges ;
- **un Musou propre à chacun des sept chasseurs** ;
- **les conflits de touches levés** : les anciennes touches restent dans le code, désactivées ;
- **verrouillage de cible** (Tab), **changement d'arme en combo** (Q), **camouflage** (C) ;
- **mises à mort contextuelles** : silencieuse camouflé, exécution d'une élite blessée ;
- **ouverture furtive** : la chasse commence camouflée, la ruche n'est pas encore alertée.

Fait aussi : caméra pilotée à la souris (clic pour capturer, perte du pointeur = pause), bascule entre cibles (Tab) et libération (R), choix des quatre emplacements à l'écran de préparation, listes de commandes à jour.

Reste : des animations de mise à mort propres à chaque arme.
**Sortie** : les sept chasseurs se jouent différemment, sans touche en conflit. Vérifié par essais automatiques ; reste à jouer.

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

## 5. La campagne de l'Unblooded

> Le détail de la campagne (monde, meute, kit, huit chasses, rite) est dans [campagne-unblooded.md](campagne-unblooded.md). Cette section en garde le résumé et l'historique des décisions.

> Décisions HW-DEC-48 à 51 et 53 à 56, qui remplacent HW-DEC-44. Ce qui suit développe vos réponses ; les points marqués « proposition » sont de moi.

### Ce qui change
La campagne n'est plus la suite des 8 chasses de films. C'est **l'ascension d'un Unblooded** :

1. **Les chasses de faune en meute**, sur une planète dédiée, région après région.
2. **Le rite de passage** : la première chasse contre les Xénomorphes. La ruche entre dans le jeu à ce moment-là.
3. **Le rang Blooded**, qui ouvre les 8 chasses de films comme chroniques légendaires, jouées avec les chasseurs de films (HW-DEC-56).

### Les chasses de faune
- **Lieu** : un **monde sauvage** (HW-DEC-49 et 53) : une planète naturelle, hostile, que le clan n'a jamais domptée. Les Unblooded y sont largués. Ce sera l'un des 24 mondes de l'atlas de la Bible V6 (HW-DEC-57) ; voir « Le choix du monde » plus bas.
- **Le joueur** : un Unblooded parmi une meute de trois ou quatre. Kit : lames de poignet, combistick et **brûleur** (HW-DEC-50). Pas de canon d'épaule, qui vient avec le rang Blooded.
- **L'Adjutant guide** : il annonce les zones, désigne la proie suivante, commente les fautes. C'est la voix du tutoriel.
- **L'Elite surveille** depuis les hauteurs. Proposition : il ne relève un Unblooded tombé qu'une fois, au prix de la meilleure récompense.
- **Huit régions** (HW-DEC-51 et 54), les huit milieux des missions de chasse de La Longue Chasse : jungle, marais, désert, fongique, glace, océan, volcan, ruines. Une chasse par région, débloquées dans cet ordre (HW-DEC-60). Chaque chasse dure cinq à huit minutes (HW-DEC-59).
- **Les zones** : chaque région compte trois ou quatre territoires de harde, tenus par un meneur ; l'abattre ouvre la zone suivante. La dernière abrite une grande proie, à faire chanceler puis à exécuter.
- **La règle d'honneur** (proposition) : frapper une bête qui fuit ne rapporte rien. La Bible V6 demande de lire la « capacité de riposte » de la proie.

### Le rite de passage
Une **triade dans la pyramide** (HW-DEC-55) : trois Unblooded, armes à énergie exclues, donc sans le brûleur. Tuer son premier Xénomorphe donne le rang Blooded, le canon d'épaule et l'accès aux chroniques. La pyramide antarctique déjà codée sert de base.

### La ruche annoncée
Huit chasses de faune, puis le rite : la ruche n'apparaît qu'à la neuvième chasse. Deux parades décidées (HW-DEC-59) :
- des chasses de faune **courtes**, de cinq à huit minutes ;
- des **traces de Xénomorphes** dès les dernières régions : mues, résine, carcasses vidées. Proposition de répartition : une mue dans la glace, de la résine sur la côte, une carcasse à cage thoracique ouverte au volcan, un œuf éclos dans les ruines.

### La région du volcan
Dans La Longue Chasse, la mission du volcan a pour adversaire un Bad Blood, un Yautja renégat. Ici, **l'Elite s'en charge** (HW-DEC-58) : le Bad Blood rôde, l'Elite l'affronte en arrière-plan, et la meute doit survivre tout en chassant une bête du volcan. Les Unblooded ne tuent pas un Yautja. C'est aussi la seule chasse où l'Elite quitte son poste d'observation : la meute y est sans filet.

### Le choix du monde
Le monde sauvage sera l'un des 24 mondes de l'atlas de la Bible V6 (HW-DEC-57). Je connais leurs noms, pas leurs descriptions : le connecteur Drive ne répond plus depuis le dernier redémarrage de la session, et le choix reste donc ouvert (question Q43).

- **Exclus** : le Homeworld (PLAN01, écarté par HW-DEC-49), Xeno Prime (PLAN08, le monde-ruche), Namarra (PLAN13, monde habité par des humains, celui de Mara Venn), Korthas (PLAN19, théâtre de la guerre des clans).
- **Candidat connu** : Vara-Kesh (PLAN03), le seul dont je connaisse une espèce, le Faucheur de Vara-Kesh.
- **Les 19 autres** : Kharuun, Nereth, Oshara, Rukh Tal, Sileth, Dharos, Morrak, Eshra, Terek-Va, Qorr, Asha-Ruun, Vor-Kel, Tala-Mor, Enshar, Vesh-Kar, Oruun, Sahr-Keth, Ilyss, Ura-Denn.

Le bon choix est un monde que l'atlas décrit comme sauvage et à plusieurs milieux ; il faut relire l'onglet « Atlas des mondes » pour trancher.

### Écarts à connaître
- **Avec la Bible V6** : elle place tout sur le Homeworld avant le rang Blooded, et exige un vaisseau possédé pour voyager. Une planète dédiée dès Unblooded s'en écarte ; l'écart est assumé par le statut hors canon de Hive Warriors.
- **Avec le titre** : les premières heures de « Hive Warriors » se jouent sans ruche. Le rite de passage doit donc arriver assez tôt.
- **Avec le pilier 1** : une meute de quatre n'est pas « un contre cent ». Les hardes doivent rester assez nombreuses pour que le joueur en abatte la plus grande part.
- **Avec le code** : le brûleur, les alliés Yautja et le combistick existent déjà. La faune, la planète, l'Adjutant et l'Elite n'existent pas.

### Ce que la première région teste
Elle reste le pilote de la carte à zones (phase 3) : découpage et bascule des zones, meneur de zone comme modèle des futurs officiers de ruche, alliés qui ne volent pas la chasse, carte plus grande que 150 m.

### Ce qui manque pour l'écrire
Les noms et comportements de la faune : la Bible V6 en liste 28 espèces, dont je ne connais que sept noms (Briseur de basalte, Fouisseur de verre, Chasseur de canopée, Dents de neige, Traqueur des lisières, Faucheur de Vara-Kesh, Pisteur de chenil). Le classeur n'est plus accessible depuis le dernier redémarrage de la session (question Q39).
