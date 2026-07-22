import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useGame } from '../game/store';

const UP = new THREE.Vector3(0, 1, 0);

// Orbit + zoom + pan, with soft auto-focus toward recent events.
// Desktop: WASD glides the view horizontally along the ground, relative to
// the direction the camera faces (W forward, S back, A/D strafe).
export function CameraRig({ boardRadius }: { boardRadius: number }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const focusTarget = useRef(new THREE.Vector3());
  const keys = useRef({ w: false, a: false, s: false, d: false });

  // Track WASD state. Ignore while typing in a form field.
  useEffect(() => {
    const set = (e: KeyboardEvent, down: boolean) => {
      const el = document.activeElement;
      if (down && el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable)) return;
      const k = keys.current;
      switch (e.code) {
        case 'KeyW': k.w = down; break;
        case 'KeyA': k.a = down; break;
        case 'KeyS': k.s = down; break;
        case 'KeyD': k.d = down; break;
        default: return;
      }
    };
    const onDown = (e: KeyboardEvent) => set(e, true);
    const onUp = (e: KeyboardEvent) => set(e, false);
    const clear = () => { keys.current = { w: false, a: false, s: false, d: false }; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', clear);
    };
  }, []);

  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const move = useRef(new THREE.Vector3());

  useFrame(({ camera }, delta) => {
    const c = controls.current;
    if (!c) return;

    const k = keys.current;
    const moving = k.w || k.a || k.s || k.d;
    if (moving) {
      // ground-plane forward (camera facing, flattened) and its perpendicular
      camera.getWorldDirection(forward.current);
      forward.current.y = 0;
      if (forward.current.lengthSq() < 1e-6) return; // looking straight down
      forward.current.normalize();
      right.current.crossVectors(forward.current, UP).normalize();

      move.current.set(0, 0, 0);
      if (k.w) move.current.add(forward.current);
      if (k.s) move.current.sub(forward.current);
      if (k.d) move.current.add(right.current);
      if (k.a) move.current.sub(right.current);

      if (move.current.lengthSq() > 0) {
        // speed scales with zoom so it feels consistent near and far
        const dist = camera.position.distanceTo(c.target);
        move.current.normalize().multiplyScalar(dist * 0.9 * delta);

        // clamp the target within the playfield so you can't lose the board
        const limit = boardRadius * 2.4 + 4;
        const nx = THREE.MathUtils.clamp(c.target.x + move.current.x, -limit, limit);
        const nz = THREE.MathUtils.clamp(c.target.z + move.current.z, -limit, limit);
        move.current.set(nx - c.target.x, 0, nz - c.target.z);

        camera.position.add(move.current);
        c.target.add(move.current);
        c.update();
      }
    }

    // Soft auto-focus toward recent events — yields to active WASD steering.
    if (!moving) {
      const focus = useGame.getState().game?.focus;
      if (focus && Date.now() - focus.at < 1800) {
        focusTarget.current.set(focus.x * 0.7, 0, focus.z * 0.7);
        c.target.lerp(focusTarget.current, 0.06);
        c.update();
      }
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
