// Station layout and interaction rules. The kitchen is one room: the chef
// walks between stations and presses E (or clicks) to work them. This file
// holds positions, hit boxes and what each interaction does; render.js draws
// them, main.js calls interact() when the player acts.
//
// Upgrades change the stations for real: a faster knife chops quicker, a
// tier-3 stove adds a third burner, a better plating counter adds plate
// slots, and a warming rack holds cooked food without burning.

import { INGREDIENTS, PREP_BURNT, PREP_CHOPPED, PREP_COOKED, PREP_RAW, matchRecipe } from './recipes.js';
import { takeItem, dropActive, activeHand } from './chef.js';
import { burnerCount, plateSlots, chopSeconds, cookSeconds, arrangeSeconds, grabSeconds, warmingSlots } from './upgrades.js';

export const BURN_AFTER_SECONDS = 8.0;
/** A pot picked up while its progress is in this zone is a PERFECT cook. */
export const PERFECT_ZONE_START = 0.7;
/** ...but only while it is still fresh (overTime <= 2s after finishing). */
export const PERFECT_FRESH_SECONDS = 2.0;

// Station rectangles (canvas 1280x720). The chef walks in front of them.
export const STATIONS = {
  pantry: { id: 'pantry', name: 'Pantry', x: 16, y: 182, w: 224, h: 384 },
  board: { id: 'board', name: 'Chopping Board', x: 272, y: 190, w: 180, h: 140 },
  stove: { id: 'stove', name: 'Stove', x: 484, y: 190, w: 216, h: 170 },
  plating: { id: 'plating', name: 'Plating Counter', x: 732, y: 190, w: 236, h: 200 },
  window: { id: 'window', name: 'Serving Window', x: 1000, y: 190, w: 264, h: 360 },
  warming: { id: 'warming', name: 'Warming Station', x: 1000, y: 580, w: 264, h: 68 },
  trash: { id: 'trash', name: 'Trash', x: 16, y: 580, w: 110, h: 68 },
};

// Pantry crates: 2 columns x 4 rows inside the pantry rectangle.
export const CRATES = Object.keys(INGREDIENTS).map((id, i) => ({
  id,
  x: 28 + (i % 2) * 106,
  y: 196 + Math.floor(i / 2) * 92,
  w: 96,
  h: 86,
}));

// Stove burners (pot centres). The third unlocks at stove tier 3.
export const BURNERS = [
  { x: 538, y: 262 },
  { x: 646, y: 262 },
  { x: 592, y: 300 },
];

// Plate slots on the plating counter. Slots 3-4 unlock with plating tiers.
export const PLATE_SLOTS = [
  { x: 792, y: 262 },
  { x: 892, y: 262 },
  { x: 792, y: 336 },
  { x: 892, y: 336 },
];

