import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { BoardModel, Terrain, Tile } from '../game/types';
import { RNG } from '../game/rng';
import { tokenTexture } from './textures';
import { useGame } from '../game/store';

export const TERRAIN_COLOR: Record<Terrain, string> = {
  forest: '#2f8f4a',
  hills: '#c06a3d',
  fields: '#e3c24a',
  pasture: '#8fd05e',
  mountains: '#8d93a1',
  desert: '#e0cd8f',
};

// shared geometries/materials
const hexGeo = new THREE.CylinderGeometry(1, 1.06, 0.3, 6);
const trunkGeo = new THREE.CylinderGeometry(0.03, 0.045, 0.16, 5);
const coneGeo = new THREE.ConeGeometry(0.12, 0.3, 6);
const rockGeo = new THREE.ConeGeometry(0.2, 0.42, 5);
const crystalGeo = new THREE.OctahedronGeometry(0.08);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const sheepBody = new THREE.SphereGeometry(0.075, 8, 6);
const sheepHead = new THREE.SphereGeometry(0.038, 6, 5);
const tokenGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.05, 20);
const tokenFace = new THREE.CircleGeometry(0.25, 20);
const robberBody = new THREE.CapsuleGeometry(0.13, 0.22, 4, 10);

const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4a2b' });
const leafMat = new THREE.MeshStandardMaterial({ color: '#1d6b35' });
const leafMat2 = new THREE.MeshStandardMaterial({ color: '#2c8746' });
const rockMat = new THREE.MeshStandardMaterial({ color: '#7a808d' });
const snowMat = new THREE.MeshStandardMaterial({ color: '#e8ecf2' });
const crystalMat = new THREE.MeshStandardMaterial({ color: '#9fd8ff', emissive: '#3f9fff', emissiveIntensity: 0.6 });
const wheatMat = new THREE.MeshStandardMaterial({ color: '#caa93a' });
const wheatMat2 = new THREE.MeshStandardMaterial({ color: '#e0be4a' });
const brickMat = new THREE.MeshStandardMaterial({ color: '#a34f2c' });
const brickMat2 = new THREE.MeshStandardMaterial({ color: '#8d3f22' });
const woolMat = new THREE.MeshStandardMaterial({ color: '#f2f0e8' });
const sheepFaceMat = new THREE.MeshStandardMaterial({ color: '#3a3630' });
const cactusMat = new THREE.MeshStandardMaterial({ color: '#4f9e57' });
// Number tokens draw on top of terrain so they're never buried by trees,
// mountains, or other tile decorations (depthTest off + high renderOrder).
const TOKEN_RENDER_ORDER = 900;
const tokenMat = new THREE.MeshStandardMaterial({ color: '#efe3c0', depthTest: false, depthWrite: false });
const robberMat = new THREE.MeshStandardMaterial({ color: '#23222b', roughness: 0.4 });

function ForestDeco({ rng }: { rng: RNG }) {
  const group = useRef<THREE.Group>(null);
  const phase = useMemo(() => rng.next() * Math.PI * 2, [rng]);
  const trees = useMemo(() => {
    const n = 4 + rng.int(3);
    return Array.from({ length: n }, () => ({
      x: (rng.next() - 0.5) * 1.1,
      z: (rng.next() - 0.5) * 1.1,
      s: 0.75 + rng.next() * 0.7,
      alt: rng.chance(0.5),
    }));
  }, [rng]);
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.z = Math.sin(clock.elapsedTime * 1.3 + phase) * 0.02;
  });
  return (
    <group ref={group}>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
          <mesh geometry={trunkGeo} material={trunkMat} position={[0, 0.08, 0]} />
          <mesh geometry={coneGeo} material={t.alt ? leafMat : leafMat2} position={[0, 0.3, 0]} />
        </group>
      ))}
    </group>
  );
}

