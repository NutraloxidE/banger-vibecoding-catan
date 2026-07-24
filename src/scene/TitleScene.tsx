import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, OrbitControls } from '@react-three/drei';
import { generateBoard, coastalTileCenters } from '../game/board';
import { DEFAULT_TILE_PALETTE_TUNING, TilePaletteTuning, Tiles } from './Tiles';
import { Ambient, GAMEPLAY_WATER_LEVEL, GAMEPLAY_BOARD_SINK } from './Ambient';

// Match the gameplay screen's calmer water swell (GameScene uses the same value)
// so the title world reads as the same world, not a separate demo look.
const GAMEPLAY_WATER_DRIFT_SPEED = 0.4;

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
export function TitleScene({ paletteTuning = DEFAULT_TILE_PALETTE_TUNING }: { paletteTuning?: TilePaletteTuning }) {
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
      <Canvas dpr={[1, 1.75]} camera={{ position: [9, 7, 9], fov: 48 }} style={{ touchAction: 'none' }}>
        <fog attach="fog" args={['#9cc4de', 24, 60]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[10, 18, 6]} intensity={1.5} color="#fff4e0" />
        <directionalLight position={[-8, 10, -10]} intensity={0.35} color="#a8c8ff" />
        <Sky sunPosition={[60, 40, 20]} turbidity={6} rayleigh={1.6} />
        <Ambient boardRadius={6.3} waterLevel={GAMEPLAY_WATER_LEVEL} waterDriftSpeed={GAMEPLAY_WATER_DRIFT_SPEED} shoreTiles={shoreTiles} />
        {/* Sink the island into the sea by the same amount as the gameplay
            screen so the coastline dips just below the raised waterline instead
            of floating above it — the water itself stays put. */}
        <group position={[0, -GAMEPLAY_BOARD_SINK, 0]}>
          <Tiles
            board={board}
            seed={seed}
            paletteLightness={paletteTuning.lightness}
            paletteSaturation={paletteTuning.saturation}
            facetContrast={paletteTuning.facetContrast}
            sandLightness={paletteTuning.sandLightness}
          />
        </group>
        <OrbitControls autoRotate autoRotateSpeed={0.7} enablePan={false} enableZoom={false}
          minPolarAngle={0.9} maxPolarAngle={1.2} />
      </Canvas>
      <div className={`title-scene-fade${covered ? ' title-scene-fade-covered' : ''}`} />
    </>
  );
}
