# Recette navigateur ciblée — préparation

Validation finale : **4/4 scénarios passent** sur le build figé `5089228a12ac2985ef03e72782fd29e8687f6b33`, en 147,713 secondes. Zéro erreur navigateur, chargement échoué ou requête externe ; le répertoire `dist` est resté identique. Rapport et captures : `final-5089228/`. Les tentatives antérieures restent conservées dans `attempts/`, dont celle ayant révélé le vrai défaut d’interaction corrigé. Chromium et le serveur de cette recette sont fermés.

Le build autorisé est fourni au lancement ; les identifiants d’un build remplacé ne sont pas inscrits comme valeurs par défaut. Le script vérifie les empreintes avant d’ouvrir Chromium, lance son propre serveur de prévisualisation sur le port choisi et vérifie que le répertoire `dist` reste identique à la fin. Un dossier de sortie existant est refusé pour conserver les tentatives précédentes.

```bash
node docs/qa/pr3-next-20261028/integrated-features/run-integrated-features.mjs \
  --root-browser-go \
  --expected-source SOURCE_COMMIT_AUTORISE \
  --expected-index SHA256_HTML_AUTORISE \
  --port 4319 \
  --output docs/qa/pr3-next-20261028/integrated-features/run-final
```

Les quatre scénarios utilisent les menus et les vrais boutons de lancement, sauvegarde, reprise et roue d’armes. Les assistances sont explicitement recensées dans `report.json` : insertion avancée avec sa vraie mise à jour, pauses de préparation, placement à proximité d’objets ou d’un allié existant, callback fatal contrôlé sur un véritable allié alloué, progression du véritable secours de trois secondes, placement de deux ennemis existants sur un axe physiquement dégagé, puis dégâts contrôlés à travers le vrai combattant APC.

Les assertions portent sur la graine 1 et le commandement offensif après reprise, le maintien du HUD « FRONTS », la conservation des identités et compteurs, un medicomp consommé une seule fois après trois secondes, la persistance de l’allié secouru, les vrais pickups PREY, le stock de six flèches et quatre coups, un premier impact unique, le refus sous le véritable héliport de Los Angeles bloquant le ciel sans munitions dépensées, et la disparition du collider APC à sa destruction.

Cette recette est automatisée et assistée. Elle ne constitue ni une session de QA humaine, ni une victoire en combat naturel, ni une validation de fidélité mesurée 1:1. Les captures, erreurs navigateur et états avant/après seront conservés même si un scénario échoue.
