// Ingredients and recipes for Junction Kitchen. Every ingredient has a prep
// state: raw, chopped (chopping board) or cooked (stove). A recipe is an exact
// multiset of prepared ingredients; the same ingredient appears in several
// recipes, so one chopped tomato can feed more than one dish.
//
// Unlocks: recipes and ingredients open level by level (see levels.js).
// LV1 starts with 4 ingredients and 3 recipes; LV5 ends with 7 and 7.

export const PREP_RAW = 'raw';
export const PREP_CHOPPED = 'chopped';
export const PREP_COOKED = 'cooked';
export const PREP_BURNT = 'burnt';

export const INGREDIENTS = {
  tomato: { id: 'tomato', name: 'Tomato', color: '#e5484d', dark: '#a92c31', unlockLevel: 1 },
  onion: { id: 'onion', name: 'Onion', color: '#e8d8f0', dark: '#9b7fb5', unlockLevel: 1 },
  cheese: { id: 'cheese', name: 'Cheese', color: '#ffc53d', dark: '#c98f1b', unlockLevel: 1 },
  dough: { id: 'dough', name: 'Dough', color: '#f2e3c6', dark: '#b89a6a', unlockLevel: 1 },
  mushroom: { id: 'mushroom', name: 'Mushroom', color: '#c9a27e', dark: '#7d5a3a', unlockLevel: 2 },
  basil: { id: 'basil', name: 'Basil', color: '#3fa34d', dark: '#1f6b2a', unlockLevel: 3 },
  egg: { id: 'egg', name: 'Egg', color: '#fff8e7', dark: '#d9c48a', unlockLevel: 5 },
};

export const INGREDIENT_IDS = Object.keys(INGREDIENTS);

/** Ingredients open at or before `level`. */
export function unlockedIngredients(level) {
  return INGREDIENT_IDS.filter((id) => INGREDIENTS[id].unlockLevel <= level);
}

// need: [ingredientId, prep] pairs. prep 'raw' means straight from the pantry.
export const RECIPES = [
  {
    id: 'pasta',
    name: 'Tomato Pasta',
    price: 12,
    unlockLevel: 1,
    need: [
      ['dough', PREP_RAW],
      ['tomato', PREP_COOKED],
    ],
  },
  {
    id: 'salad',
    name: 'Garden Salad',
    price: 10,
    unlockLevel: 1,
    need: [
      ['tomato', PREP_CHOPPED],
      ['onion', PREP_CHOPPED],
    ],
  },
  {
    id: 'melt',
    name: 'Cheese Melt',
    price: 11,
    unlockLevel: 1,
    need: [
      ['dough', PREP_RAW],
      ['cheese', PREP_COOKED],
    ],
  },
  {
    id: 'soup',
    name: 'Mushroom Soup',
    price: 15,
    unlockLevel: 2,
    need: [
      ['mushroom', PREP_COOKED],
      ['onion', PREP_COOKED],
    ],
  },
  {
    id: 'margherita',
    name: 'Margherita',
    price: 14,
    unlockLevel: 3,
    need: [
      ['dough', PREP_RAW],
      ['tomato', PREP_CHOPPED],
      ['basil', PREP_RAW],
    ],
  },
  {
    id: 'risotto',
    name: 'Golden Risotto',
    price: 16,
    unlockLevel: 4,
    need: [
      ['mushroom', PREP_COOKED],
      ['onion', PREP_CHOPPED],
      ['basil', PREP_RAW],
    ],
  },
  {
    id: 'omelette',
    name: 'Midnight Omelette',
    price: 20,
    unlockLevel: 5,
    need: [
      ['egg', PREP_COOKED],
      ['cheese', PREP_COOKED],
      ['tomato', PREP_CHOPPED],
    ],
  },
];

export function recipeById(id) {
  return RECIPES.find((r) => r.id === id) || null;
}

/** Recipes open at or before `level`. */
export function unlockedRecipes(level) {
  return RECIPES.filter((r) => r.unlockLevel <= level);
}

function keyOf(item) {
  return `${item.id}:${item.prep}`;
}

/** The recipe whose needs exactly match `items` (order-free), or null. */
export function matchRecipe(items) {
  if (!items || items.length === 0) return null;
  const have = items.map(keyOf).sort().join('|');
  for (const recipe of RECIPES) {
    const want = recipe.need.map(([id, prep]) => `${id}:${prep}`).sort().join('|');
    if (have === want) return recipe;
  }
  return null;
}

/** True when `items` could still become some recipe (a subset of its needs). */
export function canStillBecomeRecipe(items) {
  const have = items.map(keyOf).sort();
  return RECIPES.some((recipe) => {
    const want = recipe.need.map(([id, prep]) => `${id}:${prep}`).sort();
    if (have.length > want.length) return false;
    const rest = want.slice();
    return have.every((h) => {
      const at = rest.indexOf(h);
      if (at < 0) return false;
      rest.splice(at, 1);
      return true;
    });
  });
}

/** The recipes an order ticket can show: name, price and needs. */
export function recipeCard(recipe) {
  return {
    id: recipe.id,
    name: recipe.name,
    price: recipe.price,
    need: recipe.need.map(([id, prep]) => ({ id, prep, name: INGREDIENTS[id].name })),
  };
}
