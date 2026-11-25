// Unit tests for Junction Kitchen's core logic (node:test, no dependencies).
// Run: node --test tests/unit.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchRecipe, canStillBecomeRecipe, recipeById } from '../game/js/recipes.js';
import { rushLevel, spawnInterval, orderLifetime, starsForCoins, formatClock, shiftLeft } from '../game/js/timer.js';
import { makeOrder, serveDish, servePayout, tickOrders, comboMultiplier, resetOrderIds } from '../game/js/orders.js';
import { interact, newPlate, tickStations } from '../game/js/stations.js';
import { mulberry32 } from '../game/js/rng.js';
import { moveChef, newChef, FLOOR } from '../game/js/chef.js';

describe('recipes', () => {
  it('matches a plate exactly, order-free', () => {
    const plate = [
      { id: 'tomato', prep: 'cooked' },
      { id: 'dough', prep: 'raw' },
    ];
    assert.equal(matchRecipe(plate).id, 'pasta');
  });

  it('rejects a wrong prep', () => {
    const plate = [
      { id: 'dough', prep: 'raw' },
      { id: 'tomato', prep: 'chopped' },
      { id: 'cheese', prep: 'cooked' },
    ];
    assert.equal(matchRecipe(plate), null);
  });

  it('matches the 3-item recipes', () => {
    assert.equal(
      matchRecipe([
        { id: 'dough', prep: 'raw' },
        { id: 'tomato', prep: 'chopped' },
        { id: 'cheese', prep: 'raw' },
      ]).id,
      'margherita',
    );
  });

  it('knows a partial plate can still become a recipe', () => {
    assert.equal(canStillBecomeRecipe([{ id: 'dough', prep: 'raw' }]), true);
    assert.equal(canStillBecomeRecipe([{ id: 'basil', prep: 'cooked' }]), false);
  });

  it('finds recipes by id', () => {
    assert.equal(recipeById('soup').price, 15);
    assert.equal(recipeById('nope'), null);
  });
});

describe('timer and rush', () => {
  it('raises the rush every 45 seconds', () => {
    assert.equal(rushLevel(0), 1);
    assert.equal(rushLevel(44), 1);
    assert.equal(rushLevel(45), 2);
    assert.equal(rushLevel(179), 4);
  });

  it('tightens spawns and lifetimes with rush', () => {
    assert.ok(spawnInterval(1) > spawnInterval(4));
    assert.ok(orderLifetime(1) > orderLifetime(4));
    assert.equal(orderLifetime(99), 28);
  });

  it('counts stars from coins', () => {
    assert.equal(starsForCoins(0), 0);
    assert.equal(starsForCoins(60), 1);
    assert.equal(starsForCoins(100), 2);
    assert.equal(starsForCoins(150), 3);
  });

  it('formats the clock', () => {
    assert.equal(formatClock(180), '3:00');
    assert.equal(formatClock(65), '1:05');
    assert.equal(formatClock(0), '0:00');
  });

  it('counts the shift down', () => {
    assert.equal(shiftLeft(170), 10);
    assert.equal(shiftLeft(999), 0);
  });
});

describe('orders', () => {
  it('pays base + early tip, scaled by combo', () => {
    const order = { price: 12, total: 40, timeLeft: 40 };
    assert.equal(servePayout(order, 40, 0), 18); // 12 + 6 tip
    assert.equal(servePayout(order, 0, 0), 12); // no tip at the last second
    assert.equal(servePayout(order, 40, 4), 36); // x2.00 combo
    assert.equal(comboMultiplier(0), 1);
    assert.equal(comboMultiplier(99), 2);
  });

  it('serves the oldest matching order and pays out', () => {
    resetOrderIds();
    const state = {
      orders: [
        { id: 1, recipeId: 'pasta', price: 12, total: 40, timeLeft: 40 },
        { id: 2, recipeId: 'salad', price: 10, total: 40, timeLeft: 40 },
      ],
      coins: 0,
      combo: 0,
      bestCombo: 0,
      served: 0,
    };
    const result = serveDish(state, 'pasta');
    assert.equal(result.order.id, 1);
    assert.equal(result.payout, 18);
    assert.equal(state.coins, 18);
    assert.equal(state.combo, 1);
    assert.equal(state.orders.length, 1);
    assert.equal(serveDish(state, 'pasta'), null);
  });

  it('expires orders and costs reputation', () => {
    resetOrderIds();
    const rng = mulberry32(1);
    const state = {
      orders: [{ id: 1, recipeId: 'pasta', price: 12, total: 40, timeLeft: 1 }],
      reputation: 5,
      combo: 3,
      missed: 0,
      spawnTimer: 999,
      rush: 1,
    };
    const events = tickOrders(state, 2, rng);
    assert.equal(events.expired.length, 1);
    assert.equal(state.reputation, 4);
    assert.equal(state.combo, 0);
    assert.equal(state.missed, 1);
  });

  it('deals deterministic orders from a seed', () => {
    const a = makeOrder(mulberry32(42), 1);
    const b = makeOrder(mulberry32(42), 1);
    assert.equal(a.recipeId, b.recipeId);
    assert.equal(a.trainNo, b.trainNo);
  });
});

