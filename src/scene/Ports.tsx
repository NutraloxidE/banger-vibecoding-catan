import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useGame } from '../game/store';
import { Port, Resource, VertexNode } from '../game/types';
import { portSignTexture } from './textures';
import { GAMEPLAY_WATER_LEVEL } from './Ambient';

// Waterline-relative rest heights so the harbor boat + buoy float on the same
// sea surface as the rest of the scene (Ambient owns the level). The boat rests
// with its hull bottom below the sea surface and barely bobs, so it stays
// seated in the water through the swell instead of lifting into an air gap —
// while still showing its hull above the waterline; the buoy rides with its
// lower half under.
const BOAT_Y = GAMEPLAY_WATER_LEVEL - 0.055;
const BUOY_Y = GAMEPLAY_WATER_LEVEL + 0.02;
// The hull + rigging are drawn a touch larger. The mooring ropes are kept
// OUTSIDE this scale (and hand-tuned for the boat's depth) so their ends stay
// pinned to the dock bollards.
const BOAT_SCALE = 1.2;

// Coastal harbors: a small dock + a hanging sign showing the trade rate.
// Decoration + readout only — the trade math lives in rules.ts::bankRate.

const RES_EMOJI: Record<Resource, string> = {
  wood: '🪵', brick: '🧱', wheat: '🌾', sheep: '🐑', ore: '🪨',
};

const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.72, 6);
const armGeo = new THREE.BoxGeometry(0.4, 0.04, 0.04);
const signGeo = new THREE.PlaneGeometry(0.52, 0.52);
const buoyGeo = new THREE.SphereGeometry(0.06, 8, 6);
const bridgePostGeo = new THREE.BoxGeometry(0.04, 0.14, 0.04);

// Landing platform (乗り場) + support pilings (足場): a solid wooden footing at
// the water's edge where the two plank bridges converge and where a ship would
// berth. Static (aligned with the static bridges), so the walkways read as
// leaving a real landing rather than a thin floating plank.
const landingGeo = new THREE.BoxGeometry(0.48, 0.08, 0.42);
const plankLineGeo = new THREE.BoxGeometry(0.48, 0.014, 0.02);
const pilingGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6);
const bollardGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.14, 8);

const PLATFORM_TOP = 0.14; // deck top surface (matches the bridge dock height)
const PLATFORM_THICK = 0.08;
// Four corner pilings and three deck planking seams, positioned once.
const PILING_OFFSETS: [number, number][] = [
  [0.19, 0.16], [0.19, -0.16], [-0.19, 0.16], [-0.19, -0.16],
];
const PLANK_SEAMS = [-0.13, 0, 0.13];

// Moored rowboat tied up on the harbor's seaward side — a clearly separate
// vessel so the dock reads as "boat AND dock", not one merged silhouette.
const boatBaseGeo = new THREE.BoxGeometry(0.34, 0.05, 0.16);
const boatWallLongGeo = new THREE.BoxGeometry(0.34, 0.07, 0.03);
const boatWallEndGeo = new THREE.BoxGeometry(0.03, 0.07, 0.13);
const boatBenchGeo = new THREE.BoxGeometry(0.05, 0.02, 0.12);
const boatMastGeo = new THREE.CylinderGeometry(0.014, 0.018, 0.34, 6);
const furledSailGeo = new THREE.BoxGeometry(0.036, 0.24, 0.036);
const ropeGeo = new THREE.BoxGeometry(0.016, 0.016, 0.32);
// Dockside cargo clutter (a barrel + a crate) on the landing deck.
const barrelGeo = new THREE.CylinderGeometry(0.05, 0.055, 0.11, 8);
const crateGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);

const hullMat = new THREE.MeshStandardMaterial({ color: '#7d4526' });
const sailclothMat = new THREE.MeshStandardMaterial({ color: '#f0e6d0' });
const ropeMat = new THREE.MeshStandardMaterial({ color: '#d3bc90' });
const crateMat = new THREE.MeshStandardMaterial({ color: '#bd9455' });
const barrelMat = new THREE.MeshStandardMaterial({ color: '#96622f' });

