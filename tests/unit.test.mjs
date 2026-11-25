// Unit tests for Junction Kitchen's core logic (node:test, no dependencies).
// Run: node --test tests/unit.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchRecipe, canStillBecomeRecipe, recipeById, unlockedRecipes, unlockedIngredients } from '../game/js/recipes.js';
import { formatClock } from '../game/js/timer.js';
import { levelConfig, starsForLevelCoins } from '../game/js/levels.js';
import { chopSeconds, burnerCount, plateSlots, canBuy, buyUpgrade, newUpgrades, grabSeconds } from '../game/js/upgrades.js';
import { makeOrder, serveDish, servePayout, tickOrders, comboMultiplier, resetOrderIds } from '../game/js/orders.js';
import { interact, newPlate, tickStations } from '../game/js/stations.js';
import { mulberry32 } from '../game/js/rng.js';
import { moveChef, newChef, FLOOR, takeItem, activeHand, swapHands } from '../game/js/chef.js';

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

  it('matches the 3-item recipes, including the LV5 signature', () => {
    assert.equal(
      matchRecipe([
        { id: 'dough', prep: 'raw' },
        { id: 'tomato', prep: 'chopped' },
        { id: 'basil', prep: 'raw' },
      ]).id,
      'margherita',
    );
    assert.equal(
      matchRecipe([
        { id: 'egg', prep: 'cooked' },
        { id: 'cheese', prep: 'cooked' },
        { id: 'tomato', prep: 'chopped' },
      ]).id,
      'omelette',
    );
  });

  it('knows a partial plate can still become a recipe', () => {
    assert.equal(canStillBecomeRecipe([{ id: 'dough', prep: 'raw' }]), true);
    assert.equal(canStillBecomeRecipe([{ id: 'basil', prep: 'cooked' }]), false);
  });

  it('finds recipes by id', () => {
    assert.equal(recipeById('soup').price, 15);
    assert.equal(recipeById('omelette').price, 20);
    assert.equal(recipeById('nope'), null);
  });

  it('unlocks recipes and ingredients level by level', () => {
    assert.equal(unlockedRecipes(1).length, 3);
    assert.equal(unlockedRecipes(5).length, 7);
    assert.deepEqual(unlockedIngredients(1), ['tomato', 'onion', 'cheese', 'dough']);
    assert.ok(unlockedIngredients(5).includes('egg'));
  });
});

describe('levels', () => {
  it('tightens pace and raises goals per level', () => {
    assert.ok(levelConfig(1).spawnInterval > levelConfig(5).spawnInterval);
    assert.ok(levelConfig(1).orderLifetime > levelConfig(5).orderLifetime);
    assert.equal(levelConfig(3).maxOrders, 3);
    assert.equal(levelConfig(5).maxOrders, 4);
    assert.ok(levelConfig(4).expressChance > 0);
    assert.equal(levelConfig(1).expressChance, 0);
  });

  it('counts stars 1-5 from level coins', () => {
    assert.equal(starsForLevelCoins(0, 1), 0);
    assert.equal(starsForLevelCoins(16, 1), 1);
    assert.equal(starsForLevelCoins(40, 1), 3);
    assert.equal(starsForLevelCoins(70, 1), 5);
  });

  it('formats the clock', () => {
    assert.equal(formatClock(180), '3:00');
    assert.equal(formatClock(65), '1:05');
    assert.equal(formatClock(0), '0:00');
  });
});

describe('upgrades', () => {
  it('speeds chopping and cooking per tier', () => {
    assert.equal(chopSeconds({}), 2.0);
    assert.equal(chopSeconds({ knife: 1 }), 1.2);
    assert.equal(chopSeconds({ knife: 2 }), 0.7);
    assert.equal(burnerCount({}), 2);
    assert.equal(burnerCount({ stove: 3 }), 3);
    assert.equal(plateSlots({}), 2);
    assert.equal(plateSlots({ plating: 2 }), 4);
    assert.equal(grabSeconds({}), 0.5);
    assert.equal(grabSeconds({ pantry: 3 }), 0);
  });

  it('gates tiers by level and coins', () => {
    const ups = newUpgrades();
    assert.equal(canBuy(ups, 'knife', 1, 20), 'ok');
    assert.equal(canBuy(ups, 'knife', 1, 10), 'Need 20c');
    const bought = buyUpgrade(ups, 'knife', 1, 20);
    assert.equal(bought.ok, true);
    assert.equal(ups.knife, 1);
    // Tier 2 needs LV2.
    assert.equal(canBuy(ups, 'knife', 1, 35), 'Needs LV2');
    assert.equal(canBuy(ups, 'knife', 2, 35), 'ok');
  });
});

