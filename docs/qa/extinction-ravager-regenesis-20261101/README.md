# Ravager : Colossal Resilience — distant Musou, 1er novembre 2026

La variante **explicitement signée** par le profil `XEN-010` dans
l'opération AFF-27 via `extinctionUpgrade: 'colossal-resilience'`
dispose maintenant d'une mécanique STRATÉGIQUE distante de récupération
cataleptique. Le jeu normal ne crée aucun Ravager ni nouvel individu,
et l'amélioration n'est pas ajoutée au roster standard.

Dans la simulation des autres fronts, un Ravager amélioré très blessé
survit à un coup non incendiaire non excessif en entrant en catalepsie
pendant douze secondes de simulation originales. Il est incapacitant
et ne combat/capture aucun front. S'il n'est pas achevé, il revient avec
au moins 50% de ses PV d'origine sur **le même ID** ; pas de renfort,
ni crédit de mort, ni double récupération gratuite.
Un second impact létal, un feu explicitement typé ou un coup terminal
excessif conduit à une mort réelle. Les dégâts moyens cinétiques ont
une réduction projetée de 18% : c'est un réglage original du Musou,
**pas une statistique 1:1 du jeu de 2003**.

La capacité est persistée dans les saves version 1 avec
`ravagerCatalepsy` et `ravagerRegenesisSpent`, validées uniquement
si le profil de la configuration signée autorise cette évolution.
Les anciens checkpoints et les 27 opérations inchangées restent
compatibles.

**Toujours absent** : animation cataleptique, protection/interruption
en scène 3D, pose spécifique du Ravager, choix et coût de l'amélioration
via la Reine et validation de toutes les statistiques face aux
sources multi-angles. Aucun certificat visuel 1:1.
Source : https://www.avpgalaxy.net/games/avp-extinction/aliens/
