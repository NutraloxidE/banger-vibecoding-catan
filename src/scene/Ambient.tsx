import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// Water, drifting clouds, and boats circling the island.
// Pure decoration — never blocks input (raycast disabled).

const boatHull = new THREE.BoxGeometry(0.5, 0.12, 0.2);
const boatSail = new THREE.ConeGeometry(0.14, 0.34, 4);
const cloudGeo = new THREE.SphereGeometry(1, 10, 8);

const hullMat = new THREE.MeshStandardMaterial({ color: '#8a5a33' });
const sailMat = new THREE.MeshStandardMaterial({ color: '#f4efe2' });
const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false });

// Default sea surface level. GameScene raises it (via Ambient's waterLevel prop)
// so the island + docks sit IN the water rather than floating above it; the
// frozen title screen keeps the original level by using the default.
export const DEFAULT_WATER_LEVEL = -0.16;
// Sea surface used on the gameplay screen (island base is at y=0, so this keeps
// the coastline just meeting the water). Shared with Ports.tsx so the harbor
// boat + buoy float at the same line.
export const GAMEPLAY_WATER_LEVEL = -0.02;
// How far the gameplay island is lowered into the sea so the coastline dips a
// little BELOW the waterline instead of hovering above it (the surf-foam ring
// made the old ~hairline gap read as "floating"). GameScene sinks the whole
// board-content group (tiles + everything riding on them) by this; Ports drops
// its coastal bridge nodes by the same amount so the piers still meet the shore.
// The water itself and the water-anchored dock/boat/buoy are NOT sunk.
export const GAMEPLAY_BOARD_SINK = 0.1;

// Cellular-noise (Worley) water surface. The sea plane is a subdivided ring
// (a circle keeps the original silhouette, but a fan `circleGeometry` has no
// interior vertices to displace — a ring's concentric phi-segments do). The
// vertex shader raises each vertex by a cellular-noise height field and derives
// a per-vertex normal from the field's gradient; the fragment shader shades it
// (diffuse + a specular glint) and paints foam where Worley cells meet. All
// procedural — no textures, matching the no-external-assets rule.
const WATER_VERT = /* glsl */ `
uniform float uTime;
uniform float uDriftSpeed;
varying float vHeight;
varying vec3 vNormalW;
varying vec2 vCell;
varying vec3 vWorldPos;

vec2 hash2(vec2 p){
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453123);
}

// Worley/cellular noise: returns (F1, F2) — distances to the nearest and
// second-nearest animated feature points around p.
vec2 cellular(vec2 p){
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  float f1 = 9.0, f2 = 9.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(ip + g);
      o = 0.5 + 0.5 * sin(uTime * uDriftSpeed + 6.2831853 * o); // drift the cells
      vec2 r = g + o - fp;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; }
      else if (d < f2) { f2 = d; }
    }
  }
  return vec2(sqrt(f1), sqrt(f2));
}

// Three octaves of cellular noise → a swell height field (a fine high-freq
// layer on top of the original two gives higher-resolution ripple detail);
// also hands back the coarse cell (F1,F2) so the fragment shader can foam
// the crests.
float waveField(vec2 w, out vec2 cellOut){
  vec2 c1 = cellular(w * 0.18);
  vec2 c2 = cellular(w * 0.44 + 5.0);
  vec2 c3 = cellular(w * 1.15 + 11.0);
  cellOut = c1;
  return (c1.x - 0.5) * 0.8 + (c2.x - 0.5) * 0.3 + (c3.x - 0.5) * 0.12;
}

void main(){
  vec3 pos = position;
  vec2 w = (modelMatrix * vec4(pos, 1.0)).xz; // world XZ so waves are stable
  vec2 cell;
  float h = waveField(w, cell);
  const float amp = 0.16;
  const float e = 0.25;
  vec2 ignore;
  float hx = waveField(w + vec2(e, 0.0), ignore);
  float hz = waveField(w + vec2(0.0, e), ignore);
  pos.z += h * amp; // ring lies in XY; local +Z becomes world up after rotation
  vHeight = h;
  vCell = cell;
  vNormalW = normalize(vec3(-(hx - h) * amp / e, 1.0, -(hz - h) * amp / e));
  vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const MAX_SHORE_TILES = 24;

const WATER_FRAG = /* glsl */ `
uniform vec3 uColorDeep;
uniform vec3 uColorShallow;
uniform vec3 uColorCrest;
uniform vec3 uLightDir;
uniform float uOpacity;
uniform float uTime;
uniform float uDriftSpeed;
uniform float uShoreWidth;
uniform float uHexApothem;
uniform float uRadius;
uniform vec2 uShoreTiles[${MAX_SHORE_TILES}];
uniform int uShoreCount;
varying float vHeight;
varying vec3 vNormalW;
varying vec2 vCell;
varying vec3 vWorldPos;

