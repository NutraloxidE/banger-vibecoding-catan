import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../game/store';
import { validSettlementSpots, validRoadSpots } from '../game/rules';
import { vertexScore } from '../game/board';
import { sfx } from '../audio/sfx';

const ringGeo = new THREE.TorusGeometry(0.2, 0.035, 10, 24);
const hitSphere = new THREE.SphereGeometry(0.3, 8, 8);
const edgeGlow = new THREE.BoxGeometry(0.66, 0.1, 0.2);
const edgeHit = new THREE.BoxGeometry(0.72, 0.5, 0.42);
const ghostBox = new THREE.BoxGeometry(0.2, 0.2, 0.2);

function Pulse({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 4) * 0.15;
      ref.current.scale.setScalar(s);
    }
  });
  return <group ref={ref}>{children}</group>;
}

// Valid-placement highlighting + click targets for vertices and edges.
export function Highlights() {
  const game = useGame((s) => s.game);
  const clickVertex = useGame((s) => s.clickVertex);
  const clickEdge = useGame((s) => s.clickEdge);
  const setHoverSpot = useGame((s) => s.setHoverSpot);

  const derived = useMemo(() => {
    if (!game || game.winner !== null) return null;
    const pid = game.current;
    if (game.players[pid].isNpc) return null;
    if (game.phase === 'setup') {
      if (game.setupStage === 'settlement') {
        return { mode: 'vertex' as const, kind: 'settlement' as const, spots: validSettlementSpots(game, pid, true) };
      }
      return { mode: 'edge' as const, kind: 'road' as const, spots: validRoadSpots(game, pid, game.setupLastVertex) };
    }
    if (game.phase === 'main' && game.placement) {
      const kind = game.placement.kind;
      return {
        mode: kind === 'road' ? ('edge' as const) : ('vertex' as const),
        kind,
        spots: game.placement.spots,
      };
    }
    return null;
    // placement.spots array identity + phase changes drive recompute
  }, [game?.phase, game?.setupStage, game?.setupIdx, game?.placement, game?.current, game?.buildings, game?.roads, game?.winner]);

  if (!game || !derived) return null;
  const { board } = game;
  const color = game.players[game.current].color;

  if (derived.mode === 'vertex') {
    return (
      <group>
        {derived.spots.map((vid) => {
          const v = board.vertices[vid];
          if (!v) return null;
          const score = vertexScore(board, vid);
          const good = score >= 9;
          const isHover = game.hoverSpot === vid;
          return (
            <group key={vid} position={[v.x, 0.34, v.z]}>
              <Pulse>
                <mesh geometry={ringGeo} rotation={[Math.PI / 2, 0, 0]}>
                  <meshBasicMaterial color={good ? '#ffe066' : '#7fffd4'} transparent opacity={isHover ? 1 : 0.75} />
                </mesh>
              </Pulse>
              {isHover && (
                <mesh geometry={ghostBox} position={[0, 0.12, 0]}>
                  <meshStandardMaterial color={color} transparent opacity={0.55} />
                </mesh>
              )}
              <mesh
                geometry={hitSphere}
                visible={false}
                onClick={(e) => { e.stopPropagation(); clickVertex(vid); }}
                onPointerOver={(e) => { e.stopPropagation(); setHoverSpot(vid); sfx.hover(); }}
                onPointerOut={() => setHoverSpot(null)}
              />
            </group>
          );
        })}
      </group>
    );
  }

  return (
    <group>
      {derived.spots.map((eid) => {
        const e = board.edges[eid];
        if (!e) return null;
        const isHover = game.hoverSpot === eid;
        return (
          <group key={eid} position={[e.x, 0.36, e.z]} rotation={[0, e.rot, 0]}>
            <Pulse>
              <mesh geometry={edgeGlow}>
                <meshBasicMaterial color={isHover ? color : '#7fffd4'} transparent opacity={isHover ? 0.95 : 0.55} />
              </mesh>
            </Pulse>
            <mesh
              geometry={edgeHit}
              visible={false}
              onClick={(ev) => { ev.stopPropagation(); clickEdge(eid); }}
              onPointerOver={(ev) => { ev.stopPropagation(); setHoverSpot(eid); sfx.hover(); }}
              onPointerOut={() => setHoverSpot(null)}
            />
          </group>
        );
      })}
    </group>
  );
}
