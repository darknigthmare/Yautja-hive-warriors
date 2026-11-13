# Feuille de route

> Bible du jeu, document 5. Décisions HW-DEC-33 à 39.
> Statut : **ordre proposé, à valider** (question Q28). Les contenus sont décidés ; leur ordre ne l'est pas.

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
C'est le plus gros chantier (HW-DEC-33). Proposition : **un pilote sur une seule chasse** avant de refaire les huit (question Q29).
- Carte plus grande, découpée en zones.
- Chaque zone est tenue par un officier de ruche ; l'abattre la fait basculer.
- Les zones prises tarissent les renforts ; la dernière fait sortir le boss.
- La jauge de moral existante devient la mesure de la conquête.
- Préalable technique : plafond d'ennemis et mise en commun des maillages, sans quoi une grande carte ne tiendra pas.

**Sortie** : une chasse pilote jouée et jugée ; décision sur les sept autres.

### Phase 4 — La progression
Niveaux de chasseur, armes à attributs avec une forge unique, sept rangs Yautja, trophées à effets (HW-DEC-34).
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
Préalables : vérifier les règles d'accès de la table de sauvegarde ; décider du comportement sur deux appareils ; accepter qu'un classement de jeu de navigateur soit amical, sans garantie contre la triche.
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
- Annoncer « 1:1 » quoi que ce soit.
- Compter une fonction écrite comme une fonction livrée : seul compte ce qui a été joué.

## 4. Prudence sur les œuvres récentes

Les entrées tirées de *Predator: Badlands* et de *Killer of Killers* (2025) reprennent les noms présents dans le catalogue des 54 gantelets de La Longue Chasse. Leurs détails (lieux, époques, noms de chasseurs) sont à vérifier sur les œuvres avant toute écriture ; les onglets 18 et 19 les marquent « à définir ».
