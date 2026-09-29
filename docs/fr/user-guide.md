# Simulateur de train HO — Guide d'utilisation

*[English version](../en/user-guide.md)*

Le simulateur de train HO permet de **concevoir un réseau de train électrique à l'échelle HO
(1:87)** avec le système de voie **Fleischmann Profi-Gleis**, de **modeler le relief** du
plateau, de **placer des maquettes** (bâtiments, arbres, routes…) et de **faire circuler des
trains Fleischmann** sur le réseau, en vue plan 2D et en vue 3D.

Tout fonctionne dans le navigateur : aucune donnée n'est envoyée à un serveur. Le réseau est
enregistré automatiquement dans le navigateur et peut être exporté dans un fichier `.json`.

---

## 1. L'écran

| Zone | Contenu |
|---|---|
| **Barre du haut** | Nouveau / Ouvrir / Enregistrer / Réseaux… (réseaux d'exemple), export de la nomenclature (CSV), annuler / rétablir, mode d'affichage (Plan, Double, 3D), langue, aide |
| **Panneau gauche** | Quatre onglets : **Voie** (catalogue Fleischmann), **Relief** (pinceaux de terrain), **Maquettes** (décor) et **Trains** (matériel roulant et compositions) |
| **Centre** | Le **plan** (2D, vue de dessus) et/ou la **vue 3D** |
| **Panneau droit** | **Cabine de conduite** (commande des trains), **Propriétés** de la sélection, **Réseau** (taille du plateau, statistiques, nomenclature) |

### Se déplacer

* **Plan** : molette = zoom, glisser avec le bouton droit ou du milieu (ou <kbd>Espace</kbd> +
  glisser) = déplacer, <kbd>⤢</kbd> = recadrer sur le plateau. Sur écran tactile, pincer pour zoomer.
* **Vue 3D** (mode *Orbite*) : glisser clic gauche = tourner, clic droit = déplacer,
  molette = zoom. *Suivre* place la caméra derrière le train actif, *Cabine* donne la vue
  du conducteur.

---

## 2. Poser la voie

Tous les éléments proviennent de la gamme **Fleischmann HO Profi-Gleis** (voir le catalogue §7).

### Poser un premier élément

1. Ouvrez l'onglet **Voie** et cliquez un élément (par exemple **6101**).
2. Déplacez la souris sur le plan : un fantôme de l'élément suit le curseur.
   <kbd>Q</kbd>/<kbd>E</kbd> le tournent de 9° (avec <kbd>Maj</kbd> : 1°).
3. Cliquez pour le poser. Près d'une extrémité libre, le fantôme s'y **aimante**
   automatiquement.
4. <kbd>Échap</kbd> quitte le mode de pose.

### Enchaîner les éléments (la méthode rapide)

1. Avec l'outil **Sélection**, cliquez un **point rouge** : c'est une *extrémité libre*.
   Elle devient le **point d'accroche** (cercle bleu).
2. Cliquez des éléments du catalogue : chacun est raccordé au point d'accroche, qui se
   déplace à l'autre bout du nouvel élément. Un ovale complet se construit en quelques
   secondes !
3. <kbd>F</kbd> **retourne** le dernier élément : une courbe à gauche part à droite, un
   aiguillage est raccordé par une autre extrémité, etc.
4. <kbd>Retour arrière</kbd> supprime le dernier élément et revient d'un pas.
5. <kbd>Échap</kbd> arrête l'enchaînement.

Les éléments dont les extrémités se rejoignent (à 2,5 mm et 2,5° près) sont raccordés
automatiquement, y compris pour fermer une boucle. Les extrémités libres restent
signalées par des points rouges et sont comptées dans les statistiques.

### Sélectionner, déplacer, supprimer

* Cliquez un élément ou une maquette pour le sélectionner, <kbd>Maj</kbd>/<kbd>Ctrl</kbd>+clic pour
  ajouter à la sélection, glissez sur une zone vide pour tracer un cadre de sélection,
  **double-cliquez** une voie pour sélectionner toute la voie qui lui est raccordée,
  <kbd>Ctrl</kbd>+<kbd>A</kbd> sélectionne tout.
* Faites glisser la sélection pour la déplacer. Relâchée près d'une extrémité libre, elle
  s'**aimante** et tourne pour se raccorder.
* <kbd>Q</kbd>/<kbd>E</kbd> tournent la sélection de 9°, <kbd>R</kbd> de 90°.
* <kbd>Suppr</kbd> supprime la sélection.
* <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> annulent / rétablissent.

### Aiguillages

Les aiguillages, aiguillages triples et traversées-jonctions doubles (TJD) ont une
**direction** (directe / déviée…). La direction active est dessinée avec des rails
clairs, les autres sont estompées, et un petit point orange (manuel) ou jaune
(électrique) repère l'aiguillage.

Pour changer la direction :
* avec l'outil **Manœuvrer les aiguillages**, en cliquant l'aiguillage sur le plan ;
* en cliquant l'aiguillage dans la **vue 3D** ;
* dans le panneau **Propriétés**.

Un train qui aborde un aiguillage en talon alors qu'il est mal orienté le **talonne**
(comme un aiguillage talonnable) et un message s'affiche.

### Rampes et viaducs

Chaque élément a une **hauteur à chaque extrémité** (en mm au-dessus du plateau),
modifiable dans **Propriétés**. La hauteur est partagée avec l'élément raccordé.
Outils utiles :

* **Créer une rampe %** : règle l'autre extrémité pour obtenir la pente demandée
  (2 à 3 % est réaliste, 4 % est un maximum pour la plupart des trains).
* Avec plusieurs éléments sélectionnés, **+5 mm / −5 mm** les montent ou les descendent.
* Un nouvel élément raccordé à une extrémité surélevée en prend la hauteur.

Une voie plus haute que le terrain est automatiquement portée par des **piles** en 3D.
Sur le plan, la hauteur est indiquée à côté de la référence (▲40 = 40 mm).

---

## 3. Relief

Ouvrez l'onglet **Relief** et glissez sur le plan :

| Pinceau | Effet |
|---|---|
| **Monter** / **Creuser** | crée des collines ou des vallées (maintenez le bouton pour continuer) |
| **Adoucir** | adoucit les pentes |
| **Aplanir** | met le terrain à la hauteur du point de départ du geste |
| **Peindre** | peint le revêtement : herbe, prairie, terre, roche, sable, neige |

* **Rayon** et **Intensité** règlent la taille et la vitesse du pinceau.
* **Tunnels** : les voies gardent leur propre hauteur. Là où le terrain dépasse la voie
  de plus de 85 mm, la voie passe en **tunnel** : la vue 3D creuse une tranchée jusqu'à
  la colline, ouvre l'entrée, construit un **portail** en pierre (portail double pour
  deux voies parallèles) et une voûte à l'intérieur. Sur le plan, les sections en
  tunnel sont assombries et en pointillés.
