// Sunset Bay — story and missions. Original story: Rex Marlowe, a former
// getaway driver, comes home to Sunset Bay owing the Harbor Kings crew, and
// works off the debt job by job for his sister Mia's garage. Five story
// missions, then free roam. Side work: 12 hidden Bay Tokens around the city
// and taxi fares while driving a Bay Cab.
import * as THREE from 'three';
import { CONFIG } from './config.js';

export const STORY_INTRO =
  'Rex Marlowe drove getaway cars for the Harbor Kings and quit. The crew ' +
  'did not quit him: he owes them $8,000, and his sister Mia\'s garage is ' +
  'the only collateral they will take. One job at a time, Rex buys his way out.';

export const MISSIONS = [
  {
    id: 'welcome-home',
    title: '1 — Welcome Home',
    briefing: 'Mia is waiting at the garage. Walk over and say hello, then meet her contact at the pier.',
    steps: [
      { type: 'goto', place: 'hideout', radius: 6, text: 'Go to Mia\'s garage' },
      { type: 'goto', place: 'pier', radius: 6, text: 'Meet the contact at the pier' },
    ],
  },
  {
    id: 'hot-wheels',
    title: '2 — Hot Wheels',
    briefing: 'A Solaris GT is parked by the market plaza. Take it — the crew does not ask — and bring it to the garage.',
    steps: [
      { type: 'steal', carType: 'sport', place: 'plaza', radius: 5, text: 'Steal the Solaris GT at the plaza' },
      { type: 'deliver', place: 'hideout', radius: 7, text: 'Deliver the Solaris GT to the garage', needCar: true },
    ],
  },
  {
    id: 'dockside-deal',
    title: '3 — Dockside Deal',
    briefing: 'The Kings are moving cargo at the docks and short a gun. Hold the containers while Mia talks. Expect trouble.',
    steps: [
      { type: 'goto', place: 'docks', radius: 8, text: 'Get to the docks' },
      { type: 'kill', count: 4, text: 'Deal with the Harbor Kings gunmen', spawnAt: 'docks' },
      { type: 'goto', place: 'hideout', radius: 6, text: 'Report back to the garage' },
    ],
  },
  {
    id: 'payback-run',
    title: '4 — Payback Run',
    briefing: 'The SBPD impounded Mia\'s tow truck. Lift the cash box from the bank steps — and lose the cops on the way to the beach.',
    steps: [
      { type: 'goto', place: 'bank', radius: 6, text: 'Grab the cash box at the bank' },
      { type: 'escape', place: 'beach', radius: 8, text: 'Lose the cops — reach the beach', wanted: 2 },
    ],
  },
  {
    id: 'big-score',
    title: '5 — The Big Score',
    briefing: 'The Kings\' vault run. Hold the bank steps against their crew, then run the money home with every cop in the Bay on you.',
    steps: [
      { type: 'goto', place: 'bank', radius: 7, text: 'Get to the bank steps' },
      { type: 'kill', count: 5, text: 'Hold the steps — stop the Kings crew', spawnAt: 'bank' },
      { type: 'escape', place: 'hideout', radius: 7, text: 'Bring the money home — wanted level 3', wanted: 3 },
    ],
  },
];

export class MissionManager {
  constructor(places, hooks) {
    this.places = places;
    this.hooks = hooks; // {spawnEnemy, spawnCar, setWanted, toast, reward, onStoryDone}
    this.missionIndex = 0;
    this.stepIndex = 0;
    this.active = false;
    this.kills = 0;
    this.killTarget = 0;
    this.stolenCar = null;
    this.startedAt = 0;
    this.marker = new THREE.Group();
    this.marker.visible = false;
    this.beacon = null;
    this.ring = null;
  }

  attachMarker(scene) {
    const geo = new THREE.CylinderGeometry(1.6, 1.6, 26, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.position.y = 13;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.22, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffd23c }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.4;
    this.ring = ring;
    this.marker.add(this.beacon, ring);
    scene.add(this.marker);
  }

  current() {
    return MISSIONS[this.missionIndex] || null;
  }

  currentStep() {
    const m = this.current();
    return m ? m.steps[this.stepIndex] : null;
  }

  objectiveText() {
    if (!this.active) return 'Free roam — press M for missions, or find work around the Bay.';
    const step = this.currentStep();
    const m = this.current();
    if (!step) return 'Mission complete.';
    let extra = '';
    if (step.type === 'kill') extra = ` (${this.kills}/${this.killTarget})`;
    return `${m.title}: ${step.text}${extra}`;
  }

  markerPos() {
    const step = this.currentStep();
    if (!this.active || !step) return null;
    if (step.type === 'kill') {
      const p = this.places[step.spawnAt] || this.places.bank;
      return { x: p.x, z: p.z };
    }
    const p = this.places[step.place];
    return p ? { x: p.x, z: p.z } : null;
  }

