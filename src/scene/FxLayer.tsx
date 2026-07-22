import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../game/store';
import { Fx } from '../game/types';

const ringGeo = new THREE.RingGeometry(0.5, 0.62, 32);
const beamGeo = new THREE.CylinderGeometry(0.25, 0.55, 6, 12, 1, true);

function FxItem({ fx }: { fx: Fx }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const age = (Date.now() - fx.born) / 1000;
    const life = fx.kind === 'mega' ? 2.4 : 1.4;
    const t = Math.min(1, age / life);
    const ring = g.children[0] as THREE.Mesh | undefined;
    if (ring) {
      ring.scale.setScalar(0.4 + t * (fx.kind === 'mega' ? 4 : 2.2));
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.85 * (1 - t));
    }
    const beam = g.children[1] as THREE.Mesh | undefined;
    if (beam) {
      const mat = beam.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.4 * (1 - t));
      beam.rotation.y += 0.05;
    }
  });
  return (
    <group ref={ref} position={[fx.x, 0.36, fx.z]}>
      <mesh geometry={ringGeo} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color={fx.color} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      {fx.kind === 'mega' && (
        <mesh geometry={beamGeo} position={[0, 3, 0]}>
          <meshBasicMaterial color={fx.color} transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

export function FxLayer() {
  const fx = useGame((s) => s.game?.fx);
  if (!fx || fx.length === 0) return null;
  return (
    <group>
      {fx.map((f) => <FxItem key={f.id} fx={f} />)}
    </group>
  );
}