vec2 shoreHash2(vec2 p){
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453123);
}

// Finer, independent Worley field used only for the shoreline surf lace —
// higher frequency than the swell's cells so it reads as small surf foam.
vec2 shoreCellular(vec2 p){
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  float f1 = 9.0, f2 = 9.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = shoreHash2(ip + g);
      o = 0.5 + 0.5 * sin(uTime * uDriftSpeed * 1.7 + 6.2831853 * o);
      vec2 r = g + o - fp;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; }
      else if (d < f2) { f2 = d; }
    }
  }
  return vec2(sqrt(f1), sqrt(f2));
}

// Signed distance to a regular hexagon (apothem r) with flat top/bottom edges
// — negative inside, positive outside. iq's formula. The tiles are pointy-top
// in +z, so the caller swaps components to rotate this 90°.
float sdHexFlat(vec2 p, float r){
  const vec3 k = vec3(-0.8660254, 0.5, 0.5773503);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

void main(){
  vec3 N = normalize(vNormalW);
  vec3 L = normalize(uLightDir);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 H = normalize(L + V);
  float diff = clamp(dot(N, L), 0.0, 1.0);
  // Toon: quantize diffuse + depth shading into hard bands instead of a
  // smooth gradient, and turn the specular into a crisp cel highlight.
  float diffToon = floor(diff * 4.0 + 0.5) / 4.0;
  float specRaw = pow(clamp(dot(N, H), 0.0, 1.0), 40.0);
  float spec = step(0.55, specRaw);
  float depth = smoothstep(-0.5, 0.5, vHeight);
  float depthToon = floor(depth * 3.0 + 0.5) / 3.0;
  vec3 base = mix(uColorDeep, uColorShallow, depthToon);
  // Foam where Worley cells border (F2-F1 small) — hard toon edge, no blend.
  float border = step(vCell.y - vCell.x, 0.12) * step(-0.08, vHeight);
  base = mix(base, uColorCrest, border);
  vec3 col = base * (0.68 + 0.4 * diffToon) + spec * vec3(0.9);
  // Shoreline surf: a fine cellular-noise lace that hugs the ACTUAL tile
  // silhouette — the distance field is the min over the coastal (outer-ring)
  // tiles of a hexagon SDF, so the foam follows the jagged hex coastline
  // rather than a circle. It spreads outward from the tile edge and fades to
  // nothing uShoreWidth units out. A cheap radial pre-gate keeps the
  // per-fragment tile loop confined to the coast annulus.
  float radial = length(vWorldPos.xz);
  if (radial > uRadius * 0.4 && radial < uRadius * 1.7) {
    float d = 1e6;
    for (int i = 0; i < ${MAX_SHORE_TILES}; i++) {
      if (i >= uShoreCount) break;
      vec2 rp = vWorldPos.xz - uShoreTiles[i];
      d = min(d, sdHexFlat(vec2(rp.y, rp.x), uHexApothem)); // swap → pointy-top in +z
    }
    float shoreOutward = smoothstep(-0.03, 0.05, d);
    float shoreFade = 1.0 - smoothstep(0.0, uShoreWidth, d);
    float shoreBand = shoreOutward * shoreFade;
    vec2 shoreCell = shoreCellular(vWorldPos.xz * 3.4 + 9.0);
    float shoreFoam = step(shoreCell.y - shoreCell.x, 0.2) * shoreBand;
    col = mix(col, uColorCrest, shoreFoam * 0.9);
  }
  gl_FragColor = vec4(col, uOpacity);
}
`;

// Default cell-drift time frequency (matches the frozen title screen's original
// look). GameScene passes a slightly slower value for a calmer gameplay swell.
export const DEFAULT_WATER_DRIFT_SPEED = 0.55;

// Apothem (center-to-flat) of a coastal tile at the waterline. Tiles render as
// a 6-gon of circumradius ~1.06 at their base, so apothem ≈ 1.06·√3/2 ≈ 0.9.
const SHORE_HEX_APOTHEM = 0.9;
// How far (world units) the surf foam reaches out from the tile edge.
const SHORE_FOAM_WIDTH = 0.6;

export function Water({ radius, level = DEFAULT_WATER_LEVEL, driftSpeed = DEFAULT_WATER_DRIFT_SPEED, shoreTiles }: { radius: number; level?: number; driftSpeed?: number; shoreTiles?: [number, number][] }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDriftSpeed: { value: driftSpeed },
      uColorDeep: { value: new THREE.Color('#a3d3ec') },
      uColorShallow: { value: new THREE.Color('#dcf1f8') },
      uColorCrest: { value: new THREE.Color('#ffffff') },
      uLightDir: { value: new THREE.Vector3(10, 18, 6).normalize() },
      uOpacity: { value: 0.9 },
      uRadius: { value: radius },
      uShoreWidth: { value: SHORE_FOAM_WIDTH },
      uHexApothem: { value: SHORE_HEX_APOTHEM },
      uShoreTiles: { value: Array.from({ length: MAX_SHORE_TILES }, () => new THREE.Vector2(9999, 9999)) },
      uShoreCount: { value: 0 },
    },
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    transparent: true,
    side: THREE.DoubleSide,
  }), []);
  useEffect(() => { mat.uniforms.uDriftSpeed.value = driftSpeed; }, [mat, driftSpeed]);
  useEffect(() => { mat.uniforms.uRadius.value = radius; }, [mat, radius]);
  useEffect(() => {
    const arr = mat.uniforms.uShoreTiles.value as THREE.Vector2[];
    const n = Math.min(shoreTiles?.length ?? 0, MAX_SHORE_TILES);
    for (let i = 0; i < n; i++) arr[i].set(shoreTiles![i][0], shoreTiles![i][1]);
    for (let i = n; i < MAX_SHORE_TILES; i++) arr[i].set(9999, 9999);
    mat.uniforms.uShoreCount.value = n;
  }, [mat, shoreTiles]);
  const geo = useMemo(() => new THREE.RingGeometry(0.01, radius * 6, 200, 72), [radius]);
  useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.elapsedTime; });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, level, 0]} geometry={geo} material={mat} raycast={() => null} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, level - 0.14, 0]} raycast={() => null}>
        <circleGeometry args={[radius * 6.2, 48]} />
        <meshStandardMaterial color="#7bb0cf" />
      </mesh>
    </group>
  );
}

function Boat({ radius, speed, phase, dir, baseY }: { radius: number; speed: number; phase: number; dir: number; baseY: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const a = clock.elapsedTime * speed * dir + phase;
    g.position.set(Math.cos(a) * radius, baseY + Math.sin(clock.elapsedTime * 2 + phase) * 0.04, Math.sin(a) * radius);
    g.rotation.y = -a - (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    g.rotation.z = Math.sin(clock.elapsedTime * 1.5 + phase) * 0.06;
  });
  return (
    <group ref={ref} scale={1.35} raycast={() => null}>
      <mesh geometry={boatHull} material={hullMat} />
      <mesh geometry={boatSail} material={sailMat} position={[0, 0.24, 0]} />
    </group>
  );
}

function Cloud({ x, y, z, s, speed }: { x: number; y: number; z: number; s: number; speed: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.x = ((x + clock.elapsedTime * speed) % 40) - 20;
    }
  });
  return (
    <group ref={ref} position={[x, y, z]} scale={s} raycast={() => null}>
      <mesh geometry={cloudGeo} material={cloudMat} scale={[1.3, 0.5, 0.8]} />
      <mesh geometry={cloudGeo} material={cloudMat} position={[0.9, 0.1, 0.2]} scale={[0.8, 0.4, 0.6]} />
      <mesh geometry={cloudGeo} material={cloudMat} position={[-0.9, 0.05, -0.1]} scale={[0.7, 0.35, 0.55]} />
    </group>
  );
}

export function Ambient({ boardRadius, boatDistance, waterLevel = DEFAULT_WATER_LEVEL, waterDriftSpeed = DEFAULT_WATER_DRIFT_SPEED, shoreTiles }: { boardRadius: number; boatDistance?: number; waterLevel?: number; waterDriftSpeed?: number; shoreTiles?: [number, number][] }) {
  // Inner boat orbit radius. Defaults to the original formula (keeps the frozen
  // title screen unchanged); GameScene passes a larger value so the gameplay
  // boats stay well offshore and don't visually merge with the coastal harbor
  // docks at low camera angles.
  const worldR = boatDistance ?? boardRadius * 1.9 + 3;
  // Keep the circling boats' freeboard constant relative to the sea, so raising
  // the gameplay water level lifts them with it (title level = original look).
  const boatBaseY = waterLevel + 0.11;
  const clouds = useMemo(() => Array.from({ length: 5 }, (_, i) => ({
    x: (i * 13.7) % 30 - 15,
    y: 6 + (i % 3) * 1.4,
    z: (i * 8.3) % 24 - 12,
    s: 0.8 + (i % 3) * 0.5,
    speed: 0.15 + (i % 2) * 0.12,
  })), []);
  return (
    <group>
      <Water radius={boardRadius} level={waterLevel} driftSpeed={waterDriftSpeed} shoreTiles={shoreTiles} />
      <Boat radius={worldR} speed={0.12} phase={0} dir={1} baseY={boatBaseY} />
      <Boat radius={worldR + 1.6} speed={0.09} phase={2.4} dir={-1} baseY={boatBaseY} />
      {clouds.map((c, i) => <Cloud key={i} {...c} />)}
    </group>
  );
}
