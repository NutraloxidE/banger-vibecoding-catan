import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useGame } from '../game/store';

// Orbit + zoom + pan, with soft auto-focus toward recent events.
export function CameraRig({ boardRadius }: { boardRadius: number }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const focusTarget = useRef(new THREE.Vector3());

  useFrame(() => {
    const c = controls.current;
    if (!c) return;
    const focus = useGame.getState().game?.focus;
    if (focus && Date.now() - focus.at < 1800) {
      focusTarget.current.set(focus.x * 0.7, 0, focus.z * 0.7);
      c.target.lerp(focusTarget.current, 0.06);
      c.update();
    }
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan
      enableDamping
      dampingFactor={0.08}
      minDistance={4}
      maxDistance={boardRadius * 6 + 12}
      minPolarAngle={0.15}
      maxPolarAngle={1.35}
      target={[0, 0, 0]}
    />
  );
}
