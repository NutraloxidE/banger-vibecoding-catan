import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// Water, drifting clouds, and boats circling the island.
// Pure decoration — never blocks input (raycast disabled).

const boatHull = new THREE.BoxGeometry(0.5, 0.12, 0.2);
const boatSail = new THREE.ConeGeometry(0.14, 0.34, 4);
const cloudGeo = new THREE.SphereGeometry(1, 10, 8);

const hullMat = new THREE.MeshStandardMaterial({ color: '#8a5a33' });
const sailMat = new THREE.MeshStandardMaterial({ color: '#f4efe2' });
const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false });

// Default sea surface level. GameScene raises it (via Ambient's waterLevel prop)
// so the island + docks sit IN the water rather than floating above it; the
// frozen title screen keeps the original level by using the default.
export const DEFAULT_WATER_LEVEL = -0.16;
// Sea surface used on the gameplay screen (island base is at y=0, so this keeps
// the coastline just meeting the water). Shared with Ports.tsx so the harbor
// boat + buoy float at the same line.
export const GAMEPLAY_WATER_LEVEL = -0.02;

export function Water({ radius, level = DEFAULT_WATER_LEVEL }: { radius: number; level?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = level + Math.sin(clock.elapsedTime * 0.7) * 0.03;
    }
  });
  return (
    <group>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, level, 0]} raycast={() => null}>
        <circleGeometry args={[radius * 6, 48]} />
        <meshStandardMaterial color="#1c6ba0" roughness={0.25} metalness={0.1} transparent opacity={0.93} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, level - 0.14, 0]} raycast={() => null}>
        <circleGeometry args={[radius * 6.2, 48]} />
        <meshStandardMaterial color="#0c3f63" />
      </mesh>
    </group>
  );
}

function Boat({ radius, speed, phase, dir, baseY }: { radius: number; speed: number; phase: number; dir: number; baseY: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const a = clock.elapsedTime * speed * dir + phase;
    g.position.set(Math.cos(a) * radius, baseY + Math.sin(clock.elapsedTime * 2 + phase) * 0.04, Math.sin(a) * radius);
    g.rotation.y = -a - (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    g.rotation.z = Math.sin(clock.elapsedTime * 1.5 + phase) * 0.06;
  });
  return (
    <group ref={ref} scale={1.35} raycast={() => null}>
      <mesh geometry={boatHull} material={hullMat} />
      <mesh geometry={boatSail} material={sailMat} position={[0, 0.24, 0]} />
    </group>
  );
}

function Cloud({ x, y, z, s, speed }: { x: number; y: number; z: number; s: number; speed: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.x = ((x + clock.elapsedTime * speed) % 40) - 20;
    }
  });
  return (
    <group ref={ref} position={[x, y, z]} scale={s} raycast={() => null}>
      <mesh geometry={cloudGeo} material={cloudMat} scale={[1.3, 0.5, 0.8]} />
      <mesh geometry={cloudGeo} material={cloudMat} position={[0.9, 0.1, 0.2]} scale={[0.8, 0.4, 0.6]} />
      <mesh geometry={cloudGeo} material={cloudMat} position={[-0.9, 0.05, -0.1]} scale={[0.7, 0.35, 0.55]} />
    </group>
  );
}

export function Ambient({ boardRadius, boatDistance, waterLevel = DEFAULT_WATER_LEVEL }: { boardRadius: number; boatDistance?: number; waterLevel?: number }) {
  // Inner boat orbit radius. Defaults to the original formula (keeps the frozen
  // title screen unchanged); GameScene passes a larger value so the gameplay
  // boats stay well offshore and don't visually merge with the coastal harbor
  // docks at low camera angles.
  const worldR = boatDistance ?? boardRadius * 1.9 + 3;
  // Keep the circling boats' freeboard constant relative to the sea, so raising
  // the gameplay water level lifts them with it (title level = original look).
  const boatBaseY = waterLevel + 0.11;
  const clouds = useMemo(() => Array.from({ length: 5 }, (_, i) => ({
    x: (i * 13.7) % 30 - 15,
    y: 6 + (i % 3) * 1.4,
    z: (i * 8.3) % 24 - 12,
    s: 0.8 + (i % 3) * 0.5,
    speed: 0.15 + (i % 2) * 0.12,
  })), []);
  return (
    <group>
      <Water radius={boardRadius} level={waterLevel} />
      <Boat radius={worldR} speed={0.12} phase={0} dir={1} baseY={boatBaseY} />
      <Boat radius={worldR + 1.6} speed={0.09} phase={2.4} dir={-1} baseY={boatBaseY} />
      {clouds.map((c, i) => <Cloud key={i} {...c} />)}
    </group>
  );
}
