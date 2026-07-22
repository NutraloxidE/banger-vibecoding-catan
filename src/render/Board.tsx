import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BIOME_INFO, HEX_SIZE } from "../game/constants";
import type { BoardGraph, Tile } from "../game/types";
import { numberTokenTexture } from "./textures";
import { useStore } from "../store/store";

export const TILE_H = 0.4;
export const TOP_Y = TILE_H / 2;

function biomeHeight(tile: Tile): number {
  if (tile.biome === "ore") return 0.75;
  if (tile.biome === "wood") return 0.5;
  if (tile.biome === "gold") return 0.55;
  return TILE_H;
}

function HexTile({ tile }: { tile: Tile }) {
  const info = BIOME_INFO[tile.biome];
  const h = biomeHeight(tile);
  const activated = useStore((s) => s.fx.activatedTiles.includes(tile.id));
  const isRobber = useStore((s) => s.game?.robberTileId === tile.id);
  const ref = useRef<THREE.Group>(null);
  const pulse = useRef(0);

  useFrame((_, dt) => {
    if (activated) pulse.current = Math.min(1, pulse.current + dt * 3);
    else pulse.current = Math.max(0, pulse.current - dt * 2);
    if (ref.current) {
      const s = 1 + pulse.current * 0.06;
      ref.current.scale.set(s, 1 + pulse.current * 0.12, s);
      ref.current.position.y = pulse.current * 0.08;
    }
  });

  return (
    <group ref={ref} position={[tile.cx, 0, tile.cz]}>
      {/* prism body */}
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <cylinderGeometry args={[HEX_SIZE * 0.98, HEX_SIZE * 0.98, h, 6]} />
        <meshStandardMaterial color={info.color} flatShading roughness={0.9} />
      </mesh>
      {/* top cap (brighter) */}
      <mesh receiveShadow position={[0, h + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[HEX_SIZE * 0.9, 6]} />
        <meshStandardMaterial
          color={info.top}
          roughness={0.8}
          emissive={activated ? info.top : "#000"}
          emissiveIntensity={activated ? 0.4 : 0}
        />
      </mesh>

      <BiomeDecor tile={tile} h={h} />

      {tile.number !== null && !isRobber && (
        <mesh position={[0, h + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.36, 24]} />
          <meshBasicMaterial map={numberTokenTexture(tile.number)} transparent />
        </mesh>
      )}
    </group>
  );
}

function BiomeDecor({ tile, h }: { tile: Tile; h: number }) {
  const rng = useMemo(() => mulberryFromId(tile.id), [tile.id]);
  const items = useMemo(() => {
    const arr: { x: number; z: number; s: number; rot: number }[] = [];
    const count =
      tile.biome === "wood" ? 4 : tile.biome === "ore" ? 3 : tile.biome === "sheep" ? 3 : tile.biome === "wheat" ? 5 : tile.biome === "gold" ? 4 : 0;
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const r = 0.2 + rng() * 0.5;
      arr.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: 0.6 + rng() * 0.6, rot: rng() * Math.PI });
    }
    return arr;
  }, [tile.biome, rng]);

  if (tile.biome === "wood") {
    return (
      <group>
        {items.map((it, i) => (
          <group key={i} position={[it.x, h, it.z]} scale={it.s}>
            <mesh position={[0, 0.18, 0]}>
              <cylinderGeometry args={[0.03, 0.05, 0.22]} />
              <meshStandardMaterial color="#6b4423" />
            </mesh>
            <mesh position={[0, 0.38, 0]}>
              <coneGeometry args={[0.16, 0.4, 6]} />
              <meshStandardMaterial color="#2e7d32" flatShading />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  if (tile.biome === "ore") {
    return (
      <group>
        {items.map((it, i) => (
          <mesh key={i} position={[it.x, h + 0.14, it.z]} rotation={[0, it.rot, 0.3]} scale={it.s}>
            <octahedronGeometry args={[0.16]} />
            <meshStandardMaterial color="#9aa4b2" flatShading metalness={0.3} roughness={0.4} />
          </mesh>
        ))}
      </group>
    );
  }
  if (tile.biome === "gold") {
    return (
      <group>
        {items.map((it, i) => (
          <mesh key={i} position={[it.x, h + 0.16, it.z]} rotation={[it.rot, it.rot, 0]} scale={it.s}>
            <octahedronGeometry args={[0.18]} />
            <meshStandardMaterial color="#ffd34d" emissive="#b8860b" emissiveIntensity={0.5} metalness={0.6} roughness={0.2} />
          </mesh>
        ))}
      </group>
    );
  }
  if (tile.biome === "sheep") {
    return (
      <group>
        {items.map((it, i) => (
          <group key={i} position={[it.x, h + 0.08, it.z]} scale={it.s}>
            <mesh>
              <sphereGeometry args={[0.1, 8, 6]} />
              <meshStandardMaterial color="#f5f5f5" flatShading />
            </mesh>
            <mesh position={[0.09, 0.02, 0]}>
              <boxGeometry args={[0.05, 0.05, 0.05]} />
              <meshStandardMaterial color="#333" />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  if (tile.biome === "wheat") {
    return (
      <group>
        {items.map((it, i) => (
          <mesh key={i} position={[it.x, h + 0.1, it.z]} scale={it.s}>
            <coneGeometry args={[0.05, 0.2, 5]} />
            <meshStandardMaterial color="#e5b53a" flatShading />
          </mesh>
        ))}
      </group>
    );
  }
  return null;
}

function Water({ radius }: { radius: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      const m = ref.current.material as THREE.MeshStandardMaterial;
      m.opacity = 0.82 + Math.sin(state.clock.elapsedTime * 0.8) * 0.04;
    }
  });
  const r = (radius + 1.6) * HEX_SIZE * Math.sqrt(3) * 1.15;
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
      <circleGeometry args={[r, 64]} />
      <meshStandardMaterial color="#1b4f72" transparent opacity={0.85} roughness={0.2} metalness={0.4} />
    </mesh>
  );
}

export function Board({ board }: { board: BoardGraph }) {
  const tiles = board.tileOrder.map((id) => board.tiles[id]);
  return (
    <group>
      <Water radius={board.radius} />
      {tiles.map((t) => (
        <HexTile key={t.id} tile={t} />
      ))}
    </group>
  );
}

// tiny deterministic rng per tile for decoration layout
function mulberryFromId(id: string) {
  let a = 2166136261;
  for (let i = 0; i < id.length; i++) {
    a ^= id.charCodeAt(i);
    a = Math.imul(a, 16777619);
  }
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
