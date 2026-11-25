// Orders: the departure board. Each order is a ticket for one recipe, with a
// patience timer (green -> orange -> red), a passenger type and, from level 4,
// a chance to be an Express Train order (double coins, half the time).
//
// Serving pays price + early tip, times the combo multiplier, the serving
// window + quality upgrades, the passenger's tip and the perfect-cook bonus.
// A missed order costs a coin fine and one reputation heart.

import { recipeById, unlockedRecipes } from './recipes.js';
import { tipMultiplier, perfectBonus } from './upgrades.js';

export const MAX_REPUTATION = 5;

export const PASSENGER_TYPES = {
  santai: { id: 'santai', label: 'Santai', timeMult: 1.25, tipMult: 1.0 },
  buru: { id: 'buru', label: 'Buru-buru', timeMult: 0.75, tipMult: 1.5 },
  vip: { id: 'vip', label: 'VIP', timeMult: 0.7, tipMult: 2.0 },
};

export function pickPassengerType(rng) {
  const roll = rng();
  if (roll < 0.15) return 'vip';
  if (roll < 0.4) return 'buru';
  return 'santai';
}

const DESTINATIONS = ['Bandung', 'Jakarta', 'Surabaya', 'Yogya', 'Semarang', 'Malang', 'Cirebon', 'Bogor'];
const TRAIN_PREFIX = ['KA', 'ARGO', 'KA', 'KA', 'LOKAL'];

let nextOrderId = 1;

export function resetOrderIds() {
  nextOrderId = 1;
}

export function makeOrder(rng, level, levelCfg) {
  const pool = unlockedRecipes(level);
  const recipe = pool[Math.floor(rng() * pool.length)];
  const passenger = pickPassengerType(rng);
  const pax = PASSENGER_TYPES[passenger];
  const express = levelCfg.expressChance > 0 && rng() < levelCfg.expressChance;
  const dest = DESTINATIONS[Math.floor(rng() * DESTINATIONS.length)];
  const trainNo = `${TRAIN_PREFIX[Math.floor(rng() * TRAIN_PREFIX.length)]} ${100 + Math.floor(rng() * 800)}`;
  let time = levelCfg.orderLifetime * pax.timeMult;
  if (express) time *= 0.5;
  return {
    id: nextOrderId++,
    recipeId: recipe.id,
    name: recipe.name,
    price: recipe.price,
    trainNo,
    dest,
    passenger,
    express,
    timeLeft: time,
    total: time,
  };
}

/** Patience as 0..1, and its colour band: green -> orange -> red. */
export function patienceOf(order) {
  return Math.max(0, order.timeLeft / order.total);
}

export function patienceColor(order) {
  const p = patienceOf(order);
  if (p > 0.55) return '#3fa34d';
  if (p > 0.25) return '#f59e0b';
  return '#e5484d';
}

/** Combo multiplier: x1.00 up to x2.00 at a 4-serve streak. */
export function comboMultiplier(combo) {
  return 1 + 0.25 * Math.min(combo, 4);
}

/**
 * Coins for serving `order` at the current combo. `tipMult` is the
 * serving-window + quality multiplier, `perfect` whether the plate was
 * finished inside the stove's perfect zone.
 */
export function servePayout(order, combo, tipMult, perfect, perfectBonusValue) {
  const base = order.price;
  const pax = PASSENGER_TYPES[order.passenger] || PASSENGER_TYPES.santai;
  const earlyTip = Math.round(base * 0.5 * patienceOf(order));
  let pay = (base + earlyTip) * comboMultiplier(combo) * tipMult * pax.tipMult;
  if (perfect) pay *= 1 + perfectBonusValue;
  if (order.express) pay *= 2;
  return Math.round(pay);
}

/** Coins lost when a train leaves without its dish. */
export function missFine() {
  return 5;
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
    state.coins = Math.max(0, (state.coins || 0) - missFine());
  }
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0 && state.orders.length < state.levelCfg.maxOrders) {
    const order = makeOrder(rng, state.level, state.levelCfg);
    state.orders.push(order);
    events.spawned = order;
    state.spawnTimer = state.levelCfg.spawnInterval;
  }
  return events;
}

/**
 * Serve a finished dish: removes the oldest matching order and pays out.
 * `perfect` marks a plate finished inside the perfect-cook zone.
 * Returns {order, payout} or null when no order wants that dish.
 */
export function serveDish(state, recipeId, perfect) {
  const at = state.orders.findIndex((o) => o.recipeId === recipeId);
  if (at < 0) return null;
  const order = state.orders[at];
  const payout = servePayout(order, state.combo, tipMultiplier(state.upgrades || {}), !!perfect, perfectBonus(state.upgrades || {}));
  state.orders.splice(at, 1);
  state.coins += payout;
  state.levelCoins = (state.levelCoins || 0) + payout;
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
