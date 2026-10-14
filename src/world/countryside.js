// The working countryside: a raised earth village road (brick-paved near the house) with rain trees and a rickshaw-van,
// a canal (khal) with water hyacinth and a small bridge, shallow tube-well pump sheds pouring water into the plots in
// the irrigation months, grass on every edge, and winter morning fog (kuasha) on the cold days of the NASA record.
import * as THREE from 'three';
import { rand, fbm } from './noise.js';
import { grassTexture, earthTexture, tinTexture, waterNormalTexture } from './textures.js';
import { person } from './harvest.js';

const MAT = (o) => new THREE.MeshLambertMaterial(o);
const flatCurve = (pts) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.5);

/** Where the road, the canal and the pumps run. Decided before anything else, so trees and animals keep off them. */
export function routes({ flood }) {
  const road = flatCurve([[-260, 64], [-190, 58], [-120, 50], [-60, 41], [-10, 40], [16, 34], [25, 25], [28.5, 20]]);
  const canal = flatCurve(flood
    ? [[-95, -17], [-91, 15], [-104, 50], [-97, 95], [-121, 150], [-110, 230]]
    : [[-92, -70], [-91, 15], [-104, 50], [-97, 95], [-121, 150], [-110, 230]]);
  const pumps = [[-56, -4, 0], [-72, 28, Math.PI * 0.5], [76, -2, Math.PI], [-18, 78, -Math.PI * 0.5]];
  const roadPts = road.getSpacedPoints(160), canalPts = canal.getSpacedPoints(120);
  const near = (x, z, r) => roadPts.some((p) => Math.hypot(p.x - x, p.z - z) < r + 4)
    || canalPts.some((p) => Math.hypot(p.x - x, p.z - z) < r + 4.5)
    || pumps.some(([px, pz]) => Math.hypot(px - x, pz - z) < r + 6);
  return { road, canal, pumps, roadPts, canalPts, near };
}

/**
 * Builds the countryside into group. groundAt(x, z) is the rendered ground height. Returns { update(t, dt, view, sat) }.
 * The edges list (field bund, mound, pond) tells the grass where to grow.
 */
