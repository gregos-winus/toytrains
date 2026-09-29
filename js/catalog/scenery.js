// Scenery models (generic HO kits). w = width (x), d = depth (y),
// h = height, in millimetres. `shape` is the 2D footprint.

const N = (en, fr) => ({ en, fr });

export const SCENERY_GROUPS = [
  { id: 'railway', name: N('Railway', 'Ferroviaire') },
  { id: 'buildings', name: N('Buildings', 'Bâtiments') },
  { id: 'nature', name: N('Nature', 'Nature') },
  { id: 'infra', name: N('Roads & structures', 'Routes & ouvrages') },
];

export const SCENERY_TYPES = [
  { id: 'station', group: 'railway', w: 260, d: 110, h: 110, color: '#d8c7a3', roof: '#7a3b2e',
    name: N('Station building', 'Bâtiment voyageurs') },
  { id: 'platform', group: 'railway', w: 400, d: 45, h: 9, color: '#9c9890',
    name: N('Platform 400 mm', 'Quai 400 mm') },
  { id: 'engineshed', group: 'railway', w: 320, d: 90, h: 100, color: '#8b4a35', roof: '#444',
    name: N('Engine shed (1 track)', 'Remise à locomotives (1 voie)') },
  { id: 'signalbox', group: 'railway', w: 70, d: 50, h: 90, color: '#b85b3c', roof: '#3c3c3c',
    name: N('Signal box', 'Poste d’aiguillage') },
  { id: 'watertower', group: 'railway', w: 60, d: 60, h: 150, color: '#9e5a3c', roof: '#555', shape: 'circle',
    name: N('Water tower', 'Château d’eau') },
  { id: 'signal', group: 'railway', w: 10, d: 10, h: 80, color: '#333', shape: 'circle',
    name: N('Semaphore signal', 'Signal sémaphore') },
  { id: 'house', group: 'buildings', w: 110, d: 90, h: 100, color: '#e8dfcf', roof: '#9b3f2f',
    name: N('House', 'Maison') },
  { id: 'timbered', group: 'buildings', w: 90, d: 80, h: 110, color: '#f1e9d8', roof: '#6d3a2a', timber: '#4a2c1c',
    name: N('Half-timbered house', 'Maison à colombages') },
  { id: 'church', group: 'buildings', w: 200, d: 100, h: 110, color: '#d9d2c3', roof: '#4d5563', tower: 260,
    name: N('Village church', 'Église de village') },
  { id: 'factory', group: 'buildings', w: 240, d: 140, h: 120, color: '#a0523d', roof: '#555', chimney: 300,
    name: N('Factory with chimney', 'Usine avec cheminée') },
  { id: 'farm', group: 'buildings', w: 180, d: 110, h: 90, color: '#c9a36b', roof: '#8a3a2a',
    name: N('Barn', 'Grange') },
  { id: 'tree', group: 'nature', w: 45, d: 45, h: 110, color: '#3f7d34', shape: 'circle',
    name: N('Deciduous tree', 'Feuillu') },
  { id: 'conifer', group: 'nature', w: 40, d: 40, h: 140, color: '#2b5e33', shape: 'circle',
    name: N('Conifer', 'Conifère') },
  { id: 'bush', group: 'nature', w: 30, d: 30, h: 25, color: '#4f8a3a', shape: 'circle',
    name: N('Bush', 'Buisson') },
  { id: 'rock', group: 'nature', w: 70, d: 55, h: 40, color: '#8d8a84', shape: 'circle',
    name: N('Rock', 'Rocher') },
  { id: 'road', group: 'infra', w: 200, d: 70, h: 1, color: '#5c5c5c',
    name: N('Road 200 mm', 'Route 200 mm') },
  { id: 'tunnel', group: 'infra', w: 70, d: 30, h: 90, color: '#8d8a84',
    name: N('Tunnel portal (single track)', 'Portail de tunnel (voie unique)') },
  { id: 'car', group: 'infra', w: 50, d: 20, h: 17, color: '#2b6cb0',
    name: N('Car', 'Voiture') },
];

const byId = new Map(SCENERY_TYPES.map((s) => [s.id, s]));

export function sceneryType(id) {
  return byId.get(id);
}
