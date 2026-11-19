// Sunset Bay — pedestrians. Simple low-poly people who stroll the
// sidewalks, wait at corners, and run away screaming (in the game-logic
// sense: they flee) when they see a gun, a crash or a car mounting the
// pavement. Hitting one is a crime, so the wanted system reads their state.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { collideCircle, roadCoord } from './city.js';

const SHIRTS = [0xe85d75, 0x2f9e8f, 0xf2a007, 0x7b2fbe, 0x3f7fbf, 0xe8e0d0, 0x4e6e58, 0xc23b4e];
const SKINS = [0xf2c9a0, 0xd9a066, 0x8a5a3a, 0xf7e6c8, 0xb07a4a];
const PANTS = [0x2b2f36, 0x3f5a7a, 0x6a4a3a, 0x4e6e58];

export function makePedMesh(rng) {
  const g = new THREE.Group();
  g.name = 'pedestrian';
  const skin = rng.pick(SKINS);
  const shirt = rng.pick(SHIRTS);
  const pants = rng.pick(PANTS);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.3), new THREE.MeshLambertMaterial({ color: shirt }));
  body.position.y = 0.95;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.45;
  head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: rng.pick([0x1a1a1a, 0x4a2a1a, 0x8a8a8a, 0x2a1a0a]) }));
  hair.position.y = 1.47;
  g.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), new THREE.MeshLambertMaterial({ color: pants }));
  legL.position.set(-0.13, 0.3, 0);
  const legR = legL.clone();
  legR.position.x = 0.13;
  g.add(legL, legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.55, 0.15), new THREE.MeshLambertMaterial({ color: shirt }));
  armL.position.set(-0.33, 0.95, 0);
  const armR = armL.clone();
  armR.position.x = 0.33;
  g.add(armL, armR);
  g.userData.legL = legL;
  g.userData.legR = legR;
  g.userData.armL = armL;
  g.userData.armR = armR;
  return g;
}

export class Pedestrians {
  constructor(scene, rng, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.list = [];
    for (let i = 0; i < CONFIG.pedestrians; i++) {
      this.spawn(rng.range(-CONFIG.span, CONFIG.span), rng.range(-CONFIG.span, CONFIG.span));
    }
  }

  spawn(x, z) {
    const mesh = makePedMesh(this.rng);
    const ped = {
      mesh,
      pos: new THREE.Vector3(x, 0, z),
      heading: this.rng.range(0, Math.PI * 2),
      speed: this.rng.range(1.2, 2.2),
      state: 'walk', // walk | flee | down
      downTimer: 0,
      walkPhase: this.rng.range(0, 6),
      target: null,
    };
    ped.target = this.pickTarget(ped);
    mesh.position.copy(ped.pos);
    this.list.push(ped);
    this.scene.add(mesh);
    return ped;
  }

  // Sidewalk target: a point just off a road, so peds stay on pavements.
  pickTarget(ped) {
    const road = roadCoord(this.rng.int(0, CONFIG.blocks));
    const along = this.rng.range(-CONFIG.span, CONFIG.span);
    if (this.rng.chance(0.5)) return { x: road + CONFIG.roadWidth / 2 + 2.5, z: along };
    return { x: along, z: road + CONFIG.roadWidth / 2 + 2.5 };
  }

  scare(x, z, radius) {
    for (const ped of this.list) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
      if (d < radius) {
        ped.state = 'flee';
        ped.fleeFrom = { x, z };
        ped.fleeTimer = 3 + this.rng.next() * 2;
      }
    }
  }

  update(dt, playerPos, playerCar) {
    for (const ped of this.list) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        ped.mesh.rotation.x = Math.min(-Math.PI / 2, ped.mesh.rotation.x - dt * 4);
        if (ped.downTimer <= 0) {
          ped.state = 'walk';
          ped.mesh.rotation.x = 0;
          ped.pos.x += this.rng.range(-8, 8);
          ped.pos.z += this.rng.range(-8, 8);
          ped.target = this.pickTarget(ped);
        }
        continue;
      }
      let tx;
      let tz;
      let speed = ped.speed;
      if (ped.state === 'flee') {
        ped.fleeTimer -= dt;
        const dx = ped.pos.x - ped.fleeFrom.x;
        const dz = ped.pos.z - ped.fleeFrom.z;
        const d = Math.hypot(dx, dz) || 1;
        tx = ped.pos.x + (dx / d) * 20;
        tz = ped.pos.z + (dz / d) * 20;
        speed = 4.6;
        if (ped.fleeTimer <= 0) { ped.state = 'walk'; ped.target = this.pickTarget(ped); }
      } else {
        tx = ped.target.x;
        tz = ped.target.z;
        if (Math.hypot(tx - ped.pos.x, tz - ped.pos.z) < 2) ped.target = this.pickTarget(ped);
      }
      const dx = tx - ped.pos.x;
      const dz = tz - ped.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.05) {
        const want = Math.atan2(dx, dz);
        let dh = want - ped.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        ped.heading += Math.max(-3 * dt, Math.min(3 * dt, dh));
        const nx = ped.pos.x + Math.sin(ped.heading) * speed * dt;
        const nz = ped.pos.z + Math.cos(ped.heading) * speed * dt;
        const res = collideCircle(this.colliders, nx, nz, 0.4);
        ped.pos.x = res.x;
        ped.pos.z = res.z;
        ped.walkPhase += dt * speed * 3.2;
      }
      ped.mesh.position.copy(ped.pos);
      ped.mesh.rotation.y = ped.heading;
      const swing = Math.sin(ped.walkPhase) * 0.5;
      ped.mesh.userData.legL.rotation.x = swing;
      ped.mesh.userData.legR.rotation.x = -swing;
      ped.mesh.userData.armL.rotation.x = -swing * 0.8;
      ped.mesh.userData.armR.rotation.x = swing * 0.8;
      // Run over by a fast car: knocked down (a crime — the caller counts it).
      if (playerCar && Math.abs(playerCar.speed) > 6) {
        const d = Math.hypot(ped.pos.x - playerCar.pos.x, ped.pos.z - playerCar.pos.z);
        if (d < 1.7) {
          ped.state = 'down';
          ped.downTimer = 6;
          ped.hitByCar = true;
        }
      }
    }
  }

  // Nearest standing ped to a point (for combat targeting feedback).
  nearest(x, z, range) {
    let best = null;
    let bestD = range;
    for (const ped of this.list) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
      if (d < bestD) { best = ped; bestD = d; }
    }
    return best;
  }
}
