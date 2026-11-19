// Sunset Bay — Rex Marlowe on foot, and the camera that follows him.
// Third-person: the mouse orbits the camera around Rex, WASD moves relative
// to the camera, Shift runs, Space jumps. In a car the camera chases behind
// the car instead. Rex is a simple box-built character in a teal jacket.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { collideCircle } from './city.js';

export function makeRexMesh() {
  const g = new THREE.Group();
  g.name = 'rex-marlowe';
  const teal = new THREE.MeshLambertMaterial({ color: 0x2f9e8f });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const denim = new THREE.MeshLambertMaterial({ color: 0x3f5a7a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.64, 0.32), teal);
  body.position.y = 0.96;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skin);
  head.position.y = 1.48;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.12, 12), new THREE.MeshLambertMaterial({ color: 0xc23b4e }));
  cap.position.y = 1.62;
  g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.62, 0.2), denim);
  legL.position.set(-0.14, 0.31, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legL, legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.16), teal);
  armL.position.set(-0.35, 0.96, 0);
  const armR = armL.clone();
  armR.position.x = 0.35;
  g.add(armL, armR);
  // Pistol in the right hand, visible when armed.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.4), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.35, 0.78, 0.2);
  g.add(gun);
  g.userData.legL = legL;
  g.userData.legR = legR;
  g.userData.armL = armL;
  g.userData.armR = armR;
  return g;
}

export class Player {
  constructor(scene, x, z) {
    this.mesh = makeRexMesh();
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(x, 0, z);
    this.velY = 0;
    this.grounded = true;
    this.heading = Math.PI;
    this.health = CONFIG.playerHealth;
    this.cash = CONFIG.startCash;
    this.inCar = false;
    this.car = null;
    this.walkPhase = 0;
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.camDist = 7.5;
    this.armed = true;
    this.mesh.position.copy(this.pos);
  }

  // On-foot movement, camera-relative. Returns distance moved (for audio).
  updateOnFoot(dt, input, colliders) {
    const mv = input.moveVector();
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = run ? CONFIG.runSpeed : CONFIG.walkSpeed;
    let moved = 0;
    if (mv.active) {
      // Camera yaw defines "forward": the camera sits at P + (sin Y, cos Y)
      // and looks back at Rex, so screen-forward is (-sin Y, -cos Y) and
      // screen-right is (cos Y, -sin Y). WASD moves in that frame.
      const sin = Math.sin(this.camYaw);
      const cos = Math.cos(this.camYaw);
      const wx = mv.x * cos - mv.z * sin;
      const wz = -mv.x * sin - mv.z * cos;
      const targetHeading = Math.atan2(wx, wz);
      let dh = targetHeading - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.heading += Math.max(-10 * dt, Math.min(10 * dt, dh));
      const nx = this.pos.x + wx * speed * dt;
      const nz = this.pos.z + wz * speed * dt;
      const res = collideCircle(colliders, nx, nz, CONFIG.playerRadius);
      moved = Math.hypot(res.x - this.pos.x, res.z - this.pos.z);
      this.pos.x = res.x;
      this.pos.z = res.z;
      this.walkPhase += dt * speed * 2.4;
    }
    // Jump + gravity.
    if (input.wasPressed('Space') && this.grounded) {
      this.velY = CONFIG.jumpSpeed;
      this.grounded = false;
    }
    this.velY -= CONFIG.gravity * dt;
    this.pos.y += this.velY * dt;
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.velY = 0;
      this.grounded = true;
    }
    this.pos.x = Math.max(-CONFIG.span - 30, Math.min(CONFIG.span + 30, this.pos.x));
    this.pos.z = Math.max(-CONFIG.span - 30, Math.min(CONFIG.span + 46, this.pos.z));
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    const swing = Math.sin(this.walkPhase) * (mv.active ? 0.6 : 0);
    this.mesh.userData.legL.rotation.x = swing;
    this.mesh.userData.legR.rotation.x = -swing;
    this.mesh.userData.armL.rotation.x = -swing * 0.7;
    this.mesh.userData.armR.rotation.x = swing * 0.7;
    // Aim the right arm forward while the mouse button is held.
    if (input.mouseDown) this.mesh.userData.armR.rotation.x = -1.2;
    return moved;
  }

  enterCar(car) {
    this.inCar = true;
    this.car = car;
    this.mesh.visible = false;
  }

  exitCar() {
    if (!this.car) return;
    this.inCar = false;
    const side = this.car.pos.clone();
    side.x += Math.cos(this.car.heading) * 2.2;
    side.z -= Math.sin(this.car.heading) * 2.2;
    this.pos.set(side.x, 0, side.z);
    this.mesh.position.copy(this.pos);
    this.mesh.visible = true;
    this.car = null;
  }

  // Camera: orbit on foot, chase behind the car when driving. The camera
  // never goes under the ground and eases toward its target.
  updateCamera(dt, camera, input) {
    const mouse = input.consumeMouse();
    this.camYaw -= mouse.dx * 0.0032;
    this.camPitch = Math.max(-0.15, Math.min(1.1, this.camPitch + mouse.dy * 0.0028));
    let target;
    let ideal;
    if (this.inCar && this.car) {
      const c = this.car;
      const back = new THREE.Vector3(-Math.sin(c.heading), 0, -Math.cos(c.heading));
      const speedFactor = Math.min(1, Math.abs(c.speed) / 30);
      target = new THREE.Vector3(c.pos.x, 1.6, c.pos.z);
      ideal = new THREE.Vector3(
        c.pos.x + back.x * (8.5 + speedFactor * 3.5),
        3.6 + speedFactor * 1.2,
        c.pos.z + back.z * (8.5 + speedFactor * 3.5),
      );
      camera.position.lerp(ideal, Math.min(1, dt * 5));
      camera.lookAt(target.x, target.y, target.z);
      return;
    }
    target = new THREE.Vector3(this.pos.x, 1.7, this.pos.z);
    const cx = this.pos.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    const cz = this.pos.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    const cy = this.pos.y + 1.7 + Math.sin(this.camPitch) * this.camDist;
    ideal = new THREE.Vector3(cx, Math.max(0.8, cy), cz);
    camera.position.lerp(ideal, Math.min(1, dt * 10));
    camera.lookAt(target.x, target.y, target.z);
  }

  // Where a bullet starts and which way it flies (from the camera centre).
  aimRay(camera) {
    const origin = camera.position.clone();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return { origin, dir };
  }
}
