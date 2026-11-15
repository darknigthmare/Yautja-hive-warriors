# Manettes et focus — 26 octobre 2026

`GamepadControls` interroge `navigator.getGamepads()` à chaque image, y compris lorsque la bataille est en pause ou qu'un menu est ouvert. Il utilise le mapping standard du navigateur et attribue deux manettes à P1/P2 sans déplacer P2 lorsque P1 se déconnecte. Les appareils non standard ne sont pas interprétés par défaut ; `acceptUnmapped` existe pour une intégration explicitement testée. Aucun matériel physique n'est déclaré certifié par ces tests automatisés.

Les sticks ont une zone morte radiale de 0,18 avec remappage progressif. La norme des diagonales est limitée à un. `onMove(index,{x,y,magnitude})` et `onLook(index,{x,y,magnitude},delta)` utilisent un Y positif vers l'avant/haut. Le contrôleur principal convertit ces vecteurs dans son repère et applique les collisions existantes. La durée d'image ne modifie pas la vitesse physique.

| Commande standard | Bataille | Menus |
| --- | --- | --- |
| A / B | Saut / esquive | Confirmer / retour |
| X / Y | Attaque légère / lourde | Aucune frappe |
| LB / RB | Roue d'armes / interaction | Panneau précédent / suivant |
| LT / RT | Garde / tir | Aucune frappe |
| Sticks gauche / droit | Mouvement / caméra | Navigation / aucune rotation |
| Croix haut / bas | Vision / soins | Navigation |
| Croix gauche / droite | Camouflage / surcharge | Navigation |
| View / Start | Carte / pause | Retour / pause |
| L3 / R3 | Sprint / verrouillage ou recentrage | Aucun combat |

L'API publique est `update(delta,{context,playerCount,enabled})`, `reset(reason)` et `dispose()`. Les contextes sont `gameplay`, `menu`, `radial` ou `paused`. `onAction(index,action,{phase,value,reason?})` émet les fronts ; seuls garde/tir/sprint ont une fin maintenue. Start, l'ouverture d'une carte et la roue prennent la priorité sur les attaques simultanées. Les boutons maintenus lors d'une connexion ou d'un changement de contexte doivent être relâchés avant de produire une nouvelle action.

Une fin de tir avec `reason` est une **annulation**, jamais un ordre de tirer. Cela concerne pause, changement de contexte, retour, déconnexion, réinitialisation et destruction. Une vraie fin de gâchette n'a pas ce champ. Les axes sont remis à zéro en menu ou lorsque le focus est perdu. L'intégration doit passer `enabled:false` lorsque le document n'est pas actif/visible et exécuter la mise à jour avant tout retour anticipé de la simulation.

`onNavigate(index,direction)` produit les directions avec une première répétition après 0,34 seconde, puis toutes les 0,12 seconde. `onRadial(index,{x,y,magnitude,angle})` expose un angle horaire, zéro en haut, pour la sélection de la roue. `GAMEPAD_HINTS` contient les consignes adaptées au contexte et `onInputMode` permet d'actualiser leur affichage.

`MenuFocusController({getRoot,document,onBack,onPanelCycle,onInputMode})` limite le focus au panneau fourni. Ses méthodes sont `navigate(direction)`, `confirm()`, `back()`, `cyclePanel(delta)` et `handleKeyDown(event)`. Les boutons masqués ou désactivés sont exclus. Les directions suivent la disposition des contrôles et Tab reste dans le panneau ; la saisie textuelle et les listes au clavier conservent leur comportement natif. Aucun événement clavier de combat n'est synthétisé.

Dans une liste simple, gauche/droite modifie la valeur et émet `change`. A ouvre/valide l'édition des options. Dans une liste multiple, A bascule l'option courante et haut/bas déplace le curseur ; B quitte d'abord cette édition avant de fermer le panneau. LB/RB active de vrais éléments `[role="tab"]` ou les hooks `onPanelCycle` ; les menus sans onglet utilisent un déplacement de focus. L'intégration de la carte peut donc sélectionner des groupes et confirmer un ordre sans clavier.

Les tests couvrent l'API native injectée, les deux joueurs, les déconnexions, les fronts, la priorité pause, les annulations, le filtrage des axes, les répétitions à 30/60/120 FPS, la roue, les refus d'accès à l'API et le focus/listes multiples. Ils constituent une couverture du mécanisme d'entrée d'AUD-102 ; la validation du parcours complet et du matériel appartient au contrôle d'intégration. AUD-103 (couleurs/formes/effets) et AUD-104 (occlusion et collisions caméra) sont des chantiers séparés.
