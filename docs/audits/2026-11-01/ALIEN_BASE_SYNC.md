# Alien_base — branchement Yautja Hive Warriors

Données communes **versionnées, en lecture seule** et issues de la PR privée `darknigthmare/alien_base#2` ; export public autorisé `exports/alien-base-public-v1.js`. Le dépôt privé n'est jamais contacté par le navigateur.

- Origine YHW : `c898ed0a5d0974724d76aa0b426284d6815bd8eb` ; origine Tantalus : `d41b5fc120da2e7a5938308f9d3c852d20e53cc5`.
- `js/data/AlienBaseRegistry.js` : recherche stricte par IDs, statut d'admission, count et provenance ; pas de recherche floue ni fusion par nom.
- `js/data/BattleCatalog.js` : chaque profil existant reçoit `sharedAlienBaseId` sans modifier `id`, `eligibility`, budgets, spawn, gameplay Musou ni sérialisation.
- `Alien_Base_Import_Status.csv` : 773 fiches de suivi Excel des catégories destinées aux jeux, sans les liens documentaires et écarts M577 (toujours dans la base).
- **Manquants réels** : preuves à revalider individuellement, correspondance d'alias YHW ↔ Tantalus par variante/média, modèles/animations 1:1, tests visuels, admission au roster par classe et théâtre ; le catalogue n'implémente pas automatiquement 200 armes ni des ennemis supplémentaires.

Contrôle ciblé : `node --test tests/alien-base-bridge.test.js`. Une mise à jour future doit re-générer l'export côté `alien_base` et comparer le diff public avant d'importer, puis repasser tests du moteur et QA des missions. Ne pas divulguer de contenus du master privé non autorisés.


**Extension V1 :** 52 familles d'ennemis Tantalus, 29 œuvres de la matrice Apex, 158 identités de cartes TCG dans l'export public contrôlé. Les 571 variantes procédurales de Tantalus restent documentées séparément dans le dépôt maître privé : leurs statistiques ne valent que pour le gameplay de Tantalus. Le CSV de suivi compte désormais 773 entrées, toujours sans ajouter d'ennemis ou d'armes au runtime.
