// Junction Kitchen — entry point. Wires input, the game loop and the
// stations together. Playable with keyboard (WASD + E) or mouse
// (click a station: the chef walks there and works it).

import { drawGame } from './render.js';
import { moveChef, newChef } from './chef.js';
import { interact, nearestStation, newPlate, tickStations, STATIONS, crateAt } from './stations.js';
import { makeOrder, resetOrderIds, serveDish, tickOrders, MAX_REPUTATION } from './orders.js';
import { matchRecipe } from './recipes.js';
import { rushLevel, shiftLeft } from './timer.js';
import { stageScene } from './shots.js';
import { mulberry32 } from './rng.js';
import * as sfx from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const debugEl = document.getElementById('debug-state');

const SOLIDS = Object.values(STATIONS);

function params() {
  return new URLSearchParams(window.location.search);
}

export function newGameState(seed) {
  resetOrderIds();
  const rng = mulberry32(seed);
  const state = {
    screen: 'title',
    scene: null,
    time: 0,
    rush: 1,
    coins: 0,
    combo: 0,
    bestCombo: 0,
    reputation: MAX_REPUTATION,
    served: 0,
    missed: 0,
    orders: [],
    spawnTimer: 2,
    chef: newChef(),
    board: { item: null, progress: 0 },
    pots: [
      { item: null, progress: 0, burnt: false, overTime: 0 },
      { item: null, progress: 0, burnt: false, overTime: 0 },
    ],
    plates: [newPlate(), newPlate()],
    pantrySelected: 0,
    popups: [],
    message: '',
    messageT: 0,
    nearStation: null,
    showMenu: false,
    paused: false,
    rng,
    lastTickSecond: -1,
  };
  // Two orders on the board when the shift starts.
  state.orders.push(makeOrder(rng, 1));
  state.orders.push(makeOrder(rng, 1));
  return state;
}

const seedParam = Number.parseInt(params().get('seed') || '7', 10);
const state = newGameState(Number.isFinite(seedParam) ? seedParam : 7);
const sceneParam = params().get('scene');
if (sceneParam) stageScene(state, sceneParam);

function setMessage(text) {
  state.message = text;
  state.messageT = 3.5;
  if (statusEl) statusEl.textContent = text;
}

function addPopup(x, y, text, color) {
  state.popups.push({ x, y, text, color, t: 0 });
}

/** The serving window's callback: pay out, or explain why not. */
function serveCallback(items, recipe) {
  const result = serveDish(state, recipe.id);
  if (!result) return null;
  const { order, payout } = result;
  addPopup(1130, 330, `+${payout} ¢`, '#f5c542');
  sfx.playServe();
  sfx.playCoin();
  // The dishwasher returns a fresh empty plate to the counter.
  const empty = state.plates.indexOf(null);
  if (empty >= 0) state.plates[empty] = newPlate();
  return `Served ${order.name} to No. ${order.trainNo} — +${payout} coins!`;
}

function doInteract() {
  const station = nearestStation(state.chef);
  if (!station) {
    setMessage('Walk up to a station first.');
    return;
  }
  const before = JSON.stringify(state.chef.carrying);
  const msg = interact(state, station.id, serveCallback);
  if (msg) setMessage(msg);
  const after = JSON.stringify(state.chef.carrying);
  if (before !== after) {
    if (state.chef.carrying) sfx.playPickup();
    else sfx.playPlace();
  }
  if (station.id === 'board' && state.board.item && state.board.progress >= 1) sfx.playChop();
}

// ---------------------------------------------------------------- input

const keys = { up: false, down: false, left: false, right: false };

