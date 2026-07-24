import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import { useGame } from '../game/store';
import { coastalTileCenters } from '../game/board';
import { TILE_PALETTE_LIGHTNESS, Tiles } from './Tiles';
import { Ports } from './Ports';
import { Pieces } from './Pieces';
import { Highlights } from './Highlights';
import { FxLayer } from './FxLayer';
import { DiceRitual } from './DiceRitual';
import { Ambient, GAMEPLAY_WATER_LEVEL, GAMEPLAY_BOARD_SINK } from './Ambient';
import { CameraRig } from './CameraRig';

// Slightly slower than the title screen's default cell-drift frequency (0.55)
// for a calmer gameplay swell.
const GAMEPLAY_WATER_DRIFT_SPEED = 0.4;

export function GameScene() {
  const board = useGame((s) => s.game?.board);
  const seed = useGame((s) => s.game?.config.seed ?? 'x');
  const shoreTiles = useMemo(() => (board ? coastalTileCenters(board) : []), [board]);
  if (!board) return null;
  const boardRadius = (board.radius * 2 + 1) * 0.9;

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [7, 9, 9], fov: 48 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ touchAction: 'none' }}
    >
      <fog attach="fog" args={['#9cc4de', 24, 60]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[10, 18, 6]} intensity={1.5} color="#fff4e0" />
      <directionalLight position={[-8, 10, -10]} intensity={0.35} color="#a8c8ff" />
      <Sky sunPosition={[60, 40, 20]} turbidity={6} rayleigh={1.6} />
      <Ambient boardRadius={boardRadius} boatDistance={boardRadius * 2.5 + 5} waterLevel={GAMEPLAY_WATER_LEVEL} waterDriftSpeed={GAMEPLAY_WATER_DRIFT_SPEED} shoreTiles={shoreTiles} />
      {/* The island and everything riding on the tile tops (terrain decorations,
          number tokens, robber, buildings, placement highlights, production FX)
          sink together into the sea so the coast dips just below the waterline
          instead of floating above it. The water, docks, and boats stay put. */}
      <group position={[0, -GAMEPLAY_BOARD_SINK, 0]}>
        <Tiles board={board} seed={seed} paletteLightness={TILE_PALETTE_LIGHTNESS} />
        <Pieces />
        <Highlights />
        <FxLayer />
      </group>
      <Ports />
      <DiceRitual />
      <CameraRig boardRadius={boardRadius} />
    </Canvas>
  );
}
