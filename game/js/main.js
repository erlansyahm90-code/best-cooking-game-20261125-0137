// Junction Kitchen — entry point. Wires input, the game loop and the
// stations together. Playable with keyboard (WASD + E) or mouse
// (click a station: the chef walks there and works it).
//
// One progression flow, one HUD, one shop:
//   LEVEL UP (stars + coins) -> TOKO UPGRADE -> next level.
// Upgrade Tier 2 needs LV2, Tier 3 needs LV4. 5 levels, 7 recipes, 8 upgrades.

import { drawGame } from './render.js';
import { moveChef, newChef, activeHand, swapHands } from './chef.js';
import { interact, nearestStation, newPlate, tickStations, STATIONS, crateAt } from './stations.js';
import { makeOrder, resetOrderIds, serveDish, tickOrders, mostUrgentOrder, MAX_REPUTATION } from './orders.js';
import { levelConfig, levelUnlocks, starsForLevelCoins, LEVEL_COUNT } from './levels.js';
import { newUpgrades, buyUpgrade, UPGRADE_DEFS } from './upgrades.js';
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
  const cfg = levelConfig(1);
  const state = {
    screen: 'title',
    scene: null,
    time: 0,
    level: 1,
    levelCfg: cfg,
    levelTime: 0,
    levelCoins: 0,
    coins: 0,
    combo: 0,
    bestCombo: 0,
    reputation: MAX_REPUTATION,
    served: 0,
    missed: 0,
    stars: [],
    orders: [],
    spawnTimer: 2,
    chef: newChef(),
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
    upgrades: newUpgrades(),
    tea: 3,
    helperServes: 0,
    helperReady: false,
    pantrySelected: 0,
    popups: [],
    particles: [],
    message: '',
    messageT: 0,
    nearStation: null,
    overlay: null, // null | 'menu' | 'levelup' | 'shop'
    shopFromLevelUp: false,
    levelUp: null, // {stars, coins, unlocks, failed}
    paused: false,
    rng,
    lastTickSecond: -1,
  };
  // Two orders on the board when the shift starts.
  state.orders.push(makeOrder(rng, 1, cfg));
  state.orders.push(makeOrder(rng, 1, cfg));
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

function addParticles(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    state.particles.push({
      x,
      y,
      vx: (state.rng() - 0.5) * 120,
      vy: -40 - state.rng() * 90,
      t: 0,
      life: 0.5 + state.rng() * 0.4,
      color,
    });
  }
}

/** The serving window's callback: pay out, or explain why not. */
function serveCallback(items, recipe, perfect) {
  const result = serveDish(state, recipe.id, perfect);
  if (!result) return null;
  const { order, payout } = result;
  addPopup(1130, 330, `+${payout} ¢${perfect ? ' PERFECT!' : ''}`, '#f5c542');
  addParticles(1130, 330, '#f5c542', 10);
  sfx.playServe();
  sfx.playCoin();
  // The dishwasher returns a fresh empty plate to the counter.
  const slots = 2 + (state.upgrades.plating || 0);
  for (let i = 0; i < slots; i++) {
    if (state.plates[i] === null) {
      state.plates[i] = newPlate();
      break;
    }
  }
  // Sous-chef helper charges up: every 3 serves, one free chop.
  state.helperServes++;
  if (state.helperServes >= 3 && !state.helperReady) {
    state.helperReady = true;
    state.helperServes = 0;
    setMessage('Sous-chef is ready — press H to auto-chop!');
  }
  return `Served ${order.name} to No. ${order.trainNo} — +${payout} coins!`;
}

function doInteract() {
  const station = nearestStation(state.chef);
  if (!station) {
    setMessage('Walk up to a station first.');
    return;
  }
  const before = JSON.stringify(state.chef.hands);
  const msg = interact(state, station.id, serveCallback);
  if (msg) setMessage(msg);
  const after = JSON.stringify(state.chef.hands);
  if (before !== after) {
    if (activeHand(state.chef)) sfx.playPickup();
    else sfx.playPlace();
  }
  if (station.id === 'board' && state.board.item && state.board.progress >= 1) sfx.playChop();
}

/** Calming tea: restore patience to one order (3 coins, 3 cups per level). */
function serveTea(order) {
  if (!order) {
    setMessage('No order to calm down.');
    return;
  }
  if (state.tea <= 0) {
    setMessage('Out of tea — it refills next level.');
    return;
  }
  if (state.coins < 3) {
    setMessage('Tea costs 3 coins.');
    return;
  }
  state.coins -= 3;
  state.tea--;
  order.timeLeft = Math.min(order.total, order.timeLeft + 12);
  addPopup(640, 120, '🍵 +12s', '#8fd0a8');
  setMessage(`Tea served to No. ${order.trainNo} — patience restored!`);
  sfx.playServe();
}

/** Sous-chef helper: instantly finishes the chop on the board. */
function useHelper() {
  if (!state.helperReady) {
    setMessage('Sous-chef needs 3 serves to charge up.');
    return;
  }
  if (!state.board.item || state.board.progress >= 1) {
    setMessage('Nothing to chop right now.');
    return;
  }
  state.board.progress = 1;
  state.helperReady = false;
  addParticles(362, 260, '#8fd0a8', 8);
  setMessage('Sous-chef chopped it in a flash!');
  sfx.playChop();
}

