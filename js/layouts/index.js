// Example layouts. Each one is built from real Fleischmann Profi-Gleis
// pieces with the Builder DSL, so every loop closes and the parts list is
// exact.

import { createLayout, touch, buildEmbankments } from '../model.js';
import { Builder } from './builder.js';
import { buildExampleLayout } from '../examples.js';

const N = (en, fr) => ({ en, fr });
const COS18 = Math.cos(Math.PI / 10), SIN18 = Math.sin(Math.PI / 10);

// --------------------------------------------------------------- starter
function starter() {
  const L = createLayout({ width: 1800, depth: 1000, name: 'Starter oval' });
  const b = new Builder(L);
  b.hill(1500, 950, 300, 70);
  b.hill(180, 80, 220, 40);
  b.naturalPaint();
  const c = b.at(500, 143, 0);
  const bottom = c.straight(4).pieces.slice();
  c.left('6120', 5);
  const siding = c.turnout('6170');
  c.straight(3).left('6120', 5);
  siding.right('6138').straight(1).buffer();
  b.flattenUnder(b.all, 60);
  b.naturalPaint();
  b.scenery('platform', 900, 212);
  b.scenery('station', 900, 300, 0, { scale: 0.8 });
  b.scenery('house', 620, 460, 10);
  b.scenery('timbered', 780, 470, -8);
  b.scenery('farm', 1150, 500, 0);
  b.scenery('fence', 1150, 420, 0);
  b.scenery('engineshed', 900, 793, 0, { scale: 0.85 });
  b.scenery('signal', 1320, 110, 180);
  b.scenery('people', 880, 212);
  b.trees([[120, 400, 'conifer'], [150, 520, 'conifer'], [1650, 350], [1700, 550], [1600, 700, 'conifer'],
    [300, 900], [420, 930, 'bush'], [1400, 460, 'bush'], [1250, 640], [700, 640, 'bush']]);
  b.train('BR 64 + Omm', ['4064', '5205', '5205'], bottom[1], 150, 1, 0.5);
  b.train('V 60', ['4225', '5220'], siding.pieces[1], 100, 1, 0);
  touch(L);
  return L;
}

// ------------------------------------------------------------- figure 8
// Flat figure of eight on a 36° crossing (6160) with R1 curves. The lobe
// straights (1044.7 mm) put the centre of each lobe on the crossing bisector.
function figure8() {
  const W = 3200, D = 950, cx = 1600, cy = 480;
  const L = createLayout({ width: W, depth: D, name: 'Figure of eight' });
  const b = new Builder(L);
  // relief: lake in the east lobe, hills in the west lobe
  b.valley(cx + 1153, cy, 190, 40);
  b.smooth(cx + 1153, cy, 260, 3);
  b.hill(cx - 1153, cy + 40, 260, 120);
  b.smooth(cx - 1153, cy, 300, 2);
  b.naturalPaint();

  const start = b.at(cx - 52.5 * COS18, cy + 52.5 * SIN18, -18);
  const crossing = start.place('6160', 0, 1);
  const s = (cur) => cur.straight(3).straight(1, '6102').straight(1, '6103').adjust(119.85).adjust(119.85);
  // east lobe
  const east = b.from(crossing, 1);
  s(east);
  east.left('6120', 6);
  s(east);
  // west lobe with a goods siding
  const west = b.from(crossing, 2);
  const goods = west.turnout('6170');
  west.straight(2).straight(1, '6102').straight(1, '6103').adjust(119.85).adjust(119.85);
  west.right('6120', 6);
  s(west);
  goods.right('6138').straight(2).buffer();

  b.flattenUnder(b.all.filter((p) => true), 55);
  b.naturalPaint();
  b.scenery('farm', 1350, 180, -18);
  b.scenery('house', 1780, 170, 10);
  b.scenery('platform', 1250, 330, -18);
  b.scenery('signalbox', 1600, 700, 0);
  b.scenery('church', cx - 1150, cy + 40, 90, { scale: 0.8 });
  b.scenery('house', cx - 1260, cy - 140, 30);
  b.scenery('timbered', cx - 1030, cy - 150, -20);
  b.scenery('rock', cx - 1300, cy + 180, 40);
  b.trees([[cx + 1010, cy + 170], [cx + 1300, cy - 170], [cx + 1330, cy + 150, 'conifer'], [cx + 950, cy - 120, 'bush'],
    [300, 80, 'conifer'], [2900, 870, 'conifer'], [2950, 90], [250, 880], [1600, 90, 'bush'], [1500, 860], [1720, 870, 'bush'],
    [cx - 1400, cy - 40, 'conifer'], [cx - 900, cy + 190, 'conifer']]);
  b.train('Express BR 01', ['4170', '5160', '5160'], east.pieces[3], 50, 1, 0.45);
  b.train('BR 50 goods', ['4175', '5205', '5205'], goods.pieces[2], 190, 1, 0);
  touch(L);
  return L;
}

