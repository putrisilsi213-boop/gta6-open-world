// Sunset Bay — the HUD: cash, health, wanted stars, objective line, speed,
// clock, toasts, damage flash and the minimap. The minimap is a top-down
// canvas of the whole city: roads, beach, the player arrow, the mission
// beacon, police, traffic and uncollected Bay Tokens.
import { CONFIG } from './config.js';
import { roadCoord } from './city.js';

export class HUD {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.cashEl = this.el('hud-cash');
    this.healthFill = this.el('hud-health-fill');
    this.healthText = this.el('hud-health-text');
    this.starsEl = this.el('hud-stars');
    this.objectiveEl = this.el('hud-objective');
    this.speedEl = this.el('hud-speed');
    this.clockEl = this.el('hud-clock');
    this.toastEl = this.el('hud-toast');
    this.bannerEl = this.el('hud-banner');
    this.vignette = this.el('hud-vignette');
    this.crosshair = this.el('hud-crosshair');
    this.carName = this.el('hud-carname');
    this.map = this.el('hud-minimap');
    this.mapCtx = this.map ? this.map.getContext('2d') : null;
    this.toastTimer = null;
    this.bannerTimer = null;
    this.lastCash = -1;
    this.lastStars = -1;
  }

  toast(text, ms = 3500) {
    if (!this.toastEl) return;
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  banner(text, ms = 2600) {
    if (!this.bannerEl) return;
    this.bannerEl.textContent = text;
    this.bannerEl.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.bannerEl.classList.remove('show'), ms);
  }

  flashDamage() {
    if (!this.vignette) return;
    this.vignette.classList.add('hurt');
    setTimeout(() => this.vignette.classList.remove('hurt'), 220);
  }

  setCrosshair(on) {
    if (this.crosshair) this.crosshair.style.display = on ? 'block' : 'none';
  }

  // Full state refresh, cheap enough to call every frame.
  update(state) {
    const p = state.player;
    if (this.cashEl && p.cash !== this.lastCash) {
      this.cashEl.textContent = `$${Math.floor(p.cash).toLocaleString('en-US')}`;
      this.lastCash = p.cash;
    }
    const hp = Math.max(0, Math.round(p.health));
    if (this.healthFill) this.healthFill.style.width = `${hp}%`;
    if (this.healthText) this.healthText.textContent = hp;
    const stars = state.police.stars;
    if (this.starsEl && stars !== this.lastStars) {
      this.starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(CONFIG.wantedMax - stars);
      this.starsEl.classList.toggle('hot', stars > 0);
      this.lastStars = stars;
    }
    if (this.objectiveEl) {
      const text = state.missions.objectiveText();
      if (this.objectiveEl.textContent !== text) this.objectiveEl.textContent = text;
    }
    if (this.clockEl) {
      const total = 15 * 60 + Math.floor(state.playSeconds / 4); // 4 real sec = 1 game min
      const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
      const mm = String(total % 60).padStart(2, '0');
      this.clockEl.textContent = `${hh}:${mm}`;
    }
    if (p.inCar && p.car) {
      if (this.speedEl) {
        this.speedEl.style.display = 'block';
        this.speedEl.textContent = `${Math.round(Math.abs(p.car.speed) * 3.6)} km/h`;
      }
      if (this.carName) this.carName.textContent = p.car.type.name;
    } else {
      if (this.speedEl) this.speedEl.style.display = 'none';
      if (this.carName) this.carName.textContent = '';
    }
    this.drawMinimap(state);
  }

  drawMinimap(state) {
    const ctx = this.mapCtx;
    if (!ctx) return;
    const S = 190;
    const span = CONFIG.span + 46;
    const toMap = (x, z) => [S / 2 + (x / span) * (S / 2 - 4), S / 2 + (z / span) * (S / 2 - 4)];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#10151c';
    ctx.fillRect(0, 0, S, S);
    // Beach + sea at the bottom.
    ctx.fillStyle = '#e8d29a';
    const [, beachY] = toMap(0, CONFIG.span + 4);
    ctx.fillRect(0, beachY, S, S - beachY);
    ctx.fillStyle = '#1e8fa8';
    ctx.fillRect(0, beachY + 14, S, S - beachY - 14);
    // Blocks.
    ctx.fillStyle = '#3a4150';
    const pitch = CONFIG.blockSize + CONFIG.roadWidth;
    for (let bx = 0; bx < CONFIG.blocks; bx++) {
      for (let bz = 0; bz < CONFIG.blocks; bz++) {
        const [x, z] = toMap(roadCoord(bx) + CONFIG.roadWidth / 2, roadCoord(bz) + CONFIG.roadWidth / 2);
        const w = (CONFIG.blockSize / span) * (S / 2 - 4);
        ctx.fillRect(x, z, w, w);
      }
    }
    // Roads.
    ctx.strokeStyle = '#6a7076';
    ctx.lineWidth = 2;
    for (let i = 0; i <= CONFIG.blocks; i++) {
      const [x] = toMap(roadCoord(i), 0);
      const [, z] = toMap(0, roadCoord(i));
      ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, S - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, z); ctx.lineTo(S - 4, z); ctx.stroke();
    }
    const dot = (x, z, color, r = 3) => {
      const [mx, mz] = toMap(x, z);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(mx, mz, r, 0, Math.PI * 2); ctx.fill();
    };
    // Tokens.
    for (const t of state.tokens.tokens) if (!t.taken) dot(t.pos.x, t.pos.z, '#ffd23c', 2.5);
    // Traffic.
    for (const c of state.traffic.cars) dot(c.pos.x, c.pos.z, '#ffffff', 2);
    // Enemies.
    for (const e of state.combat.enemies) dot(e.pos.x, e.pos.z, '#ff4444', 3);
    // Police.
    for (const c of state.police.cars) dot(c.pos.x, c.pos.z, '#4488ff', 3.5);
    for (const o of state.police.officers) dot(o.pos.x, o.pos.z, '#4488ff', 2.5);
    // Mission beacon.
    const mp = state.missions.markerPos();
    if (mp && state.missions.active) {
      const [mx, mz] = toMap(mp.x, mp.z);
      const pulse = 5 + Math.sin(performance.now() / 250) * 2;
      ctx.strokeStyle = '#ffd23c';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, mz, pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd23c';
      ctx.beginPath(); ctx.arc(mx, mz, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    const p = state.player;
    const [px, pz] = toMap(p.pos.x, p.pos.z);
    const heading = p.inCar && p.car ? p.car.heading : p.heading;
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.PI - heading);
    ctx.fillStyle = '#2fe673';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
