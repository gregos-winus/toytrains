# HO Railway Simulator — User guide

*[Version française](../fr/user-guide.md)*

The HO Railway Simulator lets you **design an HO scale (1:87) model railway** with the
**Fleischmann Profi-Gleis** track system, **sculpt the relief** of the baseboard,
**place scenery models** (buildings, trees, roads…) and **run Fleischmann trains**
on the layout, in a 2D plan view and a 3D view.

Everything runs in your browser: nothing is sent to a server. Your layout is saved
automatically in the browser and can be exported to a `.json` file.

---

## 1. Screen overview

| Area | Content |
|---|---|
| **Top bar** | New / Open / Save / Example layout, parts list export (CSV), undo / redo, view mode (Plan, Split, 3D), language, help |
| **Left panel** | Four tabs: **Track** (Fleischmann catalogue), **Relief** (terrain brushes), **Models** (scenery) and **Trains** (rolling stock and consists) |
| **Centre** | The **plan** (2D, top view) and/or the **3D view** |
| **Right panel** | **Driver's cab** (train controls), **Properties** of the selection, **Layout** (baseboard size, statistics, parts list) |

### Navigating

* **Plan**: mouse wheel = zoom, right or middle button drag (or <kbd>Space</kbd> + drag) = pan,
  <kbd>⤢</kbd> = fit the baseboard. On a touch screen, pinch to zoom.
* **3D view** (*Orbit* mode): left drag = rotate, right drag = pan, wheel = zoom.
  *Follow* puts the camera behind the selected train, *Cab* shows the driver's view.

---

## 2. Laying track

All pieces come from the **Fleischmann HO Profi-Gleis** range (see the catalogue in §7).

### Placing a first piece

1. Open the **Track** tab and click a piece (for example **6101**).
2. Move the mouse over the plan: a ghost of the piece follows the cursor.
   <kbd>Q</kbd>/<kbd>E</kbd> rotate it by 9° (hold <kbd>Shift</kbd> for 1°).
3. Click to place it. Near an open track end the ghost **snaps** to it automatically.
4. <kbd>Esc</kbd> leaves the placement mode.

### Chaining pieces (the fast way)

1. With the **Select** tool, click a **red dot**: this is an *open end*. It becomes the
   **chaining anchor** (blue circle).
2. Click pieces in the catalogue: each one is attached to the anchor, and the anchor
   moves to the far end of the new piece. A full oval takes a few seconds!
3. <kbd>F</kbd> **flips** the last piece: a curve turning left will turn right, a turnout
   is connected by another end, etc.
4. <kbd>Backspace</kbd> removes the last piece and goes back one step.
5. <kbd>Esc</kbd> stops chaining.

Pieces whose ends meet (within 2.5 mm and 2.5°) are connected automatically, even when
you close a loop. Open ends remain shown as red dots and are counted in the statistics.

### Selecting, moving, deleting

* Click a piece or model to select it, <kbd>Shift</kbd>/<kbd>Ctrl</kbd>+click to add to the selection,
  drag on an empty area to draw a selection box, **double-click** a piece to select all
  the track connected to it, <kbd>Ctrl</kbd>+<kbd>A</kbd> selects everything.
* Drag the selection to move it. When you release it close to an open end, it **snaps**
  and rotates to connect.
* <kbd>Q</kbd>/<kbd>E</kbd> rotate the selection by 9°, <kbd>R</kbd> by 90°.
* <kbd>Delete</kbd> removes the selection.
* <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> undo / redo.

### Turnouts

Turnouts, three-way turnouts and double slips have a **route** (straight / diverging…).
The active route is drawn with bright rails, the other ones are dimmed, and a small
orange (manual) or yellow (electric) dot marks the turnout.

Change the route:
* with the **Operate turnouts** tool, by clicking the turnout on the plan;
* by clicking the turnout in the **3D view**;
* in the **Properties** panel.

A train that runs through a turnout from the frog side while it is set against it
**forces** it (like a trailable turnout) and a message is displayed.

### Gradients and viaducts

Each piece has a **height at each end** (in mm above the baseboard), editable in
**Properties**. The height is shared with the connected piece. Useful tools:

* **Make ramp %**: sets the far end so that the piece has the requested gradient
  (2–3 % is realistic, 4 % is a maximum for most trains).
* With several pieces selected, **+5 mm / −5 mm** raises or lowers them.
* New pieces attached to a raised end take its height.

Track higher than the terrain is automatically carried by **piers** in 3D. In the
plan, the height is shown next to the reference (▲40 = 40 mm).

---

## 3. Relief

Open the **Relief** tab and drag on the plan:

| Brush | Effect |
|---|---|
| **Raise** / **Lower** | builds hills or digs valleys (keep the button pressed to go on) |
| **Smooth** | softens slopes |
| **Flatten** | levels the terrain to the height where you started dragging |
| **Paint** | paints the ground cover: grass, meadow, soil, rock, sand, snow |

* **Radius** and **Strength** set the brush size and speed.
* **Tunnels**: tracks keep their own height. If the terrain is higher than the track,
  the train disappears into the hill: add **tunnel portals** (Models tab) at the ends.
* **Water**: terrain lowered below −8 mm becomes a lake or a river.
* **Build embankments under raised tracks** fills the terrain under elevated track with
  realistic slopes, instead of piers.

---

## 4. Scenery models

The **Models** tab offers generic HO models: station building, platform, engine shed,
signal box, water tower, semaphore signal, houses, half-timbered house, church, factory,
barn, trees, bushes, rocks, roads, tunnel portals and cars.