// ------------------------------------------------------------- main line
// Double-track main line (R1 inside, R2 outside, 63.5 mm apart) with two
// crossovers, a through station with a platform loop and a freight yard
// with three sidings and an engine shed.
function mainline() {
  const W = 3600, D = 1600;
  const L = createLayout({ width: W, depth: D, name: 'Double-track main line' });
  const b = new Builder(L);
  const x0 = 600, x1 = 3000, cy = 800;
  const yO = cy - 420, yI = cy - 356.5;
  // relief: hill with double-track tunnel on the west curve, river valley
  b.hill(260, 800, 420, 250);
  b.smooth(260, 800, 450, 2);
  b.valley(3400, 1500, 200, 60);
  for (let y = 1600; y > 1000; y -= 30) b.valley(3420 - (1600 - y) * 0.1, y, 70, 12, 3);
  b.naturalPaint();

  // --- outer track O (R2), with the station on the south straight
  const o = b.at(x0, yO, 0);
  o.straight(1);
  const p1 = o.turnout('6171');
  o.straight(8);
  o.trail('6170', 'straight');
  o.straight(1);
  o.left('6125', 5);
  // north straight of O: two crossover turnouts are placed by the I track
  const oNorth = o;
  // platform loop P1 (94 mm spacing for the platform)
  p1.straight(1, '6103').left('6138');
  p1.straight(4).straight(2, '6102').left('6138').straight(1, '6103');

  // --- inner track I (R1)
  const i = b.at(x0, yI, 0);
  i.straight(12).left('6120', 5);
  // north side of I, travelling west: crossover X1, yard lead, crossover X2
  const x1o = i.turnout('6171');                  // X1 towards O
  const yard1 = i.turnout('6170');                // yard lead
  i.straight(8);
  const x2o = i.turnout('6171');                  // X2 towards O
  i.straight(1).left('6120', 5);
  // crossover pieces on O
  const x1t = x1o.trail('6171', 'branch');
  const x2t = x2o.trail('6171', 'branch');
  void x1t; void x2t;
  // O north straight: 6101, through X1 turnout, 9 x 6101, through X2, curves
  oNorth.straight(1);
  oNorth.t = x1o.t;                               // continue after X1 (common end)
  oNorth.straight(9);
  oNorth.t = x2o.t;
  oNorth.left('6125', 5);

  // --- yard: ladder of three sidings off the inner track
  yard1.right('6138');
  const y2 = yard1.turnout('6170');
  yard1.straight(4).buffer();
  y2.right('6138');
  const y3 = y2.turnout('6170');
  y2.straight(3).buffer();
  y3.right('6138').straight(2).buffer();

  b.flattenUnder(b.all.filter((p) => p.x > 700 && p.x < 2950), 60);
  b.naturalPaint();

  // --- scenery
  b.scenery('platform', 1800, 333);
  b.scenery('platform', 1500, 333);
  b.scenery('platform', 1800, 241);
  b.scenery('station', 1800, 150);
  b.scenery('people', 1700, 333);
  b.scenery('people', 1850, 241);
  for (let k = 0; k < 5; k++) b.scenery('lamp', 1450 + k * 180, 333);
  b.scenery('signalbox', 2600, 200);
  b.scenery('signalbox', 900, 200);
  b.scenery('engineshed', 1300, 966.6, 0);
  b.scenery('watertower', 1080, 900);
  b.scenery('signal', 760, 330, 0);
  b.scenery('signal', 2840, 430, 180);
  // town in the middle of the loop
  const town = [['townhouse', 1500, 640, 0], ['townhouse2', 1600, 640, 0], ['townhouse', 1700, 640, 0], ['house', 1850, 650, 0],
    ['church', 2150, 700, 0], ['timbered', 2450, 620, 0], ['house', 2600, 700, 90], ['factory', 2350, 900, 0]];
  for (const [k, x, y, r] of town) b.scenery(k, x, y, r);
  for (let x = 1350; x < 2800; x += 200) b.scenery('road', x + 100, 560, 0);
  b.scenery('car', 1600, 560, 0);
  b.scenery('car', 2100, 565, 180, { });
  for (let k = 0; k < 8; k++) b.scenery('lamp', 1400 + k * 180, 595, 0);
  b.trees([[150, 300, 'conifer'], [200, 420, 'conifer'], [120, 1150, 'conifer'], [220, 1300, 'conifer'], [380, 1400, 'conifer'],
    [3300, 300], [3450, 450], [3350, 700, 'conifer'], [3500, 900], [3250, 1350], [3500, 1250, 'bush'],
    [1000, 60], [1300, 70, 'bush'], [2300, 70], [2600, 60, 'bush'], [3100, 80],
    [1000, 1400], [1400, 1450, 'bush'], [1800, 1480], [2200, 1420], [2700, 1500, 'conifer'],
    [900, 560, 'bush'], [1000, 720], [2900, 600, 'bush'], [2950, 800]]);
  b.scenery('farm', 2000, 1430, 0);
  b.scenery('fence', 2000, 1360, 0);

  // --- trains
  b.train('TEE « Rheingold »', ['4375', '5161', '5161', '5161'], o.pieces[3], 100, 1, 0.4);
  b.train('Eilzug BR 218', ['4234', '5125', '5125'], i.pieces[5], 100, -1, 0.35);
  b.train('Güterzug BR 50', ['4175', '5205', '5220', '5205', '5205'], p1.pieces[5], 150, 1, 0);
  b.train('Rangierlok V 60', ['4225', '5205'], y2.pieces[2], 100, 1, 0);
  touch(L);
  return L;
}

