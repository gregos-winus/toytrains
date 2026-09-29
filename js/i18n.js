// Minimal i18n: English and French.

const STR = {
  en: {
    appTitle: 'HO Railway Simulator',
    appSubtitle: 'Fleischmann Profi-Gleis',
    new: 'New', open: 'Open…', save: 'Save', example: 'Example', exportCsv: 'Parts list (CSV)',
    undo: 'Undo', redo: 'Redo', help: 'Help',
    view2d: 'Plan', view3d: '3D', viewSplit: 'Split',
    tabTracks: 'Track', tabTerrain: 'Relief', tabScenery: 'Models', tabTrains: 'Trains',
    toolSelect: 'Select / move', toolOperate: 'Operate turnouts',
    hintSelect: 'Click to select, drag to move, double-click selects the connected track. Click a red endpoint to start chaining pieces from it.',
    hintTrack: 'Click on the plan to place the piece (it snaps to open ends). F = flip/cycle connecting end, Q/E = rotate, Esc = stop.',
    hintChain: 'Chaining from the highlighted end: click catalogue pieces to add them. F = flip the last piece, Backspace = remove it, Esc = stop.',
    hintTerrain: 'Drag on the plan to sculpt the relief. Tracks keep their own height: terrain above a track makes a tunnel.',
    hintScenery: 'Click to place the model. Q/E = rotate. Esc = stop.',
    hintTrainPlace: 'Click on a track to place the train. F = change direction. Esc = cancel.',
    hintOperate: 'Click a turnout to switch it. Trains are driven from the “Driver’s cab” panel.',
    catalogueTracks: 'Fleischmann HO Profi-Gleis',
    attachEnd: 'Connecting end',
    brush: 'Brush', raise: 'Raise', lower: 'Lower', smooth: 'Smooth', flatten: 'Flatten', paint: 'Paint',
    radius: 'Radius', strength: 'Strength', paintColor: 'Ground cover',
    grass: 'Grass', meadow: 'Meadow', soil: 'Soil', rock: 'Rock', sand: 'Sand', snow: 'Snow',
    embankments: 'Build embankments under raised tracks',
    resetTerrain: 'Flatten all terrain',
    terrainNote: 'Water appears where the terrain is lowered below the baseboard level.',
    consist: 'Consist', locomotives: 'Locomotives', coaches: 'Coaches', wagons: 'Freight wagons',
    presets: 'Ready-made trains', placeTrain: 'Place on track', clearConsist: 'Clear',
    emptyConsist: 'Click locomotives and wagons to compose a train.',
    needLoco: 'A train needs at least one locomotive.',
    properties: 'Properties', nothingSelected: 'Nothing selected.',
    layout: 'Layout', layoutName: 'Name', boardSize: 'Baseboard (mm)', width: 'Width', depth: 'Depth', apply: 'Apply',
    stats: 'Statistics', pieces: 'Track pieces', trackLength: 'Track length', openEnds: 'Open ends',
    bom: 'Parts list', ref: 'Ref.', qty: 'Qty', description: 'Description',
    cab: 'Driver’s cab', noTrains: 'No train on the layout yet. Use the “Trains” tab.',
    speed: 'Speed', throttle: 'Throttle', reverse: 'Reverse', stop: 'Stop', remove: 'Remove',
    shuttle: 'Shuttle (auto-reverse at buffers)', follow: 'Follow', cabView: 'Cab view', allStop: 'Emergency stop',
    pause: 'Pause', play: 'Run',
    position: 'Position', rotation: 'Rotation', height: 'Height', heights: 'Height at ends (mm)', end: 'End',
    gradient: 'Gradient', state: 'Route', length: 'Length', delete: 'Delete', rotateL: 'Rotate ⟲', rotateR: 'Rotate ⟳',
    raiseSel: '+5 mm', lowerSel: '−5 mm', selectionCount: '{n} items selected',
    makeRamp: 'Make ramp', rampHint: 'Gradient % from end 0 to the far end',
    straight: 'straight', diverging: 'diverging', left: 'left', right: 'right', outer: 'outer', inner: 'inner',
    crossing: 'crossing', turning: 'turning',
    model: 'Model', scale: 'Scale',
    confirmNew: 'Start a new empty layout? Unsaved changes will be lost.',
    confirmExample: 'Load the example layout? Unsaved changes will be lost.',
    loadError: 'Could not read this file.',
    evEnd: '{name}: end of track', evCollision: '{name}: collision!', evThrown: 'Turnout {ref} forced by {name}',
    evNoRoom: 'Not enough track to place this train here.',
    camOrbit: 'Orbit', camFollow: 'Follow', camCab: 'Cab',
    showRefs: 'Show references', showGrid: 'Grid',
    kmh: 'km/h', mm: 'mm',
    language: 'Language', close: 'Close',
    selectTrain: 'Select a train',
    heightAuto: 'Height (empty = auto)',
  },
  fr: {
    appTitle: 'Simulateur de train HO',
    appSubtitle: 'Fleischmann Profi-Gleis',
    new: 'Nouveau', open: 'Ouvrir…', save: 'Enregistrer', example: 'Exemple', exportCsv: 'Nomenclature (CSV)',
    undo: 'Annuler', redo: 'Rétablir', help: 'Aide',
    view2d: 'Plan', view3d: '3D', viewSplit: 'Double',
    tabTracks: 'Voie', tabTerrain: 'Relief', tabScenery: 'Maquettes', tabTrains: 'Trains',
    toolSelect: 'Sélection / déplacement', toolOperate: 'Manœuvrer les aiguillages',
    hintSelect: 'Clic pour sélectionner, glisser pour déplacer, double-clic sélectionne la voie connectée. Cliquez une extrémité rouge pour enchaîner des éléments.',
    hintTrack: 'Cliquez sur le plan pour poser l’élément (il s’aimante aux extrémités libres). F = changer l’extrémité de raccord, Q/E = tourner, Échap = arrêter.',
    hintChain: 'Enchaînement depuis l’extrémité mise en évidence : cliquez des éléments du catalogue. F = retourner le dernier, Retour arrière = le supprimer, Échap = arrêter.',
    hintTerrain: 'Glissez sur le plan pour modeler le relief. Les voies gardent leur hauteur : un relief au-dessus d’une voie forme un tunnel.',
    hintScenery: 'Cliquez pour poser la maquette. Q/E = tourner. Échap = arrêter.',
    hintTrainPlace: 'Cliquez sur une voie pour poser le train. F = changer de sens. Échap = annuler.',
    hintOperate: 'Cliquez un aiguillage pour le manœuvrer. Les trains se conduisent depuis le panneau « Cabine de conduite ».',
    catalogueTracks: 'Fleischmann HO Profi-Gleis',
    attachEnd: 'Extrémité de raccord',
    brush: 'Pinceau', raise: 'Monter', lower: 'Creuser', smooth: 'Adoucir', flatten: 'Aplanir', paint: 'Peindre',
    radius: 'Rayon', strength: 'Intensité', paintColor: 'Revêtement',
    grass: 'Herbe', meadow: 'Prairie', soil: 'Terre', rock: 'Roche', sand: 'Sable', snow: 'Neige',
    embankments: 'Créer des remblais sous les voies surélevées',
    resetTerrain: 'Aplanir tout le relief',
    terrainNote: 'L’eau apparaît là où le relief est creusé sous le niveau du plateau.',
    consist: 'Composition', locomotives: 'Locomotives', coaches: 'Voitures', wagons: 'Wagons marchandises',
    presets: 'Trains prêts à rouler', placeTrain: 'Poser sur la voie', clearConsist: 'Vider',
    emptyConsist: 'Cliquez des locomotives et wagons pour composer un train.',
    needLoco: 'Un train doit comporter au moins une locomotive.',
    properties: 'Propriétés', nothingSelected: 'Aucune sélection.',
    layout: 'Réseau', layoutName: 'Nom', boardSize: 'Plateau (mm)', width: 'Largeur', depth: 'Profondeur', apply: 'Appliquer',
    stats: 'Statistiques', pieces: 'Éléments de voie', trackLength: 'Longueur de voie', openEnds: 'Extrémités libres',
    bom: 'Nomenclature', ref: 'Réf.', qty: 'Qté', description: 'Désignation',
    cab: 'Cabine de conduite', noTrains: 'Aucun train sur le réseau. Utilisez l’onglet « Trains ».',
    speed: 'Vitesse', throttle: 'Régulateur', reverse: 'Inverser', stop: 'Arrêt', remove: 'Retirer',
    shuttle: 'Navette (inversion auto aux heurtoirs)', follow: 'Suivre', cabView: 'Vue cabine', allStop: 'Arrêt d’urgence',
    pause: 'Pause', play: 'Marche',
    position: 'Position', rotation: 'Rotation', height: 'Hauteur', heights: 'Hauteur aux extrémités (mm)', end: 'Extrémité',
    gradient: 'Pente', state: 'Direction', length: 'Longueur', delete: 'Supprimer', rotateL: 'Tourner ⟲', rotateR: 'Tourner ⟳',
    raiseSel: '+5 mm', lowerSel: '−5 mm', selectionCount: '{n} éléments sélectionnés',
    makeRamp: 'Créer une rampe', rampHint: 'Pente en % de l’extrémité 0 vers l’autre extrémité',
    straight: 'directe', diverging: 'déviée', left: 'gauche', right: 'droite', outer: 'extérieure', inner: 'intérieure',
    crossing: 'croisement', turning: 'déviation',
    model: 'Maquette', scale: 'Échelle',
    confirmNew: 'Créer un nouveau réseau vide ? Les modifications non enregistrées seront perdues.',
    confirmExample: 'Charger le réseau d’exemple ? Les modifications non enregistrées seront perdues.',
    loadError: 'Impossible de lire ce fichier.',
    evEnd: '{name} : fin de voie', evCollision: '{name} : collision !', evThrown: 'Aiguillage {ref} talonné par {name}',
    evNoRoom: 'Pas assez de voie pour poser ce train ici.',
    camOrbit: 'Orbite', camFollow: 'Suivre', camCab: 'Cabine',
    showRefs: 'Afficher les références', showGrid: 'Grille',
    kmh: 'km/h', mm: 'mm',
    language: 'Langue', close: 'Fermer',
    selectTrain: 'Choisir un train',
    heightAuto: 'Hauteur (vide = auto)',
  },
};

let lang = 'en';
const listeners = new Set();

export function initLang() {
  let saved = null;
  try { saved = localStorage.getItem('ho-lang'); } catch { /* ignore */ }
  const nav = (typeof navigator !== 'undefined' && navigator.language) || 'en';
  lang = saved || (nav.toLowerCase().startsWith('fr') ? 'fr' : 'en');
  document.documentElement.lang = lang;
  return lang;
}

export function getLang() {
  return lang;
}

export function setLang(l) {
  lang = STR[l] ? l : 'en';
  try { localStorage.setItem('ho-lang', lang); } catch { /* ignore */ }
  document.documentElement.lang = lang;
  for (const fn of listeners) fn(lang);
}

export function onLangChange(fn) {
  listeners.add(fn);
}

export function t(key, vars) {
  let s = STR[lang][key] ?? STR.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

// Pick the current language from a {en, fr} object.
export function tr(obj) {
  if (!obj) return '';
  return obj[lang] ?? obj.en ?? '';
}

// Localise [data-i18n] elements.
export function applyI18n(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
}
