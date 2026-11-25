// The upgrade shop: 8 tools, 3 tiers each, bought with coins earned from
// serving. Tier 2 needs level 2, Tier 3 needs level 4. Every effect is real
// and visible: faster chopping and cooking, a third burner, more plate slots,
// bigger tips, faster shoes, a warming rack that never burns.
//
// Prices are tuned so a normal player affords 1-2 upgrades per level.

export const UPGRADE_DEFS = [
  {
    id: 'knife',
    name: 'Pisau & Talnan',
    blurb: 'Chop faster',
    costs: [20, 35, 55],
    effect: (tier) => `Chop ${[2.0, 1.2, 0.7][tier]}s`,
  },
  {
    id: 'stove',
    name: 'Kompor',
    blurb: 'Cook faster, +1 burner at Lv3',
    costs: [25, 45, 70],
    effect: (tier) => `Cook ${[4.0, 3.2, 2.6][tier]}s${tier >= 2 ? ' + 3rd burner' : ''}`,
  },
  {
    id: 'plating',
    name: 'Meja Plating',
    blurb: 'More plates, faster plating',
    costs: [20, 35, 50],
    effect: (tier) => `${2 + tier} plate slots`,
  },
  {
    id: 'window',
    name: 'Jendela Serving',
    blurb: 'Bigger tips',
    costs: [20, 35, 55],
    effect: (tier) => `Tip +${[25, 50, 100][tier]}%`,
  },
  {
    id: 'shoes',
    name: 'Sepatu Chef',
    blurb: 'Move faster between stations',
    costs: [15, 30, 45],
    effect: (tier) => `Speed +${15 * (tier + 1)}%`,
  },
  {
    id: 'pantry',
    name: 'Pantry',
    blurb: 'Grab ingredients faster',
    costs: [15, 25, 40],
    effect: (tier) => `Grab ${[0.5, 0.25, 0.1][tier]}s`,
  },
  {
    id: 'quality',
    name: 'Kualitas Bahan',
    blurb: 'Bigger tips + perfect bonus',
    costs: [25, 45, 70],
    effect: (tier) => `Tip +${10 * (tier + 1)}%, perfect +${10 * (tier + 1)}%`,
  },
  {
    id: 'warming',
    name: 'Warming Station',
    blurb: 'Hold cooked food without burning',
    costs: [20, 35, 55],
    effect: (tier) => `${tier + 1} warming slots`,
  },
];

export const MAX_TIER = 3;

/** Tier 2 needs level 2, Tier 3 needs level 4. */
export function tierMinLevel(tier) {
  return tier === 0 ? 1 : tier === 1 ? 2 : 4;
}

export function newUpgrades() {
  const out = {};
  for (const def of UPGRADE_DEFS) out[def.id] = 0;
  return out;
}

export function upgradeTier(upgrades, id) {
  return upgrades[id] || 0;
}

export function upgradeCost(id, tier) {
  const def = UPGRADE_DEFS.find((d) => d.id === id);
  if (!def || tier >= MAX_TIER) return null;
  return def.costs[tier];
}

/** Can this tier be bought now? Returns 'ok' or a reason. */
export function canBuy(upgrades, id, level, coins) {
  const tier = upgradeTier(upgrades, id);
  if (tier >= MAX_TIER) return 'MAX';
  if (level < tierMinLevel(tier)) return `Needs LV${tierMinLevel(tier)}`;
  const cost = upgradeCost(id, tier);
  if (coins < cost) return `Need ${cost}c`;
  return 'ok';
}

export function buyUpgrade(upgrades, id, level, coins) {
  const why = canBuy(upgrades, id, level, coins);
  if (why !== 'ok') return { ok: false, reason: why };
  const cost = upgradeCost(id, upgradeTier(upgrades, id));
  upgrades[id] = upgradeTier(upgrades, id) + 1;
  return { ok: true, cost, tier: upgrades[id] };
}

// ---- effect values, read by the game systems ----

export function chopSeconds(upgrades) {
  return [2.0, 1.2, 0.7][upgradeTier(upgrades, 'knife')] ?? 2.0;
}

export function cookSeconds(upgrades) {
  return [4.0, 3.2, 2.6][upgradeTier(upgrades, 'stove')] ?? 4.0;
}

/** Burner count: 2, or 3 at stove tier 3. */
export function burnerCount(upgrades) {
  return upgradeTier(upgrades, 'stove') >= 3 ? 3 : 2;
}

export function plateSlots(upgrades) {
  return 2 + upgradeTier(upgrades, 'plating');
}

export function arrangeSeconds(upgrades) {
  return [0.5, 0.3, 0.15, 0][upgradeTier(upgrades, 'plating')] ?? 0.5;
}

export function tipMultiplier(upgrades) {
  return (1 + 0.25 * upgradeTier(upgrades, 'window')) * (1 + 0.1 * upgradeTier(upgrades, 'quality'));
}

export function perfectBonus(upgrades) {
  return 0.5 + 0.1 * upgradeTier(upgrades, 'quality');
}

export function chefSpeedMultiplier(upgrades) {
  return 1 + 0.15 * upgradeTier(upgrades, 'shoes');
}

export function grabSeconds(upgrades) {
  return [0.5, 0.25, 0.1, 0][upgradeTier(upgrades, 'pantry')] ?? 0.5;
}

export function warmingSlots(upgrades) {
  return upgradeTier(upgrades, 'warming');
}