// -------------------------------------------------------------- mountain
// Two-level figure of eight: the line climbs at 3 % around the east lobe on
// a viaduct, crosses over itself in the middle and comes down through a
// tunnel in the west mountain. Station loop at the bottom, mountain station
// with a siding at the top.
function mountain() {
  const W = 3800, D = 1100, cx = 1900, cy = 560;
  const H = 85;
  const L = createLayout({ width: W, depth: D, name: 'Mountain line' });
  const b = new Builder(L);
  const lobe = 1292.6 / COS18; // lobe centre distance from the middle
  // relief: mountain over the west lobe, lake under the viaduct
  b.hill(cx - lobe, cy, 800, 380, 60);
  b.hill(cx - lobe - 150, cy + 250, 300, 120);
  b.smooth(cx - lobe, cy, 600, 3);
  b.valley(cx + lobe, cy, 230, 45);
  b.smooth(cx + lobe, cy, 300, 3);

  const grade = H / (6 * 263.894 + 1240);
  const low = b.at(cx - 52.5 * COS18, cy + 52.5 * SIN18, -18);
  const center = low.place('6102', 0, 1);
  // east lobe: station loop (flat), then climb
  const loop = low.turnout('6171');
  low.straight(3);
  low.trail('6170', 'straight');
  low.adjust(120).adjust(120);
  loop.left('6138').straight(1).left('6138');
  low.ramp(grade).left('6125', 6).straight(5).adjust(120).adjust(120);
  low.ramp(0);
  low.place('6102', 0, 1); // upper crossing, over the lower line
  // west lobe: mountain station with siding, then descend
  const upperStart = b.all.length - 1;
  const siding = low.turnout('6170');
  low.straight(4).adjust(120).adjust(120);
  siding.right('6138').straight(2).buffer();
  const upper = b.all.slice(upperStart + 1);
  low.ramp(-grade).right('6125', 6).straight(5).adjust(120).adjust(120);

  b.flattenUnder([center, ...loop.pieces, ...b.all.slice(1, 8)], 60);
  buildEmbankments(L, upper);
  b.naturalPaint();
  b.paintAll((x, y, h) => (h > 330 ? 5 : null)); // snow cap

  b.scenery('platform', cx + 700, cy - 260, -18);
  b.scenery('station', cx + 760, cy - 400, -18, { scale: 0.85 });
  b.scenery('people', cx + 700, cy - 260, -18);
  b.scenery('platform', cx - 655, cy - 165, 18);
  b.scenery('signalbox', cx - 480, cy - 70, 18);
  b.scenery('church', cx + 150, cy + 330, 0, { scale: 0.8 });
  b.scenery('house', cx + 350, cy - 380, -10);
  b.scenery('timbered', cx - 150, cy - 400, 15);
  b.scenery('house', cx - 50, cy + 420, 0);
  b.scenery('farm', 400, 120, 0);
  b.trees([[cx - lobe, cy + 60, 'conifer'], [cx - lobe - 120, cy - 60, 'conifer'], [cx - lobe + 100, cy - 150, 'conifer'],
    [cx - lobe - 250, cy + 180, 'conifer'], [cx - lobe + 220, cy + 200, 'conifer'], [cx - lobe - 350, cy - 250, 'conifer'],
    [cx - lobe + 300, cy - 330, 'conifer'], [cx - lobe - 420, cy + 50, 'conifer'],
    [cx + lobe - 200, cy + 150], [cx + lobe + 200, cy - 180], [cx + lobe + 20, cy + 250, 'bush'], [cx + lobe - 60, cy - 250],
    [cx + 300, cy + 200], [cx - 300, cy + 250, 'bush'], [cx, cy - 250], [3650, 100], [3700, 1000], [150, 1000, 'conifer']]);
  b.train('TEE « Rheingold »', ['4375', '5161', '5161'], b.all[12], 50, 1, 0.4);
  b.train('BR 50 + Omm', ['4175', '5205', '5205'], loop.pieces[2], 190, 1, 0);
  b.train('BR 64', ['4064', '5125'], siding.pieces[2], 190, 1, 0);
  touch(L);
  return L;
}