describe('orders', () => {
  it('pays base + early tip, scaled by combo, passenger, perfect and express', () => {
    const order = { price: 12, total: 40, timeLeft: 40, passenger: 'santai', express: false };
    assert.equal(servePayout(order, 0, 1, false, 0.5), 18); // 12 + 6 tip
    assert.equal(servePayout({ ...order, timeLeft: 0 }, 0, 1, false, 0.5), 12);
    assert.equal(servePayout(order, 4, 1, false, 0.5), 36); // x2.00 combo
    assert.equal(comboMultiplier(0), 1);
    assert.equal(comboMultiplier(99), 2);
    // VIP pays double tip; perfect adds 50%; express doubles everything.
    assert.equal(servePayout({ ...order, passenger: 'vip' }, 0, 1, false, 0.5), 36);
    assert.equal(servePayout(order, 0, 1, true, 0.5), 27);
    assert.equal(servePayout({ ...order, express: true }, 0, 1, false, 0.5), 36);
  });

  it('serves the oldest matching order and pays out', () => {
    resetOrderIds();
    const state = {
      orders: [
        { id: 1, recipeId: 'pasta', price: 12, total: 40, timeLeft: 40, passenger: 'santai', express: false },
        { id: 2, recipeId: 'salad', price: 10, total: 40, timeLeft: 40, passenger: 'santai', express: false },
      ],
      coins: 0,
      levelCoins: 0,
      combo: 0,
      bestCombo: 0,
      served: 0,
      upgrades: {},
    };
    const result = serveDish(state, 'pasta', false);
    assert.equal(result.order.id, 1);
    assert.equal(result.payout, 18);
    assert.equal(state.coins, 18);
    assert.equal(state.levelCoins, 18);
    assert.equal(state.combo, 1);
    assert.equal(state.orders.length, 1);
    assert.equal(serveDish(state, 'pasta', false), null);
  });

  it('expires orders, costs reputation and a coin fine', () => {
    resetOrderIds();
    const rng = mulberry32(1);
    const state = {
      orders: [{ id: 1, recipeId: 'pasta', price: 12, total: 40, timeLeft: 1, passenger: 'santai', express: false }],
      reputation: 5,
      combo: 3,
      missed: 0,
      coins: 10,
      spawnTimer: 999,
      level: 1,
      levelCfg: levelConfig(1),
    };
    const events = tickOrders(state, 2, rng);
    assert.equal(events.expired.length, 1);
    assert.equal(state.reputation, 4);
    assert.equal(state.combo, 0);
    assert.equal(state.missed, 1);
    assert.equal(state.coins, 5);
  });

  it('deals deterministic orders from a seed', () => {
    const cfg = levelConfig(1);
    const a = makeOrder(mulberry32(42), 1, cfg);
    const b = makeOrder(mulberry32(42), 1, cfg);
    assert.equal(a.recipeId, b.recipeId);
    assert.equal(a.trainNo, b.trainNo);
  });
});

describe('stations', () => {
  function fakeState() {
    return {
      level: 1,
      chef: { x: 264, y: 250, hands: [null, null], facing: 1 },
      board: { item: null, progress: 0 },
      pots: [
        { item: null, progress: 0, burnt: false, overTime: 0 },
        { item: null, progress: 0, burnt: false, overTime: 0 },
        { item: null, progress: 0, burnt: false, overTime: 0 },
      ],
      plates: [newPlate(), newPlate(), null, null],
      warming: [],
      grab: null,
      arrange: null,
      upgrades: {},
      pantrySelected: 0,
    };
  }

  it('runs the full chain: pantry -> board -> stove -> plate', () => {
    const state = fakeState();
    // Take a tomato from the pantry (grab takes 0.5s at pantry tier 0).
    interact(state, 'pantry', () => null);
    tickStations(state, 0.6);
    assert.equal(activeHand(state.chef).id, 'tomato');
    assert.equal(activeHand(state.chef).prep, 'raw');
    // Place it on the board and chop it.
    state.chef.x = 362;
    state.chef.y = 400;
    interact(state, 'board', () => null);
    assert.equal(activeHand(state.chef), null);
    assert.equal(state.board.item.id, 'tomato');
    tickStations(state, 2.5);
    assert.equal(state.board.progress, 1);
    interact(state, 'board', () => null);
    assert.equal(activeHand(state.chef).prep, 'chopped');
    // Cook it.
    state.chef.x = 590;
    state.chef.y = 400;
    interact(state, 'stove', () => null);
    assert.equal(state.pots[0].item.id, 'tomato');
    tickStations(state, 4.5);
    assert.equal(state.pots[0].progress, 1);
    interact(state, 'stove', () => null);
    assert.equal(activeHand(state.chef).prep, 'cooked');
    // Plate it with dough: a Tomato Pasta. (The tomato lands on the plate
    // nearest the chef — either slot — so find the plate that holds it.)
    state.chef.x = 850;
    state.chef.y = 430;
    interact(state, 'plating', () => null);
    tickStations(state, 0.6);
    const used = state.plates.find((p) => p && p.items.length === 1);
    assert.ok(used, 'tomato should be on a plate');
    takeItem(state.chef, { kind: 'ingredient', id: 'dough', prep: 'raw' });
    interact(state, 'plating', () => null);
    tickStations(state, 0.6);
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
    takeItem(state.chef, { kind: 'ingredient', id: 'cheese', prep: 'cooked' });
    assert.match(interact(state, 'board', () => null), /Only raw/);
    state.chef.hands = [null, null];
    takeItem(state.chef, { kind: 'ingredient', id: 'cheese', prep: 'burnt' });
    assert.match(interact(state, 'plating', () => null), /Burnt/);
  });

  it('carries two items and swaps hands', () => {
    const state = fakeState();
    takeItem(state.chef, { kind: 'ingredient', id: 'tomato', prep: 'raw' });
    takeItem(state.chef, { kind: 'ingredient', id: 'dough', prep: 'raw' });
    assert.equal(activeHand(state.chef).id, 'tomato');
    swapHands(state.chef);
    assert.equal(activeHand(state.chef).id, 'dough');
  });

  it('locks pantry ingredients until their level', () => {
    const state = fakeState();
    state.pantrySelected = 6; // egg, LV5
    assert.match(interact(state, 'pantry', () => null), /LV5/);
  });

  it('holds cooked food on the warming rack without burning', () => {
    const state = fakeState();
    state.upgrades = { warming: 1 };
    takeItem(state.chef, { kind: 'ingredient', id: 'cheese', prep: 'cooked' });
    interact(state, 'warming', () => null);
    assert.equal(state.warming.length, 1);
    tickStations(state, 20);
    assert.equal(state.warming.length, 1);
    interact(state, 'warming', () => null);
    assert.equal(activeHand(state.chef).id, 'cheese');
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
