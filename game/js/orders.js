// Orders: the departure board. Each order is a dish a train waits for.
// Serve before its timer runs out for coins, a tip for serving early and a
// combo bonus; miss it and the station's reputation takes a hit.

import { RECIPES, recipeById } from './recipes.js';
import { orderLifetime, spawnInterval } from './timer.js';
import { pick } from './rng.js';

export const MAX_ORDERS = 4;
export const MAX_REPUTATION = 5;

const TRAINS = [
  { no: '07', dest: 'ROMA' },
  { no: '12', dest: 'KYOTO' },
  { no: '03', dest: 'PARIS' },
  { no: '21', dest: 'LISBON' },
  { no: '09', dest: 'VIENNA' },
  { no: '15', dest: 'CAIRO' },
];

let nextOrderId = 1;

export function resetOrderIds() {
  nextOrderId = 1;
}

export function makeOrder(rng, rush) {
  const recipe = pick(rng, RECIPES);
  const train = pick(rng, TRAINS);
  const total = orderLifetime(rush);
  return {
    id: nextOrderId++,
    recipeId: recipe.id,
    name: recipe.name,
    price: recipe.price,
    trainNo: train.no,
    dest: train.dest,
    timeLeft: total,
    total,
  };
}

/** Combo multiplier: x1.00 up to x2.00 at a 4-serve streak. */
export function comboMultiplier(combo) {
  return 1 + 0.25 * Math.min(combo, 4);
}

/** Coins for serving `order` with `timeLeft` left, at the given combo. */
export function servePayout(order, timeLeft, combo) {
  const early = Math.max(0, timeLeft / order.total);
  const tip = Math.round(order.price * 0.5 * early);
  return Math.round((order.price + tip) * comboMultiplier(combo));
}

/**
 * Tick the order board: count timers down, expire orders whose train left,
 * and spawn a new order when the spawn timer runs out. Mutates `state` and
 * returns the events that happened ({expired: [...], spawned: order|null}).
 */
export function tickOrders(state, dt, rng) {
  const events = { expired: [], spawned: null };
  for (const order of state.orders) order.timeLeft -= dt;
  const still = [];
  for (const order of state.orders) {
    if (order.timeLeft <= 0) events.expired.push(order);
    else still.push(order);
  }
  state.orders = still;
  for (const order of events.expired) {
    state.reputation = Math.max(0, state.reputation - 1);
    state.combo = 0;
    state.missed++;
  }
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0 && state.orders.length < MAX_ORDERS) {
    const order = makeOrder(rng, state.rush);
    state.orders.push(order);
    events.spawned = order;
    state.spawnTimer = spawnInterval(state.rush);
  }
  return events;
}

/**
 * Serve a finished dish: removes the oldest matching order and pays out.
 * Returns {order, payout} or null when no order wants that dish.
 */
export function serveDish(state, recipeId) {
  const at = state.orders.findIndex((o) => o.recipeId === recipeId);
  if (at < 0) return null;
  const order = state.orders[at];
  const payout = servePayout(order, order.timeLeft, state.combo);
  state.orders.splice(at, 1);
  state.coins += payout;
  state.combo++;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  state.served++;
  return { order, payout };
}

/** The dish the player should cook next: the order closest to departing. */
export function mostUrgentOrder(state) {
  let best = null;
  for (const order of state.orders) {
    if (best === null || order.timeLeft < best.timeLeft) best = order;
  }
  return best;
}

export function orderRecipe(order) {
  return recipeById(order.recipeId);
}
