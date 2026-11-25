// Station layout and interaction rules. The kitchen is one room: the chef
// walks between stations and presses E (or clicks) to work them. This file
// holds positions, hit boxes and what each interaction does; render.js draws
// them, main.js calls interact() when the player acts.

import { INGREDIENT_IDS, PREP_BURNT, PREP_CHOPPED, PREP_COOKED, PREP_RAW, matchRecipe } from './recipes.js';

export const CHOP_SECONDS = 2.0;
export const COOK_SECONDS = 4.0;
export const BURN_AFTER_SECONDS = 8.0;

// Station rectangles (canvas 1280x720). The chef walks in front of them.
export const STATIONS = {
  pantry: { id: 'pantry', name: 'Pantry', x: 16, y: 182, w: 224, h: 372 },
  board: { id: 'board', name: 'Chopping Board', x: 272, y: 190, w: 180, h: 140 },
  stove: { id: 'stove', name: 'Stove', x: 484, y: 190, w: 216, h: 170 },
  plating: { id: 'plating', name: 'Plating Counter', x: 732, y: 190, w: 236, h: 200 },
  window: { id: 'window', name: 'Serving Window', x: 1000, y: 190, w: 264, h: 360 },
  trash: { id: 'trash', name: 'Trash', x: 16, y: 580, w: 110, h: 68 },
};

// Pantry crates: 2 columns x 3 rows inside the pantry rectangle.
export const CRATES = INGREDIENT_IDS.map((id, i) => ({
  id,
  x: 28 + (i % 2) * 106,
  y: 196 + Math.floor(i / 2) * 118,
  w: 96,
  h: 104,
}));

// The two stove burners (pot centres).
export const BURNERS = [
  { x: 538, y: 262 },
  { x: 646, y: 262 },
];

// The two plate slots on the plating counter.
export const PLATE_SLOTS = [
  { x: 792, y: 262 },
  { x: 892, y: 262 },
];

export const INTERACT_RANGE = 110;