1. Click a model, then click on the plan to place it (<kbd>Q</kbd>/<kbd>E</kbd> rotate the ghost).
2. Select a placed model to change its rotation, **scale** or height.
   Models sit automatically on the terrain; set a height to force it
   (e.g. for a tunnel portal at track level).

---

## 5. Trains

### Composing and placing a train

1. Open the **Trains** tab.
2. Click locomotives, coaches and wagons to build the **consist** (click a chip to remove
   it), or choose a **ready-made train**.
3. Click **Place on track**, then click on a track in the plan. The arrow shows the
   running direction; <kbd>F</kbd> reverses it. The train is laid out behind the clicked
   point (it is pushed forward if there is not enough track).

### Driving

Each train has a card in the **Driver's cab** panel:

* the **throttle** slider sets the target speed (up to the locomotive's top speed);
  the train accelerates and brakes progressively;
* the speed is shown in **scale km/h**;
* **Reverse** changes direction (the train must be stopped — a first click stops it);
* **↔ Shuttle**: the train automatically reverses when it reaches a buffer stop;
* **✕** removes the train;
* **Pause** freezes the simulation, **Emergency stop** stops all trains.

Click a card (or a train on the plan) to make it the **active train**, used by the
*Follow* and *Cab* cameras.

Trains stop at the end of the track and when they would hit another train.

---

## 6. Files and parts list

* The layout is **saved automatically** in your browser.
* **Save** downloads a `.json` file, **Open** loads one.
* **Parts list (CSV)** exports the Fleischmann references and quantities needed to build
  the layout for real (semicolon separated, opens in Excel/LibreOffice).
* The **Layout** panel shows the baseboard size (editable), the number of pieces, the
  total track length, the number of open ends and the parts list.
* **Example** loads a demonstration layout (oval with station loop, siding, tunnel, lake).

---

## 7. Fleischmann Profi-Gleis catalogue

| Ref. | Piece | Geometry |
|---|---|---|
| 6101 | Straight | 200 mm |
| 6102 | Straight | 105 mm |
| 6103 | Straight | 100 mm |
| 6110 | Adjustable straight | 80–120 mm (length in Properties) |
| 6116 | Buffer stop track | 105 mm |
| 6120 | Curve R1 | R 356.5 mm, 36° (10 per circle) |
| 6122 | Curve R1 | R 356.5 mm, 18° |
| 6125 | Curve R2 | R 420 mm, 36° |
| 6127 | Curve R2 | R 420 mm, 18° |
| 6131 | Curve R3 | R 483.5 mm, 18° |
| 6133 | Curve R4 | R 547 mm, 18° |
| 6138 | Turnout counter-curve | R 647 mm, 18° |
| 6170 / 6171 | Turnout left / right, manual | 200 mm, 18°, branch R 647 mm |
| 6172 / 6173 | Turnout left / right, electric | 200 mm, 18°, branch R 647 mm |
| 6174 / 6175 | Curved turnout left / right | R1 36° inner / R2 36° outer (approximation) |
| 6157 | Three-way turnout | 200 mm, 18° left and right |
| 6160 | Crossing | 36°, 105 mm |
| 6162 / 6163 | Crossing left / right | 18°, 200 / 210 mm |
| 6164 / 6165 | Double slip left / right, manual | 18°, 200 mm |
| 6166 / 6167 | Double slip left / right, electric | 18°, 200 mm |

Tips:
* A turnout followed by a **6138** on its branch gives a parallel track at **≈ 63.5 mm**,
  the same spacing as between R1 and R2.
* Ten 36° curves (or twenty 18°) make a full circle.

### Rolling stock

| Ref. | Model | Length | Top speed |
|---|---|---|---|
| 4170 | Steam locomotive BR 01 220 (DB) | 277 mm | 130 km/h |
| 4175 | Steam locomotive BR 50 with cabin tender (DB) | 263 mm | 80 km/h |
| 4064 | Tank locomotive BR 64 (DB) | 143 mm | 90 km/h |
| 4225 | Diesel shunter V 60 (DB) | 120 mm | 60 km/h |
| 4234 | Diesel locomotive BR 218 (DB) | 189 mm | 140 km/h |
| 4375 | Electric locomotive BR 103, TEE livery (DB) | 224 mm | 200 km/h |
| 5161 | TEE/IC open coach, 1st class (DB) | 303 mm | – |
| 5160 | Express coach (ÖBB) | 303 mm | – |
| 5125 | City-Bahn coach, Silberling type (DB) | 303 mm | – |
| 5205 | Open wagon Omm (DB) | 116 mm | – |
| 5220 | Bolster wagon (DB) | 150 mm | – |

Lengths are approximate (over buffers) and the 3D models are simplified.

---

## 8. Keyboard shortcuts

| Key | Action |
|---|---|
| <kbd>Esc</kbd> | leave the current tool / stop chaining / clear the selection |
| <kbd>F</kbd> | flip the last chained piece · cycle the connecting end · reverse the train placement direction |
| <kbd>Q</kbd> / <kbd>E</kbd> | rotate (9°, <kbd>Shift</kbd> = 1°) |
| <kbd>R</kbd> | rotate the selection by 90° |
| <kbd>Delete</kbd> | delete the selection |
| <kbd>Backspace</kbd> | remove the last chained piece (or delete the selection) |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> | undo / redo |
| <kbd>Ctrl</kbd>+<kbd>S</kbd> | save to a file |
| <kbd>Ctrl</kbd>+<kbd>A</kbd> | select everything |
| <kbd>Space</kbd> + drag | pan the plan |

---

*Fleischmann and Profi-Gleis are trademarks of their respective owners. This project is
an independent, non-commercial simulator and is not affiliated with Fleischmann.*
