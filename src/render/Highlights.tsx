import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useStore } from "../store/store";
import {
  validCityVertices,
  validMegacityVertices,
  validRoadEdges,
  validSettlementVertices,
} from "../game/rules";
import { audio } from "../fx/audio";
import { TOP_Y } from "./Board";

function Ring({
  x,
  z,
  color,
  onClick,
  onOver,
}: {
  x: number;
  z: number;
  color: string;
  onClick: () => void;
  onOver?: (over: boolean) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ref.current) {
      const s = 1 + Math.sin(t * 4) * 0.15;
      ref.current.scale.set(s, s, s);
      (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(t * 4) * 0.2;
    }
    if (inner.current) inner.current.rotation.z = t * 2;
  });
  return (
    <group position={[x, TOP_Y + 0.12, z]}>
      <mesh
        ref={ref}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          audio.click();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onOver?.(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onOver?.(false);
          document.body.style.cursor = "auto";
        }}
      >
        <ringGeometry args={[0.16, 0.28, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={inner} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.05, 0.12, 3]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function EdgeHighlight({
  ax,
  az,
  bx,
  bz,
  color,
  onClick,
}: {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  color: string;
  onClick: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const mid = { x: (ax + bx) / 2, z: (az + bz) / 2 };
  const angle = Math.atan2(bz - az, bx - ax);
  const len = Math.hypot(bx - ax, bz - az);
  useFrame((state) => {
    if (ref.current) {
      const m = ref.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.4 + Math.sin(state.clock.elapsedTime * 5) * 0.25;
    }
  });
  return (
    <mesh
      ref={ref}
      position={[mid.x, TOP_Y + 0.06, mid.z]}
      rotation={[0, -angle, 0]}
      onClick={(e) => {
        e.stopPropagation();
        audio.click();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      <boxGeometry args={[len * 0.8, 0.06, 0.16]} />
      <meshBasicMaterial color={color} transparent opacity={0.5} />
    </mesh>
  );
}

function TileTargets() {
  const board = useStore((s) => s.game!.board);
  const robber = useStore((s) => s.game!.robberTileId);
  const clickTile = useStore((s) => s.clickTile);
  return (
    <group>
      {board.tileOrder.map((id) => {
        if (id === robber) return null;
        const t = board.tiles[id];
        return (
          <mesh
            key={id}
            position={[t.cx, TOP_Y + 0.5, t.cz]}
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={(e) => {
              e.stopPropagation();
              audio.robber();
              clickTile(id);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => (document.body.style.cursor = "auto")}
          >
            <circleGeometry args={[0.6, 6]} />
            <meshBasicMaterial color="#ff4444" transparent opacity={0.25} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}

export function Highlights() {
  const game = useStore((s) => s.game);
  const buildMode = useStore((s) => s.buildMode);
  const clickVertex = useStore((s) => s.clickVertex);
  const clickEdge = useStore((s) => s.clickEdge);
  useStore((s) => s.tick); // re-render on state changes
  if (!game) return null;
  const human = game.current === 0 && game.players[0].isHuman;
  if (!human) return null;

  const color = game.players[0].color;

  // Robber placement
  if (game.phase === "robber-move") {
    return <TileTargets />;
  }

  // Setup phase
  if (game.phase === "setup-place") {
    if (game.setupStage === "settlement") {
      const spots = validSettlementVertices(game, 0, true);
      return (
        <group>
          {spots.map((id) => {
            const v = game.board.vertices[id];
            return <Ring key={id} x={v.x} z={v.z} color={color} onClick={() => clickVertex(id)} />;
          })}
        </group>
      );
    }
    const edges = validRoadEdges(game, 0, game.setupLastVertex ?? undefined);
    return (
      <group>
        {edges.map((eid) => {
          const e = game.board.edges[eid];
          const a = game.board.vertices[e.a];
          const b = game.board.vertices[e.b];
          return (
            <EdgeHighlight key={eid} ax={a.x} az={a.z} bx={b.x} bz={b.z} color={color} onClick={() => clickEdge(eid)} />
          );
        })}
      </group>
    );
  }

  // Build phase, depends on selected build mode
  if (game.phase === "build" && buildMode) {
    if (buildMode.kind === "road") {
      const edges = validRoadEdges(game, 0);
      return (
        <group>
          {edges.map((eid) => {
            const e = game.board.edges[eid];
            const a = game.board.vertices[e.a];
            const b = game.board.vertices[e.b];
            return (
              <EdgeHighlight key={eid} ax={a.x} az={a.z} bx={b.x} bz={b.z} color={color} onClick={() => clickEdge(eid)} />
            );
          })}
        </group>
      );
    }
    let spots: number[] = [];
    if (buildMode.kind === "settlement") spots = validSettlementVertices(game, 0, false);
    else if (buildMode.kind === "city") spots = validCityVertices(game, 0);
    else if (buildMode.kind === "megacity") spots = validMegacityVertices(game, 0);
    return (
      <group>
        {spots.map((id) => {
          const v = game.board.vertices[id];
          return <Ring key={id} x={v.x} z={v.z} color={color} onClick={() => clickVertex(id)} />;
        })}
      </group>
    );
  }

  return null;
}