export function stationCentre(station) {
  return { x: station.x + station.w / 2, y: station.y + station.h / 2 };
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** The nearest station within reach of the chef, or null. */
export function nearestStation(chef) {
  let best = null;
  let bestD = Infinity;
  for (const station of Object.values(STATIONS)) {
    // Distance to the closest point of the station's rectangle: the chef
    // works a station from any side, not just its front edge.
    const cx = Math.max(station.x, Math.min(chef.x, station.x + station.w));
    const cy = Math.max(station.y, Math.min(chef.y, station.y + station.h));
    const d = dist(chef.x, chef.y, cx, cy);
    if (d < bestD) {
      bestD = d;
      best = station;
    }
  }
  return bestD <= INTERACT_RANGE ? best : null;
}

/** The pantry crate a click landed on, or null. */
export function crateAt(x, y) {
  for (let i = 0; i < CRATES.length; i++) {
    const crate = CRATES[i];
    if (x >= crate.x && x <= crate.x + crate.w && y >= crate.y && y <= crate.y + crate.h) {
      return { crate, index: i };
    }
  }
  return null;
}

/**
 * What E does at each station. Returns a short message for the HUD (or null).
 * `serve` is a callback(state, recipeId) used by the serving window.
 */
export function interact(state, stationId, serve) {
  const chef = state.chef;
  if (stationId === 'pantry') {
    if (chef.carrying) return 'Hands full — serve or bin it first.';
    // The player picks a crate with keys 1–6 or by clicking it; E takes
    // the selected one. (Nearest-crate would hide the left column.)
    const crate = CRATES[state.pantrySelected ?? 0] ?? CRATES[0];
    chef.carrying = { kind: 'ingredient', id: crate.id, prep: PREP_RAW };
    return null;
  }
  if (stationId === 'board') {
    if (!chef.carrying && state.board.item) {
      if (state.board.progress >= 1) {
        chef.carrying = { kind: 'ingredient', id: state.board.item.id, prep: PREP_CHOPPED };
        state.board.item = null;
        state.board.progress = 0;
        return null;
      }
      return 'Still chopping…';
    }
    if (chef.carrying && chef.carrying.kind === 'ingredient' && !state.board.item) {
      if (chef.carrying.prep !== PREP_RAW) return 'Only raw ingredients go on the board.';
      state.board.item = chef.carrying;
      state.board.progress = 0;
      chef.carrying = null;
      return null;
    }
    return 'The board is busy.';
  }
  if (stationId === 'stove') {
    // Pick up a finished pot first, else drop the carried ingredient in a free pot.
    for (let i = 0; i < state.pots.length; i++) {
      const pot = state.pots[i];
      if (pot.item && pot.progress >= 1 && !chef.carrying) {
        chef.carrying = { kind: 'ingredient', id: pot.item.id, prep: pot.burnt ? PREP_BURNT : PREP_COOKED };
        pot.item = null;
        pot.progress = 0;
        pot.burnt = false;
        return pot.burnt ? null : null;
      }
    }
    if (chef.carrying && chef.carrying.kind === 'ingredient') {
      if (chef.carrying.prep === PREP_COOKED || chef.carrying.prep === PREP_BURNT) return 'Already cooked — it goes on a plate.';
      const free = state.pots.find((p) => !p.item);
      if (!free) return 'Both burners are full.';
      free.item = chef.carrying;
      free.progress = 0;
      free.burnt = false;
      chef.carrying = null;
      return null;
    }
    return 'A pot is still cooking.';
  }
  if (stationId === 'plating') {
    if (chef.carrying && chef.carrying.kind === 'ingredient') {
      if (chef.carrying.prep === PREP_BURNT) return 'Burnt! Bin it, don\u2019t plate it.';
      const plate = nearestPlate(state, chef);
      if (!plate) return 'No plate on the counter.';
      plate.items.push({ id: chef.carrying.id, prep: chef.carrying.prep });
      chef.carrying = null;
      const recipe = matchRecipe(plate.items);
      return recipe ? `${recipe.name} is READY — serve it!` : null;
    }
    if (chef.carrying && chef.carrying.kind === 'plate') {
      const slot = state.plates.find((p) => p === null);
      if (slot === undefined) return 'Both plate slots are full.';
      const at = state.plates.indexOf(null);
      state.plates[at] = chef.carrying.plate;
      chef.carrying = null;
      return null;
    }
    // Empty hands: pick up the nearest plate.
    const plate = nearestPlate(state, chef);
    if (!plate) return 'No plate here. Take one from the stack.';
    const at = state.plates.indexOf(plate);
    state.plates[at] = null;
    chef.carrying = { kind: 'plate', plate };
    return null;
  }
  if (stationId === 'window') {
    if (chef.carrying && chef.carrying.kind === 'plate') {
      const recipe = matchRecipe(chef.carrying.plate.items);
      if (!recipe) return 'That plate isn\u2019t a finished dish yet.';
      const result = serve(chef.carrying.plate.items, recipe);
      if (!result) return `No train ordered ${recipe.name} right now.`;
      chef.carrying = null;
      return result;
    }
    return 'Bring a finished plate to the window.';
  }
  if (stationId === 'trash') {
    if (chef.carrying) {
      chef.carrying = null;
      return 'Binned.';
    }
    const plate = nearestPlate(state, chef);
    if (plate && plate.items.length > 0) {
      plate.items = [];
      return 'Plate cleared.';
    }
    return 'Nothing to bin.';
  }
  return null;
}

/** The plate nearest the chef on the plating counter, or null. */
export function nearestPlate(state, chef) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < state.plates.length; i++) {
    const plate = state.plates[i];
    if (!plate) continue;
    const slot = PLATE_SLOTS[i];
    const d = dist(chef.x, chef.y, slot.x, slot.y);
    if (d < bestD) {
      bestD = d;
      best = plate;
    }
  }
  return best;
}

/** A fresh empty plate. */
export function newPlate() {
  return { items: [] };
}

/** Tick chopping and cooking progress. */
export function tickStations(state, dt) {
  if (state.board.item && state.board.progress < 1) {
    // Chopping only moves while the chef stands at the board.
    const c = stationCentre(STATIONS.board);
    if (dist(state.chef.x, state.chef.y, c.x, c.y + 60) < 150) {
      state.board.progress = Math.min(1, state.board.progress + dt / CHOP_SECONDS);
    }
  }
  for (const pot of state.pots) {
    if (!pot.item) continue;
    if (pot.progress < 1) {
      pot.progress = Math.min(1, pot.progress + dt / COOK_SECONDS);
      pot.overTime = 0;
    } else if (!pot.burnt) {
      pot.overTime = (pot.overTime || 0) + dt;
      if (pot.overTime > BURN_AFTER_SECONDS) pot.burnt = true;
    }
  }
}