* **Tranchées** : un terrain légèrement plus haut que la voie est creusé
  automatiquement en 3D pour que la voie reste visible.
* **Ponts** : une voie à plus de 20 mm au-dessus du sol repose sur des poutres
  métalliques et des piles en pierre (aucune pile n'est posée sur une voie passant
  dessous).
* **Eau** : un terrain creusé sous −8 mm devient un lac ou une rivière.
* **Créer des remblais sous les voies surélevées** remplit le terrain sous les voies en
  hauteur avec des talus réalistes, au lieu de piles.

---

## 4. Maquettes

L'onglet **Maquettes** propose des modèles HO génériques : bâtiment voyageurs, quai,
remise à locomotives, poste d'aiguillage, château d'eau, signal sémaphore, maisons,
maison à colombages, église, usine, grange, arbres, buissons, rochers, routes, portails
de tunnel et voitures, ainsi que des maisons de ville avec commerces, lampadaires,
clôtures et personnages. Les bâtiments ont des murs texturés (crépi, brique,
colombages), des toits en tuiles, des fenêtres, des portes et des cheminées.

1. Cliquez une maquette puis cliquez sur le plan pour la poser (<kbd>Q</kbd>/<kbd>E</kbd>
   tournent le fantôme).
2. Sélectionnez une maquette posée pour changer sa rotation, son **échelle** ou sa hauteur.
   Les maquettes se posent automatiquement sur le terrain ; indiquez une hauteur pour la
   forcer (par exemple un portail décoratif au niveau de la voie ; les portails sont
   sinon créés automatiquement à chaque entrée de tunnel).

