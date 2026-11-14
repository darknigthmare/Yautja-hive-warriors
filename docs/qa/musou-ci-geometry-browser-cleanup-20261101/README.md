# CI et fidélité des budgets de géométrie — 1er novembre 2026

## Défauts constatés au SHA 86ca6f4

La CI Node ciblée avait réussi **256/256** mais la suite intégrale
Chromium/Node avait **1221/1223**, soit deux échecs distincts :

- `tests/support-visual.test.js` ne multipliait pas les triangles d'un
  `InstancedMesh` par son nombre réel d'instances. Les quatre roues
  M577 apparaissaient alors comptées comme une seule roue (22 366
  triangles rapportés). Le contrôle de budget est corrigé pour
  compter toutes les instances, **sans modifier le budget maximal**
  du blindé ni diminuer son niveau de détail.
- La fermeture des ressources du test navigateur fermait simultanément
  le contexte et son navigateur parent. Cela pouvait entraîner
  `browserContext.close: Target page, context or browser has been closed`
  après un scénario terminé, masquant le résultat réel. La fermeture est
  désormais réalisée en ordre inverse de l'acquisition ; seules les
  erreurs spécifiques indiquant un handle déjà fermé sont considérées
  comme un nettoyage sans effet, les autres exceptions restent fatales.
  Les erreurs réelles pendant la partie ne sont pas masquées.

Nouveaux tests du gestionnaire de nettoyage : ordre de clôture,
idempotence, signal d'abandon, conservation des vraies erreurs.

**Limite :** ces corrections d'infrastructure ne certifient pas une
fidélité 1:1 visuelle, une performance GPU ni le fonctionnement de la
nouvelle conduite. Elles garantissent un comptage correct des instances
et une suite CI qui reflète mieux les erreurs réelles.