// In dock-local space (see the yaw note in PortDock): +z = toward the island,
// -z = open water. The boat floats just off the seaward edge, gently bobbing,
// tied to the two edge bollards by taut ropes.
function MooredBoat({ phase }: { phase: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    // Small bob + roll only — the boat rides low and barely moves vertically,
    // so the mooring ropes stay pinned to the fixed dock bollards.
    g.position.y = BOAT_Y + Math.sin(clock.elapsedTime * 1.3 + phase) * 0.005;
    g.rotation.x = Math.sin(clock.elapsedTime * 0.9 + phase) * 0.02;
  });
  return (
    <group ref={ref} position={[0, BOAT_Y, -0.52]}>
      {/* hull + rigging, drawn a little larger. Kept in its own scaled group so
          the ropes (siblings below) are NOT scaled and keep reaching the dock. */}
      <group scale={BOAT_SCALE}>
        {/* hull: flat bottom + low walls (open rowboat) */}
        <mesh geometry={boatBaseGeo} material={hullMat} position={[0, 0.05, 0]} castShadow />
        <mesh geometry={boatWallLongGeo} material={hullMat} position={[0, 0.095, 0.065]} />
        <mesh geometry={boatWallLongGeo} material={hullMat} position={[0, 0.095, -0.065]} />
        <mesh geometry={boatWallEndGeo} material={hullMat} position={[0.155, 0.095, 0]} />
        <mesh geometry={boatWallEndGeo} material={hullMat} position={[-0.155, 0.095, 0]} />
        <mesh geometry={boatBenchGeo} material={postMat} position={[0.08, 0.1, 0]} />
        <mesh geometry={boatBenchGeo} material={postMat} position={[-0.08, 0.1, 0]} />
        {/* short mast with the sail furled — in port, sail down */}
        <mesh geometry={boatMastGeo} material={postMat} position={[-0.06, 0.27, 0]} />
        <mesh geometry={furledSailGeo} material={sailclothMat} position={[-0.025, 0.26, 0]} rotation={[0, 0, 0.06]} />
      </group>
      {/* mooring ropes up to the dock's edge bollards — unscaled, angled to span
          from the low hull's stern rail up to the fixed bollards (far end lands
          ~[±0.1, 0.295, 0.36] in boat space, right at each bollard). */}
      <mesh geometry={ropeGeo} material={ropeMat} position={[0.1, 0.222, 0.22]} rotation={[-0.478, 0, 0]} />
      <mesh geometry={ropeGeo} material={ropeMat} position={[-0.1, 0.222, 0.22]} rotation={[-0.478, 0, 0]} />
    </group>
  );
}

const woodMat = new THREE.MeshStandardMaterial({ color: '#8a5a33' });
const postMat = new THREE.MeshStandardMaterial({ color: '#6f4a2b' });

// Shared scratch vector for the per-frame camera-angle check (no per-frame alloc).
const camDir = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