  startMission(index) {
    this.missionIndex = index;
    this.stepIndex = 0;
    this.kills = 0;
    this.active = true;
    this.startedAt = performance.now();
    const m = this.current();
    this.hooks.toast(`${m.title} — ${m.briefing}`, 7000);
    this.beginStep();
  }

  beginStep() {
    const step = this.currentStep();
    if (!step) { this.completeMission(); return; }
    if (step.type === 'steal') {
      const p = this.places[step.place];
      this.stolenCar = this.hooks.spawnCar(step.carType, p.x + 6, p.z + 4, Math.PI / 2);
    }
    if (step.type === 'kill') {
      this.kills = 0;
      this.killTarget = step.count;
      const p = this.places[step.spawnAt] || this.places.bank;
      for (let i = 0; i < step.count + 1; i++) {
        this.hooks.spawnEnemy(p.x + (i % 3 - 1) * 8, p.z + Math.floor(i / 3) * 8 - 6);
      }
      this.hooks.toast(`Harbor Kings gunmen incoming — ${step.count} to stop.`, 4000);
    }
    if (step.type === 'escape' && step.wanted) this.hooks.setWanted(step.wanted);
  }

  onKill() {
    const step = this.currentStep();
    if (!this.active || !step || step.type !== 'kill') return;
    this.kills += 1;
    if (this.kills >= this.killTarget) this.advance();
  }

  onEnterCar(car) {
    const step = this.currentStep();
    if (!this.active || !step) return;
    if (step.type === 'steal' && this.stolenCar && car === this.stolenCar) this.advance();
  }

  advance() {
    this.stepIndex += 1;
    const step = this.currentStep();
    if (!step) { this.completeMission(); return; }
    this.hooks.toast(step.text, 4000);
    this.beginStep();
  }

  completeMission() {
    const m = this.current();
    const reward = CONFIG.missionReward[this.missionIndex] || 1000;
    this.active = false;
    this.hooks.reward(reward, `${m.title} complete — +$${reward}`);
    this.hooks.missionDone();
    this.missionIndex += 1;
    this.stepIndex = 0;
    if (this.missionIndex >= MISSIONS.length) {
      this.hooks.onStoryDone();
    }
  }

  // Called every frame with the player's position and car state.
  update(playerPos, inCar, playerCar) {
    const mp = this.markerPos();
    if (mp && this.active) {
      this.marker.visible = true;
      this.marker.position.set(mp.x, 0, mp.z);
      this.beacon.rotation.y += 0.01;
      this.ring.scale.setScalar(1 + Math.sin(performance.now() / 300) * 0.12);
    } else {
      this.marker.visible = false;
    }
    if (!this.active) return;
    const step = this.currentStep();
    if (!step) return;
    const mp2 = this.markerPos();
    if (!mp2) return;
    const d = Math.hypot(playerPos.x - mp2.x, playerPos.z - mp2.z);
    if (step.type === 'goto' && d < step.radius) this.advance();
    if (step.type === 'deliver' && d < step.radius && (!step.needCar || inCar)) this.advance();
    if (step.type === 'escape' && d < step.radius) this.advance();
  }
}

// Bay Tokens: 12 glowing coins hidden around the city, worth $250 each.
export class TokenHunt {
  constructor(scene, rng, places, colliders) {
    this.scene = scene;
    this.tokens = [];
    const spots = [
      places.pier, places.park, places.plaza, places.docks, places.beach,
      { x: 0, z: 0 },
    ];
    for (let i = 0; i < 12; i++) {
      let x;
      let z;
      if (i < spots.length) { x = spots[i].x + rng.range(-8, 8); z = spots[i].z + rng.range(-8, 8); }
      else { x = rng.range(-CONFIG.span, CONFIG.span); z = rng.range(-CONFIG.span, CONFIG.span); }
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.7, 0.22, 10, 20),
        new THREE.MeshBasicMaterial({ color: 0xffd23c }),
      );
      mesh.position.set(x, 1.2, z);
      scene.add(mesh);
      this.tokens.push({ mesh, pos: new THREE.Vector3(x, 0, z), taken: false });
    }
    this.collected = 0;
  }

  update(dt, playerPos, onCollect) {
    for (const t of this.tokens) {
      if (t.taken) continue;
      t.mesh.rotation.y += dt * 2;
      t.mesh.position.y = 1.2 + Math.sin(performance.now() / 350 + t.pos.x) * 0.2;
      if (Math.hypot(t.pos.x - playerPos.x, t.pos.z - playerPos.z) < 1.8) {
        t.taken = true;
        this.scene.remove(t.mesh);
        this.collected += 1;
        onCollect(t);
      }
    }
  }
}
