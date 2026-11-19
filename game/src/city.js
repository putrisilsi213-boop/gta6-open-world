// Sunset Bay — the city itself. A procedural grid town: 7x7 blocks of
// pastel buildings around roads, a park, a beach and ocean on the south
// edge, and container docks on the west edge. Builds every mesh, the
// building colliders the player and cars bounce off, the road graph the
// traffic AI drives on, and the named places missions point at.
import * as THREE from 'three';
import { CONFIG, PALETTE } from './config.js';
import { buildingTexture, roadTexture, pavementTexture, sandTexture, grassTexture, seaTexture } from './textures.js';

// Road centre lines: grid lines at pitch intervals, offset so block 0 starts
// after the first road. roadCoord(i) is the centre of road i (0..blocks).
export function roadCoord(i) {
  const pitch = CONFIG.blockSize + CONFIG.roadWidth;
  return -CONFIG.span + CONFIG.roadWidth / 2 + i * pitch;
}

export function buildCity(scene, rng) {
  const colliders = []; // {minX,maxX,minZ,maxZ} building footprints
  const roadNodes = []; // intersections {x,z} for traffic AI
  const roadEdges = []; // {a,b} node indices along one road
  const places = {}; // named mission spots {x,z}
  const group = new THREE.Group();
  group.name = 'sunset-bay-city';
  scene.add(group);

  const span = CONFIG.span;
  const pitch = CONFIG.blockSize + CONFIG.roadWidth;

  // --- Ground: one big slab, roads drawn as textured strips on top. ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(span * 2 + 260, span * 2 + 260),
    new THREE.MeshLambertMaterial({ color: 0x8a8f8a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 40);
  ground.receiveShadow = true;
  group.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ map: roadTexture() });
  roadMat.map.wrapS = roadMat.map.wrapT = THREE.RepeatWrapping;
  const paveMat = new THREE.MeshLambertMaterial({ map: pavementTexture() });
  paveMat.map.wrapS = paveMat.map.wrapT = THREE.RepeatWrapping;

  // Road strips (vertical + horizontal) and their intersections as nodes.
  for (let i = 0; i <= CONFIG.blocks; i++) {
    const c = roadCoord(i);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.roadWidth, span * 2), roadMat.clone());
    v.material.map = roadTexture();
    v.material.map.repeat.set(1, (span * 2) / 16);
    v.rotation.x = -Math.PI / 2;
    v.position.set(c, 0, 0);
    v.receiveShadow = true;
    group.add(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(span * 2, CONFIG.roadWidth), roadMat.clone());
    h.material.map = roadTexture();
    h.material.map.repeat.set((span * 2) / 16, 1);
    h.rotation.x = -Math.PI / 2;
    h.position.set(0, 0.01, c);
    h.receiveShadow = true;
    group.add(h);
    for (let j = 0; j <= CONFIG.blocks; j++) {
      roadNodes.push({ x: c, z: roadCoord(j) });
    }
  }
  // Edges: neighbours along each road line.
  const n = CONFIG.blocks + 1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const id = i * n + j;
      if (j + 1 < n) roadEdges.push({ a: id, b: id + 1 });
      if (i + 1 < n) roadEdges.push({ a: id, b: id + n });
    }
  }

  // --- Blocks: buildings, or the park / plaza on two special blocks. ---
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.BoxGeometry(1, 0.6, 1);
  const parkBlock = { bx: 3, bz: 5 }; // central park, south-centre
  const plazaBlock = { bx: 5, bz: 1 }; // market plaza, north-east
  for (let bx = 0; bx < CONFIG.blocks; bx++) {
    for (let bz = 0; bz < CONFIG.blocks; bz++) {
      const cx = roadCoord(bx) + CONFIG.roadWidth / 2 + CONFIG.blockSize / 2;
      const cz = roadCoord(bz) + CONFIG.roadWidth / 2 + CONFIG.blockSize / 2;
      // Pavement slab for the whole block.
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.blockSize + 4, CONFIG.blockSize + 4), paveMat.clone());
      slab.material.map.repeat.set(3, 3);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(cx, 0.02, cz);
      slab.receiveShadow = true;
      group.add(slab);
      if (bx === parkBlock.bx && bz === parkBlock.bz) {
        buildPark(group, cx, cz, rng);
        continue;
      }
      if (bx === plazaBlock.bx && bz === plazaBlock.bz) {
        buildPlaza(group, cx, cz, rng);
        continue;
      }
      // 2x2 buildings per block with a gap between them.
      const sub = CONFIG.blockSize / 2 - 4;
      for (let sx = 0; sx < 2; sx++) {
        for (let sz = 0; sz < 2; sz++) {
          if (rng.chance(0.12)) continue; // occasional empty lot with palms
          const w = rng.range(16, sub);
          const d = rng.range(16, sub);
          const h = rng.range(9, 34) * (rng.chance(0.14) ? 1.9 : 1); // rare tower
          const x = cx - CONFIG.blockSize / 2 + 6 + sx * (CONFIG.blockSize / 2) + (sub - w) / 2;
          const z = cz - CONFIG.blockSize / 2 + 6 + sz * (CONFIG.blockSize / 2) + (sub - d) / 2;
          const base = rng.pick(PALETTE.building);
          const hex = `#${base.toString(16).padStart(6, '0')}`;
          const mat = new THREE.MeshLambertMaterial({ map: buildingTexture(hex, rng, Math.round(h / 4)) });
          const mesh = new THREE.Mesh(boxGeo, mat);
          mesh.scale.set(w, h, d);
          mesh.position.set(x + w / 2 - sub / 2 + (sub - w) / 2, h / 2, z + d / 2 - sub / 2 + (sub - d) / 2);
          // Recompute clean centre: building spans x..x+w, z..z+d.
          mesh.position.set(x + w / 2, h / 2, z + d / 2);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          group.add(mesh);
          const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: rng.pick(PALETTE.roof) }));
          roof.scale.set(w + 0.6, 1, d + 0.6);
          roof.position.set(x + w / 2, h + 0.3, z + d / 2);
          group.add(roof);
          // Rooftop box (AC unit / water tank) for silhouette variety.
          if (rng.chance(0.6)) {
            const unit = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x6a7076 }));
            unit.scale.set(rng.range(2, 4), 1.6, rng.range(2, 4));
            unit.position.set(x + w / 2 + rng.range(-4, 4), h + 1.1, z + d / 2 + rng.range(-4, 4));
            group.add(unit);
          }
          colliders.push({ minX: x, maxX: x + w, minZ: z, maxZ: z + d });
        }
      }
      // Palms on the block corners.
      for (let k = 0; k < 2; k++) {
        const px = cx + rng.range(-CONFIG.blockSize / 2 + 3, CONFIG.blockSize / 2 - 3);
        const pz = cz + rng.range(-CONFIG.blockSize / 2 + 3, CONFIG.blockSize / 2 - 3);
        group.add(makePalm(px, pz, rng));
      }
    }
  }

  // --- Beach + ocean on the south edge (+Z). ---
  const beachZ = span + 26;
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(span * 2 + 260, 52), new THREE.MeshLambertMaterial({ map: sandTexture() }));
  sand.material.map.wrapS = sand.material.map.wrapT = THREE.RepeatWrapping;
  sand.material.map.repeat.set(12, 2);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.03, beachZ);
  sand.receiveShadow = true;
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(span * 2 + 260, 320),
    new THREE.MeshLambertMaterial({ map: seaTexture() }),
  );
  sea.material.map.wrapS = sea.material.map.wrapT = THREE.RepeatWrapping;
  sea.material.map.repeat.set(10, 10);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, beachZ + 26 + 160);
  group.add(sea);
  // Boardwalk + beach umbrellas.
  for (let x = -span + 20; x < span; x += 42) {
    const um = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 6), new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
    pole.position.y = 1.5;
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 8), new THREE.MeshLambertMaterial({ color: [0xe85d75, 0x2f9e8f, 0xf2a007][Math.floor(rng.next() * 3)] }));
    top.position.y = 3.4;
    um.add(pole, top);
    um.position.set(x, 0, beachZ + rng.range(-6, 14));
    group.add(um);
  }
  // Pier reaching into the sea.
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 60), new THREE.MeshLambertMaterial({ color: 0x7a5a3a }));
  pier.position.set(60, 0.6, beachZ + 40);
  pier.castShadow = true;
  group.add(pier);

  // --- Docks on the west edge (-X): containers, cranes, warehouses. ---
  const dockX = -span - 26;
  const dockGround = new THREE.Mesh(new THREE.PlaneGeometry(52, span * 2), new THREE.MeshLambertMaterial({ color: 0x6a6f75 }));
  dockGround.rotation.x = -Math.PI / 2;
  dockGround.position.set(dockX, 0.02, 0);
  dockGround.receiveShadow = true;
  group.add(dockGround);
  const containerColors = [0xc23b4e, 0x2f7fbf, 0x4e8c4a, 0xf2a007, 0x7b2fbe];
  for (let i = 0; i < 26; i++) {
    const w = 6, h = 2.6, d = 2.6;
    const cx = dockX + rng.range(-20, 16);
    const cz = -span + 14 + (i % 13) * 40 + rng.range(-6, 6);
    const stacked = rng.chance(0.4);
    const c = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: rng.pick(containerColors) }));
    c.scale.set(w, h, d);
    c.position.set(cx, h / 2 + (stacked ? h : 0), cz);
    c.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
    c.castShadow = true;
    group.add(c);
    if (stacked) {
      const c2 = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: rng.pick(containerColors) }));
      c2.scale.set(w, h, d);
      c2.position.set(cx, h / 2, cz);
      c2.rotation.y = c.rotation.y;
      c2.castShadow = true;
      group.add(c2);
    }
    colliders.push({ minX: cx - 3.4, maxX: cx + 3.4, minZ: cz - 3.4, maxZ: cz + 3.4 });
  }
  // Two gantry cranes.
  for (const cz of [-120, 90]) {
    const crane = new THREE.Group();
    const legMat = new THREE.MeshLambertMaterial({ color: 0xd8a020 });
    for (const dx of [-7, 7]) {
      const leg = new THREE.Mesh(boxGeo, legMat);
      leg.scale.set(1.4, 26, 1.4);
      leg.position.set(dx, 13, 0);
      crane.add(leg);
    }
    const beam = new THREE.Mesh(boxGeo, legMat);
    beam.scale.set(18, 1.6, 2);
    beam.position.set(0, 26, 0);
    crane.add(beam);
    const arm = new THREE.Mesh(boxGeo, legMat);
    arm.scale.set(30, 1.2, 1.2);
    arm.position.set(12, 27.5, 0);
    crane.add(arm);
    crane.position.set(dockX + 6, 0, cz);
    crane.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    group.add(crane);
  }

  // --- Street lamps along every road, palms along the beach road. ---
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i <= CONFIG.blocks; i++) {
    for (let j = 0; j < CONFIG.blocks; j++) {
      const x = roadCoord(i);
      const z = roadCoord(j) + pitch / 2;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6), lampMat);
      pole.position.set(x + CONFIG.roadWidth / 2 + 0.6, 3, z);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lampGlow);
      bulb.position.set(x + CONFIG.roadWidth / 2 + 0.6, 6.1, z);
      group.add(bulb);
    }
  }
  for (let x = -span + 10; x < span; x += 26) group.add(makePalm(x, span + 6, rng));

  // --- Sky: gradient dome + sun disc + a few flat clouds. ---
  const skyGeo = new THREE.SphereGeometry(900, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 horizon; void main(){ float t = clamp(normalize(vP).y * 1.6 + 0.12, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, t), 1.0); }',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = 'sky-dome';
  scene.add(sky);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(34, 24), new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }));
  sun.position.set(-420, 320, -620);
  sun.lookAt(0, 0, 0);
  scene.add(sun);
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.range(8, 16), 8, 6), cloudMat);
      puff.scale.y = 0.45;
      puff.position.set(k * 12 - 12 + rng.range(-3, 3), rng.range(-1, 1), rng.range(-4, 4));
      cloud.add(puff);
    }
    cloud.position.set(rng.range(-500, 500), rng.range(120, 190), rng.range(-500, 300));
    scene.add(cloud);
  }

  // --- Named places missions and the HUD point at. ---
  places.hideout = { x: roadCoord(1), z: roadCoord(1) }; // Rex's garage, NW
  places.docks = { x: dockX + 8, z: -60 };
  places.beach = { x: 60, z: beachZ + 8 };
  places.park = { x: roadCoord(3) + CONFIG.roadWidth / 2 + CONFIG.blockSize / 2, z: roadCoord(5) + CONFIG.roadWidth / 2 + CONFIG.blockSize / 2 };
  places.plaza = { x: roadCoord(5) + CONFIG.roadWidth / 2 + CONFIG.blockSize / 2, z: roadCoord(1) + CONFIG.roadWidth / 2 + CONFIG.blockSize / 2 };
  places.bank = { x: roadCoord(4), z: roadCoord(3) };
  places.pier = { x: 60, z: beachZ + 62 };
  places.hospital = { x: roadCoord(6), z: roadCoord(6) };

  return { colliders, roadNodes, roadEdges, places, group, beachZ, dockX, sea };
}