// ---- level flow: LEVEL UP -> SHOP -> next level ---------------------------

function endLevel(failed) {
  const stars = starsForLevelCoins(state.levelCoins, state.level);
  state.stars[state.level - 1] = stars;
  sfx.stopSizzle();
  if (failed || state.level >= LEVEL_COUNT) {
    state.screen = 'end';
    if (failed) sfx.playMissed();
    else sfx.playServe();
    return;
  }
  state.levelUp = {
    stars,
    coins: state.levelCoins,
    unlocks: levelUnlocks(state.level + 1),
    level: state.level + 1,
  };
  state.overlay = 'levelup';
  sfx.playServe();
}

function startNextLevel() {
  state.level++;
  state.levelCfg = levelConfig(state.level);
  state.levelTime = 0;
  state.levelCoins = 0;
  state.reputation = MAX_REPUTATION;
  state.orders = [];
  state.spawnTimer = 2;
  state.tea = 3;
  state.helperServes = 0;
  state.helperReady = false;
  state.board = { item: null, progress: 0 };
  state.pots = [
    { item: null, progress: 0, burnt: false, overTime: 0 },
    { item: null, progress: 0, burnt: false, overTime: 0 },
    { item: null, progress: 0, burnt: false, overTime: 0 },
  ];
  state.plates = [newPlate(), newPlate(), null, null];
  // Keep plate slots the plating upgrade already opened.
  const slots = 2 + (state.upgrades.plating || 0);
  for (let i = 2; i < slots; i++) state.plates[i] = newPlate();
  state.warming = [];
  state.grab = null;
  state.arrange = null;
  state.chef = newChef();
  state.overlay = null;
  state.shopFromLevelUp = false;
  state.levelUp = null;
  state.orders.push(makeOrder(state.rng, state.level, state.levelCfg));
  state.orders.push(makeOrder(state.rng, state.level, state.levelCfg));
  setMessage(`LEVEL ${state.level} — ${state.levelCfg.name}! New recipes unlocked.`);
  sfx.playWhistle();
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

const INGREDIENT_NAMES = ['Tomato', 'Onion', 'Cheese', 'Dough', 'Mushroom', 'Basil', 'Egg'];

window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && state.screen === 'title') {
    startShift();
    return;
  }
  if (e.code === 'KeyR' && state.screen === 'end') {
    restart();
    return;
  }
  // Overlays.
  if (state.overlay === 'levelup' && e.code === 'Enter') {
    state.overlay = 'shop';
    state.shopFromLevelUp = true;
    return;
  }
  if (state.overlay === 'shop' && e.code === 'Enter') {
    if (state.shopFromLevelUp) startNextLevel();
    else {
      state.overlay = null;
      state.shopFromLevelUp = false;
    }
    return;
  }
  if (state.overlay === 'shop' && e.code.startsWith('Digit')) {
    const n = Number.parseInt(e.code.slice(5), 10);
    if (n >= 1 && n <= UPGRADE_DEFS.length) {
      const def = UPGRADE_DEFS[n - 1];
      const result = buyUpgrade(state.upgrades, def.id, state.level, state.coins);
      if (result.ok) {
        state.coins -= result.cost;
        setMessage(`${def.name} upgraded to Lv${result.tier}!`);
        sfx.playCoin();
      } else {
        setMessage(`${def.name}: ${result.reason}.`);
      }
    }
    return;
  }
  if (state.overlay) {
    if (e.code === 'KeyT' && state.overlay === 'menu') state.overlay = null;
    if (e.code === 'KeyU' && state.overlay === 'shop') state.overlay = null;
    return;
  }
  if (e.code === 'KeyE' && state.screen === 'play' && !state.paused) {
    doInteract();
    return;
  }
  if (e.code === 'KeyQ' && state.screen === 'play' && !state.paused) {
    swapHands(state.chef);
    setMessage('Hands swapped.');
    return;
  }
  if (e.code === 'KeyH' && state.screen === 'play' && !state.paused) {
    useHelper();
    return;
  }
  if (e.code === 'KeyC' && state.screen === 'play' && !state.paused) {
    serveTea(mostUrgentOrder(state));
    return;
  }
  if (e.code === 'KeyU' && state.screen === 'play') {
    state.overlay = 'shop';
    state.shopFromLevelUp = false;
    setMessage('Shop — buy with 1–8, Enter to go back.');
    return;
  }
  if (e.code === 'KeyT') {
    state.overlay = 'menu';
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
    if (n >= 1 && n <= 7 && state.screen === 'play') {
      state.pantrySelected = n - 1;
      setMessage(`${INGREDIENT_NAMES[n - 1]} selected — E at the pantry to take it.`);
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
  warming: { x: 972, y: 614 },
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

/** The order ticket a click landed on (for serving tea), or null. */
function ticketAt(gx, gy) {
  if (gy < 68 || gy > 152) return null;
  const w = 252;
  const gap = 12;
  const n = state.orders.length;
  if (n === 0) return null;
  const totalW = n * w + (n - 1) * gap;
  const x0 = 150 + (1280 - 150 - totalW) / 2;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (w + gap);
    if (gx >= x && gx <= x + w) return state.orders[i];
  }
  return null;
}

canvas.addEventListener('click', (e) => {
  sfx.unlockAudio();
  if (state.screen === 'title') {
    startShift();
    return;
  }
  if (state.screen === 'end') return;
  if (state.overlay === 'menu') {
    state.overlay = null;
    return;
  }
  if (state.overlay) return;
  const rect = canvas.getBoundingClientRect();
  const gx = ((e.clientX - rect.left) / rect.width) * 1280;
  const gy = ((e.clientY - rect.top) / rect.height) * 720;
  // A click on an order ticket serves calming tea to that train.
  const ticket = ticketAt(gx, gy);
  if (ticket) {
    serveTea(ticket);
    return;
  }
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
let chopParticleAt = 0;

function update(dt) {
  if (state.screen !== 'play' || state.paused || state.overlay) return;
  // Staged screenshot scenes freeze the clock: the frame must be stable.
  if (state.scene) return;
  state.time += dt;
  state.levelTime += dt;
  // Orders.
  const events = tickOrders(state, dt, state.rng);
  if (events.spawned) {
    sfx.playWhistle();
    setMessage(`New order: ${events.spawned.name} for No. ${events.spawned.trainNo} → ${events.spawned.dest}`);
  }
  for (const order of events.expired) {
    sfx.playMissed();
    setMessage(`No. ${order.trainNo} left without its ${order.name}! −5 coins, reputation down.`);
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
    addParticles(362, 260, '#c89a6b', 8);
    setMessage('Chopped! Take it to a pot or a plate.');
  }
  if (state.board.item && state.board.progress < 1 && state.time - chopParticleAt > 0.15) {
    const c = { x: 362, y: 260 };
    if (Math.hypot(state.chef.x - c.x, state.chef.y - (c.y + 60)) < 150) {
      chopParticleAt = state.time;
      addParticles(340 + state.rng() * 44, 250, '#e8d8a8', 2);
    }
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
  moveChef(state.chef, keys, dt, SOLIDS, state.upgrades);
  if (hadTarget && !state.chef.target && hadTarget.stationId) {
    // Arrived at a clicked station: work it.
    if (hadTarget.crateIndex !== null && hadTarget.crateIndex !== undefined) {
      state.pantrySelected = hadTarget.crateIndex;
    }
    const station = nearestStation(state.chef);
    if (station && station.id === hadTarget.stationId) doInteract();
  }
  state.nearStation = nearestStation(state.chef);
  // Popups, particles and messages.
  for (const p of state.popups) p.t += dt;
  state.popups = state.popups.filter((p) => p.t < 1.4);
  for (const pt of state.particles) {
    pt.t += dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy += 260 * dt;
  }
  state.particles = state.particles.filter((pt) => pt.t < pt.life);
  if (state.messageT > 0) {
    state.messageT -= dt;
    if (state.messageT <= 0) state.message = '';
  }
  // Sizzle while any pot cooks.
  sfx.updateSizzle(state.pots.some((p) => p.item && p.progress < 1));
  // End of level.
  if (state.levelTime >= state.levelCfg.duration) {
    endLevel(false);
  } else if (state.reputation <= 0) {
    endLevel(true);
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
  const hand = activeHand(state.chef);
  return {
    screen: state.screen,
    level: state.level,
    levelTime: state.levelTime,
    levelCoins: state.levelCoins,
    coins: state.coins,
    served: state.served,
    missed: state.missed,
    combo: state.combo,
    reputation: state.reputation,
    time: state.time,
    overlay: state.overlay,
    tea: state.tea,
    helperReady: state.helperReady,
    upgrades: state.upgrades,
    orders: state.orders.map((o) => ({ recipeId: o.recipeId, timeLeft: o.timeLeft, passenger: o.passenger, express: o.express })),
    carrying: hand
      ? {
          kind: hand.kind,
          id: hand.id || null,
          prep: hand.prep || null,
          items: hand.plate ? hand.plate.items.length : null,
        }
      : null,
    hands: state.chef.hands.map((h) =>
      h ? { kind: h.kind, id: h.id || null, prep: h.prep || null } : null,
    ),
    target: state.chef.target,
    chef: { x: state.chef.x, y: state.chef.y },
    board: { item: state.board.item ? state.board.item.id : null, progress: state.board.progress },
    pots: state.pots.map((p) => ({ item: p.item ? p.item.id : null, progress: p.progress, burnt: p.burnt })),
    plates: state.plates.map((p) => (p ? p.items.length : null)),
    warming: state.warming.map((w) => w.id),
    message: state.message,
  };
}

// Test hook: the autoplay test reads state and drives input through here.
window.__junction = { state, doInteract, startShift, newGameState };
requestAnimationFrame(frame);
