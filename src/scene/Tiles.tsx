import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { BoardModel, Terrain, Tile } from '../game/types';
import { RNG } from '../game/rng';
import { tokenTexture } from './textures';
import { useGame } from '../game/store';

export const TERRAIN_COLOR: Record<Terrain, string> = {
  forest: '#138239',
  hills: '#b45d30',
  fields: '#cbb34f',
  pasture: '#91bc5e',
  mountains: '#858892',
  desert: '#b45d30',
};

// The old single cylinder stays underneath as the sandy cliff/soil body.
// A separately tessellated top lets the playable surface swell gently toward
// the centre while keeping the six shared corner/edge anchors at y=0.3.
const hexBaseGeo = new THREE.CylinderGeometry(1, 1.06, 0.3, 6);
const TILE_TOP_Y = 0.302;
const TILE_CROWN = 0.055;
const TILE_EDGE_SEGMENTS = 5;
const FACET_LIGHTNESS_STEP = 0.055;
export const TILE_PALETTE_LIGHTNESS = 0.12;

export type TilePaletteColors = Record<Terrain | 'sand' | 'sandSide', string>;

export interface TilePaletteTuning {
  lightness: number;
  saturation: number;
  facetContrast: number;
  sandLightness: number;
  colors: TilePaletteColors;
}

export const DEFAULT_TILE_PALETTE_COLORS: TilePaletteColors = {
  ...TERRAIN_COLOR,
  sand: '#f3d69c',
  sandSide: '#dfbd7d',
};

export const DEFAULT_TILE_PALETTE_TUNING: TilePaletteTuning = {
  lightness: TILE_PALETTE_LIGHTNESS,
  saturation: 1,
  facetContrast: FACET_LIGHTNESS_STEP,
  sandLightness: 0,
  colors: DEFAULT_TILE_PALETTE_COLORS,
};

function smooth01(v: number) {
  const x = THREE.MathUtils.clamp(v, 0, 1);
  return x * x * (3 - 2 * x);
}

