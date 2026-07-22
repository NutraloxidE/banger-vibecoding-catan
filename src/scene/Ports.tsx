import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useGame } from '../game/store';
import { Port, Resource } from '../game/types';
import { portSignTexture } from './textures';

// Coastal harbors: a small dock + a hanging sign showing the trade rate.
// Decoration + readout only — the trade math lives in rules.ts::bankRate.

const RES_EMOJI: Record<Resource, string> = {
  wood: '🪵', brick: '🧱', wheat: '🌾', sheep: '🐑', ore: '🪨',
};

const plankGeo = new THREE.BoxGeometry(0.5, 0.06, 0.22);
const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.72, 6);
const armGeo = new THREE.BoxGeometry(0.4, 0.04, 0.04);
const signGeo = new THREE.PlaneGeometry(0.52, 0.52);
const buoyGeo = new THREE.SphereGeometry(0.06, 8, 6);

const woodMat = new THREE.MeshStandardMaterial({ color: '#8a5a33' });
const postMat = new THREE.MeshStandardMaterial({ color: '#6f4a2b' });

function PortDock({ port, ownerColor }: { port: Port; ownerColor: string | null }) {
  const ref = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const signTex = useMemo(
    () => portSignTexture(port.rate, port.kind === 'generic' ? '⚓' : RES_EMOJI[port.kind]),
    [port.rate, port.kind],
  );
  const buoyMat = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: ownerColor ?? '#d63b3b',
      emissive: ownerColor ?? '#000000',
      emissiveIntensity: ownerColor ? 0.5 : 0,
    }),
    [ownerColor],
  );
  const phase = useMemo(() => port.x + port.z, [port.x, port.z]);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = 0.02 + Math.sin(clock.elapsedTime * 1.4 + phase) * 0.03;
  });

  // face the sign back toward the island center
  const yaw = port.angle + Math.PI;

  return (
    <group position={[port.x, 0, port.z]} rotation={[0, yaw, 0]}>
      <group ref={ref}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
        onPointerOut={() => setHover(false)}
      >
        <mesh geometry={plankGeo} material={woodMat} castShadow />
        <mesh geometry={postGeo} material={postMat} position={[-0.16, 0.36, 0.04]} />
        <mesh geometry={armGeo} material={postMat} position={[-0.02, 0.66, 0.04]} />
        <mesh geometry={signGeo} position={[0.04, 0.4, 0.05]} rotation={[0, Math.PI, 0]}>
          <meshBasicMaterial map={signTex} transparent side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={buoyGeo} material={buoyMat} position={[0.2, 0.05, -0.05]} />
        {ownerColor && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
            <ringGeometry args={[0.28, 0.36, 20]} />
            <meshBasicMaterial color={ownerColor} transparent opacity={0.7} depthWrite={false} />
          </mesh>
        )}
      </group>
      {hover && (
        <Html position={[0, 0.9, 0]} center style={{ pointerEvents: 'none' }} rotation={[0, -yaw, 0]}>
          <div className="name-tag">⚓ {port.name} · {port.rate}:1 {port.kind === 'generic' ? '' : RES_EMOJI[port.kind]}</div>
        </Html>
      )}
    </group>
  );
}

export function Ports() {
  const ports = useGame((s) => s.game?.board.ports);
  const buildings = useGame((s) => s.game?.buildings);
  const players = useGame((s) => s.game?.players);
  if (!ports || !buildings || !players) return null;

  return (
    <group>
      {ports.map((port) => {
        const ownerId = port.vertices.map((v) => buildings[v]?.owner).find((o) => o != null);
        const ownerColor = ownerId != null ? players[ownerId].color : null;
        return <PortDock key={port.id} port={port} ownerColor={ownerColor ?? null} />;
      })}
    </group>
  );
}