// -------------------------------------------------------------- industry
// Small shelf layout (1.3 m): an industrial spur with three sidings, worked
// by a shunter in shuttle mode.
function industry() {
  const L = createLayout({ width: 1300, depth: 360, name: 'Industrial spur' });
  const b = new Builder(L);
  b.naturalPaint();
  const c = b.at(40, 85, 0).startBuffer().straight(1);
  const s2 = c.turnout('6170');
  c.straight(3).buffer();
  s2.right('6138');
  const s3 = s2.turnout('6170');
  s2.straight(1).buffer();
  s3.right('6138').buffer();
  b.paintAll((x, y) => (y < 250 ? 2 : null));
  b.scenery('factory', 450, 300, 0, { scale: 0.5 });
  b.scenery('farm', 860, 305, 0, { scale: 0.55 });
  b.scenery('watertower', 1180, 300, 0, { scale: 0.7 });
  b.scenery('road', 150, 22, 0);
  b.scenery('road', 350, 22, 0);
  b.scenery('car', 300, 22, 0);
  b.scenery('fence', 700, 30, 0);
  b.scenery('fence', 820, 30, 0);
  for (const x of [240, 640, 1040]) b.scenery('lamp', x, 250, 0);
  b.scenery('people', 620, 270, 0);
  b.trees([[40, 300, 'conifer'], [1260, 30, 'bush'], [1000, 30, 'bush']]);
  b.train('V 60 (shuttle)', ['4225', '5205', '5220'], c.pieces[4], 100, 1, 0.35, { shuttle: true });
  b.train('BR 64', ['4064'], s2.pieces[2], 150, 1, 0);
  touch(L);
  return L;
}

// ---------------------------------------------------------------- branch
// Point-to-point branch line (3 m): terminus with run-round loop and goods
// siding, an S-curve through a tunnel and a halt at the far end. The train
// runs in shuttle mode.
function branch() {
  const L = createLayout({ width: 3050, depth: 650, name: 'Branch line' });
  const b = new Builder(L);
  b.hill(2215, 320, 270, 240, 40);
  b.hill(2450, 560, 200, 90);
  b.smooth(2215, 330, 300, 2);
  b.hill(700, 600, 250, 60);
  const c = b.at(60, 230, 0).startBuffer().straight(2);
  const goods = c.turnout('6171');
  const loop = c.turnout('6170');
  c.straight(3).trail('6171', 'straight');
  loop.right('6138').straight(1).right('6138');
  c.straight(1).left('6127', 2).right('6127', 2).straight(2).buffer();
  goods.left('6138').straight(2).buffer();
  b.flattenUnder([...b.all.slice(0, 12), ...goods.pieces, ...loop.pieces], 60);
  b.naturalPaint();
  b.scenery('platform', 365, 277);
  b.scenery('station', 365, 380, 0, { scale: 0.8 });
  b.scenery('people', 340, 277);
  b.scenery('lamp', 250, 277);
  b.scenery('lamp', 480, 277);
  b.scenery('farm', 1200, 110, 0, { scale: 0.8 });
  b.scenery('signal', 720, 270, 0);
  b.scenery('platform', 2700, 343);
  b.scenery('house', 2700, 250, 0, { scale: 0.6 });
  b.scenery('people', 2720, 343);
  b.scenery('timbered', 950, 450, 5);
  b.scenery('house', 1150, 470, -8);
  b.scenery('church', 1500, 520, 0, { scale: 0.7 });
  b.trees([[1750, 120], [1850, 560, 'conifer'], [2050, 520, 'conifer'], [2300, 150, 'conifer'], [2150, 120, 'conifer'],
    [2950, 120], [2950, 560, 'bush'], [100, 560, 'conifer'], [600, 80, 'bush'], [1400, 400, 'bush']]);
  b.train('BR 64 (shuttle)', ['4064', '5125'], c.pieces[2], 150, 1, 0.45, { shuttle: true });
  b.train('V 60', ['4225', '5205'], goods.pieces[2], 150, 1, 0);
  touch(L);
  return L;
}

