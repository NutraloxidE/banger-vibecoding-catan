import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useStore } from "../store/store";
import { audio } from "../fx/audio";

const BIOME_COLORS = ["#3f8c43", "#c26a38", "#95d873", "#eec24a", "#889099", "#ffd34d"];

function FloatingHex({ i }: { i: number }) {
  const ref = useRef<THREE.Group>(null);
  const data = useMemo(() => {
    const a = (i / 22) * Math.PI * 2 + Math.random();
    const r = 3 + Math.random() * 7;
    return {
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      baseY: -2 + Math.random() * 4,
      speed: 0.3 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
      color: BIOME_COLORS[i % BIOME_COLORS.length],
      spin: (Math.random() - 0.5) * 0.5,
      h: 0.3 + Math.random() * 0.5,
    };
  }, [i]);
  useFrame((state) => {
    if (ref.current) {
      const t = state.clock.elapsedTime;
      ref.current.position.y = data.baseY + Math.sin(t * data.speed + data.phase) * 0.6;
      ref.current.rotation.y = t * data.spin;
    }
  });
  return (
    <group ref={ref} position={[data.x, data.baseY, data.z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.8, 0.8, data.h, 6]} />
        <meshStandardMaterial color={data.color} flatShading roughness={0.85} />
      </mesh>
    </group>
  );
}

function TitleRig() {
  const { camera } = useThree();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    camera.position.x = Math.sin(t * 0.15) * 12;
    camera.position.z = Math.cos(t * 0.15) * 12;
    camera.position.y = 6 + Math.sin(t * 0.2) * 1.5;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function TitleScene() {
  const hexes = useMemo(() => Array.from({ length: 22 }, (_, i) => i), []);
  return (
    <Canvas shadows dpr={[1, 1.8]} camera={{ position: [0, 6, 12], fov: 50 }}>
      <color attach="background" args={["#0b0e14"]} />
      <fog attach="fog" args={["#0b0e14", 12, 32]} />
      <hemisphereLight args={["#bcd7ff", "#20303a", 0.8]} />
      <directionalLight position={[8, 14, 6]} intensity={1.3} castShadow />
      <pointLight position={[0, 4, 0]} color="#ffcf4d" intensity={2} distance={20} />
      {hexes.map((i) => (
        <FloatingHex key={i} i={i} />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]} receiveShadow>
        <circleGeometry args={[40, 64]} />
        <meshStandardMaterial color="#123047" roughness={0.3} metalness={0.5} />
      </mesh>
      <TitleRig />
    </Canvas>
  );
}

export function TitleScreen() {
  const goSetup = useStore((s) => s.goSetup);
  const continueGame = useStore((s) => s.continueGame);
  const hasSave = useStore((s) => s.hasSave());

  const start = () => {
    audio.unlock();
    audio.build();
    goSetup();
  };
  const cont = () => {
    audio.unlock();
    if (!continueGame()) start();
  };

  return (
    <div className="title-root">
      <div className="title-canvas">
        <TitleScene />
      </div>
      <div className="title-overlay">
        <div className="title-badge">A CHAOTIC 3D HEX STRATEGY GAME</div>
        <h1 className="title-logo">
          HEX<span>FALL</span>
        </h1>
        <p className="title-sub">
          Roll the economy. Build a terrible road. Ascend into a Mega City. Blame the sheep.
        </p>
        <div className="title-actions">
          <button className="btn btn-huge" onClick={start}>
            ▶ START GAME
          </button>
          {hasSave && (
            <button className="btn btn-ghost" onClick={cont}>
              ↺ Continue
            </button>
          )}
        </div>
        <div className="title-foot">Drag to orbit · Scroll / pinch to zoom · Desktop &amp; mobile</div>
      </div>
    </div>
  );
}
