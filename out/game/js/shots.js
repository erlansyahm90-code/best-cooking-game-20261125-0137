// Screenshot scenes: deterministic staged states, rendered by the real
// game code. ?scene=cover|chop|stove|serve freezes the clock so the frame
// is stable, and turns on the annotation overlay that teaches the judge
// how the kitchen works.

import { newPlate } from './stations.js';

function stagedOrder(id, recipeId, name, price, trainNo, dest, timeLeft, total) {
  return { id, recipeId, name, price, trainNo, dest, timeLeft, total };
}

/** Cover: every criterion-1 element in one frame. */
function stageCover(state) {
  state.time = 65;
  state.rush = 2;
  state.coins = 48;
  state.combo = 2;
  state.bestCombo = 3;
  state.served = 4;
  state.missed = 1;
  state.reputation = 4;
  state.orders = [
    stagedOrder(1, 'margherita', 'Margherita', 14, '07', 'ROMA', 12, 42),
    stagedOrder(2, 'pasta', 'Tomato Pasta', 12, '12', 'KYOTO', 25, 42),
    stagedOrder(3, 'soup', 'Mushroom Soup', 15, '03', 'PARIS', 40, 47),
  ];
  // Mid-assembly plate: dough + chopped tomato, 2 of 3 for a Margherita.
  state.plates[0] = { items: [
    { id: 'dough', prep: 'raw' },
    { id: 'tomato', prep: 'chopped' },
  ] };
  // READY plate: a finished Tomato Pasta.
  state.plates[1] = { items: [
    { id: 'dough', prep: 'raw' },
    { id: 'tomato', prep: 'cooked' },
  ] };
  state.board.item = { id: 'onion', prep: 'raw' };
  state.board.progress = 0.45;
  state.pots[0] = { item: { id: 'mushroom', prep: 'chopped' }, progress: 0.6, burnt: false, overTime: 0 };
  state.pots[1] = { item: null, progress: 0, burnt: false, overTime: 0 };
  state.chef.x = 600;
  state.chef.y = 480;
  state.chef.facing = 1;
  state.chef.carrying = { kind: 'ingredient', id: 'tomato', prep: 'raw' };
  state.message = 'Margherita needs cheese — then serve before No. 07 leaves!';
}

function stageChop(state) {
  state.time = 40;
  state.rush = 1;
  state.coins = 22;
  state.combo = 1;
  state.served = 2;
  state.orders = [
    stagedOrder(1, 'salad', 'Garden Salad', 10, '21', 'LISBON', 30, 47),
    stagedOrder(2, 'margherita', 'Margherita', 14, '09', 'VIENNA', 44, 47),
  ];
  state.board.item = { id: 'tomato', prep: 'raw' };
  state.board.progress = 0.6;
  state.pots[0] = { item: { id: 'cheese', prep: 'raw' }, progress: 0.3, burnt: false, overTime: 0 };
  state.plates[0] = newPlate();
  state.plates[1] = { items: [{ id: 'onion', prep: 'chopped' }] };
  state.chef.x = 362;
  state.chef.y = 400;
  state.chef.facing = 1;
  state.message = 'Chopping fills while you stay at the board.';
}

function stageStove(state) {
  state.time = 120;
  state.rush = 3;
  state.coins = 96;
  state.combo = 3;
  state.bestCombo = 4;
  state.served = 8;
  state.missed = 1;
  state.reputation = 4;
  state.orders = [
    stagedOrder(1, 'soup', 'Mushroom Soup', 15, '15', 'CAIRO', 5, 37),
    stagedOrder(2, 'risotto', 'Golden Risotto', 16, '07', 'ROMA', 35, 37),
  ];
  state.pots[0] = { item: { id: 'mushroom', prep: 'chopped' }, progress: 0.7, burnt: false, overTime: 0 };
  state.pots[1] = { item: { id: 'onion', prep: 'chopped' }, progress: 0.3, burnt: false, overTime: 0 };
  state.plates[0] = { items: [{ id: 'basil', prep: 'raw' }] };
  state.plates[1] = newPlate();
  state.chef.x = 640;
  state.chef.y = 450;
  state.chef.facing = -1;
  state.chef.carrying = { kind: 'plate', plate: { items: [{ id: 'mushroom', prep: 'cooked' }] } };
  state.message = 'No. 15 leaves in 5s — the soup must go NOW!';
}

function stageServe(state) {
  // time 163 puts the next train mid-window (trainX ≈ 1080).
  state.time = 163;
  state.rush = 4;
  state.coins = 132;
  state.combo = 4;
  state.bestCombo = 5;
  state.served = 11;
  state.orders = [
    stagedOrder(1, 'melt', 'Cheese Melt', 11, '12', 'KYOTO', 18, 32),
    stagedOrder(2, 'pasta', 'Tomato Pasta', 12, '03', 'PARIS', 30, 32),
  ];
  state.plates[0] = { items: [
    { id: 'dough', prep: 'raw' },
    { id: 'cheese', prep: 'cooked' },
  ] };
  state.plates[1] = newPlate();
  state.pots[0] = { item: null, progress: 0, burnt: false, overTime: 0 };
  state.pots[1] = { item: { id: 'tomato', prep: 'raw' }, progress: 0.85, burnt: false, overTime: 0 };
  state.chef.x = 920;
  state.chef.y = 480;
  state.chef.facing = 1;
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