// --------------------------------------------------------------- express
// Double-track express line on large radii (R3 inside, R4 outside, 18°
// curves 6131/6133) with a pair of crossovers.
function express() {
  const L = createLayout({ width: 3200, depth: 1350, name: 'Express line (large radii)' });
  const b = new Builder(L);
  const x0 = 800, cy = 680;
  b.valley(1600, 700, 260, 45);
  b.smooth(1600, 700, 320, 3);
  b.hill(2950, 1250, 300, 80);
  b.hill(250, 120, 250, 60);
  b.naturalPaint();
  const o = b.at(x0, cy - 547, 0);
  o.straight(8).left('6133', 10).straight(1);
  const i = b.at(x0, cy - 483.5, 0);
  i.straight(8).left('6131', 10);
  const x1o = i.turnout('6171');
  i.straight(5);
  const x2o = i.turnout('6171');
  i.straight(1).left('6131', 10);
  x1o.trail('6171', 'branch');
  x2o.trail('6171', 'branch');
  o.jump(x1o).straight(5).jump(x2o).left('6133', 10);
  b.flattenUnder(b.all, 60);
  b.naturalPaint();
  b.scenery('farm', 1200, 950, 0);
  b.scenery('fence', 1200, 880, 0);
  b.scenery('house', 2000, 950, 180);
  b.scenery('timbered', 2150, 900, 170);
  b.scenery('church', 1900, 460, 0, { scale: 0.8 });
  b.scenery('signalbox', 1600, 1270, 180);
  b.scenery('signal', 2300, 1100, 180);
  b.scenery('signal', 900, 70, 0);
  b.trees([[1400, 500], [1450, 880, 'bush'], [1750, 880], [1300, 600, 'bush'], [2250, 600], [2350, 750, 'conifer'],
    [950, 700, 'conifer'], [1000, 850], [3050, 300], [3100, 600, 'conifer'], [120, 800], [150, 1200, 'conifer'],
    [1600, 40, 'bush'], [2400, 40], [600, 1300, 'bush']]);
  b.train('TEE « Rheingold »', ['4375', '5161', '5161', '5161'], o.pieces[4], 100, 1, 0.5);
  b.train('D-Zug BR 01', ['4170', '5160', '5160', '5160'], i.pieces[4], 100, -1, 0.45);
  touch(L);
  return L;
}

