# Source M577 / UD-4L — registre de fidélité, 1er novembre 2026

Ce registre sépare les **caractéristiques documentées** du M577, les **études de tournage** et les **adaptations du jeu**. Sources secondaires de lecture du *Technical Manual* : https://www.avpcentral.com/m577-apc et https://www.avpcentral.com/aliens-colonial-marines-technical-manual . La preuve filmique et l'exactitude dimensionnelle nécessitent toujours des comparatifs multi-angle indépendants. Les nombres de gameplay ne sont jamais automatiquement égaux à des unités de mètres ou km/h.

Les 14 lignes du fichier `M577_Cheyenne_Exigences_Sources.csv` sont ouvrables dans Excel (UTF-8 avec BOM, séparateur point-virgule). **Zéro ligne n'est labellisée « visuel 1:1 certifié »**. Ce document n'est pas une permission de copier le système RTS d'AVP: Extinction. La simulation est Musou à fronts simultanés, et les équipages, groupes et pertes sont les identités déjà finies.

## Kinematics de cette passe

La vitesse du convoi part de zéro et augmente jusqu'à sa vitesse de croisière en temps de simulation, avec pas borné à 0,25 s, distance d'intégration trapézoïdale et tests 30/60/120 FPS. Les contrôles complets d'empreinte/portes/sol et la conservation du manifeste s'appliquent **avant** chaque pas réellement déplacé. Après reprise d'un checkpoint la conduite recommence à l'arrêt, sans reconstituer un nouvel équipage. La pause conserve la vitesse et la position en mémoire ; aucune mission n'est modifiée si le convoi n'a pas roulé.

**Restent ouverts** : cinématique vraie de direction, pression des pneus, châssis/suspension mécanique, limites de gabarit film, porte, intérieur TOC, profils armement par variante et arrimage Cheyenne sur une rampe 3D.
