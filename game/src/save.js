// Sunset Bay — save and load. One JSON blob in localStorage: cash, health,
// mission progress, player position, tokens collected and the clock. The
// game also auto-saves after every mission. Nothing leaves the browser.
import { CONFIG } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      cash: state.player.cash,
      health: state.player.health,
      missionIndex: state.missions.missionIndex,
      x: state.player.pos.x,
      z: state.player.pos.z,
      tokens: state.tokens.collected,
      playSeconds: state.playSeconds,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(CONFIG.saveKey, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(CONFIG.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(CONFIG.saveKey); } catch { /* private mode */ }
}
