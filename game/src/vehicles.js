// Sunset Bay — vehicles. Builds every car from boxes (body, cabin, wheels,
// lights, taxi sign / police light bar), drives the arcade car physics the
// player uses, and runs the traffic AI: cars follow the road graph, keep
// their lane, brake for the car ahead and loop around the city forever.
import * as THREE from 'three';
import { CONFIG, CAR_TYPES } from './config.js';
import { collideCircle } from './city.js';

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14181c });
const hubGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.32, 8);
const hubMat = new THREE.MeshLambertMaterial({ color: 0xb8bec4 });

export function makeCarMesh(typeKey, colorOverride) {
  const type = CAR_TYPES[typeKey] || CAR_TYPES.sedan;
  const color = colorOverride ?? type.color;
  const g = new THREE.Group();
  g.name = `car-${typeKey}`;
  const L = type.length;
  const W = type.width;
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, 0.62, L), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, 0.55, L * 0.48), new THREE.MeshLambertMaterial({ color: 0x1a2027 }));
  cabin.position.set(0, 1.1, -L * 0.05);
  cabin.castShadow = true;
  g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.08, L * 0.46), bodyMat);
  roof.position.set(0, 1.4, -L * 0.05);
  g.add(roof);
  // Headlights / taillights.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), lightMat);
    hl.position.set(sx * (W / 2 - 0.3), 0.62, L / 2 + 0.01);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), tailMat);
    tl.position.set(sx * (W / 2 - 0.3), 0.62, -L / 2 - 0.01);
    g.add(tl);
  }
  // Wheels.
  const wheels = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(wheelGeo, wheelMat);
    tyre.rotation.z = Math.PI / 2;
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    w.add(tyre, hub);
    w.position.set(sx * (W / 2 - 0.05), 0.36, sz * (L / 2 - 0.75));
    w.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    g.add(w);
    wheels.push(w);
  }
  if (typeKey === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xffe94a }));
    sign.position.set(0, 1.55, -L * 0.05);
    g.add(sign);
  }
  if (typeKey === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    bar.position.set(0, 1.5, -L * 0.05);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.28, 1.52, -L * 0.05);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.42), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.set(0.28, 1.52, -L * 0.05);
    g.add(red, blue);
    g.userData.lightRed = red;
    g.userData.lightBlue = blue;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, 0.18, L * 0.7), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = 0.62;
    g.add(stripe);
  }
  g.userData.wheels = wheels;
  g.userData.type = type;
  return g;
}

// One drivable car: position, heading, speed and arcade physics.
export class Car {
  constructor(typeKey, x, z, heading, colorOverride) {
    this.typeKey = typeKey;
    this.type = CAR_TYPES[typeKey] || CAR_TYPES.sedan;
    this.mesh = makeCarMesh(typeKey, colorOverride);
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = heading;
  }

  // input: {throttle -1..1, steer -1..1}; dt seconds; colliders for walls.
  drive(input, dt, colliders) {
    const t = this.type;
    const accel = input.throttle > 0 ? t.accel * input.throttle : t.accel * 0.7 * input.throttle;
    this.speed += accel * dt;
    if (input.throttle === 0) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 6 * dt);
    this.speed -= this.speed * CONFIG.carDrag * dt * 0.4;
    const maxF = t.topSpeed;
    const maxR = -CONFIG.carReverseMax;
    this.speed = Math.max(maxR, Math.min(maxF, this.speed));
    if (Math.abs(this.speed) < 0.05 && input.throttle === 0) this.speed = 0;
    const steerTarget = input.steer * CONFIG.carSteer * Math.min(1, Math.abs(this.speed) / 8 + 0.25);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * CONFIG.carGrip);
    this.heading += this.steer * (this.speed / t.topSpeed) * dt * 1.6 * Math.sign(this.speed || 1);
    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    const res = collideCircle(colliders, nx, nz, 1.6);
    if (res.hit) {
      if (Math.abs(this.speed) > 8) this.crashed = true;
      this.speed *= 0.35;
    }
    this.pos.x = res.x;
    this.pos.z = res.z;
    // Keep cars inside the city + beach road, off the sea and docks.
    this.pos.x = Math.max(-CONFIG.span - 8, Math.min(CONFIG.span + 8, this.pos.x));
    this.pos.z = Math.max(-CONFIG.span - 8, Math.min(CONFIG.span + 44, this.pos.z));
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    for (const w of this.mesh.userData.wheels) w.rotation.x += this.speed * dt * 2;
  }
}

