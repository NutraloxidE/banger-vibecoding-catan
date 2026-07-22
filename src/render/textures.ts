import * as THREE from "three";

// Canvas-generated textures so we never depend on external fonts or images.

const numberCache = new Map<number, THREE.CanvasTexture>();

export function numberTokenTexture(n: number): THREE.CanvasTexture {
  const cached = numberCache.get(n);
  if (cached) return cached;
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  // parchment disc
  ctx.fillStyle = "#f4e7c3";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#b79a5e";
  ctx.stroke();
  const red = n === 6 || n === 8;
  ctx.fillStyle = red ? "#c0392b" : "#333";
  ctx.font = `bold ${n >= 10 ? 60 : 72}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), size / 2, size / 2 - 6);
  // probability pips
  const dots = 6 - Math.abs(7 - n);
  ctx.fillStyle = red ? "#c0392b" : "#555";
  const dotY = size / 2 + 34;
  const spacing = 12;
  const startX = size / 2 - ((dots - 1) * spacing) / 2;
  for (let i = 0; i < dots; i++) {
    ctx.beginPath();
    ctx.arc(startX + i * spacing, dotY, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  numberCache.set(n, tex);
  return tex;
}

let portTex: THREE.CanvasTexture | null = null;
export function portTexture(): THREE.CanvasTexture {
  if (portTex) return portTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "bold 40px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("⚓", 32, 34);
  portTex = new THREE.CanvasTexture(c);
  return portTex;
}