// -------------------------------------------------------------------- hbf
// Large layout (4.8 x 1.8 m): double track R3/R4 with two crossovers, a
// four-track through station (two platform loops), a freight yard fanned
// out by a three-way turnout, an engine depot, a town, a double-track
// tunnel and a river crossed on bridges.
function hbf() {
  const L = createLayout({ width: 4800, depth: 1800, name: 'Main station (Hauptbahnhof)' });
  const b = new Builder(L);
  const x0 = 900, cy = 927;
  const yO = cy - 547, yI = cy - 483.5;
  b.hill(420, 930, 480, 260);
  b.smooth(420, 930, 520, 2);
  for (let y = 1800; y >= 0; y -= 25) b.valley(4330 + Math.sin(y / 260) * 60, y, 80, 14, 3);
  b.naturalPaint();

  // outer track with platform loop P1 (south, outside)
  const o = b.at(x0, yO, 0);
  o.straight(2).straight(1, '6103');
  const p1 = o.turnout('6171');
  o.straight(8).trail('6170', 'straight');
  o.straight(2).straight(1, '6103').left('6133', 10).straight(1);
  p1.straight(1, '6103').left('6138').straight(4).straight(2, '6102').left('6138').straight(1, '6103');
  // inner track with platform loop P2 (inside)
  const i = b.at(x0, yI, 0);
  i.straight(2).straight(1, '6103');
  const p2 = i.turnout('6170');
  i.straight(8).trail('6171', 'straight');
  i.straight(2).straight(1, '6103').left('6131', 10);
  p2.straight(1, '6103').right('6138').straight(4).straight(2, '6102').right('6138').straight(1, '6103');
  // north side: crossovers and yard lead
  const x1o = i.turnout('6171');
  const yard = i.turnout('6170');
  i.straight(10);
  const x2o = i.turnout('6171');
  i.straight(2).left('6131', 10);
  x1o.trail('6171', 'branch');
  x2o.trail('6171', 'branch');
  o.jump(x1o).straight(11).jump(x2o).straight(1).left('6133', 10);
  // freight yard: two-step lead, three-way turnout, depot
  yard.right('6138').left('6138').right('6138');
  const [yl, yr] = yard.threeWay('6157');
  yard.straight(4).buffer();
  yl.right('6138');
  const dep = yl.turnout('6170');
  yl.straight(3).buffer();
  dep.right('6138').straight(2).buffer();
  yr.left('6138').straight(3).buffer();

  b.flattenUnder(b.all.filter((p) => p.x > 1000 && p.x < 3800), 60);
  b.naturalPaint();

  // station
  b.scenery('station', 2400, 165, 0, { scale: 1.4 });
  b.scenery('platform', 2200, 333); b.scenery('platform', 2600, 333);
  b.scenery('platform', 2200, 490.6); b.scenery('platform', 2600, 490.6);
  b.scenery('platform', 2400, 241, 0, { scale: 1 });
  for (let k = 0; k < 7; k++) { b.scenery('lamp', 1950 + k * 150, 333); b.scenery('lamp', 1950 + k * 150, 490.6); }
  b.scenery('people', 2300, 333); b.scenery('people', 2550, 490.6); b.scenery('people', 2400, 241);
  b.scenery('signalbox', 1250, 250); b.scenery('signalbox', 3600, 250);
  b.scenery('signal', 1250, 330, 0); b.scenery('signal', 3560, 420, 180);
  // depot and yard
  b.scenery('engineshed', 1450, 1157.3, 0);
  b.scenery('watertower', 1750, 1090);
  b.scenery('signalbox', 3200, 1180, 180);
  // town
  const town = [['townhouse', 1600, 700, 0], ['townhouse2', 1700, 700, 0], ['townhouse', 1800, 700, 0], ['townhouse2', 1900, 700, 0],
    ['church', 2300, 820, 0], ['house', 2650, 700, 0], ['timbered', 2800, 710, 0], ['house', 2950, 700, 0],
    ['factory', 3300, 860, 0], ['townhouse', 1600, 900, 180], ['townhouse2', 1700, 900, 180], ['house', 1900, 900, 180]];
  for (const [k, x, y, r] of town) b.scenery(k, x, y, r);
  for (let x = 1500; x < 3100; x += 200) b.scenery('road', x + 100, 610, 0);
  for (let x = 1500; x < 2100; x += 200) b.scenery('road', x + 100, 800, 0);
  b.scenery('car', 1700, 610, 0); b.scenery('car', 2500, 615, 180); b.scenery('car', 1800, 800, 0);
  for (let k = 0; k < 9; k++) b.scenery('lamp', 1520 + k * 180, 645, 0);
  b.scenery('farm', 3000, 1650, 0); b.scenery('fence', 3000, 1580, 0);
  b.trees([[150, 400, 'conifer'], [200, 600, 'conifer'], [150, 1300, 'conifer'], [260, 1500, 'conifer'], [500, 1650, 'conifer'],
    [4600, 300], [4650, 700, 'conifer'], [4600, 1200], [4650, 1600, 'bush'], [4100, 1700], [4050, 80],
    [1200, 60], [1600, 50, 'bush'], [3200, 60], [3600, 70, 'bush'], [1300, 1700], [2000, 1720, 'bush'], [2500, 1700],
    [1300, 700, 'bush'], [3500, 700], [3550, 1000, 'conifer'], [1350, 1000]]);

  b.train('TEE « Rheingold »', ['4375', '5161', '5161', '5161'], o.pieces[5], 100, 1, 0.45);
  b.train('D-Zug BR 01', ['4170', '5160', '5160', '5160'], i.pieces[6], 100, -1, 0.4);
  b.train('Güterzug BR 50', ['4175', '5205', '5220', '5205', '5205'], p1.pieces[6], 100, 1, 0);
  b.train('Nahverkehr BR 218', ['4234', '5125', '5125'], p2.pieces[6], 100, 1, 0);
  b.train('Rangierlok V 60', ['4225', '5205'], dep.pieces[2], 190, 1, 0);
  b.train('BR 64', ['4064'], yr.pieces[2], 150, 1, 0);
  touch(L);
  return L;
}