function MountainDeco({ rng }: { rng: RNG }) {
  const rocks = useMemo(() => Array.from({ length: 3 }, (_, i) => ({
    x: (rng.next() - 0.5) * 0.9,
    z: (rng.next() - 0.5) * 0.9,
    s: 0.7 + rng.next() * 0.9,
    r: rng.next() * Math.PI,
  })), [rng]);
  return (
    <group>
      {rocks.map((r, i) => (
        <group key={i} position={[r.x, 0, r.z]} scale={r.s} rotation={[0, r.r, 0]}>
          <mesh geometry={rockGeo} material={rockMat} position={[0, 0.2, 0]} />
          <mesh geometry={coneGeo} material={snowMat} position={[0, 0.38, 0]} scale={0.42} />
        </group>
      ))}
      <mesh geometry={crystalGeo} material={crystalMat} position={[(rng.next() - 0.5) * 0.8, 0.08, (rng.next() - 0.5) * 0.8]} rotation={[0.4, rng.next() * 3, 0.3]} />
    </group>
  );
}

function FieldDeco({ rng }: { rng: RNG }) {
  const rows = useMemo(() => Array.from({ length: 4 }, (_, i) => ({
    x: (rng.next() - 0.5) * 0.9,
    z: -0.45 + i * 0.3 + (rng.next() - 0.5) * 0.1,
    w: 0.5 + rng.next() * 0.4,
    alt: i % 2 === 0,
  })), [rng]);
  return (
    <group>
      {rows.map((r, i) => (
        <mesh key={i} geometry={boxGeo} material={r.alt ? wheatMat : wheatMat2}
          position={[r.x, 0.05, r.z]} scale={[r.w, 0.1, 0.14]} rotation={[0, 0.3, 0]} />
      ))}
    </group>
  );
}

function HillsDeco({ rng }: { rng: RNG }) {
  const bricks = useMemo(() => Array.from({ length: 4 }, () => ({
    x: (rng.next() - 0.5) * 0.9,
    z: (rng.next() - 0.5) * 0.9,
    s: 0.5 + rng.next() * 0.6,
    r: rng.next() * Math.PI,
    alt: rng.chance(0.5),
  })), [rng]);
  return (
    <group>
      {bricks.map((b, i) => (
        <mesh key={i} geometry={boxGeo} material={b.alt ? brickMat : brickMat2}
          position={[b.x, 0.07 * b.s, b.z]} scale={[0.28 * b.s, 0.14 * b.s, 0.18 * b.s]} rotation={[0, b.r, 0]} />
      ))}
    </group>
  );
}

function PastureDeco({ rng, tileIndex }: { rng: RNG; tileIndex: number }) {
  const sheep = useMemo(() => Array.from({ length: 2 + rng.int(2) }, () => ({
    x: (rng.next() - 0.5) * 0.9,
    z: (rng.next() - 0.5) * 0.9,
    r: rng.next() * Math.PI * 2,
    ph: rng.next() * Math.PI * 2,
  })), [rng]);
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.children.forEach((c, i) => {
      const s = sheep[i];
      if (s) c.position.y = 0.06 + Math.abs(Math.sin(clock.elapsedTime * 2.2 + s.ph)) * 0.03;
    });
  });
  return (
    <group ref={group}>
      {sheep.map((s, i) => (
        <group key={i} position={[s.x, 0.06, s.z]} rotation={[0, s.r, 0]}>
          <mesh geometry={sheepBody} material={woolMat} />
          <mesh geometry={sheepHead} material={sheepFaceMat} position={[0.075, 0.02, 0]} />
        </group>
      ))}
    </group>
  );
}

function DesertDeco({ rng }: { rng: RNG }) {
  const cacti = useMemo(() => Array.from({ length: 2 }, () => ({
    x: (rng.next() - 0.5) * 0.9,
    z: (rng.next() - 0.5) * 0.9,
    s: 0.6 + rng.next() * 0.6,
  })), [rng]);
  return (
    <group>
      {cacti.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]} scale={c.s}>
          <mesh geometry={trunkGeo} material={cactusMat} position={[0, 0.1, 0]} scale={[1.6, 1.6, 1.6]} />
          <mesh geometry={trunkGeo} material={cactusMat} position={[0.07, 0.14, 0]} scale={[1, 0.8, 1]} rotation={[0, 0, -0.9]} />
        </group>
      ))}
    </group>
  );
}

