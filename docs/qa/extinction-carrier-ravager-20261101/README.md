# Carrier et Ravager — première intégration LV-742 (1er novembre 2026)

> **Suivi du 2 novembre :** les paragraphes ci-dessous conservent les étapes initiales de cette intégration. La cargaison finie 6/12, la variante standard et le lâcher 3D étaient déjà codés avant la passe actuelle. La pose cataleptique proche et la variante améliorée optionnelle sont décrites dans le [suivi courant](../continuation-20261102/extinction-reporting/README.md). Les anciens « non encore implémenté » sont des constats de ces étapes, pas le verdict courant. Aucune fidélité visuelle 1:1 n’est certifiée.

Les sources du jeu *AVP: Extinction* identifient le Carrier
(6 Facehuggers, 12 avec amélioration) et le Ravager (lames et
récupération améliorée). Guide de référence :
https://gamefaqs.gamespot.com/xbox/917829-aliens-versus-predator-extinction/faqs/29709

**État réalisé :** morphologies 3D procédurales distinctes
avec niveaux de détail, admission strictement limitée à
`AFF-27` et aux identifiants `XEN-009`/`XEN-010`,
pression de mêlée différenciée. Aucune modification de
l'allocation des 27 opérations, aucun nouvel ennemi
artificiellement ajouté et aucun changement de `configDigest`.

**Limitations :** les six arches dorsales sont actuellement
**vides**, et les deux silhouettes ne disposent pas de textures
ou animations multi-angles vérifiées 1:1. Le vrai transport des
Facehuggers déjà alloués, leur lancement/implantation, les
améliorations Ravager de défense et catalepsie, et l'affectation
explicite de ces castes à une variante sourcée de LV-742 restent
à implémenter. Les chiffres de dommages, vitesse et taille sont
des paramètres de Musou, non les valeurs du RTS original.
Le même profil est rejeté sur Lethe et Sevastopol.

Les tests associés valident modèle LOD, identité et absence
de génération gratuite, et refusent le croisement de médias.
La colonne d'audit historique est conservée pour les écarts
datés du 26 octobre ; la colonne runtime est actualisée
séparément.


## 1er novembre 2026 — cargaison biologique persistante, hors caméra

Une cargaison Carrier peut maintenant contenir jusqu'à six
**identifiants de Facehuggers déjà présents dans le même groupe
et la même faction LV-742**, sans création d'unités ni réserve.
Le chargement et le largage ne s'effectuent que pour un groupe
stratégique distant et hors écran. Les parasites sont soustraits
au combat éloigné, à la capture des fronts et à l'exposition hors
ruche tant qu'ils sont transportés. Ils suivent les coordonnées
réelles du Carrier et leur lien de cargaison est validé à la
reprise des sauvegardes contre toute duplication/contamination.
Si le Carrier est détruit, les mêmes parasites sont dispersés
à sa dernière position, sans gain de nouveaux individus.

**Non encore 1:1 ni complet :** aucun saut lancé dans la scène
3D, aucun arrimage animé des corps des Facehuggers, pas de
mode 12 places amélioré, pas de projection de cargaison
pendant une matérialisation existante. Ces capacités seront
soumises à tests physiques et d'identités avant activation.

## Destruction par le feu et Supercarrier à cargaison FINIE

Le Carrier normal conserve une capacité de six individus. Une
**configuration AFF-27 explicitement signée** peut désormais désigner
`extinctionUpgrade: "supercarrier-genome"` sur le profil XEN-009
pour accueillir jusqu'à douze Facehuggers **existants**. Aucune
allocation ni fichier de mission actuel n'active cet attribut :
l'achat par menu/upgrade d'une reine n'est pas implémenté et
aucun ancien checkpoint n'est réécrit. Les douze identifiants
d'un test sont déplacés depuis un groupe réel de la même faction,
et non créés ex nihilo.

La mort par flammes/incendie distingue les dégâts `fire/flame/
napalm/incendiary/burn` d'une attaque conventionnelle :
la première détruit et comptabilise une fois les occupants,
la seconde libère les mêmes identités vivantes. Les sources
**n'autorisent pas un lâcher de parasites vivants hors d'un
Carrier entièrement brûlé**. Attention : l'ancien `cause` de
combat distant n'indique pas toujours le type de munition, donc
le classement feu/non-feu est limité aux impacts explicitement
qualifiés. Les explosions acides, animations de libération,
compétences d'upgrade de la reine et UI de déploiement restent
à développer.