function buildPark(group, cx, cz, rng) {
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.blockSize + 4, CONFIG.blockSize + 4), new THREE.MeshLambertMaterial({ map: grassTexture() }));
  grass.material.map.wrapS = grass.material.map.wrapT = THREE.RepeatWrapping;
  grass.material.map.repeat.set(4, 4);
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(cx, 0.04, cz);
  grass.receiveShadow = true;
  group.add(grass);
  // Pond.
  const pond = new THREE.Mesh(new THREE.CircleGeometry(9, 20), new THREE.MeshLambertMaterial({ color: 0x2f8fc4 }));
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(cx - 10, 0.06, cz + 6);
  group.add(pond);
  for (let i = 0; i < 7; i++) {
    group.add(makePalm(cx + rng.range(-24, 24), cz + rng.range(-24, 24), rng));
  }
  // Bandstand.
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.8, 10), new THREE.MeshLambertMaterial({ color: 0xd8cfc0 }));
  stand.position.set(cx + 12, 0.4, cz - 10);
  group.add(stand);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(7.5, 3, 10), new THREE.MeshLambertMaterial({ color: 0xc25a4a }));
  roof.position.set(cx + 12, 4.4, cz - 10);
  group.add(roof);
}

function buildPlaza(group, cx, cz, rng) {
  // Market plaza: stalls with striped awnings around a fountain.
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.6, 1.2, 12), new THREE.MeshLambertMaterial({ color: 0x9ec7e8 }));
  fountain.position.set(cx, 0.6, cz);
  group.add(fountain);
  const water = new THREE.Mesh(new THREE.CircleGeometry(4.4, 12), new THREE.MeshLambertMaterial({ color: 0x2f8fc4 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(cx, 1.25, cz);
  group.add(water);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const sx = cx + Math.cos(a) * 18;
    const sz = cz + Math.sin(a) * 18;
    const stall = new THREE.Group();
    const counter = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 2), new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
    counter.position.y = 0.6;
    const awn = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.3, 3), new THREE.MeshLambertMaterial({ color: [0xe85d75, 0x2f9e8f, 0xf2a007][i % 3] }));
    awn.position.y = 2.6;
    stall.add(counter, awn);
    stall.position.set(sx, 0, sz);
    stall.rotation.y = -a + Math.PI / 2;
    group.add(stall);
  }
}