// Warming rack slots (on the rack's shelf).
export const WARMING_SLOTS = [
  { x: 1052, y: 614 },
  { x: 1132, y: 614 },
  { x: 1212, y: 614 },
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

function upgradesOf(state) {
  return state.upgrades || {};
}

/**
 * What E does at each station. Returns a short message for the HUD (or null).
 * `serve` is a callback(items, recipe, perfect) used by the serving window.
 */
export function interact(state, stationId, serve) {
  const chef = state.chef;
  const ups = upgradesOf(state);
  if (stationId === 'pantry') {
    if (!chef.hands[0] && !chef.hands[1]) {
      // both hands empty — fall through to take
    } else if (chef.hands[0] && chef.hands[1]) {
      return 'Both hands full — serve or bin it first.';
    }
    // The player picks a crate with keys 1–7 or by clicking it; E takes
    // the selected one. (Nearest-crate would hide the left column.)
    const crate = CRATES[state.pantrySelected ?? 0] ?? CRATES[0];
    const ing = INGREDIENTS[crate.id];
    if (ing.unlockLevel > state.level) return `${ing.name} unlocks at LV${ing.unlockLevel}.`;
    if (state.grab) return 'Still grabbing…';
    const dur = grabSeconds(ups);
    if (dur <= 0) {
      takeItem(chef, { kind: 'ingredient', id: crate.id, prep: PREP_RAW });
      return null;
    }
    state.grab = { t: 0, dur, crateId: crate.id };
    return null;
  }
  if (stationId === 'board') {
    const hand = activeHand(chef);
    if (!hand && state.board.item) {
      if (state.board.progress >= 1) {
        takeItem(chef, { kind: 'ingredient', id: state.board.item.id, prep: PREP_CHOPPED });
        state.board.item = null;
        state.board.progress = 0;
        return null;
      }
      return 'Still chopping…';
    }
    if (hand && hand.kind === 'ingredient' && !state.board.item) {
      if (hand.prep !== PREP_RAW) return 'Only raw ingredients go on the board.';
      state.board.item = dropActive(chef);
      state.board.progress = 0;
      return null;
    }
    return 'The board is busy.';
  }
  if (stationId === 'stove') {
    const hand = activeHand(chef);
    const pots = state.pots.slice(0, burnerCount(ups));
    // Pick up a finished pot first, else drop the carried ingredient in a free pot.
    for (const pot of pots) {
      if (pot.item && pot.progress >= 1 && !hand) {
        const perfect = !pot.burnt && pot.progress >= PERFECT_ZONE_START && (pot.overTime || 0) <= PERFECT_FRESH_SECONDS;
        takeItem(chef, { kind: 'ingredient', id: pot.item.id, prep: pot.burnt ? PREP_BURNT : PREP_COOKED, perfect });
        pot.item = null;
        pot.progress = 0;
        pot.burnt = false;
        pot.overTime = 0;
        return perfect ? 'PERFECT cook! Serve it for a bonus.' : null;
      }
    }
    if (hand && hand.kind === 'ingredient') {
      if (hand.prep === PREP_COOKED || hand.prep === PREP_BURNT) return 'Already cooked — it goes on a plate.';
      const free = pots.find((p) => !p.item);
      if (!free) return 'All burners are full.';
      free.item = dropActive(chef);
      free.progress = 0;
      free.burnt = false;
      free.overTime = 0;
      return null;
    }
    return 'A pot is still cooking.';
  }
  if (stationId === 'plating') {
    const hand = activeHand(chef);
    if (hand && hand.kind === 'ingredient') {
      if (hand.prep === PREP_BURNT) return 'Burnt! Bin it, don\u2019t plate it.';
      const plate = nearestPlate(state, chef);
      if (!plate) return 'No plate on the counter.';
      if (state.arrange) return 'Still plating…';
      const dur = arrangeSeconds(ups);
      if (dur <= 0) {
        plate.items.push({ id: hand.id, prep: hand.prep, perfect: !!hand.perfect });
        if (hand.perfect) plate.perfect = true;
        dropActive(chef);
        const recipe = matchRecipe(plate.items);
        return recipe ? `${recipe.name} is READY — serve it!` : null;
      }
      state.arrange = { t: 0, dur, plate, item: { id: hand.id, prep: hand.prep, perfect: !!hand.perfect } };
      dropActive(chef);
      return null;
    }
    if (hand && hand.kind === 'plate') {
      const at = state.plates.findIndex((p, i) => p === null && i < plateSlots(ups));
      if (at < 0) return 'All plate slots are full.';
      state.plates[at] = hand.plate;
      dropActive(chef);
      return null;
    }
    // Empty hands: pick up the nearest plate.
    const plate = nearestPlate(state, chef);
    if (!plate) return 'No plate here. Take one from the stack.';
    const at = state.plates.indexOf(plate);
    state.plates[at] = null;
    takeItem(chef, { kind: 'plate', plate });
    return null;
  }
  if (stationId === 'window') {
    const hand = activeHand(chef);
    if (hand && hand.kind === 'plate') {
      const recipe = matchRecipe(hand.plate.items);
      if (!recipe) return 'That plate isn\u2019t a finished dish yet.';
      const result = serve(hand.plate.items, recipe, !!hand.plate.perfect);
      if (!result) return `No train ordered ${recipe.name} right now.`;
      dropActive(chef);
      return result;
    }
    return 'Bring a finished plate to the window.';
  }
  if (stationId === 'warming') {
    const slots = warmingSlots(ups);
    if (slots <= 0) return 'Warming Station is locked — buy it in the shop (U).';
    const hand = activeHand(chef);
    if (hand && hand.kind === 'ingredient' && hand.prep === PREP_COOKED) {
      if (state.warming.length >= slots) return 'The warming rack is full.';
      state.warming.push(dropActive(chef));
      return 'Kept warm — it will not burn here.';
    }
    if (!hand && state.warming.length > 0) {
      takeItem(chef, state.warming.shift());
      return null;
    }
    return 'The rack only holds cooked food.';
  }
  if (stationId === 'trash') {
    const hand = activeHand(chef);
    if (hand) {
      dropActive(chef);
      return 'Binned.';
    }
    const plate = nearestPlate(state, chef);
    if (plate && plate.items.length > 0) {
      plate.items = [];
      plate.perfect = false;
      return 'Plate cleared.';
    }
    return 'Nothing to bin.';
  }
  return null;
}

/** The plate nearest the chef on the plating counter, or null. */
export function nearestPlate(state, chef) {
  const slots = plateSlots(upgradesOf(state));
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < slots; i++) {
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
  return { items: [], perfect: false };
}

/** Tick chopping, cooking, pantry grabs and plating. */
export function tickStations(state, dt) {
  const ups = upgradesOf(state);
  // Pantry grab.
  if (state.grab) {
    state.grab.t += dt;
    if (state.grab.t >= state.grab.dur) {
      takeItem(state.chef, { kind: 'ingredient', id: state.grab.crateId, prep: PREP_RAW });
      state.grab = null;
    }
  }
  // Plating arrange.
  if (state.arrange) {
    state.arrange.t += dt;
    if (state.arrange.t >= state.arrange.dur) {
      state.arrange.plate.items.push(state.arrange.item);
      if (state.arrange.item.perfect) state.arrange.plate.perfect = true;
      state.arrange = null;
    }
  }
  // Chopping only moves while the chef stands at the board.
  if (state.board.item && state.board.progress < 1) {
    const c = stationCentre(STATIONS.board);
    if (dist(state.chef.x, state.chef.y, c.x, c.y + 60) < 150) {
      state.board.progress = Math.min(1, state.board.progress + dt / chopSeconds(ups));
    }
  }
  for (const pot of state.pots) {
    if (!pot.item) continue;
    if (pot.progress < 1) {
      pot.progress = Math.min(1, pot.progress + dt / cookSeconds(ups));
      pot.overTime = 0;
    } else if (!pot.burnt) {
      pot.overTime = (pot.overTime || 0) + dt;
      if (pot.overTime > BURN_AFTER_SECONDS) pot.burnt = true;
    }
  }
}
