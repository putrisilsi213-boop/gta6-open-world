// Sunset Bay — main entry. Wires every system together: renderer, sun and
// shadows, the title / playing / paused / busted / wasted flow, the frame
// loop, stealing and driving, shooting and crimes, taxi fares, saving, and
// the screenshot staging hook (?shot=...). No network, no model calls.
import * as THREE from 'three';
import { CONFIG, PALETTE } from './config.js';
import { makeRng } from './random.js';
import { buildCity } from './city.js';
import { Traffic } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat, HealthPickup } from './combat.js';
import { MissionManager, TokenHunt, MISSIONS, STORY_INTRO } from './missions.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { SoundBank } from './audio.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') || '7');

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffd9a0, 420, 950);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 40, 120);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Sun + sky light.
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2c0, 2.1);
sun.position.set(220, 320, 140);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -320;
sun.shadow.camera.right = 320;
sun.shadow.camera.top = 320;
sun.shadow.camera.bottom = -320;
sun.shadow.camera.far = 900;
sun.shadow.bias = -0.0006;
scene.add(sun);

const rng = makeRng(SEED);
const city = buildCity(scene, rng);
const input = new Input(canvas);
const sound = new SoundBank();
const hud = new HUD();
const traffic = new Traffic(scene, rng, city.roadNodes, city.roadEdges, city.colliders);
const peds = new Pedestrians(scene, rng, city.colliders);
const police = new Police(scene, rng, city.colliders, city.roadNodes, city.roadEdges);
const combat = new Combat(scene, rng);
const player = new Player(scene, city.places.hideout.x + 4, city.places.hideout.z + 4);

// Shared state object the HUD and save system read.
const state = {
  player, police, traffic, peds, combat, missions: null, tokens: null,
  playSeconds: 0,
};

// Mission hooks: the mission system calls back into the world.
const missions = new MissionManager(city.places, {
  spawnEnemy: (x, z) => combat.spawnEnemy(x, z),
  spawnCar: (type, x, z, heading) => traffic.spawnParked(type, x, z, heading),
  setWanted: (n) => { police.stars = Math.max(police.stars, n); police.quietTimer = 0; },
  toast: (t, ms) => hud.toast(t, ms),
  reward: (amount, text) => {
    player.cash += amount;
    hud.banner(text);
    sound.missionDone();
    saveGame(state);
  },
  missionDone: () => { combat.clearEnemies(); },
  onStoryDone: () => {
    hud.banner('STORY COMPLETE — Sunset Bay is yours, Rex. Free roam forever.', 8000);
    hud.toast('All 5 missions done. Tokens, fares and the city are still yours.', 8000);
  },
});
missions.attachMarker(scene);
state.missions = missions;
const tokens = new TokenHunt(scene, rng, city.places, city.colliders);
state.tokens = tokens;

// Health pickups around the city.
const pickups = [
  new HealthPickup(scene, city.places.park.x, city.places.park.z),
  new HealthPickup(scene, city.places.hospital.x, city.places.hospital.z),
  new HealthPickup(scene, city.places.beach.x - 20, city.places.beach.z),
];

