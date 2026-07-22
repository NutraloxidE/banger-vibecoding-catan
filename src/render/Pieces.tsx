import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { BoardGraph, Building, Road } from "../game/types";
import { useStore } from "../store/store";
import { TOP_Y } from "./Board";

function Settlement({ color }: { color: string }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.12, 0]}>
        <boxGeometry args={[0.22, 0.22, 0.22]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, 0.3, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.19, 0.16, 4]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    </group>
  );
}

function City({ color }: { color: string }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.16, 0]}>
        <boxGeometry args={[0.28, 0.32, 0.28]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.15} />
      </mesh>
      <mesh castShadow position={[0.14, 0.28, 0.05]}>
        <boxGeometry args={[0.16, 0.5, 0.16]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.2} emissive={color} emissiveIntensity={0.12} />
      </mesh>
      <mesh castShadow position={[-0.1, 0.22, -0.08]}>
        <boxGeometry args={[0.14, 0.3, 0.14]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
    </group>
  );
}

function MegaCity({ color }: { color: string }) {
  const ref = useRef<THREE.Group>(null);
  const towers = useMemo(
    () =>
      Array.from({ length: 6 }, () => ({
        x: (Math.random() - 0.5) * 0.4,
        z: (Math.random() - 0.5) * 0.4,
        h: 0.5 + Math.random() * 0.9,
        w: 0.08 + Math.random() * 0.09,
      })),
    [],
  );
  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.elapsedTime;
      ref.current.children.forEach((c, i) => {
        const mesh = c as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && mat.emissiveIntensity !== undefined) {
          mat.emissiveIntensity = 0.4 + Math.sin(t * 2 + i) * 0.25;
        }
      });
    }
  });
  return (
    <group>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.1, 6]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <group ref={ref}>
        {towers.map((t, i) => (
          <mesh key={i} castShadow position={[t.x, t.h / 2 + 0.1, t.z]}>
            <boxGeometry args={[t.w, t.h, t.w]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} metalness={0.4} roughness={0.3} />
          </mesh>
        ))}
      </group>
      <pointLight position={[0, 1.2, 0]} color={color} intensity={2} distance={4} />
    </group>
  );
}

function BuildingMesh({ b, board }: { b: Building; board: BoardGraph }) {
  const color = useStore((s) => s.game!.players[b.owner].color);
  const v = board.vertices[b.vertexId];
  const ref = useRef<THREE.Group>(null);
  const spawn = useRef(0);
  useFrame((_, dt) => {
    if (spawn.current < 1) {
      spawn.current = Math.min(1, spawn.current + dt * 3);
      if (ref.current) {
        const e = 1 - Math.pow(1 - spawn.current, 3);
        ref.current.scale.setScalar(e);
        ref.current.position.y = TOP_Y + (1 - e) * 1.5;
      }
    }
  });
  return (
    <group ref={ref} position={[v.x, TOP_Y, v.z]}>
      {b.kind === "settlement" && <Settlement color={color} />}
      {b.kind === "city" && <City color={color} />}
      {b.kind === "megacity" && <MegaCity color={color} />}
    </group>
  );
}

function RoadMesh({ road, board }: { road: Road; board: BoardGraph }) {
  const color = useStore((s) => s.game!.players[road.owner].color);
  const e = board.edges[road.edgeId];
  const a = board.vertices[e.a];
  const b = board.vertices[e.b];
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);
  return (
    <mesh position={[mid.x, TOP_Y + 0.04, mid.z]} rotation={[0, -angle, 0]} castShadow>
      <boxGeometry args={[len * 0.82, 0.08, 0.1]} />
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
  );
}

function Robber({ board }: { board: BoardGraph }) {
  const tileId = useStore((s) => s.game?.robberTileId);
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current && tileId) {
      const tile = board.tiles[tileId];
      ref.current.position.x += (tile.cx - ref.current.position.x) * 0.15;
      ref.current.position.z += (tile.cz - ref.current.position.z) * 0.15;
      ref.current.position.y = 0.7 + Math.sin(state.clock.elapsedTime * 2) * 0.04;
    }
  });
  if (!tileId) return null;
  const tile = board.tiles[tileId];
  return (
    <group ref={ref} position={[tile.cx, 0.7, tile.cz]}>
      <mesh castShadow>
        <capsuleGeometry args={[0.14, 0.28, 4, 8]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <pointLight position={[0, 0.4, 0]} color="#8b0000" intensity={1.2} distance={2} />
    </group>
  );
}

export function Pieces({ board }: { board: BoardGraph }) {
  const buildings = useStore((s) => s.game!.buildings);
  const roads = useStore((s) => s.game!.roads);
  return (
    <group>
      {Object.values(roads).map((r) => (
        <RoadMesh key={r.edgeId} road={r} board={board} />
      ))}
      {Object.values(buildings).map((b) => (
        <BuildingMesh key={b.vertexId} b={b} board={board} />
      ))}
      <Robber board={board} />
    </group>
  );
}