describe('stations', () => {
  function fakeState() {
    return {
      chef: { x: 264, y: 250, carrying: null },
      board: { item: null, progress: 0 },
      pots: [
        { item: null, progress: 0, burnt: false, overTime: 0 },
        { item: null, progress: 0, burnt: false, overTime: 0 },
      ],
      plates: [newPlate(), newPlate()],
      pantrySelected: 0,
    };
  }

  it('runs the full chain: pantry -> board -> stove -> plate', () => {
    const state = fakeState();
    // Take a tomato from the pantry (chef stands by the crates).
    interact(state, 'pantry', () => null);
    assert.equal(state.chef.carrying.id, 'tomato');
    assert.equal(state.chef.carrying.prep, 'raw');
    // Place it on the board and chop it.
    state.chef.x = 362;
    state.chef.y = 400;
    interact(state, 'board', () => null);
    assert.equal(state.chef.carrying, null);
    assert.equal(state.board.item.id, 'tomato');
    tickStations(state, 2.5);
    assert.equal(state.board.progress, 1);
    interact(state, 'board', () => null);
    assert.equal(state.chef.carrying.prep, 'chopped');
    // Cook it.
    state.chef.x = 590;
    state.chef.y = 400;
    interact(state, 'stove', () => null);
    assert.equal(state.pots[0].item.id, 'tomato');
    tickStations(state, 4.5);
    assert.equal(state.pots[0].progress, 1);
    interact(state, 'stove', () => null);
    assert.equal(state.chef.carrying.prep, 'cooked');
    // Plate it with dough: a Tomato Pasta. (The tomato lands on the plate
    // nearest the chef — either slot — so find the plate that holds it.)
    state.chef.x = 850;
    state.chef.y = 430;
    interact(state, 'plating', () => null);
    const used = state.plates.find((p) => p && p.items.length === 1);
    assert.ok(used, 'tomato should be on a plate');
    state.chef.carrying = { kind: 'ingredient', id: 'dough', prep: 'raw' };
    interact(state, 'plating', () => null);
    assert.equal(matchRecipe(used.items).id, 'pasta');
  });

  it('burns a pot left too long', () => {
    const state = fakeState();
    state.pots[0] = { item: { id: 'cheese', prep: 'raw' }, progress: 1, burnt: false, overTime: 0 };
    tickStations(state, 9);
    assert.equal(state.pots[0].burnt, true);
  });

  it('refuses cooked food on the board and burnt food on a plate', () => {
    const state = fakeState();
    state.chef.carrying = { kind: 'ingredient', id: 'cheese', prep: 'cooked' };
    assert.match(interact(state, 'board', () => null), /Only raw/);
    state.chef.carrying = { kind: 'ingredient', id: 'cheese', prep: 'burnt' };
    assert.match(interact(state, 'plating', () => null), /Burnt/);
  });
});

describe('chef', () => {
  it('stays inside the floor', () => {
    const chef = newChef();
    chef.x = FLOOR.x + 1;
    chef.y = FLOOR.y + 1;
    moveChef(chef, { left: true, up: true, right: false, down: false }, 5, []);
    assert.ok(chef.x >= FLOOR.x);
    assert.ok(chef.y >= FLOOR.y);
  });

  it('walks toward a click target and stops there', () => {
    const chef = newChef();
    chef.x = 600;
    chef.y = 500;
    chef.target = { x: 700, y: 500, stationId: null };
    for (let i = 0; i < 120 && chef.target; i++) {
      moveChef(chef, { up: false, down: false, left: false, right: false }, 1 / 60, []);
    }
    assert.equal(chef.target, null);
    assert.ok(Math.abs(chef.x - 700) < 10);
  });
});