const KEYMAP = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && state.screen === 'title') {
    startShift();
    return;
  }
  if (e.code === 'KeyR' && state.screen === 'end') {
    restart();
    return;
  }
  if (e.code === 'KeyE' && state.screen === 'play' && !state.paused) {
    doInteract();
    return;
  }
  if (e.code === 'KeyT') {
    state.showMenu = !state.showMenu;
    return;
  }
  if (e.code === 'KeyM') {
    sfx.setMuted(!sfx.isMuted());
    setMessage(sfx.isMuted() ? 'Sound off.' : 'Sound on.');
    return;
  }
  if (e.code === 'KeyP' && state.screen === 'play') {
    state.paused = !state.paused;
    setMessage(state.paused ? 'Paused — P to resume.' : 'Back to work!');
    return;
  }
  if (e.code.startsWith('Digit')) {
    const n = Number.parseInt(e.code.slice(5), 10);
    if (n >= 1 && n <= 6 && state.screen === 'play') {
      state.pantrySelected = n - 1;
      const names = ['Tomato', 'Onion', 'Cheese', 'Dough', 'Mushroom', 'Basil'];
      setMessage(`${names[n - 1]} selected — E at the pantry to take it.`);
    }
    return;
  }
  const dir = KEYMAP[e.code];
  if (dir) {
    keys[dir] = true;
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  const dir = KEYMAP[e.code];
  if (dir) keys[dir] = false;
});

/** Where the chef stands to work each station (on the floor, in front of it). */
const STATION_APPROACH = {
  pantry: { x: 268, y: 400 },
  board: { x: 362, y: 374 },
  stove: { x: 592, y: 388 },
  plating: { x: 850, y: 418 },
  window: { x: 972, y: 440 },
  trash: { x: 154, y: 614 },
};

/** Push a clicked point out of station rectangles so the chef can reach it. */
function walkablePoint(x, y) {
  let px = Math.max(40, Math.min(1240, x));
  let py = Math.max(374, Math.min(626, y));
  for (const s of SOLIDS) {
    if (px > s.x - 28 && px < s.x + s.w + 28 && py > s.y - 28 && py < s.y + s.h + 28) {
      // Try each side; take the first push that lands on open floor.
      const tries = [
        { x: s.x + s.w + 28, y: py },
        { x: px, y: s.y + s.h + 28 },
        { x: s.x - 28, y: py },
        { x: px, y: Math.max(374, s.y - 28) },
      ];
      for (const t of tries) {
        if (t.x < 40 || t.x > 1240 || t.y < 374 || t.y > 626) continue;
        const inside = SOLIDS.some(
          (o) => t.x > o.x - 24 && t.x < o.x + o.w + 24 && t.y > o.y - 24 && t.y < o.y + o.h + 24,
        );
        if (!inside) {
          px = t.x;
          py = t.y;
          break;
        }
      }
    }
  }
  return { x: px, y: py };
}

