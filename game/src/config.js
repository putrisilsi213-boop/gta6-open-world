// Sunset Bay — shared tuning constants for the whole game.
// One place for every number the other modules read: city size, physics,
// wanted levels, economy and mission tuning. Nothing here names, copies or
// references any commercial game; every value is our own design.
export const CONFIG = {
  // City: a grid of square blocks separated by roads. The beach and the
  // ocean sit on the +Z (south) edge; the docks sit on the -X (west) edge.
  blocks: 7, // blocks per side
  blockSize: 56, // metres of buildings per block
  roadWidth: 16, // metres of road between blocks
  sidewalk: 3, // pavement strip around each block
  // Derived: half the city span, used for clamping and the minimap.
  get span() {
    return (this.blocks * this.blockSize + (this.blocks + 1) * this.roadWidth) / 2;
  },
  // Player on foot.
  walkSpeed: 6,
  runSpeed: 10.5,
  jumpSpeed: 8.5,
  gravity: 22,
  playerRadius: 0.55,
  playerHealth: 100,
  // Driving (arcade, metres / seconds).
  carAccel: 16,
  carBrake: 30,
  carReverseMax: 10,
  carDrag: 0.55,
  carSteer: 1.9,
  carGrip: 6.5,
  // Wanted system.
  wantedMax: 5,
  wantedDecaySeconds: 18, // quiet seconds before one star drops
  crimeWanted: { stealCar: 1, hitPedestrian: 1, shoot: 1, killPedestrian: 2, killCop: 2 },
  // Economy (Bay Dollars, $).
  startCash: 250,
  missionReward: [600, 900, 1200, 1500, 2500],
  tokenReward: 250,
  fareReward: 180,
  bustedFine: 150,
  wastedFine: 200,
  // Traffic and crowds.
  trafficCars: 14,
  pedestrians: 26,
  // Combat.
  pistolDamage: 34,
  pistolRange: 70,
  pistolFireMs: 240,
  enemyHealth: 70,
  copHealth: 60,
  // World life.
  dayLengthSeconds: 360, // full sun cycle; the game starts mid-afternoon
  saveKey: 'sunset-bay-save-v1',
};

// Original vehicle roster for Sunset Bay. Colours are paint, stats are ours.
export const CAR_TYPES = {
  sedan: { name: 'Coral Sedan', topSpeed: 27, accel: 15, color: 0x3f7fbf, length: 4.4, width: 1.9 },
  coupe: { name: 'Marlin Coupe', topSpeed: 30, accel: 17, color: 0xc23b4e, length: 4.2, width: 1.85 },
  sport: { name: 'Solaris GT', topSpeed: 36, accel: 20, color: 0xf2a007, length: 4.3, width: 1.9 },
  taxi: { name: 'Bay Cab', topSpeed: 28, accel: 16, color: 0xf5c518, length: 4.4, width: 1.9 },
  van: { name: 'Harbor Van', topSpeed: 23, accel: 12, color: 0x7a8a99, length: 5.0, width: 2.0 },
  truck: { name: 'Dock Hauler', topSpeed: 24, accel: 13, color: 0x4e6e58, length: 5.4, width: 2.1 },
  police: { name: 'SBPD Interceptor', topSpeed: 33, accel: 19, color: 0x1c2733, length: 4.4, width: 1.95 },
  muscle: { name: 'Comet Muscle', topSpeed: 32, accel: 18, color: 0x7b2fbe, length: 4.5, width: 1.95 },
};

// Original Sunset Bay palette: sun-soaked pastel walls, teal sea, coral roofs.
export const PALETTE = {
  skyTop: 0x2f7fc4,
  skyHorizon: 0xffd9a0,
  sun: 0xfff2c0,
  sea: 0x1e8fa8,
  sand: 0xe8d29a,
  road: 0x2b2f36,
  roadLine: 0xf2d13c,
  sidewalk: 0x9aa0a3,
  grass: 0x4f9e57,
  building: [0xf2c9a0, 0xf7e6c8, 0xa8d8d0, 0xf2a594, 0xd9c2e8, 0xbfe3a8, 0x9ec7e8, 0xe8e0d0],
  roof: [0xc25a4a, 0x4a7a8c, 0x7a6a8c, 0x5a8c6a],
  palmTrunk: 0x8a6a4a,
  palmLeaf: 0x3f9e4d,
};
