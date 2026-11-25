# Junction Kitchen

[![make.fun](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/erlansyahm90-code/best-cooking-game-20261125-0137/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/erlansyahm90-code/best-cooking-game-20261125-0137/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)

A cooking game set in a train-station kitchen, built for the
[make.fun bounty "Make the best cooking game"](https://make.fun/bounty/best-cooking-game-20261125-0137).

Orders arrive as trains on the departure board. Chop, cook, plate — and serve
each dish before its train leaves the platform. Early serves pay a tip,
streaks build a combo multiplier, and a missed train costs the station a
heart of reputation plus a coin fine. One chopped tomato feeds three different
dishes, so the game rewards planning the route, not just the dish.

## Play

Open `game/index.html` in a desktop browser (or serve the repo root and open
`/game/`). No network, no build step, no dependencies.

- **WASD / arrow keys** — move the chef (or click anywhere to walk there)
- **E or click a station** — work it: take ingredients, chop, cook, plate, serve
- **Q** — swap the two hands · **C** — calming tea (+12s patience, 3c) ·
  **H** — sous-chef auto-chop · **U** — upgrade shop
- **T** — the recipe book (all 7 dishes, locked ones included)
- **P** — pause, **M** — sound on/off, **R** — next shift

## Progression: one flow, one HUD, one shop

**LEVEL UP (stars + coins) → TOKO UPGRADE → next level.**

- **5 levels** — Pagi, Siang, Sore, Malam, Tengah Malam (Rush Hour). Each level
  unlocks a new recipe and ingredient, brings orders faster with tighter
  timers, and adds simultaneous orders (2 → 3 → 4). Express Trains appear
  from LV4: double coins, half the time.
- **8 upgrades, 3 tiers each** (Tier 2 needs LV2, Tier 3 needs LV4), bought
  with serve coins: Pisau & Talnan (chop 2.0s → 0.7s), Kompor (faster + a 3rd
  burner at Lv3), Meja Plating (+plate slots, faster plating), Jendela Serving
  (tips +25/50/100%), Sepatu Chef (+15% speed/tier), Pantry (faster grab),
  Kualitas Bahan (bigger tips + perfect bonus), Warming Station (hold cooked
  food without burning, +1 slot/tier).
- **Cooking mechanics** — patience meter per order (green → orange → red);
  perfect-cook zone on every pot (serve in the green zone for a coin bonus,
  leave it too long and it burns); carry **2 items** at once; chopped
  ingredients never spoil while cooked food can burn; goal meter with 1–5
  stars per level; sous-chef helper after every 3 serves; calming tea to
  rescue a nearly-red order; passenger types (Buru-buru, Santai, VIP) with
  different patience and tips.

## The kitchen

- **Pantry** — 7 ingredients: tomato, onion, cheese, dough, mushroom, basil, egg
- **Chopping board** — raw ingredients become chopped while you stay at the board
- **Stove** — 2 burners (3 at Kompor Lv3); pots cook in 4 seconds and burn if left too long
- **Plating counter** — 2 plates (up to 4); assemble the exact ingredients an order needs
- **Warming station** — hold cooked dishes without burning
- **Serving window** — serve finished plates to the waiting trains
- **7 recipes** — Tomato Pasta, Garden Salad, Cheese Melt, Mushroom Soup,
  Margherita, Golden Risotto, Midnight Omelette (the LV5 signature)

## Layout

```
main.ts            hand-in: copies game/ + screenshots/ to /output, writes dossier.json
vendor/            make.fun's dossier library, copied unchanged from the kit
game/
  index.html       the page (canvas 1280x720)
  css/style.css    page chrome
  js/main.js       game loop, input, wiring, level flow + shop
  js/chef.js       movement, facing, two hands
  js/orders.js     the departure board, patience, passengers, scoring
  js/recipes.js    ingredients + the 7 recipes
  js/levels.js     the 5 levels: pace, unlocks, goals, stars
  js/upgrades.js   the 8 upgrades: costs, tiers, effects
  js/stations.js   station layout + interaction rules
  js/timer.js      clock shim (timing lives in levels.js)
  js/render.js     all canvas drawing (vector art, no image files)
  js/audio.js      Web Audio synthesis (no audio files)
  js/shots.js      deterministic screenshot scenes (?scene=cover|chop|stove|serve)
screenshots/       4 real renders of the game (the first by name is the cover)
tests/             unit tests for recipes, timers and scoring (node, no deps)
```

All art is drawn with canvas vector shapes and all sound is synthesized live
with Web Audio — the game ships no image or audio files.

## Screenshots

The four screenshots are real renders of this code in a headless browser,
staged with `?scene=` (the same deterministic states the game itself plays).
The cover shows the whole kitchen at once: the departure board, ingredients
on the counter, a dish mid-assembly, a READY plate, cooking pots and timers.

## License

MIT — see [LICENSE](LICENSE).