canvas.addEventListener('click', (e) => {
  sfx.unlockAudio();
  if (state.screen === 'title') {
    startShift();
    return;
  }
  if (state.screen === 'end') return;
  if (state.showMenu) {
    state.showMenu = false;
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const gx = ((e.clientX - rect.left) / rect.width) * 1280;
  const gy = ((e.clientY - rect.top) / rect.height) * 720;
  // Which station (if any) did the click land on?
  let stationId = null;
  for (const s of SOLIDS) {
    if (gx >= s.x && gx <= s.x + s.w && gy >= s.y && gy <= s.y + s.h) stationId = s.id;
  }
  // A click on a pantry crate selects that ingredient.
  let crateIndex = null;
  const hit = crateAt(gx, gy);
  if (hit) {
    crateIndex = hit.index;
    stationId = 'pantry';
  }
  // Clicking a station sends the chef to its approach point; clicking open
  // floor just walks there.
  const point = stationId ? STATION_APPROACH[stationId] : walkablePoint(gx, gy);
  state.chef.target = { x: point.x, y: point.y, stationId, crateIndex };
});

function startShift() {
  sfx.unlockAudio();
  state.screen = 'play';
  setMessage('Shift started — check the departure board!');
  sfx.playWhistle();
}

function restart() {
  const fresh = newGameState((Math.random() * 1e9) | 0);
  Object.assign(state, fresh);
  state.screen = 'play';
  setMessage('New shift — the trains are coming!');
}

// ---------------------------------------------------------------- loop

let last = performance.now();
let chopSoundAt = 0;
let cookSoundAt = 0;

function update(dt) {
  if (state.screen !== 'play' || state.paused) return;
  // Staged screenshot scenes freeze the clock: the frame must be stable.
  if (state.scene) return;
  state.time += dt;
  state.rush = rushLevel(state.time);
  // Orders.
  const events = tickOrders(state, dt, state.rng);
  if (events.spawned) {
    sfx.playWhistle();
    setMessage(`New order: ${events.spawned.name} for No. ${events.spawned.trainNo} → ${events.spawned.dest}`);
  }
  for (const order of events.expired) {
    sfx.playMissed();
    setMessage(`No. ${order.trainNo} left without its ${order.name}! Reputation down.`);
  }
  // Last-seconds tick.
  const urgent = state.orders.find((o) => o.timeLeft <= 5);
  if (urgent) {
    const sec = Math.ceil(urgent.timeLeft);
    if (sec !== state.lastTickSecond) {
      state.lastTickSecond = sec;
      sfx.playTick();
    }
  }
  // Stations.
  const boardWasDone = state.board.item && state.board.progress >= 1;
  const potsWereDone = state.pots.map((p) => p.item && p.progress >= 1);
  tickStations(state, dt);
  if (state.board.item && state.board.progress >= 1 && !boardWasDone && state.time - chopSoundAt > 1) {
    chopSoundAt = state.time;
    sfx.playChop();
    setMessage('Chopped! Take it to a pot or a plate.');
  }
  state.pots.forEach((pot, i) => {
    if (pot.item && pot.progress >= 1 && !potsWereDone[i] && state.time - cookSoundAt > 1) {
      cookSoundAt = state.time;
      sfx.playReady();
      setMessage('Something finished cooking — grab it before it burns!');
    }
  });
  // Chef.
  const hadTarget = state.chef.target;
  moveChef(state.chef, keys, dt, SOLIDS);
  if (hadTarget && !state.chef.target && hadTarget.stationId) {
    // Arrived at a clicked station: work it.
    if (hadTarget.crateIndex !== null && hadTarget.crateIndex !== undefined) {
      state.pantrySelected = hadTarget.crateIndex;
    }
    const station = nearestStation(state.chef);
    if (station && station.id === hadTarget.stationId) doInteract();
  }
  state.nearStation = nearestStation(state.chef);
  // Popups and messages.
  for (const p of state.popups) p.t += dt;
  state.popups = state.popups.filter((p) => p.t < 1.4);
  if (state.messageT > 0) {
    state.messageT -= dt;
    if (state.messageT <= 0) state.message = '';
  }
  // Sizzle while any pot cooks.
  sfx.updateSizzle(state.pots.some((p) => p.item && p.progress < 1));
  // End of shift.
  if (shiftLeft(state.time) <= 0 || state.reputation <= 0) {
    state.screen = 'end';
    sfx.stopSizzle();
    if (state.reputation <= 0) sfx.playMissed();
    else sfx.playServe();
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  drawGame(ctx, state);
  if (debugEl) debugEl.textContent = JSON.stringify(snapshotState());
  requestAnimationFrame(frame);
}

/** A small JSON snapshot of the state, for the DOM test hook. */
function snapshotState() {
  return {
    screen: state.screen,
    coins: state.coins,
    served: state.served,
    missed: state.missed,
    combo: state.combo,
    reputation: state.reputation,
    time: state.time,
    orders: state.orders.map((o) => ({ recipeId: o.recipeId, timeLeft: o.timeLeft })),
    carrying: state.chef.carrying
      ? {
          kind: state.chef.carrying.kind,
          id: state.chef.carrying.id || null,
          prep: state.chef.carrying.prep || null,
          items: state.chef.carrying.plate ? state.chef.carrying.plate.items.length : null,
        }
      : null,
    target: state.chef.target,
    chef: { x: state.chef.x, y: state.chef.y },
    board: { item: state.board.item ? state.board.item.id : null, progress: state.board.progress },
    pots: state.pots.map((p) => ({ item: p.item ? p.item.id : null, progress: p.progress, burnt: p.burnt })),
    plates: state.plates.map((p) => (p ? p.items.length : null)),
    message: state.message,
  };
}

// Test hook: the autoplay test reads state and drives input through here.
window.__junction = { state, doInteract, startShift, newGameState };
requestAnimationFrame(frame);