// Taxi fare beacon (separate from the mission beacon).
const fareBeacon = new THREE.Group();
const fareCyl = new THREE.Mesh(
  new THREE.CylinderGeometry(1.4, 1.4, 22, 12, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xf5c518, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
);
fareCyl.position.y = 11;
fareBeacon.add(fareCyl);
fareBeacon.visible = false;
scene.add(fareBeacon);
let fare = null; // {stage:'pickup'|'dropoff', x, z, cooldown}
let fareCooldown = 0;

function randomRoadSpot() {
  const n = city.roadNodes[Math.floor(rng.next() * city.roadNodes.length)];
  return { x: n.x + rng.range(-4, 4), z: n.z + rng.range(-4, 4) };
}

function maybeStartFare() {
  if (fare || fareCooldown > 0) return;
  if (!player.inCar || !player.car || player.car.typeKey !== 'taxi') return;
  const spot = randomRoadSpot();
  fare = { stage: 'pickup', x: spot.x, z: spot.z };
  fareBeacon.position.set(spot.x, 0, spot.z);
  fareBeacon.visible = true;
  hud.toast('Taxi fare: pick up the passenger at the yellow beacon.', 4000);
}

// --- Screens (title / pause / over) ---
const screens = {
  title: document.getElementById('screen-title'),
  pause: document.getElementById('screen-pause'),
  over: document.getElementById('screen-over'),
  howto: document.getElementById('screen-howto'),
};
const overTitle = document.getElementById('over-title');
const overText = document.getElementById('over-text');
const continueBtn = document.getElementById('btn-continue');
let mode = 'title'; // title | playing | paused | over
let overKind = null;

function showOnly(name) {
  for (const [key, el] of Object.entries(screens)) {
    if (el) el.style.display = key === name ? 'flex' : 'none';
  }
  document.getElementById('hud').style.display = name === null ? 'block' : 'none';
}

function startGame(fromSave) {
  sound.ensure();
  sound.startMusic();
  if (fromSave) {
    const data = loadGame();
    if (data) {
      player.cash = data.cash;
      player.health = data.health;
      player.pos.set(data.x, 0, data.z);
      player.mesh.position.copy(player.pos);
      state.playSeconds = data.playSeconds || 0;
      tokens.collected = data.tokens || 0;
      missions.missionIndex = Math.min(data.missionIndex || 0, MISSIONS.length - 1);
      hud.toast(`Welcome back — $${Math.floor(player.cash)} in the bank, mission ${missions.missionIndex + 1} of 5.`, 5000);
    }
  } else {
    player.cash = CONFIG.startCash;
    player.health = CONFIG.playerHealth;
    player.pos.set(city.places.hideout.x + 4, 0, city.places.hideout.z + 4);
    player.mesh.position.copy(player.pos);
    state.playSeconds = 0;
    missions.missionIndex = 0;
    hud.toast(STORY_INTRO, 9000);
  }
  police.clear();
  combat.clearEnemies();
  showOnly(null);
  mode = 'playing';
  if (missions.missionIndex < MISSIONS.length) missions.startMission(missions.missionIndex);
  canvas.requestPointerLock();
}

function pauseGame() {
  if (mode !== 'playing') return;
  mode = 'paused';
  document.exitPointerLock();
  showOnly('pause');
  document.getElementById('hud').style.display = 'none';
}

function resumeGame() {
  if (mode !== 'paused') return;
  showOnly(null);
  mode = 'playing';
  canvas.requestPointerLock();
}

function endRun(kind) {
  overKind = kind;
  mode = 'over';
  document.exitPointerLock();
  sound.busted();
  const fine = kind === 'busted' ? CONFIG.bustedFine : CONFIG.wastedFine;
  player.cash = Math.max(0, player.cash - fine);
  if (player.inCar) player.exitCar();
  police.clear();
  combat.clearEnemies();
  player.health = CONFIG.playerHealth;
  player.pos.set(city.places.hospital.x, 0, city.places.hospital.z);
  player.mesh.position.copy(player.pos);
  overTitle.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
  overTitle.style.color = kind === 'busted' ? '#4488ff' : '#ff4444';
  overText.textContent = kind === 'busted'
    ? `The SBPD caught up with you. Fine $${fine} — the Harbor Kings debt is still yours.`
    : `You got taken out on the streets of Sunset Bay. Hospital bill $${fine}.`;
  showOnly('over');
  document.getElementById('hud').style.display = 'none';
  saveGame(state);
}

document.getElementById('btn-new').addEventListener('click', () => startGame(false));
if (continueBtn) {
  continueBtn.style.display = hasSave() ? 'inline-block' : 'none';
  continueBtn.addEventListener('click', () => startGame(true));
}
document.getElementById('btn-howto').addEventListener('click', () => showOnly('howto'));
document.getElementById('btn-howto-back').addEventListener('click', () => showOnly('title'));
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-save').addEventListener('click', () => {
  saveGame(state);
  hud.toast('Progress saved.', 2500);
});
document.getElementById('btn-restart-mission').addEventListener('click', () => {
  combat.clearEnemies();
  if (missions.missionIndex < MISSIONS.length) missions.startMission(missions.missionIndex);
  resumeGame();
});
document.getElementById('btn-quit-title').addEventListener('click', () => {
  mode = 'title';
  showOnly('title');
  document.getElementById('hud').style.display = 'none';
  if (continueBtn) continueBtn.style.display = hasSave() ? 'inline-block' : 'none';
});
document.getElementById('btn-over').addEventListener('click', () => {
  showOnly(null);
  mode = 'playing';
  canvas.requestPointerLock();
});