export function buildCountryside(group, { routes: rt, groundAt, mobile, flood, edges }) {
  const updates = [];

  // ---------------------------------------------------------------- the road: raised earth, brick near the house
  const roadSamples = rt.road.getSpacedPoints(Math.round(rt.road.getLength() / 2));
  const earth = new THREE.Color('#9c8462'), bank = new THREE.Color('#6d8a45'), brick = new THREE.Color('#8f6450');
  const brickFrom = roadSamples.findIndex((p) => p.x > -20);
  group.add(ribbon(roadSamples, groundAt, [[-2.7, -0.05, bank], [-1.6, 0.45, earth], [1.6, 0.45, earth], [2.7, -0.05, bank]],
    (i, k) => (i >= brickFrom && (k === 1 || k === 2) ? brick : null), MAT({ vertexColors: true, map: earthTexture([1, 40]) })));
  // rain trees (koroi) along the road, away from the default view so they never hide the field
  const rainSpots = [];
  roadSamples.forEach((p, i) => {
    if (i % 9 || p.x > -58) return;
    const t = rt.road.getTangentAt(Math.min(1, i / (roadSamples.length - 1)));
    const side = (i / 9) % 2 ? 1 : -1;
    rainSpots.push([p.x - t.z * 4.8 * side, p.z + t.x * 4.8 * side]);
  });
  group.add(rainTrees(rainSpots, groundAt));

  // ---------------------------------------------------------------- the canal: mud banks, water, hyacinth, a bridge
  const canalSamples = rt.canal.getSpacedPoints(Math.round(rt.canal.getLength() / 2.5));
  const mud = new THREE.Color('#5d4a36'), grassy = new THREE.Color('#6a8743');
  group.add(ribbon(canalSamples, groundAt, [[-3.6, 0.0, grassy], [-2.4, 0.14, mud], [2.4, 0.14, mud], [3.6, 0.0, grassy]], null, MAT({ vertexColors: true })));
  const waterMat = new THREE.MeshStandardMaterial({ color: '#3d5a52', roughness: 0.25, envMapIntensity: 0.55, normalMap: waterNormalTexture([2, 20]), normalScale: new THREE.Vector2(0.18, 0.18), transparent: true, opacity: 0.95 });
  const water = ribbon(canalSamples, groundAt, [[-1.9, 0.2, mud], [1.9, 0.2, mud]], null, waterMat);
  water.castShadow = false;
  group.add(water);
  const hyacinth = waterHyacinth(canalSamples, groundAt, mobile ? 40 : 90);
  group.add(hyacinth);
  const crossing = closestPair(rt.roadPts, rt.canalPts);
  if (crossing) {
    const i = rt.roadPts.indexOf(crossing[0]), a = rt.roadPts[Math.max(0, i - 1)], b = rt.roadPts[Math.min(rt.roadPts.length - 1, i + 1)];
    group.add(bridge(crossing, Math.atan2(b.x - a.x, b.z - a.z), groundAt));
  }
  updates.push((t, dt, v) => {
    waterMat.normalMap.offset.y = -t * 0.03;
    const dry = v.dryness ?? 0;                                     // in a drought the khal shrinks to a trickle
    waterMat.opacity = 0.95 - dry * 0.5;
    hyacinth.visible = dry < 0.6;
  });

  // ---------------------------------------------------------------- a rickshaw-van going up and down the road
  const van = rickshawVan();
  group.add(van.group);
  const roadLen = rt.road.getLength();
  let along = 0.35, dir = 1, wait = 0;
  updates.push((t, dt) => {
    if (wait > 0) { wait -= dt; } else {
      along += dir * dt * 3.2 / roadLen;
      if (along > 0.97 || along < 0.02) { dir = -dir; along = Math.min(0.97, Math.max(0.02, along)); wait = 5; }
    }
    const p = rt.road.getPointAt(along), tan = rt.road.getTangentAt(along);
    const lane = 0.6 * dir;                                         // keep to one side
    const x = p.x - tan.z * lane, z = p.z + tan.x * lane;
    van.group.position.set(x, groundAt(x, z) + 0.45, z);
    van.group.rotation.y = Math.atan2(tan.x * dir, tan.z * dir);
    van.spin(wait > 0 ? 0 : dt * 3.2 / 0.35, t, wait <= 0);
  });

  // ---------------------------------------------------------------- shallow tube-well pump sheds
  const pumps = rt.pumps.map(([x, z, yaw]) => {
    const s = pumpShed();
    s.group.position.set(x, groundAt(x, z), z);
    s.group.rotation.y = yaw;
    group.add(s.group);
    return s;
  });
  updates.push((t, dt, v) => {
    const season = v.season ?? 0.3;
    // boro is irrigated from the first weeks to ripening; aman gets a top-up in the dry spells
    const on = flood ? season > 0.08 && season < 0.75 && v.fieldWaterY < 0.25 : (v.dryness ?? 0) > 0.15 || (season > 0.2 && season < 0.7);
    pumps.forEach((p) => p.run(on, t));
  });

  // ---------------------------------------------------------------- grass on every edge
  const tufts = [];
  const along2 = (pts, offsets, step) => pts.forEach((p, i) => {
    if (i % step || Math.hypot(p.x, p.z) > 170) return;
    const nx = pts[Math.min(pts.length - 1, i + 1)].z - pts[Math.max(0, i - 1)].z, nz = -(pts[Math.min(pts.length - 1, i + 1)].x - pts[Math.max(0, i - 1)].x);
    const l = Math.hypot(nx, nz) || 1;
    for (const o of offsets) tufts.push([p.x + nx / l * (o + (rand() - 0.5) * 0.6), p.z + nz / l * (o + (rand() - 0.5) * 0.6)]);
  });
  along2(roadSamples, [-2.9, -2.3, 2.3, 2.9], mobile ? 2 : 1);
  along2(canalSamples, [-3.0, -2.5, 2.5, 3.0], mobile ? 2 : 1);
  for (const e of edges) {                                            // rectangles and rings: the bund, the mound, the pond
    const n = Math.round(e.length * (mobile ? 0.7 : 1.6));
    for (let k = 0; k < n; k++) tufts.push(e.at(rand()));
  }
  group.add(grassTufts(tufts, groundAt));

  return { update(t, dt, v, sat) { for (const u of updates) u(t, dt, v, sat); } };
}

// ===================================================================== winter fog

