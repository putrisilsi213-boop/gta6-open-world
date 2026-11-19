// Sunset Bay — screenshot staging. ?shot=<name>&seed=1 puts the game in a
// fixed, photogenic state so headless Chromium can capture the four required
// screenshots of the real game: the title screen, driving with the HUD and
// minimap, a police chase at 3 stars, and a mission shootout at the docks.
// The camera is snapped into place because headless rendering runs at low
// FPS and the chase camera's ease would still be travelling when the shot
// is taken. Nothing here is shown to the player in normal play.
import { roadCoord } from './city.js';

function snapChaseCam(camera, car) {
  const backX = -Math.sin(car.heading);
  const backZ = -Math.cos(car.heading);
  camera.position.set(car.pos.x + backX * 11, 4.6, car.pos.z + backZ * 11);
  camera.lookAt(car.pos.x, 1.6, car.pos.z);
}

function snapFootCam(camera, player) {
  camera.position.set(
    player.pos.x + Math.sin(player.camYaw) * 7.5,
    player.pos.y + 4.2,
    player.pos.z + Math.cos(player.camYaw) * 7.5,
  );
  camera.lookAt(player.pos.x, 1.7, player.pos.z);
}

export function stageShot(name, ctx) {
  const { state, city, traffic, police, combat, missions, player, hud, camera } = ctx;
  const places = city.places;

  if (name === 'start') {
    // Title screen over the city: the main loop's title branch orbits the
    // camera, so just leave the mode at 'title' (main.js handles that).
    return 'title';
  }

  if (name === 'drive') {
    // Rex in a Solaris GT on the main avenue, traffic around, minimap live.
    const car = traffic.spawnParked('sport', roadCoord(3), roadCoord(3), 0);
    car.parked = false;
    car.isTraffic = false;
    car.speed = 16;
    player.enterCar(car);
    player.pos.set(car.pos.x, 0, car.pos.z);
    snapChaseCam(camera, car);
    hud.toast('Sunset Bay — drive anywhere. Steal cars with E, lose the cops, run jobs.', 6000);
    missions.startMission(1); // "Hot Wheels" objective line shows on the HUD
    return 'playing';
  }

  if (name === 'chase') {
    // Three-star chase: SBPD interceptors routing in on Rex's coupe.
    const car = traffic.spawnParked('coupe', roadCoord(4), roadCoord(3), Math.PI / 2);
    car.parked = false;
    car.isTraffic = false;
    car.speed = 20;
    player.enterCar(car);
    player.pos.set(car.pos.x, 0, car.pos.z);
    snapChaseCam(camera, car);
    police.stars = 3;
    police.quietTimer = 0;
    for (let i = 0; i < 3; i++) police.spawnCopCar(player.pos);
    // Stage the pursuit for the shot: two interceptors ahead on the same
    // avenue (visible in the chase camera) and one closing from behind.
    const cops = police.cars;
    const placeCop = (cop, dx, dz, heading) => {
      if (!cop) return;
      cop.pos.set(car.pos.x + dx, 0, car.pos.z + dz);
      cop.heading = heading;
      cop.mesh.position.copy(cop.pos);
      cop.mesh.rotation.y = heading;
      cop.path = null;
    };
    placeCop(cops[0], 32, 0, -Math.PI / 2);
    placeCop(cops[1], -38, 4, Math.PI / 2);
    placeCop(cops[2], 55, 0, -Math.PI / 2);
    hud.toast('WANTED — 3 stars. Lose the SBPD!', 5000);
    return 'playing';
  }

  if (name === 'mission') {
    // Mission 3 shootout at the docks: gunmen ahead of Rex, beacon, objective.
    player.pos.set(places.docks.x + 16, 0, places.docks.z + 12);
    player.mesh.position.copy(player.pos);
    player.heading = -2.19; // face the dock containers and the gunmen
    player.camYaw = 0.95; // camera behind Rex (heading = camYaw + PI)
    snapFootCam(camera, player);
    missions.startMission(2);
    missions.stepIndex = 1;
    missions.beginStep(); // spawns the Harbor Kings gunmen at the docks
    hud.toast('Dockside Deal — stop the Harbor Kings gunmen.', 5000);
    return 'playing';
  }

  return 'playing';
}
