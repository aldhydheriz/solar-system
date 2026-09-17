// Backward-compat barrel (Fase 0.1).
// Import baru yang disarankan:
//   types  -> './planetTypes'
//   data   -> './planetData' (sumber: './data/planets.json')
//   logic  -> './factory'
// File ini tetap ada supaya import lama ('./planets') tidak pecah.
export * from './planetTypes';
export * from './planetData';
export * from './factory';
