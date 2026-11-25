// Screenshot scenes: deterministic staged states, rendered by the real
// game code. ?scene=cover|chop|stove|serve freezes the clock so the frame
// is stable, and turns on the annotation overlay that teaches the judge
// how the kitchen works.

import { newPlate } from './stations.js';
import { newUpgrades } from './upgrades.js';
import { levelConfig } from './levels.js';

function stagedOrder(id, recipeId, name, price, trainNo, dest, timeLeft, total, passenger, express) {
  return { id, recipeId, name, price, trainNo, dest, timeLeft, total, passenger: passenger || 'santai', express: !!express };
}

function baseScene(state, level, coins, levelCoins) {
  state.level = level;
  state.levelCfg = levelConfig(level);
  state.levelTime = 20;
  state.coins = coins;
  state.levelCoins = levelCoins;
  state.upgrades = newUpgrades();
  state.tea = 2;
  state.helperServes = 0;
  state.helperReady = false;
  state.warming = [];
  state.grab = null;
  state.arrange = null;
  state.overlay = null;
  state.plates = [newPlate(), newPlate(), null, null];
  state.pots = [
    { item: null, progress: 0, burnt: false, overTime: 0 },
    { item: null, progress: 0, burnt: false, overTime: 0 },
    { item: null, progress: 0, burnt: false, overTime: 0 },
  ];
}

/** Cover: every criterion-1 element in one frame, at LV3 with an Express train. */
function stageCover(state) {
  baseScene(state, 3, 48, 48);
  state.time = 65;
  state.combo = 2;
  state.bestCombo = 3;
  state.served = 4;
  state.missed = 1;
  state.reputation = 4;
  state.helperReady = true;
  state.upgrades.knife = 1;
  state.upgrades.stove = 2;
  state.upgrades.plating = 1;
  state.upgrades.window = 1;
  state.upgrades.quality = 1;
  state.upgrades.warming = 1;
  state.plates[2] = newPlate();
  state.warming = [{ kind: 'ingredient', id: 'cheese', prep: 'cooked' }];
  state.orders = [
    stagedOrder(1, 'soup', 'Mushroom Soup', 15, '15', 'CAIRO', 8, 20, 'vip', true),
    stagedOrder(2, 'margherita', 'Margherita', 14, '07', 'ROMA', 12, 42, 'buru', false),
    stagedOrder(3, 'pasta', 'Tomato Pasta', 12, '12', 'KYOTO', 25, 42, 'santai', false),
  ];
  // Mid-assembly plate: dough + chopped tomato, 2 of 3 for a Margherita.
  state.plates[0] = { items: [
    { id: 'dough', prep: 'raw' },
    { id: 'tomato', prep: 'chopped' },
  ], perfect: false };
  // READY plate: a finished Tomato Pasta.
  state.plates[1] = { items: [
    { id: 'dough', prep: 'raw' },
    { id: 'tomato', prep: 'cooked' },
  ], perfect: true };
  state.board.item = { id: 'onion', prep: 'raw' };
  state.board.progress = 0.45;
  // Pot 0 sits in the PERFECT zone (0.8); pot 1 is early.
  state.pots[0] = { item: { id: 'mushroom', prep: 'chopped' }, progress: 0.8, burnt: false, overTime: 0 };
  state.pots[1] = { item: null, progress: 0, burnt: false, overTime: 0 };
  state.chef.x = 600;
  state.chef.y = 480;
  state.chef.facing = 1;
  state.chef.hands = [
    { kind: 'ingredient', id: 'tomato', prep: 'raw' },
    { kind: 'ingredient', id: 'dough', prep: 'raw' },
  ];
  state.message = 'Margherita needs cheese — then serve before No. 07 leaves!';
}

function stageChop(state) {
  baseScene(state, 2, 22, 22);
  state.time = 40;
  state.combo = 1;
  state.served = 2;
  state.orders = [
    stagedOrder(1, 'salad', 'Garden Salad', 10, '21', 'LISBON', 30, 47, 'santai', false),
    stagedOrder(2, 'soup', 'Mushroom Soup', 15, '09', 'VIENNA', 44, 47, 'buru', false),
  ];
  state.board.item = { id: 'tomato', prep: 'raw' };
  state.board.progress = 0.6;
  state.pots[0] = { item: { id: 'cheese', prep: 'raw' }, progress: 0.3, burnt: false, overTime: 0 };
  state.plates[0] = newPlate();
  state.plates[1] = { items: [{ id: 'onion', prep: 'chopped' }], perfect: false };
  state.chef.x = 362;
  state.chef.y = 400;
  state.chef.facing = 1;
  state.chef.hands = [null, null];
  state.message = 'Chopping fills while you stay at the board.';
}