// A plank walkway spanning from the harbor dock (out on the water) up to one of
// the two coastal nodes it serves, so it reads at a glance which corners the
// harbor connects to. Oriented in world space so it heads toward the node and
// rises from the low dock to the higher shore — the deck's width axis is kept
// horizontal (no roll about the long axis), so the plank always lies flat-top
// even when a short span forces a steep slope.
function Bridge({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
  const { pos, quat, len } = useMemo(() => {
    const f = new THREE.Vector3(...from);
    const t = new THREE.Vector3(...to);
    const dir = t.clone().sub(f);
    const length = dir.length();
    // Build an explicit orthonormal basis instead of a shortest-arc rotation:
    // X = heading (dock→node, with slope); Z = horizontal width (perpendicular
    // to both the heading and world-up) so the deck never rolls; Y = deck up.
    const x = dir.clone().normalize();
    const z = new THREE.Vector3().crossVectors(x, WORLD_UP);
    if (z.lengthSq() < 1e-6) z.set(0, 0, 1); else z.normalize(); // near-vertical guard
    const y = new THREE.Vector3().crossVectors(z, x).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    const mid = f.add(t).multiplyScalar(0.5);
    return { pos: mid.toArray() as [number, number, number], quat: q.toArray() as [number, number, number, number], len: length };
  }, [from, to]);

  return (
    <group position={pos} quaternion={quat}>
      {/* deck */}
      <mesh material={woodMat} castShadow>
        <boxGeometry args={[len, 0.05, 0.24]} />
      </mesh>
      {/* side rails */}
      <mesh material={postMat} position={[0, 0.08, 0.11]}>
        <boxGeometry args={[len, 0.05, 0.03]} />
      </mesh>
      <mesh material={postMat} position={[0, 0.08, -0.11]}>
        <boxGeometry args={[len, 0.05, 0.03]} />
      </mesh>
      {/* corner posts */}
      <mesh geometry={bridgePostGeo} material={postMat} position={[len / 2 - 0.03, 0.06, 0.11]} />
      <mesh geometry={bridgePostGeo} material={postMat} position={[len / 2 - 0.03, 0.06, -0.11]} />
      <mesh geometry={bridgePostGeo} material={postMat} position={[-len / 2 + 0.03, 0.06, 0.11]} />
      <mesh geometry={bridgePostGeo} material={postMat} position={[-len / 2 + 0.03, 0.06, -0.11]} />
    </group>
  );
}

function PortDock({ port, ownerColor, showRate }: { port: Port; ownerColor: string | null; showRate: boolean }) {
  const buoyRef = useRef<THREE.Group>(null);
  const signRef = useRef<THREE.Group>(null);
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

  // The pier/landing is a solid structure; only the buoy bobs and the hanging
  // sign sways gently in the breeze.
  useFrame(({ clock }) => {
    if (buoyRef.current) buoyRef.current.position.y = BUOY_Y + Math.sin(clock.elapsedTime * 1.4 + phase) * 0.03;
    if (signRef.current) signRef.current.rotation.z = Math.sin(clock.elapsedTime * 1.1 + phase) * 0.05;
  });

  // Dock-local frame: +z points toward the island center, so -z is open water.
  // (yaw = 3π/2 − angle maps local +z onto the inward direction; the previous
  // `angle + π` was inconsistent per coast side, which scattered dock parts.)
  const yaw = Math.PI * 1.5 - port.angle;
  const rateEmoji = port.kind === 'generic' ? '⚓' : RES_EMOJI[port.kind];

  return (
    <group position={[port.x, 0, port.z]} rotation={[0, yaw, 0]}>
      <group
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
        onPointerOut={() => setHover(false)}
      >
        {/* Landing platform (乗り場) — the deck the bridges land on */}
        <mesh geometry={landingGeo} material={woodMat} position={[0, PLATFORM_TOP - PLATFORM_THICK / 2, 0]} castShadow receiveShadow />
        {/* deck planking seams */}
        {PLANK_SEAMS.map((z) => (
          <mesh key={z} geometry={plankLineGeo} material={postMat} position={[0, PLATFORM_TOP + 0.007, z]} />
        ))}
        {/* support pilings (足場) sinking into the water at each corner */}
        {PILING_OFFSETS.map(([px, pz]) => (
          <mesh key={`${px},${pz}`} geometry={pilingGeo} material={postMat} position={[px, PLATFORM_TOP - PLATFORM_THICK - 0.19, pz]} />
        ))}
        {/* mooring bollards on the seaward edge, where the boat ties up */}
        <mesh geometry={bollardGeo} material={postMat} position={[0.1, PLATFORM_TOP + 0.07, -0.16]} />
        <mesh geometry={bollardGeo} material={postMat} position={[-0.1, PLATFORM_TOP + 0.07, -0.16]} />
        {/* dockside cargo: a barrel + a crate waiting by the walkways */}
        <mesh geometry={crateGeo} material={crateMat} position={[0.17, PLATFORM_TOP + 0.05, 0.06]} rotation={[0, 0.5, 0]} castShadow />
        <mesh geometry={barrelGeo} material={barrelMat} position={[0.15, PLATFORM_TOP + 0.055, -0.09]} castShadow />
        {/* mast at one end of the deck + the hanging sign, facing the island.
            Raised so the sign hangs clear above the deck (its bottom no longer
            dips into the planking). */}
        <mesh geometry={postGeo} material={postMat} position={[-0.16, 0.42, 0.04]} />
        <mesh geometry={armGeo} material={postMat} position={[-0.02, 0.76, 0.04]} />
        {/* two back-to-back front-facing planes so the text reads correctly
            from either side (a single DoubleSide plane mirrors the back) */}
        <group ref={signRef} position={[0.04, 0.5, 0.05]}>
          <mesh geometry={signGeo} rotation={[0, Math.PI, 0]}>
            <meshBasicMaterial map={signTex} transparent side={THREE.FrontSide} />
          </mesh>
          <mesh geometry={signGeo} rotation={[0, 0, 0]}>
            <meshBasicMaterial map={signTex} transparent side={THREE.FrontSide} />
          </mesh>
        </group>
        {ownerColor && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, PLATFORM_TOP + 0.01, 0]}>
            <ringGeometry args={[0.3, 0.38, 24]} />
            <meshBasicMaterial color={ownerColor} transparent opacity={0.7} depthWrite={false} />
          </mesh>
        )}
        {/* the harbor's boat, moored just off the seaward edge */}
        <MooredBoat phase={phase} />
      </group>
      {/* buoy floating on the open water beside the moored boat */}
      <group ref={buoyRef} position={[0.34, BUOY_Y, -0.34]}>
        <mesh geometry={buoyGeo} material={buoyMat} />
      </group>
      {/* Dedicated flat readout: when the camera looks from near overhead the
          vertical sign goes edge-on, so a screen-facing DOM badge fades in with
          the trade ratio. Anchored over the dock so you know which harbor it is. */}
      <Html position={[0, 0.7, 0]} center style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
        <div
          className={`port-rate-badge${showRate ? ' on' : ''}`}
          style={ownerColor ? { borderColor: ownerColor } : undefined}
        >
          {rateEmoji} {port.rate}:1
        </div>
      </Html>
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
  const vertices = useGame((s) => s.game?.board.vertices);
  const buildings = useGame((s) => s.game?.buildings);
  const players = useGame((s) => s.game?.players);
  // Show the flat rate badges only when the camera is near top-down (where the
  // 3D signs are edge-on). Hysteresis (on >0.8, off <0.68) avoids flicker.
  const [topDown, setTopDown] = useState(false);
  useFrame(({ camera }) => {
    camera.getWorldDirection(camDir);
    const elevation = -camDir.y; // 0 = horizontal view, 1 = straight down
    if (!topDown && elevation > 0.8) setTopDown(true);
    else if (topDown && elevation < 0.68) setTopDown(false);
  });
  if (!ports || !vertices || !buildings || !players) return null;

  // Bridges land on the landing-platform deck; the coastal nodes sit on the tile tops.
  const DOCK_Y = PLATFORM_TOP;
  const NODE_Y = 0.3;

  return (
    <group>
      {ports.map((port) => {
        const ownerId = port.vertices.map((v) => buildings[v]?.owner).find((o) => o != null);
        const ownerColor = ownerId != null ? players[ownerId].color : null;
        return (
          <group key={port.id}>
            {port.vertices.map((vid) => {
              const v: VertexNode | undefined = vertices[vid];
              if (!v) return null;
              // Start each bridge at the platform's edge (offset toward its
              // node), not the platform center — otherwise the deck cuts
              // across the middle of the landing and through the sign.
              const dx = v.x - port.x, dz = v.z - port.z;
              const dl = Math.hypot(dx, dz) || 1;
              const from: [number, number, number] = [port.x + (dx / dl) * 0.2, DOCK_Y, port.z + (dz / dl) * 0.2];
              return <Bridge key={vid} from={from} to={[v.x, NODE_Y, v.z]} />;
            })}
            <PortDock port={port} ownerColor={ownerColor ?? null} showRate={topDown} />
          </group>
        );
      })}
    </group>
  );
}
