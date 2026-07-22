import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, OrbitControls } from '@react-three/drei';
import { generateBoard } from '../game/board';
import { Tiles } from './Tiles';
import { Ambient } from './Ambient';

// Title-screen-only ambience (per spec.md §2 the title must feel alive:
// particles + wildlife on top of the shared clouds/water/boats).

// Slowly rising golden motes drifting over the island.
function Motes() {
  const ref = useRef<THREE.Points>(null);
  const { positions, speeds } = useMemo(() => {
    const n = 140;
    const pos = new Float32Array(n * 3);
    const sp = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 26;
      pos[i * 3 + 1] = Math.random() * 7 + 0.2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 26;
      sp[i] = 0.12 + Math.random() * 0.35;
    }
    return { positions: pos, speeds: sp };
  }, []);

  useFrame((state, dt) => {
    const attr = ref.current?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!attr) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < speeds.length; i++) {
      let y = attr.getY(i) + speeds[i] * dt;
      if (y > 7.5) y = 0.2;
      attr.setY(i, y);
      attr.setX(i, attr.getX(i) + Math.sin(t * 0.6 + i) * 0.0025);
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref} raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.09} color="#ffe9a0" transparent opacity={0.75}
        sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// A tiny flock of stylized birds circling high above the island.
const wingGeo = new THREE.BoxGeometry(0.26, 0.02, 0.07);
const birdMat = new THREE.MeshStandardMaterial({ color: '#2b3442' });

function Bird({ offset, radius, height, speed }: { offset: number; radius: number; height: number; speed: number }) {
  const ref = useRef<THREE.Group>(null);
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const a = clock.elapsedTime * speed + offset;
    g.position.set(Math.cos(a) * radius, height + Math.sin(clock.elapsedTime * 1.3 + offset) * 0.3, Math.sin(a) * radius);
    g.rotation.y = -a - Math.PI / 2;
    const flap = Math.sin(clock.elapsedTime * 9 + offset) * 0.7;
    if (left.current) left.current.rotation.x = flap;
    if (right.current) right.current.rotation.x = -flap;
  });
  return (
    <group ref={ref} raycast={() => null}>
      <mesh ref={left} geometry={wingGeo} material={birdMat} position={[-0.12, 0, 0]} />
      <mesh ref={right} geometry={wingGeo} material={birdMat} position={[0.12, 0, 0]} />
    </group>
  );
}

function Birds() {
  const flock = useMemo(() => Array.from({ length: 4 }, (_, i) => ({
    offset: i * 1.7,
    radius: 6.5 + (i % 2) * 1.6,
    height: 4.6 + (i % 3) * 0.7,
    speed: 0.16 + (i % 2) * 0.05,
  })), []);
  return <group>{flock.map((b, i) => <Bird key={i} {...b} />)}</group>;
}

// The title screen's living diorama: a demo island, slowly orbiting camera.
export function TitleScene() {
  const board = useMemo(() => generateBoard('medium', 'HEXTOPIA-TITLE'), []);
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [9, 7, 9], fov: 50 }} style={{ touchAction: 'none' }}>
      <fog attach="fog" args={['#9cc4de', 22, 55]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[10, 18, 6]} intensity={1.3} color="#fff4e0" />
      <Sky sunPosition={[60, 35, 20]} turbidity={6} rayleigh={1.8} />
      <Ambient boardRadius={6.3} />
      <Motes />
      <Birds />
      <Tiles board={board} seed="HEXTOPIA-TITLE" />
      <OrbitControls autoRotate autoRotateSpeed={0.7} enablePan={false} enableZoom={false}
        minPolarAngle={0.9} maxPolarAngle={1.2} />
    </Canvas>
  );
}