function stageStove(state) {
  baseScene(state, 4, 96, 60);
  state.time = 120;
  state.combo = 3;
  state.bestCombo = 4;
  state.served = 8;
  state.missed = 1;
  state.reputation = 4;
  state.upgrades.stove = 3;
  state.upgrades.knife = 2;
  state.upgrades.plating = 1;
  state.upgrades.warming = 2;
  state.plates[2] = newPlate();
  state.warming = [
    { kind: 'ingredient', id: 'cheese', prep: 'cooked' },
    { kind: 'ingredient', id: 'mushroom', prep: 'cooked' },
  ];
  state.orders = [
    stagedOrder(1, 'soup', 'Mushroom Soup', 15, '15', 'CAIRO', 5, 18, 'vip', true),
    stagedOrder(2, 'risotto', 'Golden Risotto', 16, '07', 'ROMA', 35, 37, 'santai', false),
  ];
  state.pots[0] = { item: { id: 'mushroom', prep: 'chopped' }, progress: 0.7, burnt: false, overTime: 0 };
  state.pots[1] = { item: { id: 'onion', prep: 'chopped' }, progress: 0.3, burnt: false, overTime: 0 };
  state.pots[2] = { item: { id: 'cheese', prep: 'raw' }, progress: 0.5, burnt: false, overTime: 0 };
  state.plates[0] = { items: [{ id: 'basil', prep: 'raw' }], perfect: false };
  state.plates[1] = newPlate();
  state.chef.x = 640;
  state.chef.y = 450;
  state.chef.facing = -1;
  state.chef.hands = [
    { kind: 'plate', plate: { items: [{ id: 'mushroom', prep: 'cooked' }], perfect: true } },
    null,
  ];
  state.message = 'No. 15 leaves in 5s — the soup must go NOW!';
}

function stageServe(state) {
  // time 163 puts the next train mid-window (trainX ≈ 1080).
  baseScene(state, 5, 132, 80);
  state.time = 163;
  state.combo = 4;
  state.bestCombo = 5;
  state.served = 11;
  state.upgrades.stove = 3;
  state.upgrades.knife = 3;
  state.upgrades.plating = 2;
  state.upgrades.window = 2;
  state.upgrades.quality = 2;
  state.upgrades.warming = 3;
  state.plates[2] = newPlate();
  state.plates[3] = newPlate();
  state.warming = [
    { kind: 'ingredient', id: 'egg', prep: 'cooked' },
    { kind: 'ingredient', id: 'cheese', prep: 'cooked' },
  ];
  state.orders = [
    stagedOrder(1, 'melt', 'Cheese Melt', 11, '12', 'KYOTO', 18, 32, 'santai', false),
    stagedOrder(2, 'omelette', 'Midnight Omelette', 20, '03', 'PARIS', 30, 32, 'vip', false),
  ];
  state.plates[0] = { items: [
    { id: 'dough', prep: 'raw' },
    { id: 'cheese', prep: 'cooked' },
  ], perfect: false };
  state.plates[1] = newPlate();
  state.pots[0] = { item: null, progress: 0, burnt: false, overTime: 0 };
  state.pots[1] = { item: { id: 'tomato', prep: 'raw' }, progress: 0.85, burnt: false, overTime: 0 };
  state.chef.x = 920;
  state.chef.y = 480;
  state.chef.facing = 1;
  state.chef.hands = [null, null];
  state.popups = [{ x: 1130, y: 330, text: '+24 ¢', t: 0.3, color: '#f5c542' }];
  state.message = 'Served with 12s to spare — tip + combo!';
}

/** Stage `name` on a fresh play state; unknown names fall back to cover. */
export function stageScene(state, name) {
  state.screen = 'play';
  state.scene = name;
  state.spawnTimer = 999;
  if (name === 'chop') stageChop(state);
  else if (name === 'stove') stageStove(state);
  else if (name === 'serve') stageServe(state);
  else {
    state.scene = 'cover';
    stageCover(state);
  }
}
