# Solara Bay — Open World

[![Play on make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/rardiyansyah004-blip/gta6-01-v2b/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/rardiyansyah004-blip/gta6-01-v2b/reward.svg)](https://make.fun/bounty/gta6-01)

A 2D top-down open-world crime game set in **Solara Bay**, a sun-soaked city of palm trees, neon and bad decisions. Steal cars, outrun the SBPD, and run nine story missions for Lena Ortiz, Marco Ruiz and Dario Voss — from a first stolen sedan to the Crown of Solara.

## What is in the game

- **Open world, 3200×2400, 5 districts** — Downtown, Palmera Beach, Old Town, Marina Docks, Verde Park — with a road grid, buildings, parks, palms, neon signs and the sea on the east edge.
- **On foot and driving** — 8 car models, each with its own speed and handling. Press E to steal a parked car (the cops notice), E again to step out.
- **Wanted 1–5 stars** — the SBPD answers in kind: patrol cars chase, roadblocks go up at 3 stars, **Air One** the police helicopter launches at 4 stars with a searchlight on you. Get busted on foot and you lose a fine; get wasted and the hospital patches you up.
- **SBPD DISPATCH feed** — the radio talks: callouts as your wanted level climbs, roadblock warnings, Air One sightings.
- **9 story missions** — First Wheels, Courier Run, Getaway, Dockside Takedown, The Big Score, Street Kings (a 6-checkpoint race), Harbor Heat (defend the docks), Getaway Driver (escort), Crown of Solara (a 5-star finale). Timed steps, checkpoints, gang waves, escort and survival.
- **Garage tunes** — Lena's Garage: $500 per tune, +15% top speed, up to 3 times, kept across cars.
- **Weapon upgrades** — the pistol is tuned after job 4 and fires faster after job 7.
- **3 radio stations** — Q switches between Solara FM, Bay 94.5 and Neon Nights, all synthesised live with WebAudio. M toggles the music.
- **Respect ranks** — from Nobody to Legend of Solara as missions are completed.
- **3 save slots** — progress saves after every mission; the title screen shows each slot's jobs, money and takedowns. Press 1/2/3 to pick a slot, Space to continue the latest.
- **Living city** — traffic, parked cars, pedestrians who flee when shots are fired, burning wrecks with smoke, dusk lighting.

## Controls

WASD / arrows — move and drive · Shift — run · Mouse — aim · Click — shoot · E — enter / exit car · R — reload · F — punch · Q — radio · G — garage tune (near Lena's Garage) · P — pause · M — music on/off · N — new game

## Play

Open `game/index.html` in a browser, or run the dev server:

```sh
node serve.ts
# http://localhost:8080/
```

## Screenshots

Four staged shots, each proving a different system:

1. **cover** — 5-star chase with Air One, roadblock and dispatch feed
2. **drive** — the Street Kings race at the start line
3. **city** — a living dusk intersection with a burning wreck
4. **title** — the title screen with three save slots

Each is taken at `game/index.html?shot=<name>&seed=20261121` (1280×720).

## Tech

Pure HTML5 Canvas + ES modules, no dependencies, no network, no audio files — every sound is synthesised with WebAudio. The entrypoint is `main.ts`, which copies `game/` and the screenshots into the output directory and writes `dossier.json` through the kit's vendor `buildDossier` helper.