/** Low drifting fog sheets over the fields (kuasha). update(t, amount 0..1). */
export function fogLayers(mobile) {
  const group = new THREE.Group();
  const tex = fogTexture();
  const layers = (mobile ? [[2.0, 0.8]] : [[1.2, 0.8], [2.8, 0.65], [5.0, 0.5]]).map(([y, a], i) => {
    const t = tex.clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(5 + i, 5 + i);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshBasicMaterial({ color: '#e9eef0', alphaMap: t, transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.renderOrder = 2;
    group.add(m);
    return { m, t, a, speed: 0.004 + i * 0.002 };
  });
  return {
    group,
    update(time, amount) {
      group.visible = amount > 0.02;
      for (const l of layers) {
        l.m.material.opacity = l.a * amount;
        l.t.offset.set(time * l.speed, time * l.speed * 0.6);
      }
    },
  };
}

function fogTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#000';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    const cx = rand() * 256, cy = rand() * 256, r = 30 + rand() * 70;
    for (const dx of [0, -256, 256]) for (const dy of [0, -256, 256]) {
      const g = x.createRadialGradient(cx + dx, cy + dy, 0, cx + dx, cy + dy, r);
      g.addColorStop(0, `rgba(255,255,255,${0.35 + rand() * 0.25})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(cx + dx - r, cy + dy - r, r * 2, r * 2);
    }
  }
  return new THREE.CanvasTexture(c);
}

// ===================================================================== pieces

/** A strip along sampled points with a cross-section profile [[offset, height above ground, colour], ...]. */
function ribbon(samples, groundAt, profile, colorAt, material) {
  const n = samples.length, w = profile.length;
  const pos = new Float32Array(n * w * 3), col = new Float32Array(n * w * 3), uv = new Float32Array(n * w * 2);
  for (let i = 0; i < n; i++) {
    const a = samples[Math.max(0, i - 1)], b = samples[Math.min(n - 1, i + 1)];
    let nx = -(b.z - a.z), nz = b.x - a.x;
    const l = Math.hypot(nx, nz) || 1;
    nx /= l; nz /= l;
    const p = samples[i];
    profile.forEach(([off, dy, c], k) => {
      const x = p.x + nx * off, z = p.z + nz * off, o = (i * w + k) * 3;
      pos[o] = x; pos[o + 1] = groundAt(x, z) + dy; pos[o + 2] = z;
      const cc = (colorAt && colorAt(i, k)) || c;
      col[o] = cc.r; col[o + 1] = cc.g; col[o + 2] = cc.b;
      uv[(i * w + k) * 2] = k / (w - 1); uv[(i * w + k) * 2 + 1] = i / (n - 1);
    });
  }
  const idx = [];
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < w - 1; k++) {
    const a = i * w + k, b = a + 1, c = a + w, d = c + 1;
    idx.push(a, b, c, b, d, c);                       // wound so the faces point up
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.receiveShadow = true;
  return m;
}

/** Rain trees (koroi): a tall trunk under a wide, flat umbrella of a crown. */
function rainTrees(spots, groundAt) {
  const crownG = new THREE.IcosahedronGeometry(1, 2);
  const cp = crownG.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < cp.count; i++) {
    v.fromBufferAttribute(cp, i);
    v.multiplyScalar(1 + (fbm(v.x * 1.4 + 2, v.y * 1.4 + v.z, 2) - 0.5) * 0.4);
    cp.setXYZ(i, v.x, v.y * 0.42, v.z);
  }
  crownG.computeVertexNormals();
  const trunkG = new THREE.CylinderGeometry(0.35, 0.6, 1, 7);
  trunkG.translate(0, 0.5, 0);
  const crowns = new THREE.InstancedMesh(crownG, MAT({ color: '#3f6f30' }), spots.length);
  const trunks = new THREE.InstancedMesh(trunkG, MAT({ color: '#5a4a3a' }), spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  spots.forEach(([x, z], i) => {
    const h = 7 + rand() * 3, r = 6 + rand() * 3, y = groundAt(x, z);
    trunks.setMatrixAt(i, m.compose(p.set(x, y, z), q.identity(), s.set(1, h + 1, 1)));
    crowns.setMatrixAt(i, m.compose(p.set(x, y + h + 1.2, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28), s.set(r, r, r)));
    crowns.setColorAt(i, c.setHSL(0.26 + rand() * 0.04, 0.4, 0.42 + rand() * 0.1));
  });
  const g = new THREE.Group();
  for (const im of [crowns, trunks]) { im.castShadow = true; g.add(im); }
  return g;
}

/** Water hyacinth rafts: glossy green rosettes floating along the canal, a few pale violet flower spikes. */
function waterHyacinth(samples, groundAt, n) {
  const leafG = new THREE.SphereGeometry(1, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  leafG.scale(0.6, 0.35, 0.6);
  const flowerG = new THREE.ConeGeometry(0.09, 0.4, 5);
  flowerG.translate(0, 0.35, 0);
  const leaves = new THREE.InstancedMesh(leafG, MAT({ color: '#4c8a3a' }), n);
  const flowers = new THREE.InstancedMesh(flowerG, MAT({ color: '#b9a3d8' }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  let fi = 0;
  for (let i = 0; i < n; i++) {
    const a = samples[Math.floor(rand() * (samples.length - 1))], b = samples[Math.min(samples.length - 1, samples.indexOf(a) + 1)];
    const nx = -(b.z - a.z), nz = b.x - a.x, l = Math.hypot(nx, nz) || 1, off = (rand() - 0.5) * 2.8;
    const x = a.x + nx / l * off, z = a.z + nz / l * off, y = groundAt(x, z) + 0.2;
    const sc = 0.7 + rand() * 0.7;
    leaves.setMatrixAt(i, m.compose(p.set(x, y, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6), s.set(sc, sc, sc)));
    leaves.setColorAt(i, c.setHSL(0.27 + rand() * 0.05, 0.5, 0.36 + rand() * 0.1));
    if (rand() < 0.35) flowers.setMatrixAt(fi++, m.compose(p.set(x, y + 0.1, z), q.identity(), s.setScalar(0.8 + rand() * 0.5)));
  }
  flowers.count = fi;
  const g = new THREE.Group();
  g.add(leaves, flowers);
  return g;
}

/** A small concrete culvert-bridge where the road crosses the canal. */
function bridge([rp, cp], yaw, groundAt) {
  const g = new THREE.Group();
  const conc = MAT({ color: '#b3aea3' });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.35, 7.5), conc);
  deck.position.y = 0.55;
  g.add(deck);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 7.5), conc);
    rail.position.set(side * 2.0, 0.95, 0);
    g.add(rail);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.set((rp.x + cp.x) / 2, groundAt(rp.x, rp.z), (rp.z + cp.z) / 2);
  g.rotation.y = yaw;
  return g;
}

/** A pedal rickshaw-van (bhan gari): a flat wooden bed on two wheels behind a bicycle, with a load of sacks. */
function rickshawVan() {
  const group = new THREE.Group();
  const wood = MAT({ color: '#8a6440' }), metal = MAT({ color: '#2f3b4a' }), tyre = MAT({ color: '#1e1e1e' }), sack = MAT({ color: '#d8c391' });
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 1.7), wood);           // the bed sits behind the rider (local -z)
  bed.position.set(0, 0.75, -0.9);
  group.add(bed);
  const wheels = [];
  const wheelG = new THREE.TorusGeometry(0.33, 0.05, 6, 16);
  for (const [x, z] of [[-0.75, -0.9], [0.75, -0.9], [0, 0.85]]) {
    const w = new THREE.Mesh(wheelG, tyre);
    w.rotation.y = Math.PI / 2;
    w.position.set(x, 0.33, z);
    group.add(w);
    wheels.push(w);
  }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.5), metal);
  frame.position.set(0, 0.75, 0.15);
  frame.rotation.x = 0.25;
  const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 5), metal);
  bars.rotation.z = Math.PI / 2;
  bars.position.set(0, 1.35, 0.75);
  group.add(frame, bars);
  for (let k = 0; k < 4; k++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), sack);
    s.scale.set(1, 0.75, 1.35);
    s.position.set(k % 2 ? 0.33 : -0.33, 0.98, -0.6 - Math.floor(k / 2) * 0.75);
    group.add(s);
  }
  const rider = person('#2f4e86', '#e8e4d8');
  rider.group.scale.setScalar(0.95);
  rider.group.position.set(0, 0.15, 0.2);
  group.add(rider.group);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  group.scale.setScalar(1.3);
  return {
    group,
    spin(rad, t, pedalling) {
      for (const w of wheels) w.rotation.x += rad;
      rider.pose('walk', pedalling ? t * 6 : 0);
    },
  };
}

/** A brick pump shed with a tin roof; its outlet pours a stream into the plot when the pump runs. */
function pumpShed() {
  const group = new THREE.Group();
  const brickM = MAT({ color: '#a8604a', map: earthTexture([2, 2]) });
  const shed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.9, 2.0), brickM);
  shed.position.y = 0.95;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.06, 2.5), new THREE.MeshStandardMaterial({ color: '#8a9298', map: tinTexture([3, 1]), metalness: 0.3, roughness: 0.6 }));
  roof.position.y = 2.0;
  roof.rotation.z = 0.12;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.4), MAT({ color: '#2f5f7a' }));
  door.position.set(0, 0.75, -1.01);
  door.rotation.y = Math.PI;
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.3, 8), MAT({ color: '#25303a' }));
  pipe.rotation.x = Math.PI / 2;
  pipe.position.set(0.4, 0.75, 1.6);                                  // the outlet points along +z, into the plot
  group.add(shed, roof, door, pipe);
  // the stream: a falling arc of water, a splash, and a wet runnel spreading into the plot
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.4, 0.75, 2.25), new THREE.Vector3(0.4, 0.7, 2.9), new THREE.Vector3(0.4, 0.05, 3.3));
  const streakTex = streaks();
  const stream = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.1, 8, false), new THREE.MeshBasicMaterial({ color: '#d9eef7', alphaMap: streakTex, transparent: true, opacity: 0.85, depthWrite: false }));
  const splash = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.55, 16), new THREE.MeshBasicMaterial({ color: '#f2f8fb', transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
  splash.rotation.x = -Math.PI / 2;
  splash.position.set(0.4, 0.08, 3.3);
  const runnel = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 7), new THREE.MeshStandardMaterial({ color: '#4f6a6a', roughness: 0.25, envMapIntensity: 0.5, transparent: true, opacity: 0.85 }));
  runnel.rotation.x = -Math.PI / 2;
  runnel.position.set(0.4, 0.06, 6.8);
  group.add(stream, splash, runnel);
  group.traverse((o) => { if (o.isMesh && o !== stream && o !== splash && o !== runnel) o.castShadow = true; });
  return {
    group,
    run(on, t) {
      stream.visible = splash.visible = on;
      runnel.material.opacity = on ? 0.85 : 0.25;
      if (!on) return;
      streakTex.offset.x = -t * 1.8;
      const k = 1 + Math.sin(t * 9) * 0.15;
      splash.scale.set(k, k, k);
    },
  };
}

function streaks() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 16;
  const x = c.getContext('2d');
  x.fillStyle = 'rgb(120,120,120)';
  x.fillRect(0, 0, 64, 16);
  for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(255,255,255,${0.4 + rand() * 0.6})`; x.fillRect(rand() * 64, rand() * 16, 6 + rand() * 14, 1.5); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Grass tufts: a few thin blades each, swaying a little; instanced. */
function grassTufts(spots, groundAt) {
  const pos = [], col = [];
  for (let b = 0; b < 6; b++) {
    const a = (b / 6) * Math.PI * 2 + rand() * 0.5, h = 0.35 + rand() * 0.35, lean = 0.12 + rand() * 0.15, w = 0.035;
    const dx = Math.cos(a), dz = Math.sin(a), px = -dz * w, pz = dx * w;
    const tip = [dx * lean, h, dz * lean];
    for (const v of [[px, 0, pz], [-px, 0, -pz], tip]) pos.push(...v);
    const g = 0.75 + rand() * 0.25;
    col.push(0.5 * g, 0.62 * g, 0.28 * g, 0.5 * g, 0.62 * g, 0.28 * g, 0.72 * g, 0.78 * g, 0.42 * g);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const uniforms = { uTime: { value: 0 } };
  const mat = MAT({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec2 ip = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
      transformed.x += sin(uTime * 1.7 + ip.x * 0.3 + ip.y * 0.2) * 0.06 * position.y;`);
  };
  const im = new THREE.InstancedMesh(g, mat, Math.max(1, spots.length));
  im.count = spots.length;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  spots.forEach(([x, z], i) => {
    const sc = 0.8 + rand() * 0.9;
    im.setMatrixAt(i, m.compose(p.set(x, groundAt(x, z), z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28), s.set(sc, sc * 1.6, sc)));
    im.setColorAt(i, c.setHSL(0.2 + rand() * 0.07, 0.45, 0.45 + rand() * 0.15));
  });
  im.receiveShadow = true;
  im.onBeforeRender = () => { uniforms.uTime.value = performance.now() / 1000; };
  return im;
}

function closestPair(a, b) {
  let best = null, d = Infinity;
  for (const p of a) for (const q of b) { const dd = (p.x - q.x) ** 2 + (p.z - q.z) ** 2; if (dd < d) { d = dd; best = [p, q]; } }
  return d < 36 ? best : null;
}