function makeCrownedHexGeometry() {
  const geo = new THREE.BufferGeometry();
  const positions: number[] = [0, TILE_TOP_Y + TILE_CROWN, 0];
  const uvs: number[] = [0.5, 0.5];
  const indices: number[] = [];
  const ringRadii = [0.28, 0.5, 0.7, 0.84, 0.94, 1];
  const around = 6 * TILE_EDGE_SEGMENTS;

  for (const radius of ringRadii) {
    const crown = TILE_CROWN * (1 - smooth01((radius - 0.18) / 0.82));
    for (let i = 0; i < around; i++) {
      const side = Math.floor(i / TILE_EDGE_SEGMENTS);
      const t = (i % TILE_EDGE_SEGMENTS) / TILE_EDGE_SEGMENTS;
      const a0 = THREE.MathUtils.degToRad(side * 60 - 30);
      const a1 = THREE.MathUtils.degToRad((side + 1) * 60 - 30);
      const x = THREE.MathUtils.lerp(Math.cos(a0), Math.cos(a1), t) * radius;
      const z = THREE.MathUtils.lerp(Math.sin(a0), Math.sin(a1), t) * radius;
      positions.push(x, TILE_TOP_Y + crown, z);
      uvs.push(x * 0.5 + 0.5, z * 0.5 + 0.5);
    }
  }

  for (let i = 0; i < around; i++) {
    indices.push(0, 1 + ((i + 1) % around), 1 + i);
  }
  for (let ring = 0; ring < ringRadii.length - 1; ring++) {
    const inner = 1 + ring * around;
    const outer = inner + around;
    for (let i = 0; i < around; i++) {
      const next = (i + 1) % around;
      indices.push(inner + i, outer + next, outer + i);
      indices.push(inner + i, inner + next, outer + next);
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const crownedHexGeo = makeCrownedHexGeometry();

function hashNoise(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function pointyHexRadius(x: number, z: number) {
  const sector = Math.PI / 3;
  const angle = Math.atan2(z, x);
  const edgeDelta = ((angle + Math.PI / 6) % sector + sector) % sector - Math.PI / 6;
  const edgeRadius = Math.cos(Math.PI / 6) / Math.cos(edgeDelta);
  return Math.hypot(x, z) / edgeRadius;
}

function tuneColor(color: THREE.Color, saturation: number, lightness: number) {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  color.setHSL(
    hsl.h,
    THREE.MathUtils.clamp(hsl.s * saturation, 0, 1),
    THREE.MathUtils.clamp(hsl.l + lightness, 0, 1),
  );
  return color;
}

function makeTerrainTexture(
  terrain: Terrain,
  paletteLightness: number,
  paletteSaturation: number,
  facetContrast: number,
  sandLightness: number,
  paletteColors: TilePaletteColors,
) {
  const size = 144;
  const facetSize = 18;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(size, size);
  const terrainColor = new THREE.Color(paletteColors[terrain]);
  const sandColor = new THREE.Color(paletteColors.sand);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px / (size - 1) - 0.5) * 2;
      const z = (py / (size - 1) - 0.5) * 2;
      const hexRadius = pointyHexRadius(x, z);
      const cellX = Math.floor(px / facetSize);
      const cellY = Math.floor(py / facetSize);
      const localX = (px % facetSize) / facetSize;
      const localY = (py % facetSize) / facetSize;
      const triangle = localX + localY < 1 ? 0 : 1;
      const facetX = cellX * 2 + triangle;
      const facetY = cellY * 2 + (triangle === 0 ? 1 : 0);
      const facetTone = Math.floor(hashNoise(facetX, facetY) * 3);
      const boundary = 0.835 + (hashNoise(facetX + 31, facetY + 17) - 0.5) * 0.035;
      const beach = hexRadius >= boundary + 0.075
        ? 1
        : hexRadius >= boundary + 0.03
          ? 0.62
          : hexRadius >= boundary
            ? 0.28
            : 0;
      const color = terrainColor.clone().lerp(sandColor, beach);
      tuneColor(
        color,
        paletteSaturation,
        paletteLightness + facetTone * facetContrast + beach * sandLightness,
      );

      const offset = (py * size + px) * 4;
      image.data[offset] = Math.round(color.r * 255);
      image.data[offset + 1] = Math.round(color.g * 255);
      image.data[offset + 2] = Math.round(color.b * 255);
      image.data[offset + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.anisotropy = 2;
  return texture;
}

// shared geometries/materials
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

export function Tiles({
  board,
  seed,
  paletteLightness = 0,
  paletteSaturation = 1,
  facetContrast = FACET_LIGHTNESS_STEP,
  sandLightness = 0,
  paletteColors = DEFAULT_TILE_PALETTE_COLORS,
}: {
  board: BoardModel;
  seed: string;
  paletteLightness?: number;
  paletteSaturation?: number;
  facetContrast?: number;
  sandLightness?: number;
  paletteColors?: TilePaletteColors;
}) {
  const clickTile = useGame((s) => s.clickTile);
  const robberTile = useGame((s) => s.game?.robberTile ?? -1);
  const phase = useGame((s) => s.game?.phase);
  const isHumanTurn = useGame((s) => (s.game ? !s.game.players[s.game.current].isNpc : false));
  const stormTile = useGame((s) => (s.game?.worldEvent?.kind === 'storm' ? s.game.worldEvent.tileId ?? -1 : -1));
  const goldenTile = useGame((s) => s.game?.goldenTile ?? -1);

  const mats = useMemo(() => {
    const m: Partial<Record<Terrain, THREE.MeshStandardMaterial>> = {};
    (Object.keys(TERRAIN_COLOR) as Terrain[]).forEach((t) => {
      m[t] = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: makeTerrainTexture(t, paletteLightness, paletteSaturation, facetContrast, sandLightness, paletteColors),
        roughness: 0.94,
      });
    });
    return m as Record<Terrain, THREE.MeshStandardMaterial>;
  }, [facetContrast, paletteColors, paletteLightness, paletteSaturation, sandLightness]);
  const sandSideMat = useMemo(() => {
    const color = tuneColor(new THREE.Color(paletteColors.sandSide), paletteSaturation, paletteLightness + sandLightness);
    return new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
  }, [paletteColors.sandSide, paletteLightness, paletteSaturation, sandLightness]);

  useEffect(() => () => {
    Object.values(mats).forEach((material) => {
      material.map?.dispose();
      material.dispose();
    });
    sandSideMat.dispose();
  }, [mats, sandSideMat]);

  const robberSelecting = phase === 'robber' && isHumanTurn;

  return (
    <group>
      {board.tiles.map((tile) => (
        <group key={tile.id} position={[tile.x, 0, tile.z]}>
          <mesh
            geometry={hexBaseGeo}
            material={sandSideMat}
            position={[0, 0.15, 0]}
            onClick={(e) => { e.stopPropagation(); clickTile(tile.id); }}
          />
          <mesh
            geometry={crownedHexGeo}
            material={mats[tile.terrain]}
            rotation={[0, ((tile.id * 5) % 6) * Math.PI / 3, 0]}
            onClick={(e) => { e.stopPropagation(); clickTile(tile.id); }}
          />
          <group position={[0, TILE_TOP_Y + TILE_CROWN, 0]}>
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
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TILE_TOP_Y + TILE_CROWN + 0.02, 0]}>
              <ringGeometry args={[0.75, 0.9, 32]} />
              <meshBasicMaterial color="#ff5544" transparent opacity={0.5} />
            </mesh>
          )}
          {stormTile === tile.id && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TILE_TOP_Y + TILE_CROWN + 0.04, 0]}>
              <ringGeometry args={[0.6, 0.95, 32]} />
              <meshBasicMaterial color="#7fb8ff" transparent opacity={0.4} />
            </mesh>
          )}
          {goldenTile === tile.id && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TILE_TOP_Y + TILE_CROWN + 0.03, 0]}>
              <ringGeometry args={[0.8, 0.95, 32]} />
              <meshBasicMaterial color="#ffce4a" transparent opacity={0.55} />
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
