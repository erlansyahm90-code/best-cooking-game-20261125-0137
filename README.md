# Junction Kitchen

[![make.fun](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/erlansyahm90-code/best-cooking-game-20261125-0137/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/erlansyahm90-code/best-cooking-game-20261125-0137/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)

A cooking game set in a train-station kitchen, built for the
[make.fun bounty "Make the best cooking game"](https://make.fun/bounty/best-cooking-game-20261125-0137).

Orders arrive as trains on the departure board. Chop, cook, plate — and serve
each dish before its train leaves the platform. Early serves pay a tip,
streaks build a combo multiplier, and a missed train costs the station a
heart of reputation. One chopped tomato feeds three different dishes, so the
game rewards planning the route, not just the dish.

## Play

Open `game/index.html` in a desktop browser (or serve the repo root and open
`/game/`). No network, no build step, no dependencies.

- **WASD / arrow keys** — move the chef (or click anywhere to walk there)
- **E or click a station** — work it: take ingredients, chop, cook, plate, serve
- **T** — the menu (all 6 recipes)
- **P** — pause, **M** — sound on/off, **R** — next shift

## The kitchen

- **Pantry** — 6 ingredients: tomato, onion, cheese, dough, mushroom, basil
- **Chopping board** — raw ingredients become chopped while you stay at the board
- **Stove** — 2 burners; pots cook in 4 seconds and burn if left too long
- **Plating counter** — 2 plates; assemble the exact ingredients an order needs
- **Serving window** — serve finished plates to the waiting trains
- **6 recipes** — Tomato Pasta, Margherita, Mushroom Soup, Garden Salad,
  Cheese Melt, Golden Risotto

Shifts last 3 minutes. The rush rises every 45 seconds: trains arrive faster
and departures get tighter. Earn 60 / 100 / 150 coins for one, two, three stars.

## Layout

```
main.ts            hand-in: copies game/ + screenshots/ to /output, writes dossier.json
vendor/            make.fun's dossier library, copied unchanged from the kit
game/
  index.html       the page (canvas 1280x720)
  css/style.css    page chrome
  js/main.js       game loop, input, wiring
  js/chef.js       movement, facing, carrying
  js/orders.js     the departure board, timers, scoring
  js/recipes.js    ingredients + the 6 recipes
  js/stations.js   station layout + interaction rules
  js/timer.js      shift clock, rush levels, star thresholds
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