// --- Crime handling ---
function onCrime(type, info) {
  if (type === 'ram') {
    if (player.inCar && player.car) {
      player.car.speed *= 0.55;
      sound.crash();
      hud.flashDamage();
    }
    return;
  }
  if (type === 'officerShot') {
    if (info.dist < 30 && rng.next() < 0.45) {
      player.health -= 8;
      hud.flashDamage();
      sound.noiseBurst(0.08, 0.2, 900);
    }
    return;
  }
  if (type === 'busted') {
    endRun('busted');
  }
}

function onEnemyShot(enemy, dist) {
  if (dist < 30 && rng.next() < 0.38) {
    player.health -= 6;
    hud.flashDamage();
    sound.noiseBurst(0.08, 0.2, 900);
  }
}

// --- Shooting (on foot only) ---
function tryShoot() {
  if (mode !== 'playing' || player.inCar) return;
  const { origin, dir } = player.aimRay(camera);
  const targets = [];
  for (const e of combat.enemies) targets.push({ pos: e.pos, health: e.health, kind: 'enemy', ref: e });
  for (const o of police.officers) targets.push({ pos: o.pos, health: o.health, kind: 'officer', ref: o });
  for (const ped of peds.list) {
    if (ped.state !== 'down') targets.push({ pos: ped.pos, health: 100, kind: 'ped', ref: ped });
  }
  const res = combat.shoot(origin, dir, targets, performance.now());
  if (res === 'rate') return;
  sound.gunshot();
  peds.scare(player.pos.x, player.pos.z, 30);
  if (police.addCrime('shoot')) sound.wantedUp();
  if (res && res.hit) {
    const t = res.hit;
    if (t.kind === 'enemy') {
      t.ref.health -= CONFIG.pistolDamage;
      if (t.ref.health <= 0) missions.onKill();
    } else if (t.kind === 'officer') {
      t.ref.health -= CONFIG.pistolDamage;
      if (t.ref.health <= 0) {
        police.addCrime('killCop');
        sound.wantedUp();
        police.officers = police.officers.filter((o) => o !== t.ref);
        scene.remove(t.ref.mesh);
      }
    } else if (t.kind === 'ped') {
      t.ref.state = 'down';
      t.ref.downTimer = 8;
      police.addCrime('killPedestrian');
      sound.wantedUp();
    }
  }
}

