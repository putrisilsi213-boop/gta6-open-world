# gta6-open-world

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/putrisilsi213-boop/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/putrisilsi213-boop/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Sunset Bay** — an original open-world crime game for make.fun's "Make GTA 6" bounty ($1,666 in USDC). Rex Marlowe comes home to Sunset Bay owing the Harbor Kings crew $8,000. Steal cars, outrun the SBPD, run five story jobs, collect Bay Tokens and drive a Bay Cab — and buy your way out. A sun-soaked 3D city with traffic, pedestrians, a wanted level with responding police, combat, a HUD with minimap, start screen and saves. Every name, character, vehicle, place, story beat, texture and sound is original and made for this game; nothing is borrowed from any commercial game.

## Run it

```sh
node serve.ts
# open http://localhost:8080 — keyboard + mouse, desktop Chrome
```

Or serve `game/` with any static file server. The game runs fully offline: every script, texture and sound is a file under `game/` or generated at runtime — no network requests.

## Play

- **WASD / Arrows** — walk, run, drive · **Mouse** — look (click to lock)
- **E** — steal / enter a car, E again to get out
- **Click** — fire your pistol (on foot) · **Space** — jump · **Shift** — sprint
- **P / Esc** — pause · **M** — mute

Stealing cars, hitting pedestrians and shooting raise your wanted stars. Lay low and the heat fades; get caught and you're BUSTED. Follow the yellow beacon for story missions, find 12 Bay Tokens ($250 each), and take taxi fares in a Bay Cab.

## Layout

- `game/index.html` — page, HUD and menus
- `game/src/main.js` — game loop, screens, crimes, fares, saving
- `game/src/city.js` — procedural Sunset Bay: blocks, beach, docks, park
- `game/src/vehicles.js` — car models, driving physics, traffic AI
- `game/src/pedestrians.js` — sidewalk crowds that flee trouble
- `game/src/police.js` — wanted stars, SBPD chases, BUSTED
- `game/src/combat.js` — pistol fire, mission gunmen, health pickups
- `game/src/missions.js` — five story missions + Bay Token hunt
- `game/src/player.js` — Rex on foot and the chase camera
- `game/src/hud.js` — HUD, minimap, toasts
- `game/src/audio.js` — synthesized WebAudio SFX and synthwave music
- `game/src/textures.js` — procedural canvas textures
- `game/vendor/three.module.min.js` — three.js (MIT, vendored)

---

<sub>Entered on [make.fun](https://make.fun/?ref=fitra-wahyudi&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
