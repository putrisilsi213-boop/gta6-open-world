// Sunset Bay — procedural canvas textures. Every texture in the game is
// painted here at load time on an offscreen canvas: building facades with
// lit windows, road asphalt with lane dashes, sand, grass and the ocean.
// No image files ship with the game and nothing is downloaded.
import * as THREE from 'three';

function canvasTexture(width, height, painter) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  painter(canvas.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// A building facade: flat wall colour, a grid of windows (some lit warm),
// a darker ground floor with a door and an awning stripe.
export function buildingTexture(baseColor, rng, floors) {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, h - 34, w, 34);
    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(w / 2 - 10, h - 30, 20, 30);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(0, h - 40, w, 4);
    const rows = Math.max(3, floors);
    const cols = 4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = rng.chance(0.28);
        ctx.fillStyle = lit ? '#ffd98a' : '#20262e';
        const x = 10 + c * 28;
        const y = 14 + r * ((h - 60) / rows);
        ctx.fillRect(x, y, 18, 20);
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillRect(x, y, 18, 3);
      }
    }
  });
}

// Road surface: dark asphalt, edge lines and a centre dashed line.
export function roadTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.04})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.fillStyle = '#f2d13c';
    ctx.fillRect(w / 2 - 2, 0, 4, 40);
    ctx.fillRect(w / 2 - 2, 64, 4, 40);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(4, 0, 3, h);
    ctx.fillRect(w - 7, 0, 3, h);
  });
}

// Sidewalk / plaza paving: light concrete slabs.
export function pavementTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#9aa0a3';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 32); ctx.lineTo(w, i * 32); ctx.stroke();
    }
  });
}

// Beach sand with speckles.
export function sandTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(120,90,40,${0.05 + Math.random() * 0.12})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

// Park grass with blades.
export function grassTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#4f9e57';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = `rgba(20,80,30,${0.08 + Math.random() * 0.15})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 4);
    }
  });
}

// Ocean: deep teal with soft moving-looking streaks (static, the mesh bobs).
export function seaTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#1e8fa8';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.1})`;
      ctx.lineWidth = 2 + Math.random() * 3;
      ctx.beginPath();
      const y = Math.random() * h;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y + 8, w * 0.7, y - 8, w, y);
      ctx.stroke();
    }
  });
}

// A soft round sprite (glow for markers, headlights, muzzle flash).
export function glowTexture() {
  return canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}