// --- Frame loop ---
const clock = new THREE.Clock();
let titleAngle = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (mode === 'title') {
    titleAngle += dt * 0.05;
    camera.position.set(Math.cos(titleAngle) * 190, 90, Math.sin(titleAngle) * 190);
    camera.lookAt(0, 10, 20);
    traffic.update(dt, null, police.cars);
    peds.update(dt, player.pos, null);
    renderer.render(scene, camera);
    return;
  }
  if (mode !== 'playing') {
    renderer.render(scene, camera);
    return;
  }

  state.playSeconds += dt;
  const now = performance.now();

  // Pause / mute keys.
  if (input.wasPressed('Escape') || input.wasPressed('KeyP')) pauseGame();
  if (input.wasPressed('KeyM')) {
    const muted = sound.toggleMute();
    hud.toast(muted ? 'Sound muted.' : 'Sound on.', 1500);
  }

  // Enter / exit car.
  if (input.wasPressed('KeyE')) {
    if (player.inCar) {
      const wasTaxi = player.car.typeKey === 'taxi';
      player.exitCar();
      sound.doorSlam();
      if (wasTaxi) { fare = null; fareBeacon.visible = false; }
    } else {
      const car = traffic.nearestCar(player.pos.x, player.pos.z, 4.2, null);
      if (car) {
        player.enterCar(car);
        car.parked = false;
        sound.doorSlam();
        if (car.isTraffic) {
          car.isTraffic = false;
          if (police.addCrime('stealCar')) sound.wantedUp();
          hud.toast(`Stole a ${car.type.name} — the SBPD noticed.`, 3500);
        }
        missions.onEnterCar(car);
      }
    }
  }

  // Shooting.
  if (input.mouseDown || input.consumeShot()) tryShoot();

  // Movement.
  if (player.inCar && player.car) {
    const mv = input.moveVector();
    // In a staged screenshot the car drives itself straight down the road.
    const throttle = SHOT ? 0.6 : mv.z;
    const steer = -mv.x;
    const before = player.car.crashed;
    player.car.crashed = false;
    player.car.drive({ throttle, steer }, dt, city.colliders);
    // While driving, Rex *is* where his car is: police, missions and the
    // minimap all read player.pos.
    player.pos.set(player.car.pos.x, 0, player.car.pos.z);
    player.heading = player.car.heading;
    if (player.car.crashed && !before) {
      sound.crash();
      hud.flashDamage();
      player.health -= 3;
    }
    // Car vs pedestrians is handled in peds.update via playerCar.
    sound.setEngine(Math.abs(player.car.speed) / player.car.type.topSpeed, true);
    // Taxi fares.
    fareCooldown = Math.max(0, fareCooldown - dt);
    maybeStartFare();
    if (fare) {
      fareBeacon.position.set(fare.x, 0, fare.z);
      const d = Math.hypot(player.car.pos.x - fare.x, player.car.pos.z - fare.z);
      if (d < 6) {
        if (fare.stage === 'pickup') {
          const drop = randomRoadSpot();
          fare = { stage: 'dropoff', x: drop.x, z: drop.z };
          hud.toast('Passenger aboard — drive to the drop-off.', 3000);
        } else {
          player.cash += CONFIG.fareReward;
          hud.banner(`Fare complete — +$${CONFIG.fareReward}`);
          sound.pickup();
          fare = null;
          fareBeacon.visible = false;
          fareCooldown = 6;
        }
      }
    }
  } else {
    player.updateOnFoot(dt, input, city.colliders);
    sound.setEngine(0, false);
  }

  // World systems.
  traffic.update(dt, player.inCar ? player.car : null, police.cars);
  peds.update(dt, player.pos, player.inCar ? player.car : null);
  // Pedestrians hit by the player's car count as a crime once each.
  for (const ped of peds.list) {
    if (ped.hitByCar && !ped.counted) {
      ped.counted = true;
      if (police.addCrime('hitPedestrian')) sound.wantedUp();
      hud.toast('You hit a pedestrian — the SBPD is coming.', 3000);
    }
  }
  police.update(dt, player, onCrime);
  sound.setSiren(police.sirenOn);
  combat.update(dt, player.pos, onEnemyShot);
  missions.update(player.pos, player.inCar, player.car);
  tokens.update(dt, player.pos, () => {
    player.cash += CONFIG.tokenReward;
    hud.banner(`Bay Token found — +$${CONFIG.tokenReward} (${tokens.collected}/12)`);
    sound.pickup();
  });
  for (const pk of pickups) {
    if (pk.update(dt, player.pos)) {
      player.health = Math.min(CONFIG.playerHealth, player.health + 40);
      hud.toast('Health +40', 2000);
      sound.pickup();
      setTimeout(() => {
        const np = new HealthPickup(scene, pk.pos.x, pk.pos.z);
        pickups.push(np);
      }, 45000);
    }
  }

  // Wasted?
  if (player.health <= 0) {
    endRun('wasted');
    return;
  }

  // Camera + HUD.
  player.updateCamera(dt, camera, input);
  hud.setCrosshair(!player.inCar);
  hud.update(state);

  renderer.render(scene, camera);
}

// Sea shimmer: gentle bob so the ocean reads as alive.
const seaMesh = city.sea;
let seaPhase = 0;
setInterval(() => { seaPhase += 0.05; if (seaMesh) seaMesh.position.y = -0.4 + Math.sin(seaPhase) * 0.08; }, 50);

// Screenshot staging (?shot=start|drive|chase|mission) — see shots.js.
if (SHOT) {
  const shotMode = stageShot(SHOT, { state, city, traffic, peds, police, combat, missions, tokens, player, hud, camera, scene, rng, startMission: (i) => missions.startMission(i) });
  if (shotMode === 'playing') {
    showOnly(null);
    mode = 'playing';
    document.getElementById('hud').style.display = 'block';
    hud.update(state);
  } else {
    showOnly('title');
  }
} else {
  showOnly('title');
}

// Debug handle for headless playtesting (harmless in normal play).
window.__game = {
  debug() {
    return {
      mode,
      camera: camera.position.toArray().map((v) => Math.round(v * 10) / 10),
      player: { x: Math.round(player.pos.x), z: Math.round(player.pos.z), heading: Math.round(player.heading * 100) / 100, inCar: player.inCar },
      car: player.car ? { x: Math.round(player.car.pos.x), z: Math.round(player.car.pos.z), heading: Math.round(player.car.heading * 100) / 100, speed: Math.round(player.car.speed * 10) / 10 } : null,
      cops: police.cars.map((c) => ({ x: Math.round(c.pos.x), z: Math.round(c.pos.z), speed: Math.round(c.speed) })),
      stars: police.stars,
      enemies: combat.enemies.length,
      objective: missions.objectiveText(),
    };
  },
};

animate();
