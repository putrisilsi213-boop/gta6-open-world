// Sunset Bay — the wanted system and the Sunset Bay Police Department.
// Stars rise with crimes and fall after quiet time. Police cars spawn at the
// city edge, chase the player and ram; at 3+ stars foot officers spawn and
// shoot. Getting caught on foot means BUSTED; the caller handles the fine
// and the respawn at the police station.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Car } from './vehicles.js';

export class Police {
  constructor(scene, rng, colliders, roadNodes, roadEdges) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = colliders;
    this.roadNodes = roadNodes;
    this.stars = 0;
    this.quietTimer = 0;
    this.cars = [];
    this.officers = [];
    this.bustTimer = 0;
    this.sirenOn = false;
    // Road-graph adjacency so cop cars can route to the player like traffic
    // instead of beelining through buildings and getting stuck on walls.
    this.adj = roadNodes.map(() => []);
    for (const e of roadEdges || []) {
      this.adj[e.a].push(e.b);
      this.adj[e.b].push(e.a);
    }
  }

  nearestNode(x, z) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < this.roadNodes.length; i++) {
      const d = (this.roadNodes[i].x - x) ** 2 + (this.roadNodes[i].z - z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  // Breadth-first route across the road graph, as a list of node indices.
  route(from, to) {
    if (from === to) return [to];
    const prev = new Array(this.roadNodes.length).fill(-1);
    const queue = [from];
    prev[from] = from;
    while (queue.length) {
      const cur = queue.shift();
      for (const nb of this.adj[cur]) {
        if (prev[nb] === -1) {
          prev[nb] = cur;
          if (nb === to) {
            const path = [to];
            let n = to;
            while (n !== from) { n = prev[n]; path.unshift(n); }
            return path;
          }
          queue.push(nb);
        }
      }
    }
    return [to];
  }

  wanted() {
    return this.stars;
  }

  addCrime(kind) {
    const add = CONFIG.crimeWanted[kind] || 1;
    const before = this.stars;
    this.stars = Math.min(CONFIG.wantedMax, this.stars + add);
    this.quietTimer = 0;
    if (this.stars > before) return true; // rose — caller plays the sting
    return false;
  }

  clear() {
    this.stars = 0;
    this.quietTimer = 0;
    this.bustTimer = 0;
    for (const c of this.cars) this.scene.remove(c.mesh);
    for (const o of this.officers) this.scene.remove(o.mesh);
    this.cars = [];
    this.officers = [];
  }

  copCarTarget() {
    // 1 star: 1 car, +1 car per star up to 4, 5 stars: 5 cars.
    return Math.min(5, Math.max(0, this.stars));
  }

  spawnCopCar(playerPos) {
    // Spawn at a road node far from the player so sirens arrive, not pop in.
    let best = null;
    let bestD = 60;
    for (const n of this.roadNodes) {
      const d = Math.hypot(n.x - playerPos.x, n.z - playerPos.z);
      if (d > bestD && d < 170) { best = n; bestD = d; }
    }
    const spot = best || this.roadNodes[Math.floor(this.rng.next() * this.roadNodes.length)];
    const car = new Car('police', spot.x, spot.z, this.rng.range(0, Math.PI * 2));
    car.isCop = true;
    car.ramCooldown = 0;
    this.cars.push(car);
    this.scene.add(car.mesh);
    return car;
  }

  spawnOfficer(playerPos) {
    const a = this.rng.range(0, Math.PI * 2);
    const x = playerPos.x + Math.cos(a) * 24;
    const z = playerPos.z + Math.sin(a) * 24;
    const mesh = this.makeOfficerMesh();
    const officer = {
      mesh,
      pos: new THREE.Vector3(x, 0, z),
      heading: a,
      health: CONFIG.copHealth,
      shootTimer: 1 + this.rng.next(),
      walkPhase: 0,
      state: 'chase',
    };
    mesh.position.copy(officer.pos);
    this.officers.push(officer);
    this.scene.add(mesh);
    return officer;
  }

  makeOfficerMesh() {
    const g = new THREE.Group();
    g.name = 'sbpd-officer';
    const navy = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.64, 0.3), navy);
    body.position.y = 0.95;
    body.castShadow = true;
    g.add(body);
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.3, 0.32), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    vest.position.y = 1.05;
    g.add(vest);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
    head.position.y = 1.45;
    g.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.1, 10), navy);
    cap.position.y = 1.6;
    g.add(cap);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), navy);
    legL.position.set(-0.13, 0.3, 0);
    const legR = legL.clone();
    legR.position.x = 0.13;
    g.add(legL, legR);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.15), navy);
    arm.position.set(0.34, 0.95, 0.1);
    arm.rotation.x = -1.1; // aiming forward
    g.add(arm);
    g.userData.legL = legL;
    g.userData.legR = legR;
    return g;
  }

  update(dt, player, onCrime) {
    // Wanted decay: quiet time drops one star at a time.
    if (this.stars > 0) {
      this.quietTimer += dt;
      if (this.quietTimer >= CONFIG.wantedDecaySeconds) {
        this.stars -= 1;
        this.quietTimer = 0;
      }
    }
    // Match the cop fleet to the wanted level.
    const want = this.copCarTarget();
    while (this.cars.length < want) this.spawnCopCar(player.pos);
    while (this.cars.length > want) {
      const c = this.cars.pop();
      this.scene.remove(c.mesh);
    }
    const wantOfficers = this.stars >= 3 ? Math.min(3, this.stars - 1) : 0;
    while (this.officers.length < wantOfficers) this.spawnOfficer(player.pos);
    while (this.officers.length > wantOfficers) {
      const o = this.officers.pop();
      this.scene.remove(o.mesh);
    }
    this.sirenOn = this.cars.length > 0;

    // Cop cars: route along the roads to the player, then ram. Re-route
    // every couple of seconds as the player moves between intersections.
    for (const car of this.cars) {
      car.ramCooldown = Math.max(0, (car.ramCooldown || 0) - dt);
      const dxP = player.pos.x - car.pos.x;
      const dzP = player.pos.z - car.pos.z;
      const dist = Math.hypot(dxP, dzP);
      car.repath = (car.repath || 0) - dt;
      const playerNode = this.nearestNode(player.pos.x, player.pos.z);
      if (!car.path || car.repath <= 0 || car.pathGoal !== playerNode) {
        car.path = this.route(this.nearestNode(car.pos.x, car.pos.z), playerNode);
        car.pathIdx = 0;
        car.pathGoal = playerNode;
        car.repath = 2;
      }
      let tx = player.pos.x;
      let tz = player.pos.z;
      if (dist > 18 && car.path && car.pathIdx < car.path.length) {
        const node = this.roadNodes[car.path[car.pathIdx]];
        if (Math.hypot(node.x - car.pos.x, node.z - car.pos.z) < 6) car.pathIdx += 1;
        const wp = this.roadNodes[car.path[Math.min(car.pathIdx, car.path.length - 1)]];
        tx = wp.x;
        tz = wp.z;
      }
      const dx = tx - car.pos.x;
      const dz = tz - car.pos.z;
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, dh * 1.8));
      const throttle = dist > 4 ? 1 : 0.4;
      car.drive({ throttle, steer }, dt, this.colliders);
      // Flash the light bar.
      const phase = Math.floor(performance.now() / 180) % 2;
      if (car.mesh.userData.lightRed) car.mesh.userData.lightRed.visible = phase === 0;
      if (car.mesh.userData.lightBlue) car.mesh.userData.lightBlue.visible = phase === 1;
      // Ram: shove the player's car, or bust the player on foot.
      if (dist < 3.4 && car.ramCooldown <= 0) {
        car.ramCooldown = 1.2;
        onCrime('ram', { dist, car });
      }
    }

    // Foot officers: close in and shoot with poor aim.
    for (const o of this.officers) {
      const dx = player.pos.x - o.pos.x;
      const dz = player.pos.z - o.pos.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - o.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      o.heading += Math.max(-4 * dt, Math.min(4 * dt, dh));
      if (dist > 14) {
        o.pos.x += Math.sin(o.heading) * 5.2 * dt;
        o.pos.z += Math.cos(o.heading) * 5.2 * dt;
        o.walkPhase += dt * 14;
      } else {
        o.shootTimer -= dt;
        if (o.shootTimer <= 0) {
          o.shootTimer = 0.9 + this.rng.next() * 0.7;
          onCrime('officerShot', { officer: o, dist });
        }
      }
      o.mesh.position.copy(o.pos);
      o.mesh.rotation.y = o.heading;
      const swing = Math.sin(o.walkPhase) * 0.5;
      o.mesh.userData.legL.rotation.x = swing;
      o.mesh.userData.legR.rotation.x = -swing;
    }

    // Busted: a cop car parked on the player on foot, or an officer adjacent.
    if (!player.inCar && this.stars > 0) {
      let near = false;
      for (const c of this.cars) {
        if (Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z) < 2.6 && Math.abs(c.speed) < 2) near = true;
      }
      for (const o of this.officers) {
        if (Math.hypot(o.pos.x - player.pos.x, o.pos.z - player.pos.z) < 2.2) near = true;
      }
      if (near) {
        this.bustTimer += dt;
        if (this.bustTimer > 1.6) {
          this.bustTimer = 0;
          onCrime('busted', {});
        }
      } else {
        this.bustTimer = 0;
      }
    }
  }
}
