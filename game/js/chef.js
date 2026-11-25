// The chef: movement, facing and TWO hands. Hand 0 is the active hand;
// Q swaps the two hands. Pure movement math — no DOM here, so the autoplay
// test can drive it.

import { chefSpeedMultiplier } from './upgrades.js';

export const CHEF_SPEED = 260;
export const CHEF_RADIUS = 24;

// The walkable kitchen floor (canvas 1280x720).
export const FLOOR = { x: 16, y: 350, w: 1248, h: 300 };

export function newChef() {
  return {
    x: 640,
    y: 520,
    facing: 1, // 1 right, -1 left
    moving: false,
    walkPhase: 0,
    hands: [null, null], // each: {kind:'ingredient', id, prep} or {kind:'plate', plate}
    target: null, // click-to-move destination {x, y, stationId}
  };
}

/** The active hand: hand 0 if it holds something, else hand 1. */
export function activeHand(chef) {
  return chef.hands[0] || chef.hands[1] || null;
}

export function activeHandIndex(chef) {
  if (chef.hands[0]) return 0;
  if (chef.hands[1]) return 1;
  return -1;
}

export function freeHandIndex(chef) {
  if (!chef.hands[0]) return 0;
  if (!chef.hands[1]) return 1;
  return -1;
}

/** Put an item in the first free hand. Returns false when both hands are full. */
export function takeItem(chef, item) {
  const at = freeHandIndex(chef);
  if (at < 0) return false;
  chef.hands[at] = item;
  return true;
}

/** Remove and return the active-hand item, or null. */
export function dropActive(chef) {
  const at = activeHandIndex(chef);
  if (at < 0) return null;
  const item = chef.hands[at];
  chef.hands[at] = null;
  return item;
}

export function swapHands(chef) {
  const tmp = chef.hands[0];
  chef.hands[0] = chef.hands[1];
  chef.hands[1] = tmp;
}

export function handsEmpty(chef) {
  return !chef.hands[0] && !chef.hands[1];
}

/**
 * Move the chef for one step. `input` is {up, down, left, right} booleans.
 * Walls are the station rectangles plus the floor bounds; the chef slides
 * along them instead of stopping dead.
 */
export function moveChef(chef, input, dt, solids, upgrades) {
  const speed = CHEF_SPEED * chefSpeedMultiplier(upgrades || {});
  let dx = 0;
  let dy = 0;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  if (chef.target && dx === 0 && dy === 0) {
    const tx = chef.target.x - chef.x;
    const ty = chef.target.y - chef.y;
    const d = Math.hypot(tx, ty);
    if (d < 8) {
      chef.target = null;
    } else {
      dx = tx / d;
      dy = ty / d;
    }
  }
  const len = Math.hypot(dx, dy);
  chef.moving = len > 0;
  if (len > 0) {
    dx /= len;
    dy /= len;
    if (dx !== 0) chef.facing = dx > 0 ? 1 : -1;
    chef.walkPhase += dt * 10;
  }
  const nx = chef.x + dx * speed * dt;
  const ny = chef.y + dy * speed * dt;
  // Move one axis at a time so the chef slides along counters.
  if (!hitsSolid(nx, chef.y, solids)) chef.x = nx;
  if (!hitsSolid(chef.x, ny, solids)) chef.y = ny;
  chef.x = Math.max(FLOOR.x + CHEF_RADIUS, Math.min(FLOOR.x + FLOOR.w - CHEF_RADIUS, chef.x));
  chef.y = Math.max(FLOOR.y + CHEF_RADIUS, Math.min(FLOOR.y + FLOOR.h - CHEF_RADIUS, chef.y));
}

function hitsSolid(x, y, solids) {
  for (const s of solids) {
    if (
      x + CHEF_RADIUS > s.x &&
      x - CHEF_RADIUS < s.x + s.w &&
      y + CHEF_RADIUS > s.y &&
      y - CHEF_RADIUS < s.y + s.h
    ) {
      return true;
    }
  }
  return false;
}

/** One-line description of both hands, for the HUD. */
export function carryingLabel(chef) {
  const label = (item) => {
    if (!item) return '—';
    if (item.kind === 'ingredient') {
      const prep = item.prep === 'raw' ? '' : ` (${item.prep})`;
      return `${item.id}${prep}`;
    }
    const n = item.plate.items.length;
    return `Plate (${n})`;
  };
  return `${label(chef.hands[0])} · ${label(chef.hands[1])}`;
}
