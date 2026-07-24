import { Canvas } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import { useGame } from '../game/store';
import { Tiles } from './Tiles';
import { Ports } from './Ports';
import { Pieces } from './Pieces';
import { Highlights } from './Highlights';
import { FxLayer } from './FxLayer';
import { DiceRitual } from './DiceRitual';
import { Ambient, GAMEPLAY_WATER_LEVEL } from './Ambient';
import { CameraRig } from './CameraRig';

export function GameScene() {
  const board = useGame((s) => s.game?.board);
  const seed = useGame((s) => s.game?.config.seed ?? 'x');
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
      <ambientLight intensity={0.75} />
      <directionalLight position={[10, 18, 6]} intensity={1.35} color="#fff4e0" />
      <directionalLight position={[-8, 10, -10]} intensity={0.3} color="#a8c8ff" />
      <Sky sunPosition={[60, 40, 20]} turbidity={6} rayleigh={1.6} />
      <Ambient boardRadius={boardRadius} boatDistance={boardRadius * 2.5 + 5} waterLevel={GAMEPLAY_WATER_LEVEL} />
      <Tiles board={board} seed={seed} />
      <Ports />
      <Pieces />
      <Highlights />
      <FxLayer />
      <DiceRitual />
      <CameraRig boardRadius={boardRadius} />
    </Canvas>
  );
}
