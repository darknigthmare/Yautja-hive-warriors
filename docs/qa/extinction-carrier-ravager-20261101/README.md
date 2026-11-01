# Carrier et Ravager — première intégration LV-742 (1er novembre 2026)

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