export const LAYOUTS = [
  { id: 'industry', level: 1, size: '1.3 × 0.36 m', build: industry,
    name: N('Industrial spur', 'Embranchement industriel'),
    desc: N('Small shelf layout: three factory sidings worked by a V 60 shunter in shuttle mode.', 'Petit réseau sur étagère : trois voies d’usine desservies par un locotracteur V 60 en navette.') },
  { id: 'starter', level: 1, size: '1.8 × 1.0 m', build: starter,
    name: N('Starter oval', 'Ovale de départ'),
    desc: N('R1 oval with a siding and a small station. Ideal to discover the simulator.', 'Ovale R1 avec une voie de garage et une petite gare. Idéal pour découvrir le simulateur.') },
  { id: 'branch', level: 2, size: '3.05 × 0.65 m', build: branch,
    name: N('Branch line', 'Ligne secondaire'),
    desc: N('Point-to-point: terminus with run-round loop and goods siding, S-curve through a tunnel, halt at the far end. BR 64 shuttle.', 'Ligne en antenne : terminus avec voie de contournement et voie de débord, courbe en S sous tunnel, halte au bout. Navette BR 64.') },
  { id: 'village', level: 2, size: '2.4 × 1.2 m', build: () => buildExampleLayout('Village station'),
    name: N('Village station', 'Gare de village'),
    desc: N('R2 oval with a passing loop, a siding with engine shed, a tunnel under the hill and a lake.', 'Ovale R2 avec voie d’évitement, voie de garage et remise, tunnel sous la colline et lac.') },
  { id: 'figure8', level: 2, size: '3.2 × 0.95 m', build: figure8,
    name: N('Figure of eight', 'Huit'),
    desc: N('Figure of eight on a 36° crossing (6160), goods siding, lake and village.', 'Huit sur un croisement 36° (6160), voie de débord, lac et village.') },
  { id: 'express', level: 2, size: '3.2 × 1.35 m', build: express,
    name: N('Express line (large radii)', 'Ligne rapide (grands rayons)'),
    desc: N('Double track on R3/R4 curves (6131/6133) with crossovers: TEE and express trains in both directions.', 'Double voie en courbes R3/R4 (6131/6133) avec communications : TEE et express dans les deux sens.') },
  { id: 'mainline', level: 3, size: '3.6 × 1.6 m', build: mainline,
    name: N('Double-track main line', 'Grande ligne à double voie'),
    desc: N('Double track R1/R2, two crossovers, through station with platform loop, three-track yard, engine shed, town and double-track tunnel.', 'Double voie R1/R2, deux communications, gare de passage avec voie à quai, faisceau de trois voies, remise, ville et tunnel à double voie.') },
  { id: 'mountain', level: 3, size: '3.8 × 1.1 m', build: mountain,
    name: N('Mountain line (two levels)', 'Ligne de montagne (deux niveaux)'),
    desc: N('Two-level figure of eight: 3 % climb on a viaduct over a lake, crossing over itself, mountain station and tunnel.', 'Huit à deux niveaux : rampe de 3 % sur viaduc au-dessus d’un lac, passage supérieur, gare de montagne et tunnel.') },
  { id: 'hbf', level: 3, size: '4.8 × 1.8 m', build: hbf,
    name: N('Main station', 'Grande gare'),
    desc: N('Large layout: double track R3/R4, four-track station with two platform loops, yard with three-way turnout, engine depot, town, double tunnel and river bridges. Six trains.', 'Grand réseau : double voie R3/R4, gare à quatre voies avec deux voies à quai, faisceau avec aiguillage triple, dépôt, ville, tunnel double et ponts sur la rivière. Six trains.') },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id);
}