function Deco({ tile, seed }: { tile: Tile; seed: string }) {
  const rng = useMemo(() => new RNG(`${seed}:deco:${tile.id}`), [seed, tile.id]);
  switch (tile.terrain) {
    case 'forest': return <ForestDeco rng={rng} />;
    case 'mountains': return <MountainDeco rng={rng} />;
    case 'fields': return <FieldDeco rng={rng} />;
    case 'hills': return <HillsDeco rng={rng} />;
    case 'pasture': return <PastureDeco rng={rng} tileIndex={tile.id} />;
    case 'desert': return <DesertDeco rng={rng} />;
  }
}

function Robber({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 0.5 + Math.sin(clock.elapsedTime * 2) * 0.04;
      ref.current.rotation.y = clock.elapsedTime * 0.8;
    }
  });
  return (
    <group position={[x, 0.5, z]} ref={ref}>
      <mesh geometry={robberBody} material={robberMat} />
      <mesh geometry={coneGeo} material={robberMat} position={[0, 0.28, 0]} scale={1.2} />
    </group>
  );
}

export function Tiles({ board, seed }: { board: BoardModel; seed: string }) {
  const clickTile = useGame((s) => s.clickTile);
  const robberTile = useGame((s) => s.game?.robberTile ?? -1);
  const phase = useGame((s) => s.game?.phase);
  const isHumanTurn = useGame((s) => (s.game ? !s.game.players[s.game.current].isNpc : false));
  const stormTile = useGame((s) => (s.game?.worldEvent?.kind === 'storm' ? s.game.worldEvent.tileId ?? -1 : -1));

  const mats = useMemo(() => {
    const m: Partial<Record<Terrain, THREE.MeshStandardMaterial>> = {};
    (Object.keys(TERRAIN_COLOR) as Terrain[]).forEach((t) => {
      m[t] = new THREE.MeshStandardMaterial({ color: TERRAIN_COLOR[t], roughness: 0.85 });
    });
    return m as Record<Terrain, THREE.MeshStandardMaterial>;
  }, []);

  const robberSelecting = phase === 'robber' && isHumanTurn;

  return (
    <group>
      {board.tiles.map((tile) => (
        <group key={tile.id} position={[tile.x, 0, tile.z]}>
          <mesh
            geometry={hexGeo}
            material={mats[tile.terrain]}
            position={[0, 0.15, 0]}
            onClick={(e) => { e.stopPropagation(); clickTile(tile.id); }}
          />
          <group position={[0, 0.3, 0]}>
            <Deco tile={tile} seed={seed} />
            {tile.token !== null && (
              <group position={[0, 0.12, 0]}>
                <mesh geometry={tokenGeo} material={tokenMat} renderOrder={TOKEN_RENDER_ORDER} />
                <mesh geometry={tokenFace} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.028, 0]} renderOrder={TOKEN_RENDER_ORDER + 1}>
                  <meshBasicMaterial map={tokenTexture(tile.token)} transparent depthTest={false} depthWrite={false} />
                </mesh>
              </group>
            )}
          </group>
          {robberSelecting && tile.id !== robberTile && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.32, 0]}>
              <ringGeometry args={[0.75, 0.9, 32]} />
              <meshBasicMaterial color="#ff5544" transparent opacity={0.5} />
            </mesh>
          )}
          {stormTile === tile.id && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.34, 0]}>
              <ringGeometry args={[0.6, 0.95, 32]} />
              <meshBasicMaterial color="#7fb8ff" transparent opacity={0.4} />
            </mesh>
          )}
        </group>
      ))}
      {robberTile >= 0 && board.tiles[robberTile] && (
        <Robber x={board.tiles[robberTile].x} z={board.tiles[robberTile].z} />
      )}
    </group>
  );
}
