import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useGame } from '../game/store';

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const roofGeo = new THREE.ConeGeometry(0.16, 0.14, 4);
const roadGeo = new THREE.BoxGeometry(0.62, 0.09, 0.14);
const beamGeo = new THREE.CylinderGeometry(0.03, 0.09, 2.6, 8, 1, true);

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function colMat(color: string, emissive = 0): THREE.MeshStandardMaterial {
  const key = `${color}:${emissive}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, roughness: 0.6,
      emissive: emissive > 0 ? color : '#000000',
      emissiveIntensity: emissive,
    });
    matCache.set(key, m);
  }
  return m;
}

function Settlement({ color }: { color: string }) {
  return (
    <group>
      <mesh geometry={boxGeo} material={colMat(color)} position={[0, 0.09, 0]} scale={[0.2, 0.18, 0.2]} />
      <mesh geometry={roofGeo} material={colMat('#f5f0e0')} position={[0, 0.24, 0]} rotation={[0, Math.PI / 4, 0]} />
    </group>
  );
}

function City({ color }: { color: string }) {
  return (
    <group>
      <mesh geometry={boxGeo} material={colMat(color)} position={[-0.07, 0.13, 0]} scale={[0.18, 0.26, 0.2]} />
      <mesh geometry={boxGeo} material={colMat(color)} position={[0.1, 0.09, 0.04]} scale={[0.16, 0.18, 0.16]} />
      <mesh geometry={roofGeo} material={colMat('#f5f0e0')} position={[-0.07, 0.33, 0]} rotation={[0, Math.PI / 4, 0]} />
      <mesh geometry={boxGeo} material={colMat('#ffe28a', 0.4)} position={[0.1, 0.2, 0.04]} scale={[0.06, 0.05, 0.06]} />
    </group>
  );
}

function MegaCity({ color }: { color: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.25;
  });
  return (
    <group>
      <mesh geometry={boxGeo} material={colMat(color)} position={[0, 0.3, 0]} scale={[0.2, 0.6, 0.2]} />
      <mesh geometry={boxGeo} material={colMat(color)} position={[-0.16, 0.2, 0.06]} scale={[0.13, 0.4, 0.13]} />
      <mesh geometry={boxGeo} material={colMat(color)} position={[0.15, 0.16, -0.08]} scale={[0.12, 0.32, 0.12]} />
      {/* emissive windows */}
      <mesh geometry={boxGeo} material={colMat('#ffe28a', 0.9)} position={[0, 0.32, 0]} scale={[0.21, 0.5, 0.12]} />
      <mesh geometry={boxGeo} material={colMat('#8ff0ff', 0.9)} position={[-0.16, 0.2, 0.06]} scale={[0.14, 0.3, 0.06]} />
      {/* beacon */}
      <group ref={ref}>
        <mesh geometry={beamGeo} position={[0, 1.8, 0]}>
          <meshBasicMaterial color={color} transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
      <mesh geometry={roofGeo} material={colMat('#ffe28a', 1.2)} position={[0, 0.66, 0]} scale={0.6} />
    </group>
  );
}

export function Pieces() {
  const buildings = useGame((s) => s.game?.buildings);
  const roads = useGame((s) => s.game?.roads);
  const board = useGame((s) => s.game?.board);
  const players = useGame((s) => s.game?.players);
  const [hoverName, setHoverName] = useState<{ name: string; x: number; z: number } | null>(null);

  if (!board || !buildings || !roads || !players) return null;

  return (
    <group>
      {Object.values(roads).map((r) => {
        const e = board.edges[r.edge];
        if (!e) return null;
        return (
          <mesh key={r.edge} geometry={roadGeo} material={colMat(players[r.owner].color)}
            position={[e.x, 0.34, e.z]} rotation={[0, e.rot, 0]} />
        );
      })}
      {Object.values(buildings).map((b) => {
        const v = board.vertices[b.vertex];
        if (!v) return null;
        const color = players[b.owner].color;
        return (
          <group key={b.vertex} position={[v.x, 0.3, v.z]}
            onPointerOver={(e) => { e.stopPropagation(); setHoverName({ name: b.name, x: v.x, z: v.z }); }}
            onPointerOut={() => setHoverName((h) => (h?.name === b.name ? null : h))}
          >
            {b.kind === 'settlement' && <Settlement color={color} />}
            {b.kind === 'city' && <City color={color} />}
            {b.kind === 'megacity' && <MegaCity color={color} />}
          </group>
        );
      })}
      {hoverName && (
        <Html position={[hoverName.x, 1.1, hoverName.z]} center style={{ pointerEvents: 'none' }}>
          <div className="name-tag">{hoverName.name}</div>
        </Html>
      )}
    </group>
  );
}
