# Commandes coopératives et continuité de campagne

Date : 29 octobre 2026. Projet : Yautja Hive Warriors. [PR #5](https://github.com/darknigthmare/Yautja-hive-warriors/pull/5).

## Résultat

**44 tests Node réussis, aucun échec, aucun test ignoré.** Les huit fichiers JavaScript directement vérifiés passent aussi le contrôle de syntaxe.

Base de cette passe : **6b81359c44322c7b71e276bcf1f9e266180d16ab**, arbre **887644fbaf67eee71f18609fd4f477545da3123d**. Les [empreintes des fichiers testés](validation.json) permettent de rattacher les résultats au code exact, indépendamment de la date d’un build.

Guides appliqués à la révision **19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9** : **input-systems**, **game-ui-ux**, **save-systems**. Le changement reprend les actions et systèmes propriétaires déjà présents : il raccorde le clavier J2 à l’interaction commune, maintient des choix de joueurs valides et vérifie le résultat réel d’une écriture.

## 1. Interactions du joueur 2 au clavier

### Défaut reproduit

Le listener clavier traitait Entrée pour J2 en essayant seulement le secours et les interactions de secteur, puis en lançant une attaque. Il contournait la méthode commune utilisée par E/J1 et l’action d’interaction à la manette. Les ponts tactiques, le transport, les objectifs d’opération et les objets Prey pouvaient ainsi être ignorés par ce chemin clavier.

Un autre détail empêchait de raccorder simplement la méthode : elle retournait vrai même si sa dernière tentative d’exécution n’avait rien fait. Cela aurait supprimé l’attaque ordinaire de J2 en l’absence d’interaction.

### Correction

Entrée tente maintenant l’interaction commune avec **le joueur 2** et attaque seulement si aucune action n’a consommé la commande. Les trois branches d’exécution renvoient un résultat booléen ; leurs critères, effets, récompenses et coûts ne changent pas.

Le secours garde sa priorité et ne s’exécute qu’une fois par pression. Une exécution réussie consomme la commande sans attaque supplémentaire. Les QTE de facehugger normal et royal utilisent Entrée ; les attaques restent bloquées pendant le QTE.

Les gardes de pause, insertion, mode photo, roue, répétition et contrôle d’interface restent appliquées. J2 mort ne peut pas interagir. Le bloc J2 reste placé avant la garde de mort de J1 : **J2 vivant reste jouable lorsque J1 est mort**. Les commandes lourde et plasma conservent leur rôle.

### Preuves

Quinze tests exécutent le véritable listener keydown et les méthodes de production, extraits du fichier courant sans construire de scène WebGL. Ils couvrent les interactions citées, les trois branches d’exécution, les refus, le repli vers une attaque, les QTE et les gardes. Avant correction : **13 échecs, 2 réussites**. Après : **15 réussites**.

## 2. Carte de commandement après retour en solo

### Défaut reproduit

La carte est conservée entre les missions. Passer en solo désactivait les options Joueur 2 sans changer une sélection déjà active. Le donneur d’ordre ou le bénéficiaire du soin pouvait donc rester associé au second emplacement après sa disparition.

### Correction et preuve

En solo, les deux sélecteurs reviennent sur **Joueur 1**. En coopération, un choix explicite de J2 reste sélectionné. Les groupes, le front, le compagnon, la cible ennemie, le zoom et le déplacement de la carte restent conservés.

Quatre tests appellent la vraie méthode de mise à jour avec des sélecteurs simulés. Les deux transitions problématiques échouaient avant le correctif ; les quatre cas réussissent maintenant. Ils ne constituent pas une validation visuelle du canvas.

## 3. Réessai réel des écritures de campagne

### Défaut reproduit

Quand le stockage refusait l’enregistrement d’une mort nommée, la campagne gardait la perte en mémoire. Une observation ultérieure identique n’essayait plus d’écrire et retournait pourtant persisted=true. Après rechargement du registre, cette perte pouvait donc disparaître.

### Correction

Une observation réessaie désormais l’écriture si une précédente tentative a échoué, même sans nouvelle conséquence. recorded reste lié à une nouvelle observation ; persisted reflète le résultat réel de la persistance. Il n’y a pas de nouvelle insertion de l’individu.

La séquence testée tue **BOS-26** dans AFF-01, provoque une panne temporaire du stockage, réobserve la même perte après rétablissement, recharge le registre puis reconstruit **AFF-03**. L’individu reste mort, à zéro PV, et les effectifs se réconcilient.

Le stockage toujours indisponible continue de produire persisted=false. Une observation d’un registre déjà chargé et valide n’entraîne pas d’écriture redondante. Les protections des registres incompatibles et l’isolation des clés d’honneur et de trophées sont conservées.

La suite campagne passe **8/8**, dont les deux régressions qui échouaient avant correction.

## Vérification consolidée

| Suite | Réussites | Portée |
| --- | ---: | --- |
| co-op-keyboard-interactions.test.js | 15 | Listener clavier, priorité des interactions, exécutions, QTE, gardes et J2 autonome |
| command-map-coop-selection.test.js | 4 | Transitions coop/solo des sélections de joueurs |
| battle-campaign-record.test.js | 8 | Continuité nommée, reprise d’écriture, finalisation et reconstruction d’une vraie opération |
| gamepad-controls.test.js | 13 | Emplacements, fronts de boutons, menus, focus, répétitions et interruptions |
| gamepad-menu-roots.test.js | 4 | Portée des menus/modales et absence de fuite vers le combat |
| **Total** | **44** | **0 échec, 0 ignoré** |

- [Commande et journal de la suite consolidée](targeted-tests.txt).
- [Régressions brutes observées sur les sources initiales](baseline-regressions.txt) : 17 échecs attendus répartis sur les trois suites concernées.
- [Contrôles de syntaxe](syntax-checks.txt).
- [Révisions, empreintes, environnement et limites](validation.json).

Une revue indépendante a contrôlé les gardes, les retours booléens, la conservation des choix et le résultat de la persistance. Les tests manette existants ont été hydratés avec leurs dépendances à l’identique du commit de départ. Aucune dépendance ou version verrouillée du projet n’a été modifiée.

## Suivi d’audit

Les preuves sont ajoutées à **AUD-099**, **AUD-108** et **AUD-118**. Ces trois critères restent **À valider**, avec acceptanceVerified=false.

La passe valide une partie des commandes de la carte, le raccord des interactions coop et un défaut de continuité. Elle ne prouve pas tous les parcours de commandement, deux fronts simultanément visibles avec budget matériel mesuré, ni toutes les migrations de sauvegarde.

Les 126 identifiants, les critères et les statuts du suivi sont conservés : 67 Terminé, 44 À valider, 15 En cours. Les 123 autres actions restent identiques. Aucune cellule des classeurs historiques n’est modifiée.

## Conditions et limites d’exécution

Les tests sont des contrôles CPU et des fixtures de commandes/DOM. Ils n’utilisent ni scène WebGL complète, ni manette physique, ni testeur humain. Ils ne mesurent pas les performances matérielles ou la fidélité aux références.

Node 24.22.1 et le cœur officiel Three.js r160 ont été utilisés. Le build Three de test conserve les octets de la distribution 0.160.1 ; son descripteur local n’est pas une installation complète npm ci.

Le build local a été tenté : npm run build échoue avec **vite: not found** (code 127). La version Vite 8.3.4 verrouillée n’est pas installée ni présente dans le cache, et l’accès standard au registre échoue sur le proxy hérité. Aucun navigateur exécutable n’est installé. Les versions et la configuration réseau n’ont pas été changées pour contourner ces limites.

Le statut du nouvel aperçu Git Vercel doit être rattaché à son commit après publication et est consigné dans la PR. L’aperçu précédent ne valide pas ce code. Aucun build ou parcours navigateur réussi n’est revendiqué par cette passe.

Enfin, le réessai de campagne nécessite une observation ultérieure et une écriture réussie : fermer le jeu pendant une panne persistante peut encore perdre un état qui n’a jamais pu être enregistré.
