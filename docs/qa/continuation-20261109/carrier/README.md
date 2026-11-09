# Carrier : acquisition autonome et vol après synchronisation

Le Carrier choisissait déjà ses cibles et lançait naturellement sa cargaison dans les limites de sa défense et de sa formation. La capture du 2 novembre, placée près de l'allocation initiale mais hors de ces limites, ne permettait pas de conclure à un défaut de cette décision. Les portées, tactiques, PV et budgets restent identiques.

Un défaut distinct est reproduit : `Game.update` appelle `Horde.update`, puis `BattleActorBridge.sync` avant le rendu. Le Horde animait l'arc réel du Facehugger, puis le Bridge réappliquait immédiatement l'élévation du sol. Le [test initial valide](baseline-before-flight-fix.txt) passe cinq cas sur six et échoue précisément sur la hauteur après cette synchronisation. La [source de ces six tests](baseline-test-source.js) et la première erreur de nom de variante dans la fixture restent conservées séparément.

Le correctif du propriétaire est limité à `BattleActorBridge.sync` : pendant `actor.carrierFlight`, il conserve l'altitude de l'arc géré par le Horde. Dès la fin de cette seconde de vol, la projection habituelle au sol reprend.

Les [huit nouveaux cas](final-autonomy-eight.txt) passent ; ils sont compris dans la [régression ciblée de 36 cas réussis](targeted-regression.txt), sans saut ni annulation. Ils font intervenir le vrai `EnvironmentManager`, sa navigation et ses collisions, le ciblage du Horde, le callback installé par `Bridge.bind` et la transition finie de `BattleSimulation`. Le joueur se trouve dans la zone défendue ; le Carrier part de son allocation existante et marche jusqu'à portée. Aucun appel direct de lancement Bridge ne remplace la décision autonome dans ces nouveaux tests.

La couverture vérifie la distinction défense 24 / formation 28, une cible proche mais hors zone, le refus d'une vraie boîte de collision, la hauteur initiale et l'apex après synchronisation, la pause sans tick Horde, le contact au sol à une seconde, la sauvegarde des identités, le nettoyage et l'épuisement des six parasites sans septième apparition. Les 952 identités et le plafond de 32 acteurs sont conservés. La capacité améliorée de douze ne remplit pas les six places restantes.

Il s'agit d'une arène physique plate de test, avec les vraies classes du jeu et un seul Carrier projeté. Cela ne constitue ni un parcours rendu complet de LV-742, ni une reprise de l'animation aérienne après sauvegarde, ni une mesure de difficulté ou de performance matérielle. Les vérifications navigateur de cette passe restent une preuve séparée. AUD-024 et AUD-025 restent ouverts dans leur portée globale ; aucune fidélité 1:1 ou validation humaine n'est certifiée.

Les empreintes, commandes et limites figurent dans [validation.json](validation.json).
