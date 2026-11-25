// The 5 levels of Junction Kitchen: one shift per level, each with its own
// pace, recipe pool, order pressure and coin goals. All tuning lives here,
// in one file, so the difficulty curve is easy to read and change.
//
// Flow: LEVEL UP (stars + coins) -> SHOP (upgrades) -> next level.
// Upgrade Tier 2 needs LV2, Tier 3 needs LV4 (see upgrades.js).

export const LEVELS = [
  {
    level: 1,
    name: 'Pagi',
    duration: 60,
    spawnInterval: 13,
    orderLifetime: 50,
    maxOrders: 2,
    expressChance: 0,
    goalNormal: 40,
    goalExpert: 70,
  },
  {
    level: 2,
    name: 'Siang',
    duration: 75,
    spawnInterval: 11,
    orderLifetime: 44,
    maxOrders: 2,
    expressChance: 0,
    goalNormal: 55,
    goalExpert: 90,
  },
  {
    level: 3,
    name: 'Sore',
    duration: 90,
    spawnInterval: 10,
    orderLifetime: 40,
    maxOrders: 3,
    expressChance: 0,
    goalNormal: 70,
    goalExpert: 110,
  },
  {
    level: 4,
    name: 'Malam',
    duration: 90,
    spawnInterval: 9,
    orderLifetime: 36,
    maxOrders: 3,
    expressChance: 0.15,
    goalNormal: 85,
    goalExpert: 130,
  },
  {
    level: 5,
    name: 'Tengah Malam',
    duration: 120,
    spawnInterval: 8,
    orderLifetime: 32,
    maxOrders: 4,
    expressChance: 0.25,
    goalNormal: 100,
    goalExpert: 160,
  },
];

export const LEVEL_COUNT = LEVELS.length;

export function levelConfig(level) {
  return LEVELS[Math.max(1, Math.min(LEVEL_COUNT, level)) - 1];
}

/** Stars 1-5 for coins earned in a level (normal goal = 3 stars). */
export function starsForLevelCoins(coins, level) {
  const cfg = levelConfig(level);
  if (coins >= cfg.goalExpert) return 5;
  if (coins >= Math.round(cfg.goalNormal * 1.3)) return 4;
  if (coins >= cfg.goalNormal) return 3;
  if (coins >= Math.round(cfg.goalNormal * 0.7)) return 2;
  if (coins >= Math.round(cfg.goalNormal * 0.4)) return 1;
  return 0;
}

/** What the next level unlocks (recipe + ingredient names), for the overlay. */
export function levelUnlocks(level) {
  const names = [];
  if (level === 2) names.push('Mushroom Soup', 'Mushroom');
  if (level === 3) names.push('Margherita', 'Basil');
  if (level === 4) names.push('Golden Risotto', 'Express Trains');
  if (level === 5) names.push('Midnight Omelette', 'Egg');
  return names;
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${rest < 10 ? '0' : ''}${rest}`;
}
