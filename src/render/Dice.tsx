import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useStore } from "../store/store";
import { audio } from "../fx/audio";

function pipTexture(n: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#faf7f0";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#222";
  const dot = (x: number, y: number) => {
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  };
  const L = 16, M = 32, R = 48;
  const layouts: Record<number, [number, number][]> = {
    1: [[M, M]],
    2: [[L, L], [R, R]],
    3: [[L, L], [M, M], [R, R]],
    4: [[L, L], [R, L], [L, R], [R, R]],
    5: [[L, L], [R, L], [M, M], [L, R], [R, R]],
    6: [[L, L], [R, L], [L, M], [R, M], [L, R], [R, R]],
  };
  (layouts[n] || []).forEach(([x, y]) => dot(x, y));
  return new THREE.CanvasTexture(c);
}

function pipTextures(): THREE.CanvasTexture[] {
  return [1, 2, 3, 4, 5, 6].map(pipTexture);
}

// Rotation that shows a given value on the +Y face.
const FACE_UP: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [0, 0, Math.PI / 2],
  3: [Math.PI / 2, 0, 0],
  4: [-Math.PI / 2, 0, 0],
  5: [0, 0, -Math.PI / 2],
  6: [Math.PI, 0, 0],
};

// three box face order: +x,-x,+y,-y,+z,-z. We want +y to display the value,
// so map material by desired orientation. We build one die material set with
// faces 1..6 and rotate the die to bring the right face up.
function Die({ value, offset, nonce, delay }: { value: number; offset: number; nonce: number; delay: number }) {
  const ref = useRef<THREE.Group>(null);
  const materials = useMemo(() => {
    const tex = pipTextures();
    // face order maps so opposite faces sum to 7 (classic die)
    const order = [3, 4, 1, 6, 2, 5]; // +x,-x,+y,-y,+z,-z
    return order.map((n) => new THREE.MeshStandardMaterial({ map: tex[n - 1], roughness: 0.4 }));
  }, []);
  const anim = useRef({ t: 999, active: false });

  useEffect(() => {
    anim.current = { t: -delay, active: true };
  }, [nonce, delay]);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const a = anim.current;
    if (!a.active) return;
    a.t += dt;
    if (a.t < 0) return;
    const DUR = 0.7;
    if (a.t < DUR) {
      const p = a.t / DUR;
      g.position.y = 1.4 + Math.sin(p * Math.PI) * 1.6; // arc
      g.rotation.x += dt * 18 * (1 - p);
      g.rotation.z += dt * 14 * (1 - p);
      g.visible = true;
    } else {
      // settle to show value
      const target = FACE_UP[value] ?? [0, 0, 0];
      g.position.y += (1.2 - g.position.y) * 0.2;
      g.rotation.x += (target[0] - g.rotation.x) * 0.25;
      g.rotation.y += (target[1] - g.rotation.y) * 0.25;
      g.rotation.z += (target[2] - g.rotation.z) * 0.25;
      if (a.t > DUR + 1.2) a.active = false;
    }
  });

  return (
    <group ref={ref} position={[offset, 1.2, 0]}>
      <mesh castShadow material={materials}>
        <boxGeometry args={[0.42, 0.42, 0.42]} />
      </mesh>
    </group>
  );
}

export function Dice() {
  const dice = useStore((s) => s.game?.dice);
  const nonce = dice?.nonce ?? 0;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (nonce === 0) return;
    setVisible(true);
    audio.dice();
    const t1 = setTimeout(() => audio.diceImpact(), 500);
    const t2 = setTimeout(() => setVisible(false), 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [nonce]);

  if (!dice || !visible) return null;
  return (
    <group position={[0, 0, 0]}>
      <Die value={dice.d1} offset={-0.4} nonce={nonce} delay={0} />
      <Die value={dice.d2} offset={0.4} nonce={nonce} delay={0.12} />
    </group>
  );
}