export function makePalm(x, z, rng) {
  const palm = new THREE.Group();
  const h = rng ? rng.range(4.5, 7) : 6;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, h, 6), new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk }));
  trunk.position.y = h / 2;
  trunk.rotation.z = 0.08;
  palm.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.7), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.2, h + 0.1, Math.sin(a) * 1.2);
    leaf.rotation.set(Math.sin(a) * 0.9, -a, Math.cos(a) * 0.9 - 0.5);
    palm.add(leaf);
  }
  palm.position.set(x, 0, z);
  palm.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return palm;
}

// Circle (player / car / ped) vs building AABBs: push out and report hit.
export function collideCircle(colliders, x, z, radius) {
  let hit = false;
  for (const c of colliders) {
    if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) {
      const dxl = x + radius - c.minX;
      const dxr = c.maxX - (x - radius);
      const dzl = z + radius - c.minZ;
      const dzr = c.maxZ - (z - radius);
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) x = c.minX - radius;
      else if (m === dxr) x = c.maxX + radius;
      else if (m === dzl) z = c.minZ - radius;
      else z = c.maxZ + radius;
      hit = true;
    }
  }
  return { x, z, hit };
}

// Is a point on a road (within the road half-width of a grid line)?
export function onRoad(x, z) {
  const pitch = CONFIG.blockSize + CONFIG.roadWidth;
  const rel = (v) => {
    const m = ((v + CONFIG.span) % pitch + pitch) % pitch;
    return m < CONFIG.roadWidth || m > pitch - 0.001;
  };
  return rel(x) || rel(z);
}
