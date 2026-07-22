import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Board } from "./Board";
import { Pieces } from "./Pieces";
import { Highlights } from "./Highlights";
import { Dice } from "./Dice";
import { useStore } from "../store/store";

// OrbitControls impl ref is typed loosely to avoid a hard three-stdlib type dep.
function CameraFocus({ controls }: { controls: React.MutableRefObject<any> }) {
  const { camera } = useThree();
  const focus = useStore((s) => s.fx.cameraFocus);
  const target = useRef(new THREE.Vector3(0, 0, 0));
  useEffect(() => {
    if (focus) target.current.set(focus.x, 0, focus.z);
    else target.current.set(0, 0, 0);
  }, [focus]);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const c = controls.current;
      if (c) {
        c.target.lerp(target.current, 0.06);
        c.update();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [controls, camera]);
  return null;
}

export function GameCanvas() {
  const board = useStore((s) => s.game?.board);
  const controls = useRef<any>(null);
  const radius = board?.radius ?? 2;
  const dist = 8 + radius * 2.5;

  if (!board) return null;

  return (
    <Canvas
      shadows
      dpr={[1, 1.8]}
      camera={{ position: [0, dist * 0.9, dist], fov: 45, near: 0.1, far: 200 }}
      gl={{ antialias: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#0b0e14"]} />
      <fog attach="fog" args={["#0b0e14", dist * 1.4, dist * 3.2]} />

      <hemisphereLight args={["#bcd7ff", "#20303a", 0.7]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[10, 18, 8]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-radius * 4}
        shadow-camera-right={radius * 4}
        shadow-camera-top={radius * 4}
        shadow-camera-bottom={-radius * 4}
        shadow-camera-far={60}
      />
      <directionalLight position={[-8, 6, -10]} intensity={0.4} color="#5b8cff" />

      <Board board={board} />
      <Pieces board={board} />
      <Highlights />
      <Dice />

      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={5}
        maxDistance={dist * 2}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.3}
        rotateSpeed={0.6}
        zoomSpeed={0.8}
      />
      <CameraFocus controls={controls} />
    </Canvas>
  );
}