// Traffic: a fleet of AI cars circulating the road graph.
export class Traffic {
  constructor(scene, rng, nodes, edges, colliders) {
    this.scene = scene;
    this.rng = rng;
    this.nodes = nodes;
    this.edges = edges;
    this.colliders = colliders;
    this.cars = [];
    // Adjacency for route choices.
    this.adj = nodes.map(() => []);
    for (const e of edges) {
      this.adj[e.a].push(e.b);
      this.adj[e.b].push(e.a);
    }
    const keys = ['sedan', 'coupe', 'taxi', 'van', 'truck', 'muscle', 'sedan'];
    for (let i = 0; i < CONFIG.trafficCars; i++) {
      const key = keys[i % keys.length];
      const node = Math.floor(rng.next() * nodes.length);
      const car = new Car(key, nodes[node].x, nodes[node].z, rng.range(0, Math.PI * 2));
      car.isTraffic = true;
      car.targetNode = this.adj[node][Math.floor(rng.next() * this.adj[node].length)];
      car.cruise = rng.range(9, 14);
      car.wait = 0;
      this.cars.push(car);
      scene.add(car.mesh);
    }
  }

  // All traffic cars, including the player's parked ones, for collision checks.
  allCars() {
    return this.cars;
  }

  update(dt, playerCar, cops) {
    for (const car of this.cars) {
      if (car === playerCar) continue;
      if (car.parked) continue; // staged / parked cars stay put until stolen
      const target = this.nodes[car.targetNode];
      const dx = target.x - car.pos.x;
      const dz = target.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3) {
        const next = this.adj[car.targetNode];
        car.targetNode = next[Math.floor(this.rng.next() * next.length)];
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      // Brake for the car ahead.
      let blocked = false;
      for (const other of this.cars) {
        if (other === car) continue;
        const ox = other.pos.x - car.pos.x;
        const oz = other.pos.z - car.pos.z;
        const od = Math.hypot(ox, oz);
        if (od < 7 && od > 0.01) {
          const dot = (ox * Math.sin(car.heading) + oz * Math.cos(car.heading)) / od;
          if (dot > 0.7) { blocked = true; break; }
        }
      }
      if (playerCar) {
        const ox = playerCar.pos.x - car.pos.x;
        const oz = playerCar.pos.z - car.pos.z;
        const od = Math.hypot(ox, oz);
        if (od < 7 && od > 0.01) {
          const dot = (ox * Math.sin(car.heading) + oz * Math.cos(car.heading)) / od;
          if (dot > 0.7) blocked = true;
        }
      }
      const throttle = blocked ? 0 : 0.55;
      const steer = Math.max(-1, Math.min(1, dh * 1.6));
      car.drive({ throttle, steer }, dt, this.colliders);
      // Cap AI speed at cruise.
      if (car.speed > car.cruise) car.speed = car.cruise;
    }
  }

  // The nearest parked/traffic car to a point, within range, for stealing.
  nearestCar(x, z, range, exclude) {
    let best = null;
    let bestD = range;
    for (const car of this.cars) {
      if (car === exclude) continue;
      const d = Math.hypot(car.pos.x - x, car.pos.z - z);
      if (d < bestD) { best = car; bestD = d; }
    }
    return best;
  }

  // Park a fresh car of a type at a road spot (mission staging / respawns).
  spawnParked(typeKey, x, z, heading) {
    const car = new Car(typeKey, x, z, heading);
    car.isTraffic = true;
    car.parked = true; // stays put until the player steals it
    car.targetNode = 0;
    car.cruise = 11;
    this.cars.push(car);
    this.scene.add(car.mesh);
    return car;
  }

  remove(car) {
    this.scene.remove(car.mesh);
    this.cars = this.cars.filter((c) => c !== car);
  }
}
