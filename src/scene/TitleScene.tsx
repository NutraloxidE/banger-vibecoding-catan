import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, OrbitControls } from '@react-three/drei';
import { generateBoard, coastalTileCenters } from '../game/board';
import { Tiles } from './Tiles';
import { Ambient } from './Ambient';

// How often the background world regenerates into a fresh procedural island,
// and how long the cover-fade around the swap takes.
const WORLD_SWITCH_MS = 45_000;
const FADE_MS = 900;

function randomTitleSeed() {
  return `HEXTOPIA-TITLE-${Math.random().toString(36).slice(2, 10)}`;
}

// The title screen's living diorama: a demo island, slowly orbiting camera.
// The island itself is swapped for a freshly generated one on a timer so the
// background never looks static; the swap is hidden behind a brief fade.
export function TitleScene() {
  const [seed, setSeed] = useState('HEXTOPIA-TITLE');
  const [covered, setCovered] = useState(false);
  const board = useMemo(() => generateBoard('medium', seed), [seed]);
  const shoreTiles = useMemo(() => coastalTileCenters(board), [board]);

  useEffect(() => {
    let swapTimeout: ReturnType<typeof setTimeout>;
    const interval = setInterval(() => {
      setCovered(true);
      swapTimeout = setTimeout(() => {
        setSeed(randomTitleSeed());
        setCovered(false);
      }, FADE_MS);
    }, WORLD_SWITCH_MS);
    return () => { clearInterval(interval); clearTimeout(swapTimeout); };
  }, []);

  return (
    <>
      <Canvas dpr={[1, 1.5]} camera={{ position: [9, 7, 9], fov: 50 }} style={{ touchAction: 'none' }}>
        <fog attach="fog" args={['#9cc4de', 22, 55]} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[10, 18, 6]} intensity={1.3} color="#fff4e0" />
        <Sky sunPosition={[60, 35, 20]} turbidity={6} rayleigh={1.8} />
        <Ambient boardRadius={6.3} shoreTiles={shoreTiles} />
        <Tiles board={board} seed={seed} />
        <OrbitControls autoRotate autoRotateSpeed={0.7} enablePan={false} enableZoom={false}
          minPolarAngle={0.9} maxPolarAngle={1.2} />
      </Canvas>
      <div className={`title-scene-fade${covered ? ' title-scene-fade-covered' : ''}`} />
    </>
  );
}
