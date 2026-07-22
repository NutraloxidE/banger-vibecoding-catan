import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, OrbitControls } from '@react-three/drei';
import { generateBoard } from '../game/board';
import { Tiles } from './Tiles';
import { Ambient } from './Ambient';

// The title screen's living diorama: a demo island, slowly orbiting camera.
export function TitleScene() {
  const board = useMemo(() => generateBoard('medium', 'HEXTOPIA-TITLE'), []);
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [9, 7, 9], fov: 50 }} style={{ touchAction: 'none' }}>
      <fog attach="fog" args={['#9cc4de', 22, 55]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[10, 18, 6]} intensity={1.3} color="#fff4e0" />
      <Sky sunPosition={[60, 35, 20]} turbidity={6} rayleigh={1.8} />
      <Ambient boardRadius={6.3} />
      <Tiles board={board} seed="HEXTOPIA-TITLE" />
      <OrbitControls autoRotate autoRotateSpeed={0.7} enablePan={false} enableZoom={false}
        minPolarAngle={0.9} maxPolarAngle={1.2} />
    </Canvas>
  );
}
