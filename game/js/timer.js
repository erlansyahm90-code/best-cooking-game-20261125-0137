// The shift clock and the rush: as the shift goes on, trains arrive faster
// and departures get tighter. Rush never adds chores — it only tightens time.

export const SHIFT_SECONDS = 180;
export const RUSH_STEP_SECONDS = 45;

export function rushLevel(elapsedSeconds) {
  return 1 + Math.floor(Math.max(0, elapsedSeconds) / RUSH_STEP_SECONDS);
}

/** Seconds between order arrivals at a rush level. */
export function spawnInterval(rush) {
  return Math.max(8, 15 - rush * 2);
}

/** How long an order lives before its train departs, at a rush level. */
export function orderLifetime(rush) {
  return Math.max(28, 52 - rush * 5);
}

/** Seconds left in the shift. */
export function shiftLeft(elapsedSeconds) {
  return Math.max(0, SHIFT_SECONDS - elapsedSeconds);
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${rest < 10 ? '0' : ''}${rest}`;
}

/** Star thresholds on coins earned by the end of the shift. */
export const STAR_COINS = [60, 100, 150];

export function starsForCoins(coins) {
  let stars = 0;
  for (const bar of STAR_COINS) if (coins >= bar) stars++;
  return stars;
}
