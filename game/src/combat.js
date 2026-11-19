// Sunset Bay — combat. Hitscan pistol fire with a tracer line and muzzle
// flash, enemy gunmen for the missions (Harbor Kings crew), and health
// pickups. Shooting is raycast against simple sphere targets; no physics
// engine is involved, which keeps the whole game dependency-free apart
// from three.js.
import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Combat {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.enemies = []; // mission gunmen {mesh,pos,heading,health,shootTimer,state}
    this.tracers = [];
    this.lastShot = 0;
    this.flash = null;
  }

  makeGunmanMesh(shirtColor) {
    const g = new THREE.Group();
    g.name = 'harbor-kings-gunman';
    const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.64, 0.3), shirt);
    body.position.y = 0.95;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
    head.position.y = 1.45;
    g.add(head);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0xc23b4e }));
    band.position.y = 1.56;
    g.add(band);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), new THREE.MeshLambertMaterial({ color: 0x2b2f36 }));
    legL.position.set(-0.13, 0.3, 0);
    const legR = legL.clone();
    legR.position.x = 0.13;
    g.add(legL, legR);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.15), shirt);
    arm.position.set(0.34, 0.95, 0.1);
    arm.rotation.x = -1.1;
    g.add(arm);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.42), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.34, 1.0, 0.35);
    g.add(gun);
    g.userData.legL = legL;
    g.userData.legR = legR;
    return g;
  }

  spawnEnemy(x, z, health = CONFIG.enemyHealth) {
    const mesh = this.makeGunmanMesh(0x3a3f45);
    const e = {
      mesh,
      pos: new THREE.Vector3(x, 0, z),
      heading: this.rng.range(0, Math.PI * 2),
      health,
      shootTimer: 0.8 + this.rng.next(),
      walkPhase: 0,
      state: 'fight',
    };
    mesh.position.copy(e.pos);
    this.enemies.push(e);
    this.scene.add(mesh);
    return e;
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  // Player fires from the camera: returns the hit target (enemy/officer/ped/car) or null.
  // origin/direction in world space; candidates are checked as spheres.
  shoot(origin, direction, targets, nowMs) {
    if (nowMs - this.lastShot < CONFIG.pistolFireMs) return 'rate';
    this.lastShot = nowMs;
    const end = origin.clone().addScaledVector(direction, CONFIG.pistolRange);
    let best = null;
    let bestT = CONFIG.pistolRange;
    for (const t of targets) {
      const to = t.pos.clone().sub(origin);
      const along = to.dot(direction);
      if (along < 0 || along > CONFIG.pistolRange) continue;
      const closest = origin.clone().addScaledVector(direction, along);
      const d = closest.distanceTo(new THREE.Vector3(t.pos.x, t.pos.y + 1.1, t.pos.z));
      if (d < 1.1 && along < bestT) { best = t; bestT = along; }
    }
    end.copy(origin).addScaledVector(direction, best ? bestT : CONFIG.pistolRange);
    this.spawnTracer(origin, end);
    if (best) {
      best.health -= CONFIG.pistolDamage;
      if (best.health <= 0) return { hit: best, killed: true };
      return { hit: best, killed: false };
    }
    return { hit: null, killed: false };
  }

  spawnTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.07 });
  }

  update(dt, playerPos, onEnemyShot) {
    // Fade tracers.
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }
    // Enemies: hold ground, strafe a little, shoot at the player.
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.health <= 0) {
        this.scene.remove(e.mesh);
        this.enemies.splice(i, 1);
        continue;
      }
      const dx = playerPos.x - e.pos.x;
      const dz = playerPos.z - e.pos.z;
      const dist = Math.hypot(dx, dz);
      e.heading = Math.atan2(dx, dz);
      e.mesh.rotation.y = e.heading;
      if (dist > 26) {
        e.pos.x += Math.sin(e.heading) * 3.4 * dt;
        e.pos.z += Math.cos(e.heading) * 3.4 * dt;
        e.walkPhase += dt * 10;
        const swing = Math.sin(e.walkPhase) * 0.5;
        e.mesh.userData.legL.rotation.x = swing;
        e.mesh.userData.legR.rotation.x = -swing;
      } else {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = 1.1 + this.rng.next() * 0.9;
          this.spawnTracer(new THREE.Vector3(e.pos.x, 1.2, e.pos.z), new THREE.Vector3(playerPos.x, 1.2, playerPos.z));
          onEnemyShot(e, dist);
        }
      }
      e.mesh.position.copy(e.pos);
    }
  }
}

// Health pickup: a floating green cross that heals on touch.
export class HealthPickup {
  constructor(scene, x, z) {
    this.scene = scene;
    this.pos = new THREE.Vector3(x, 0, z);
    this.taken = false;
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    const barV = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.1), new THREE.MeshBasicMaterial({ color: 0x2fae4e }));
    barV.position.z = 0.36;
    const barH = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0x2fae4e }));
    barH.position.z = 0.36;
    g.add(box, barV, barH);
    g.position.set(x, 1, z);
    this.mesh = g;
    scene.add(g);
  }

  update(dt, playerPos) {
    if (this.taken) return false;
    this.mesh.rotation.y += dt * 1.5;
    this.mesh.position.y = 1 + Math.sin(performance.now() / 400) * 0.15;
    if (Math.hypot(this.pos.x - playerPos.x, this.pos.z - playerPos.z) < 1.4) {
      this.taken = true;
      this.scene.remove(this.mesh);
      return true;
    }
    return false;
  }
}
