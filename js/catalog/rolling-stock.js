// Fleischmann HO rolling stock used by the simulator. Lengths are over
// buffers in millimetres (approximate), vmax is the prototype top speed in
// km/h. `style` drives the procedural 3D/2D model.

const N = (en, fr) => ({ en, fr });

export const ROLLING_STOCK = [
  // --- locomotives
  {
    ref: '4170', kind: 'loco', style: 'steam-tender', rw: 'DB', epoch: 'III',
    name: N('Steam locomotive BR 01 220', 'Locomotive à vapeur BR 01 220'),
    length: 277, vmax: 130, color: '#1b1b1b', color2: '#b3202a',
  },
  {
    ref: '4175', kind: 'loco', style: 'steam-tender', rw: 'DB', epoch: 'III',
    name: N('Steam locomotive BR 50 (cabin tender)', 'Locomotive à vapeur BR 50 (tender à guérite)'),
    length: 263, vmax: 80, color: '#1d1d1d', color2: '#b3202a',
  },
  {
    ref: '4064', kind: 'loco', style: 'steam-tank', rw: 'DB', epoch: 'III',
    name: N('Tank locomotive BR 64', 'Locomotive-tender BR 64'),
    length: 143, vmax: 90, color: '#1d1d1d', color2: '#b3202a',
  },
  {
    ref: '4225', kind: 'loco', style: 'diesel-shunter', rw: 'DB', epoch: 'III',
    name: N('Diesel shunter V 60', 'Locotracteur diesel V 60'),
    length: 120, vmax: 60, color: '#8e1b1b', color2: '#2a2a2a',
  },
  {
    ref: '4234', kind: 'loco', style: 'diesel-hood', rw: 'DB', epoch: 'IV',
    name: N('Diesel locomotive BR 218', 'Locomotive diesel BR 218'),
    length: 189, vmax: 140, color: '#a4262c', color2: '#d9d4c7',
  },
  {
    ref: '4375', kind: 'loco', style: 'electric', rw: 'DB', epoch: 'IV',
    name: N('Electric locomotive BR 103 (TEE)', 'Locomotive électrique BR 103 (TEE)'),
    length: 224, vmax: 200, color: '#8c1c2b', color2: '#e8dcb5',
  },
  // --- coaches
  {
    ref: '5161', kind: 'coach', style: 'coach', rw: 'DB', epoch: 'IV',
    name: N('TEE/IC open coach 1st class', 'Voiture TEE/IC à couloir central 1re classe'),
    length: 303, color: '#8c1c2b', color2: '#e8dcb5',
  },
  {
    ref: '5160', kind: 'coach', style: 'coach', rw: 'ÖBB', epoch: 'IV',
    name: N('ÖBB express coach', 'Voiture grandes lignes ÖBB'),
    length: 303, color: '#2f5d3a', color2: '#2f5d3a',
  },
  {
    ref: '5125', kind: 'coach', style: 'coach', rw: 'DB', epoch: 'IV',
    name: N('City-Bahn coach (Silberling)', 'Voiture City-Bahn (Silberling)'),
    length: 303, color: '#e07b22', color2: '#9a9a96',
  },
  // --- freight
  {
    ref: '5205', kind: 'wagon', style: 'open', rw: 'DB', epoch: 'III',
    name: N('Open wagon Omm', 'Wagon tombereau Omm'),
    length: 116, color: '#6b3a24',
  },
  {
    ref: '5220', kind: 'wagon', style: 'flat', rw: 'DB', epoch: 'III',
    name: N('Bolster wagon (Drehschemelwagen)', 'Wagon à traverse pivotante'),
    length: 150, color: '#5a3a28',
  },
];

const byRef = new Map(ROLLING_STOCK.map((s) => [s.ref, s]));

export function stock(ref) {
  return byRef.get(ref);
}

// Ready-made consists offered in the train panel.
export const PRESET_TRAINS = [
  { name: N('TEE Rheingold-style', 'TEE style Rheingold'), consist: ['4375', '5161', '5161', '5161'] },
  { name: N('Express (BR 01)', 'Express (BR 01)'), consist: ['4170', '5160', '5160', '5160'] },
  { name: N('Freight (BR 50)', 'Marchandises (BR 50)'), consist: ['4175', '5205', '5205', '5220', '5205', '5220'] },
  { name: N('Local (BR 218)', 'Omnibus (BR 218)'), consist: ['4234', '5125', '5125'] },
  { name: N('Branch line (BR 64)', 'Ligne secondaire (BR 64)'), consist: ['4064', '5205', '5205'] },
  { name: N('Shunter (V 60)', 'Manœuvre (V 60)'), consist: ['4225', '5220'] },
];
