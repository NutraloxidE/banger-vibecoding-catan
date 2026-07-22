import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../game/store';
import { diceFaceTexture } from './textures';

// Physical-feeling dice drop. The values are already decided by the store;
// the animation only presents them, then calls finishDice exactly once.

const diceGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);

// face materials: index order +x -x +y -y +z -z shows value i+1
function makeDieMaterials(): THREE.MeshStandardMaterial[] {
  return [1, 2, 3, 4, 5, 6].map(
    (v) => new THREE.MeshStandardMaterial({ map: diceFaceTexture(v), roughness: 0.4 }),
  );
}

const FACE_NORMALS: THREE.Vector3[] = [
  new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
];

function faceUpQuaternion(value: number, yaw: number): THREE.Quaternion {
  const n = FACE_NORMALS[value - 1];
  const q = new THREE.Quaternion().setFromUnitVectors(n, new THREE.Vector3(0, 1, 0));
  const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  return qy.multiply(q);
}

function Die({ value, offsetX, delay, giant, startedAt, dur }: {
  value: number; offsetX: number; delay: number; giant: boolean; startedAt: number; dur: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const mats = useMemo(makeDieMaterials, []);
  const target = useMemo(() => faceUpQuaternion(value, offsetX * 1.7 + value), [value, offsetX]);
  const tumbleAxis = useMemo(
    () => new THREE.Vector3(Math.sin(value * 3.1), 1, Math.cos(value * 1.7)).normalize(),
    [value],
  );
  const tmpQ = useMemo(() => new THREE.Quaternion(), []);

  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const t = Math.max(0, Math.min(1, (Date.now() - startedAt - delay) / dur));
    const scale = giant ? 2.3 : 1;
    // fall with a bounce
    const fall = t < 0.6 ? 1 - Math.pow(t / 0.6, 2) : 0;
    const bounce = t >= 0.6 && t < 0.85 ? Math.sin(((t - 0.6) / 0.25) * Math.PI) * 0.5 : 0;
    const y = 0.35 * scale + fall * 7 + bounce;
    m.position.set(offsetX * scale, y, 1.2);
    m.scale.setScalar(scale);
    if (t < 0.75) {
      tmpQ.setFromAxisAngle(tumbleAxis, t * 14 + offsetX);
      m.quaternion.copy(tmpQ);
    } else {
      const k = Math.min(1, (t - 0.75) / 0.2);
      tmpQ.setFromAxisAngle(tumbleAxis, 0.75 * 14 + offsetX);
      m.quaternion.slerpQuaternions(tmpQ, target, k);
    }
  });

  return <mesh ref={ref} geometry={diceGeo} material={mats} />;
}

export function DiceRitual() {
  const phase = useGame((s) => s.game?.phase);
  const dice = useGame((s) => s.game?.dice ?? null);
  const startedAt = useGame((s) => s.game?.diceStartedAt ?? 0);
  const giant = useGame((s) => s.game?.diceGiant ?? false);
  const fast = useGame((s) => s.settings.fastMode);
  const finishDice = useGame((s) => s.finishDice);
  const done = useRef(false);

  const dur = fast ? 650 : 1350;

  useFrame(() => {
    if (phase !== 'dice' || !dice) { done.current = false; return; }
    if (!done.current && Date.now() - startedAt > dur + 450) {
      done.current = true;
      finishDice();
    }
  });

  if (phase !== 'dice' || !dice) return null;
  return (
    <group>
      <Die value={dice[0]} offsetX={-0.7} delay={0} giant={giant} startedAt={startedAt} dur={dur} />
      <Die value={dice[1]} offsetX={0.7} delay={120} giant={giant} startedAt={startedAt} dur={dur} />
    </group>
  );
}
