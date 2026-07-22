import * as THREE from 'three';

// Canvas-generated textures: number tokens and dice pips. No external assets.

const tokenCache = new Map<string, THREE.CanvasTexture>();

export function tokenTexture(n: number): THREE.CanvasTexture {
  const key = `t${n}`;
  const hit = tokenCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);
  // cream disc
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fillStyle = '#f3e6c4';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#b09a6a';
  ctx.stroke();
  const hot = n === 6 || n === 8;
  ctx.fillStyle = hot ? '#c53030' : '#2d2417';
  ctx.font = 'bold 52px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), 64, 58);
  // probability pips
  const weight: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
  const pips = weight[n] ?? 0;
  ctx.fillStyle = hot ? '#c53030' : '#2d2417';
  for (let i = 0; i < pips; i++) {
    ctx.beginPath();
    ctx.arc(64 + (i - (pips - 1) / 2) * 12, 96, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tokenCache.set(key, tex);
  return tex;
}

const diceCache = new Map<number, THREE.CanvasTexture>();

export function diceFaceTexture(v: number): THREE.CanvasTexture {
  const hit = diceCache.get(v);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fdf8ec';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#d8cdb2';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 120, 120);
  ctx.fillStyle = '#20242e';
  const P: Record<number, [number, number][]> = {
    1: [[64, 64]],
    2: [[38, 38], [90, 90]],
    3: [[34, 34], [64, 64], [94, 94]],
    4: [[38, 38], [90, 38], [38, 90], [90, 90]],
    5: [[36, 36], [92, 36], [64, 64], [36, 92], [92, 92]],
    6: [[38, 32], [90, 32], [38, 64], [90, 64], [38, 96], [90, 96]],
  };
  for (const [x, y] of P[v]) {
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  diceCache.set(v, tex);
  return tex;
}