---

## 5. Trains

### Composer et poser un train

1. Ouvrez l'onglet **Trains**.
2. Cliquez locomotives, voitures et wagons pour former la **composition** (cliquez une
   pastille pour la retirer), ou choisissez un **train prêt à rouler**.
3. Cliquez **Poser sur la voie**, puis cliquez une voie sur le plan. La flèche indique le
   sens de marche ; <kbd>F</kbd> l'inverse. Le train est placé derrière le point cliqué
   (il est avancé s'il n'y a pas assez de voie).

### Conduire

Chaque train a sa carte dans la **Cabine de conduite** :

* le **régulateur** règle la vitesse visée (jusqu'à la vitesse maximale de la locomotive) ;
  le train accélère et freine progressivement ;
* la vitesse est affichée en **km/h à l'échelle** ;
* **Inverser** change le sens de marche (le train doit être arrêté — un premier clic l'arrête) ;
* **↔ Navette** : le train repart automatiquement dans l'autre sens au heurtoir ;
* **✕** retire le train ;
* **Pause** fige la simulation, **Arrêt d'urgence** arrête tous les trains.

Cliquez une carte (ou un train sur le plan) pour en faire le **train actif**, suivi par les
caméras *Suivre* et *Cabine*.

Les trains s'arrêtent en fin de voie et avant de heurter un autre train.

---

## 6. Fichiers et nomenclature

* Le réseau est **enregistré automatiquement** dans le navigateur.
* **Enregistrer** télécharge un fichier `.json`, **Ouvrir** en charge un.
* **Nomenclature (CSV)** exporte les références Fleischmann et les quantités nécessaires
  pour construire le réseau en vrai (séparateur point-virgule, s'ouvre dans Excel/LibreOffice).
* Le panneau **Réseau** indique la taille du plateau (modifiable), le nombre d'éléments, la
  longueur totale de voie, le nombre d'extrémités libres et la nomenclature.
* **Réseaux…** ouvre la bibliothèque de réseaux d'exemple (voir §7).

---

## 7. Réseaux d'exemple

| Réseau | Niveau | Contenu |
|---|---|---|
| **Ovale de départ** | ★☆☆ | Ovale R1, une voie de garage avec heurtoir, petite gare — 1,8 × 1,0 m |
| **Gare de village** | ★★☆ | Ovale R2, voie d'évitement, voie de garage avec remise, tunnel sous une colline, lac — 2,4 × 1,2 m |
| **Huit** | ★★☆ | Huit sur le croisement 36° 6160, voie de débord, lac, village — 3,2 × 0,95 m |
| **Grande ligne à double voie** | ★★★ | Double voie R1/R2 (entraxe 63,5 mm), deux communications, gare de passage avec voie à quai, faisceau de trois voies avec remise, ville, tunnel à double voie — 3,6 × 1,6 m |
| **Ligne de montagne** | ★★★ | Huit à deux niveaux : rampe de 3 % sur viaduc au-dessus d'un lac, passage supérieur, gare de montagne avec voie de garage, long tunnel — 3,8 × 1,1 m |

Tous les réseaux d'exemple sont construits avec de vraies pièces Fleischmann : leur
nomenclature est exportable et les boucles se referment exactement.

---

## 8. Vue 3D

* Relief texturé (herbe, roche sur les pentes raides, sable, neige), touffes d'herbe,
  eau animée, ballast en gravier, traverses en bois et rails à surface de roulement
  brillante.
* Matériel roulant détaillé : livrées avec fenêtres et inscriptions, bogies, roues à
  rayons qui tournent, bielles des locomotives à vapeur, fumée, feux (blancs à l'avant
  du train).
* Caméras : **Orbite**, **Suivre** (derrière le train actif) et **Cabine** (vue du
  conducteur, y compris dans les tunnels).

---

## 9. Catalogue Fleischmann Profi-Gleis

| Réf. | Élément | Géométrie |
|---|---|---|
| 6101 | Voie droite | 200 mm |
| 6102 | Voie droite | 105 mm |
| 6103 | Voie droite | 100 mm |
| 6110 | Voie droite réglable | 80–120 mm (longueur dans Propriétés) |
| 6116 | Voie heurtoir | 105 mm |
| 6120 | Courbe R1 | R 356,5 mm, 36° (10 par cercle) |
| 6122 | Courbe R1 | R 356,5 mm, 18° |
| 6125 | Courbe R2 | R 420 mm, 36° |
| 6127 | Courbe R2 | R 420 mm, 18° |
| 6131 | Courbe R3 | R 483,5 mm, 18° |
| 6133 | Courbe R4 | R 547 mm, 18° |
| 6138 | Courbe d'aiguillage | R 647 mm, 18° |
| 6170 / 6171 | Aiguillage gauche / droit, manuel | 200 mm, 18°, déviation R 647 mm |
| 6172 / 6173 | Aiguillage gauche / droit, électrique | 200 mm, 18°, déviation R 647 mm |
| 6174 / 6175 | Aiguillage courbe gauche / droit | R1 36° intérieur / R2 36° extérieur (approximation) |
| 6157 | Aiguillage triple | 200 mm, 18° à gauche et à droite |
| 6160 | Croisement | 36°, 105 mm |
| 6162 / 6163 | Croisement gauche / droit | 18°, 200 / 210 mm |
| 6164 / 6165 | TJD gauche / droite, manuelle | 18°, 200 mm |
| 6166 / 6167 | TJD gauche / droite, électrique | 18°, 200 mm |

Astuces :
* Un aiguillage suivi d'une **6138** sur sa branche déviée donne une voie parallèle à
  **≈ 63,5 mm**, le même entraxe qu'entre R1 et R2.
* Dix courbes de 36° (ou vingt de 18°) forment un cercle complet.

### Matériel roulant

| Réf. | Modèle | Longueur | Vitesse max. |
|---|---|---|---|
| 4170 | Locomotive à vapeur BR 01 220 (DB) | 277 mm | 130 km/h |
| 4175 | Locomotive à vapeur BR 50 à tender à guérite (DB) | 263 mm | 80 km/h |
| 4064 | Locomotive-tender BR 64 (DB) | 143 mm | 90 km/h |
| 4225 | Locotracteur diesel V 60 (DB) | 120 mm | 60 km/h |
| 4234 | Locomotive diesel BR 218 (DB) | 189 mm | 140 km/h |
| 4375 | Locomotive électrique BR 103, livrée TEE (DB) | 224 mm | 200 km/h |
| 5161 | Voiture TEE/IC à couloir central, 1re classe (DB) | 303 mm | – |
| 5160 | Voiture grandes lignes (ÖBB) | 303 mm | – |
| 5125 | Voiture City-Bahn, type Silberling (DB) | 303 mm | – |
| 5205 | Wagon tombereau Omm (DB) | 116 mm | – |
| 5220 | Wagon à traverse pivotante (DB) | 150 mm | – |

Les longueurs sont approximatives (hors tampons) et les modèles 3D sont simplifiés.

---

## 10. Raccourcis clavier

| Touche | Action |
|---|---|
| <kbd>Échap</kbd> | quitter l'outil / arrêter l'enchaînement / vider la sélection |
| <kbd>F</kbd> | retourner le dernier élément enchaîné · changer l'extrémité de raccord · inverser le sens de pose du train |
| <kbd>Q</kbd> / <kbd>E</kbd> | tourner (9°, <kbd>Maj</kbd> = 1°) |
| <kbd>R</kbd> | tourner la sélection de 90° |
| <kbd>Suppr</kbd> | supprimer la sélection |
| <kbd>Retour arrière</kbd> | supprimer le dernier élément enchaîné (ou la sélection) |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> | annuler / rétablir |
| <kbd>Ctrl</kbd>+<kbd>S</kbd> | enregistrer dans un fichier |
| <kbd>Ctrl</kbd>+<kbd>A</kbd> | tout sélectionner |
| <kbd>Espace</kbd> + glisser | déplacer le plan |

---

*Fleischmann et Profi-Gleis sont des marques de leurs propriétaires respectifs. Ce projet
est un simulateur indépendant et non commercial, sans lien avec Fleischmann.*
