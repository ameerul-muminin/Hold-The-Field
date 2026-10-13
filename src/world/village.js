// The village around the paddy: a Bangladeshi homestead on its raised earth mound (bhita), with a swept courtyard,
// tin and thatch roofs, a hand tube well, cows by the cowshed, banana, betel-nut palms and bamboo, a pond with a ghat
// and a power line. In the haor: duck flocks, country boats and other villages standing as wooded islands in the water;
// in the Barind: mud houses and rows of palmyra (taal) palms. Everything is built in code and instanced where repeated.
import * as THREE from 'three';
import { fbm, noise2, rand } from './noise.js';
import { grassTexture, earthTexture, thatchTexture, plasterTexture, frondTexture, tinTexture, waterNormalTexture } from './textures.js';

export const HOME = { x: 41, z: 6, w: 26, d: 24, h: 0.7 };      // homestead mound (top), east of the field
export const POND = { x: 38, z: 28, r: 5.5 };     // south of the mound, in front of the default camera

const smooth = (e0, e1, v) => { const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const MAT = (o) => new THREE.MeshLambertMaterial(o);

/** Builds the village into group. Returns { update(time, dt, view), sackOffset }. */
export function buildVillage(group, { flood, mobile }) {
  const H = HOME.h, top = (o) => { o.position.y += H; return o; };
  const shadows = (o) => { o.traverse?.((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
  const updates = [];

  // ---------------------------------------------------------------- the mound and its courtyard
  group.add(mound(flood));

  // ---------------------------------------------------------------- houses
  const tinTints = ['#8a9298', '#7f888d', '#9a6a48', '#6f8a7a'];
  if (flood) {
    group.add(shadows(top(house({ x: 41, z: 13.5, rot: 0, w: 6.4, d: 4.6, roof: 'tin', tint: tinTints[0], walls: 'tin', door: '#2f6f8f' }))));
    group.add(shadows(top(house({ x: 32.5, z: 10, rot: -Math.PI / 2, w: 5, d: 4, roof: 'tin', tint: tinTints[2], walls: 'mud', door: '#3d7a4a' }))));
  } else {
    group.add(shadows(top(house({ x: 41, z: 13.5, rot: 0, w: 6.4, d: 4.6, roof: 'thatch', walls: 'mud', wallColor: '#b07a52', door: '#5a3a22', tall: true }))));
    group.add(shadows(top(house({ x: 32.5, z: 10, rot: -Math.PI / 2, w: 5, d: 4, roof: 'tin', tint: tinTints[1], walls: 'mud', wallColor: '#b88456', door: '#3d5a7a' }))));
  }
  group.add(shadows(top(house({ x: 49.5, z: 4, rot: Math.PI / 2, w: 3.8, d: 3.2, h: 2.0, roof: 'thatch', walls: 'mud', wallColor: flood ? '#a78a66' : '#b07a52', door: '#3d2a1b', veranda: false }))));   // kitchen
  group.add(shadows(top(cowshed(33.5, -1.5))));
  const cows = [cow('#8a5636'), cow('#e8e2d6', '#6b5a48')];
  cows[0].group.position.set(32.2, H, -2.2); cows[0].group.rotation.y = 0.4;
  cows[1].group.position.set(35.2, H, -0.8); cows[1].group.rotation.y = 2.6;
  cows.forEach((c) => { group.add(shadows(c.group)); updates.push(c.update); });
  for (const [x, z, s] of [[29.8, -4.4, 1], [30.4, 3, 0.85]]) group.add(shadows(top(haystack(x, z, s))));
  group.add(shadows(top(tubeWell(45.5, 8.8))));
  group.add(top(dryingMat(36.4, 2.4)));

  // ---------------------------------------------------------------- plants of the homestead
  const bananas = [[52.5, 13.5], [53, 9.5], [52, 17.4], [29, 15.5], [28.8, 10.5], [52.5, -4.5], [47.5, -5.2]];
  group.add(bananaPlants(bananas.map(([x, z]) => [x, H, z])));
  const betel = [];
  for (let z = -5; z <= 18; z += 3.6) betel.push([55.6 + (rand() - 0.5) * 0.8, z]);
  for (let x = 45; x <= 53; x += 3.4) betel.push([x, -7.6 + (rand() - 0.5) * 0.6]);
  group.add(betelPalms(betel.map(([x, z]) => [x, H * 0.6, z]), mobile));
  group.add(bamboo([[55.5, -9]], mobile));
  group.add(broadTrees([[53.5, 1.5, 3.2], [29.5, -8.5, 3], [38, -8.8, 2.6]], H));

  // ---------------------------------------------------------------- pond with a ghat (haor), power line
  if (flood) group.add(pond());
  group.add(powerLine(-34, -10, 70, 14));

  // ---------------------------------------------------------------- the haor beyond, or the Barind's palmyra rows
  if (flood) {
    group.add(islands(mobile));
    const d = ducks(mobile ? 14 : 28);
    group.add(d.group);
    updates.push(d.update);
    const boats = [[-70, -60, 0.6], [55, -95, -0.4], [-150, -140, 1.2]].map(([x, z, r]) => {
      const b = nouka();
      b.position.set(x, -0.5, z);
      b.rotation.y = r;
      group.add(b);
      return b;
    });
    updates.push((t, dt, v) => boats.forEach((b, i) => {
      b.position.y = v.lakeY + 0.05 + Math.sin(t * 1.1 + i * 2) * 0.06;
      b.position.x += Math.sin(t * 0.05 + i) * dt * 0.4;
      b.rotation.z = Math.sin(t * 0.8 + i) * 0.035;
    }));
  } else {
    const taal = [];
    for (let z = -14; z <= 14; z += 7) taal.push([-28.5 + (rand() - 0.5), z]);
    for (let x = -18; x <= 18; x += 9) taal.push([x, -20.5 + (rand() - 0.5)]);
    taal.push([62, -8], [70, 2], [-70, 26], [-52, -24]);
    group.add(palmyras(taal));
  }

  return {
    sackOffset: new THREE.Vector3(8, H, -11),          // the harvest sacks stand in the courtyard
    update(t, dt, v) { for (const u of updates) u(t, dt, v); },
  };
}

// ===================================================================== pieces

function mound(flood) {
  const { x: cx, z: cz, w, d, h } = HOME, pad = 4;
  const g = new THREE.PlaneGeometry(w + pad * 2, d + pad * 2, 40, 36);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, cols = new Float32Array(pos.count * 3), c = new THREE.Color();
  const grass = new THREE.Color(flood ? '#6f8f45' : '#8f9150'), bank = new THREE.Color(flood ? '#7a6347' : '#9a6a44');
  const yard = new THREE.Color(flood ? '#a89070' : '#b98a62');
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i), lz = pos.getZ(i);
    const out = Math.hypot(Math.max(0, Math.abs(lx) - w / 2), Math.max(0, Math.abs(lz) - d / 2));
    const k = 1 - smooth(0, pad - 0.5, out + (noise2(lx * 0.3, lz * 0.3) - 0.5) * 1.2);
    pos.setY(i, -0.2 + (h + 0.2) * k + (fbm(lx * 0.2, lz * 0.2, 2) - 0.5) * 0.12 * k);
    // swept courtyard in the middle, grass elsewhere on top, bare earth on the banks
    const yardK = 1 - smooth(3.5, 6, Math.hypot((lx - 0) / 1.3, (lz + 0.5) / 1.1));
    c.copy(bank).lerp(grass, smooth(0.25, 0.85, k)).lerp(yard, yardK * smooth(0.8, 1, k));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, MAT({ vertexColors: true, map: grassTexture([5, 5]) }));
  m.position.set(cx, 0, cz);
  m.receiveShadow = true;
  return m;
}

/** A homestead house: raised plinth, mud or tin walls, a painted door and barred window, a two-sloped roof. */
function house({ x, z, rot = 0, w = 6, d = 4.4, h = 2.4, roof = 'tin', walls = 'mud', tint = '#a7adb3', wallColor = '#c49a6a', door = '#2f6f8f', veranda = true, tall = false }) {
  const g = new THREE.Group();
  const wh = tall ? h + 0.6 : h;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 1.4, 0.45, d + (veranda ? 2.4 : 1)), MAT({ color: '#8e7354', map: earthTexture([3, 2]) }));
  plinth.position.set(0, 0.22, veranda ? -0.7 : 0);       // the veranda is in front (local -z)
  g.add(plinth);
  const wallM = walls === 'tin'
    ? new THREE.MeshStandardMaterial({ color: '#9aa2a7', map: tinTexture([3, 1]), metalness: 0.2, roughness: 0.65 })
    : MAT({ color: wallColor, map: plasterTexture([2, 1]) });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, wh, d), wallM);
  body.position.y = 0.45 + wh / 2;
  const doorM = MAT({ color: door });
  const dr = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.8), doorM);
  dr.position.set(0.6, 0.45 + 0.9, -d / 2 - 0.01);
  dr.rotation.y = Math.PI;
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.65), MAT({ color: '#2a2420' }));
  win.position.set(-w / 2 + 1.2, 0.45 + 1.55, -d / 2 - 0.01);
  win.rotation.y = Math.PI;
  g.add(body, dr, win);
  // window bars
  for (let k = -1; k <= 1; k++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.62, 0.035), doorM);
    bar.position.set(-w / 2 + 1.2 + k * 0.2, 0.45 + 1.55, -d / 2 - 0.04);
    g.add(bar);
  }
  // two-sloped roof (do-chala) with an overhang, gables closed with the wall material
  const pitch = roof === 'tin' ? 0.42 : 0.6, wallTop = 0.45 + wh, half = d / 2 + (veranda ? 1.4 : 0.6), len = w + 0.9;
  const ridge = wallTop + Math.tan(pitch) * d / 2, roofAt = (dz) => ridge - Math.tan(pitch) * Math.abs(dz);
  const roofM = roof === 'tin'
    ? new THREE.MeshStandardMaterial({ color: tint, map: tinTexture([len / 1.2, 1]), metalness: 0.3, roughness: 0.6, side: THREE.DoubleSide })
    : MAT({ color: '#cfae66', map: thatchTexture([3, 1.5]), side: THREE.DoubleSide });
  const thick = roof === 'tin' ? 0.05 : 0.3, slope = half / Math.cos(pitch);
  for (const side of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(len, thick, slope), roofM);
    slab.rotation.x = side * pitch;
    slab.position.set(0, roofAt(half / 2) + thick / 2, side * half / 2);
    g.add(slab);
  }
  const gable = new THREE.Shape();
  gable.moveTo(-d / 2, 0); gable.lineTo(d / 2, 0); gable.lineTo(0, ridge - wallTop); gable.closePath();
  const gableM = wallM.clone();
  gableM.side = THREE.DoubleSide;
  for (const side of [-1, 1]) {
    const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), gableM);
    gm.position.set(side * w / 2, wallTop, 0);
    gm.rotation.y = side * Math.PI / 2;
    g.add(gm);
  }
  if (veranda) {
    const postM = MAT({ color: '#6b4a2e' });
    for (const px of [-w / 2 + 0.2, w / 2 - 0.2, 0]) {
      const ph = roofAt(d / 2 + 1.2) - 0.45;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, ph, 6), postM);
      post.position.set(px, 0.45 + ph / 2, -d / 2 - 1.2);
      g.add(post);
    }
  }
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  return g;
}

function cowshed(x, z) {
  const g = new THREE.Group();
  const postM = MAT({ color: '#6b4a2e' }), roofM = MAT({ color: '#c7a45f', map: thatchTexture([2, 1]), side: THREE.DoubleSide });
  for (const [px, pz] of [[-2.2, -1.6], [2.2, -1.6], [-2.2, 1.6], [2.2, 1.6]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, pz < 0 ? 2.4 : 2.0, 6), postM);
    p.position.set(px, (pz < 0 ? 2.4 : 2.0) / 2, pz);
    g.add(p);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.25, 4.2), roofM);
  roof.position.y = 2.25;
  roof.rotation.x = 0.1;
  const trough = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 0.5), MAT({ color: '#8b7356' }));
  trough.position.set(0, 0.18, 1.3);
  g.add(roof, trough);
  g.position.set(x, 0, z);
  return g;
}

/** A small deshi cow (reddish brown or white), grazing with a slow head bob. */
function cow(color, patch = null) {
  const group = new THREE.Group();
  const m = MAT({ color }), dark = MAT({ color: '#2b2420' }), pm = patch ? MAT({ color: patch }) : m;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.95, 4, 10), m);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.95;
  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), pm);
  hump.position.set(0.45, 1.25, 0);
  const neck = new THREE.Group();
  neck.position.set(0.7, 1.05, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.26), pm);
  head.position.set(0.32, -0.1, 0);
  head.rotation.z = -0.5;
  const horns = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 5), MAT({ color: '#d8cdb8' }));
  horns.position.set(0.18, 0.08, 0.1);
  const horn2 = horns.clone(); horn2.position.z = -0.1;
  neck.add(head, horns, horn2);
  group.add(body, hump, neck);
  for (const [lx, lz] of [[0.45, 0.17], [0.45, -0.17], [-0.45, 0.17], [-0.45, -0.17]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.72, 5), m);
    leg.position.set(lx, 0.36, lz);
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.08, 5), dark);
    hoof.position.set(lx, 0.04, lz);
    group.add(leg, hoof);
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4), m);
  tail.position.set(-0.85, 0.75, 0);
  tail.rotation.z = -0.25;
  group.add(tail);
  const phase = rand() * 10;
  return {
    group,
    update(t) {
      neck.rotation.z = -0.55 + Math.sin(t * 0.5 + phase) * 0.35;          // head down to graze, up to look
      tail.rotation.x = Math.sin(t * 2.2 + phase) * 0.25;
    },
  };
}

function haystack(x, z, s) {
  const g = new THREE.Group();
  const pts = [];
  for (let k = 0; k <= 10; k++) { const v = k / 10; pts.push(new THREE.Vector2(1.5 * Math.sin(Math.acos(v * 0.98)) * (1 - v * 0.15), v * 3.0)); }
  const hay = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), MAT({ color: '#d9b863', map: thatchTexture([2, 1]) }));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), MAT({ color: '#6b4a2e' }));
  pole.position.y = 3.3;
  g.add(hay, pole);
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  return g;
}

/** The green hand-pump tube well on its concrete pad. */
function tubeWell(x, z) {
  const g = new THREE.Group();
  const green = MAT({ color: '#2f8a4a' }), conc = MAT({ color: '#a9a69e' });
  const pad = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 1.6), conc);
  pad.position.y = 0.08;
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.95, 8), green);
  pipe.position.y = 0.6;
  const headM = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.32, 8), green);
  headM.position.y = 1.2;
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 6), green);
  spout.rotation.z = Math.PI / 2;
  spout.position.set(0.2, 1.08, 0);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.04, 0.04), green);
  handle.position.set(-0.38, 1.4, 0);
  handle.rotation.z = -0.35;
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.26, 10), MAT({ color: '#3d6fb0' }));
  bucket.position.set(0.32, 0.3, 0.3);
  g.add(pad, pipe, headM, spout, handle, bucket);
  g.position.set(x, 0, z);
  return g;
}

/** A woven mat with paddy spread out to dry in the courtyard. */
function dryingMat(x, z) {
  const g = new THREE.Group();
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), MAT({ color: '#b89a62', map: thatchTexture([2, 2]) }));
  mat.rotation.x = -Math.PI / 2;
  mat.position.y = 0.02;
  const paddy = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.7), MAT({ color: '#e0b94e', map: grassTexture([3, 2]) }));
  paddy.rotation.x = -Math.PI / 2;
  paddy.position.y = 0.04;
  g.add(mat, paddy);
  g.position.set(x, 0, z);
  g.rotation.y = 0.2;
  g.traverse((m) => { if (m.isMesh) m.receiveShadow = true; });
  return g;
}

/** Banana plants: a pseudo-stem and broad, arching, torn leaves (instanced). */
function bananaPlants(spots) {
  const leafParts = [];
  for (let k = 0; k < 7; k++) {
    const g = new THREE.PlaneGeometry(0.75, 2.4, 2, 8);
    g.translate(0, 1.2, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {                 // a broad paddle that rises, then bends over at the tip
      const y = p.getY(i), t = y / 2.4;
      const wid = t < 0.12 ? 0.12 : Math.min(1, Math.sin(Math.min(1, (t - 0.12) * 1.25) * Math.PI) * 1.4 + 0.5) * 1.5;
      p.setXYZ(i, p.getX(i) * wid, Math.sin(t * Math.PI * 0.7) * 1.3 - t * t * 1.4, y * 0.85);
    }
    g.rotateX(-0.45);
    g.rotateY((k / 7) * Math.PI * 2 + rand() * 0.4);
    g.translate(0, 2.2, 0);
    leafParts.push(g);
  }
  const leaves = mergeAll(leafParts);
  const stem = new THREE.CylinderGeometry(0.11, 0.17, 2.3, 7);
  stem.translate(0, 1.15, 0);
  const lm = new THREE.InstancedMesh(leaves, MAT({ color: '#6aa33e', side: THREE.DoubleSide }), spots.length);
  const sm = new THREE.InstancedMesh(stem, MAT({ color: '#7d8f4a' }), spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  spots.forEach(([x, y, z], i) => {
    const sc = 0.85 + rand() * 0.35;
    m.compose(p.set(x, y, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28), s.setScalar(sc));
    lm.setMatrixAt(i, m); sm.setMatrixAt(i, m);
    lm.setColorAt(i, c.setHSL(0.24 + rand() * 0.04, 0.5, 0.42 + rand() * 0.08));
  });
  const g = new THREE.Group();
  for (const im of [lm, sm]) { im.castShadow = im.receiveShadow = true; g.add(im); }
  return g;
}

/** Betel-nut (supari) palms: very thin, very tall, a small tuft on top. */
function betelPalms(spots, mobile) {
  const n = mobile ? Math.ceil(spots.length * 0.6) : spots.length;
  const trunk = new THREE.CylinderGeometry(0.08, 0.12, 1, 6);
  trunk.translate(0, 0.5, 0);
  const fronds = [];
  for (let k = 0; k < 7; k++) {
    const g = new THREE.PlaneGeometry(0.9, 2.4, 1, 5);
    g.translate(0, 1.2, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = y / 2.4; p.setXYZ(i, p.getX(i), Math.sin(t * Math.PI * 0.5) * 0.9 - t * t * 1.3, y); }
    g.rotateY((k / 7) * Math.PI * 2);
    fronds.push(g);
  }
  const crown = mergeAll(fronds);
  const tm = new THREE.InstancedMesh(trunk, MAT({ color: '#8b8473' }), n);
  const cm = new THREE.InstancedMesh(crown, MAT({ color: '#4f8a3a', alphaMap: frondTexture(), alphaTest: 0.5, side: THREE.DoubleSide }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const [x, y, z] = spots[i], h = 10 + rand() * 3.5;
    tm.setMatrixAt(i, m.compose(p.set(x, y, z), q.identity(), s.set(1, h, 1)));
    cm.setMatrixAt(i, m.compose(p.set(x, y + h - 0.1, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28), s.setScalar(0.85 + rand() * 0.25)));
  }
  const g = new THREE.Group();
  for (const im of [tm, cm]) { im.castShadow = true; g.add(im); }
  return g;
}

/** Bamboo clumps: tall culms leaning out, with feathery foliage up high. */
function bamboo(clumps, mobile) {
  const per = mobile ? 9 : 16, n = clumps.length * per;
  const culm = new THREE.CylinderGeometry(0.05, 0.075, 1, 5);
  culm.translate(0, 0.5, 0);
  const sprays = [];
  for (let k = 0; k < 5; k++) {
    const f = new THREE.PlaneGeometry(0.4, 1.1, 1, 3);
    f.translate(0, 0.55, 0);
    f.rotateX(-1.0 - rand() * 0.5);
    f.rotateY((k / 5) * Math.PI * 2);
    sprays.push(f);
  }
  const leaf = mergeAll(sprays);
  const leavesPer = 4;
  const cm = new THREE.InstancedMesh(culm, MAT({ color: '#a3a95a' }), n);
  const lm = new THREE.InstancedMesh(leaf, MAT({ color: '#86ad4c', alphaMap: frondTexture(), alphaTest: 0.5, side: THREE.DoubleSide }), n * leavesPer);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler(), c = new THREE.Color();
  let i = 0, j = 0;
  for (const [cx, cz] of clumps) for (let k = 0; k < per; k++) {
    const a = rand() * 6.28, r = rand() * 1.2, h = 9 + rand() * 4, lean = 0.08 + rand() * 0.16;
    e.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean);
    q.setFromEuler(e);
    const base = p.set(cx + Math.cos(a) * r, HOME.h * 0.5, cz + Math.sin(a) * r);
    cm.setMatrixAt(i++, m.compose(base, q, s.set(1, h, 1)));
    for (let f = 0; f < leavesPer; f++) {
      const tipP = new THREE.Vector3(0, h * (0.55 + f * 0.14), 0).applyQuaternion(q).add(base);
      lm.setMatrixAt(j, m.compose(tipP, q, s.setScalar(0.8 + rand() * 0.5)));
      lm.setColorAt(j++, c.setHSL(0.21 + rand() * 0.04, 0.45, 0.42 + rand() * 0.1));
    }
  }
  const g = new THREE.Group();
  for (const im of [cm, lm]) { im.castShadow = true; g.add(im); }
  return g;
}

/** Mango and jackfruit trees: dense, dark, round crowns that shade the homestead. */
function broadTrees(spots, y0) {
  const crownG = new THREE.IcosahedronGeometry(1, 2);
  const cp = crownG.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < cp.count; i++) {
    v.fromBufferAttribute(cp, i);
    v.multiplyScalar(1 + (fbm(v.x * 1.7 + 3, v.y * 1.7 + v.z * 1.2, 3) - 0.5) * 0.5);
    v.y *= 0.8;
    cp.setXYZ(i, v.x, v.y, v.z);
  }
  crownG.computeVertexNormals();
  const trunkG = new THREE.CylinderGeometry(0.25, 0.42, 1, 7);
  trunkG.translate(0, 0.5, 0);
  const crowns = new THREE.InstancedMesh(crownG, MAT({ color: '#2f6a2c' }), spots.length);
  const trunks = new THREE.InstancedMesh(trunkG, MAT({ color: '#5a4430' }), spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  spots.forEach(([x, z, r], i) => {
    const h = 3 + r * 0.6;
    trunks.setMatrixAt(i, m.compose(p.set(x, y0, z), q.identity(), s.set(1, h + r * 0.3, 1)));
    crowns.setMatrixAt(i, m.compose(p.set(x, y0 + h + r * 0.55, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28), s.set(r * 1.15, r, r * 1.15)));
  });
  const g = new THREE.Group();
  for (const im of [crowns, trunks]) { im.castShadow = im.receiveShadow = true; g.add(im); }
  return g;
}

/** The family pond (pukur) with a brick ghat stepping down to the water. */
function pond() {
  const { x, z, r } = POND;
  const g = new THREE.Group();
  const bank = new THREE.Mesh(new THREE.TorusGeometry(r + 0.5, 0.8, 8, 40), MAT({ color: '#6f8a45', map: grassTexture([8, 1]) }));
  bank.rotation.x = Math.PI / 2;
  bank.scale.set(1, 1, 0.45);
  bank.position.y = 0.0;
  bank.receiveShadow = true;
  const normalMap = waterNormalTexture([2, 2]);
  const water = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshStandardMaterial({ color: '#2c4a3c', roughness: 0.35, envMapIntensity: 0.35, normalMap, normalScale: new THREE.Vector2(0.2, 0.2) }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.16;
  water.receiveShadow = true;
  g.add(bank, water);
  const brick = MAT({ color: '#b5654a', map: earthTexture([1, 1]) });
  for (let k = 0; k < 5; k++) {                         // the ghat: steps from the bank down into the water, towards the house
    const step = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 0.55), brick);
    step.position.set(0, 0.42 - k * 0.1, -r - 0.6 + k * 0.45);
    step.receiveShadow = true;
    g.add(step);
  }
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 2.8), brick);
    wall.position.set(side * 1.25, 0.3, -r + 0.3);
    g.add(wall);
  }
  g.position.set(x, 0, z);
  return g;
}

/** Concrete poles along the village path with sagging wires: rural electricity reaches the haor. */
function powerLine(x, z0, z1, step) {
  const g = new THREE.Group();
  const conc = MAT({ color: '#b8b5ac' }), wireM = new THREE.LineBasicMaterial({ color: '#2a2a2a', transparent: true, opacity: 0.7 });
  const tops = [];
  for (let z = z0; z <= z1; z += step) {
    const px = x + (rand() - 0.5) * 0.8;
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 8.5, 0.22), conc);
    pole.position.set(px, 4.25, z);
    pole.rotation.z = (rand() - 0.5) * 0.04;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), conc);
    arm.position.set(px, 7.9, z);
    pole.castShadow = true;
    g.add(pole, arm);
    tops.push([new THREE.Vector3(px - 0.7, 8.05, z), new THREE.Vector3(px + 0.7, 8.05, z)]);
  }
  for (let k = 0; k + 1 < tops.length; k++) for (const side of [0, 1]) {
    const a = tops[k][side], b = tops[k + 1][side], pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * 0.6; pts.push(p); }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireM));
  }
  return g;
}

/** Other haor villages: wooded islands on their mounds, tin roofs among the trees, one with a mosque. */
function islands(mobile) {
  const spots = [[-140, -95, 26], [95, -125, 22], [-55, -210, 30], [210, -200, 28], [-270, -150, 24], [40, -310, 34], [-190, -290, 26]];
  const g = new THREE.Group();
  const moundG = new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const moundM = MAT({ color: '#5f7a3c', map: grassTexture([8, 8]) });
  const crownG = new THREE.IcosahedronGeometry(1, 1);
  const treesPer = mobile ? 9 : 16, nTrees = spots.length * treesPer;
  const crowns = new THREE.InstancedMesh(crownG, MAT({ color: '#2f6a2c' }), nTrees);
  const wallsG = new THREE.BoxGeometry(1, 1, 1);
  wallsG.translate(0, 0.5, 0);
  const roofG = new THREE.CylinderGeometry(1, 1, 1, 3);       // a triangular prism
  roofG.rotateZ(Math.PI / 2);
  roofG.rotateX(-Math.PI / 2);                               // ridge along x, apex up, base 0.5 below the centre
  const housesPer = 4, nHouses = spots.length * housesPer;
  const walls = new THREE.InstancedMesh(wallsG, MAT({ color: '#ffffff' }), nHouses);
  const roofs = new THREE.InstancedMesh(roofG, new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.25, roughness: 0.6 }), nHouses);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  const roofCols = ['#a9b0b5', '#b9bfc4', '#9b5a3c', '#5f8a6a', '#8e969c'], wallCols = ['#c9a77c', '#b9bfc4', '#d8c7a6', '#a88a66'];
  let ti = 0, hi = 0;
  spots.forEach(([x, z, r], si) => {
    const ground = (px, pz) => 4.6 * Math.sqrt(Math.max(0, 1 - ((px - x) / r) ** 2 - ((pz - z) / (r * 0.75)) ** 2)) - 2;
    const mound = new THREE.Mesh(moundG, moundM);
    mound.position.set(x, -2, z);
    mound.scale.set(r, 4.6, r * 0.75);
    g.add(mound);
    for (let k = 0; k < treesPer; k++) {
      const a = rand() * 6.28, d = Math.sqrt(rand()) * r * 0.8, tr = 3 + rand() * 3.5;
      const tx = x + Math.cos(a) * d, tz = z + Math.sin(a) * d * 0.75;
      crowns.setMatrixAt(ti, m.compose(p.set(tx, ground(tx, tz) + tr * 0.75 + rand() * 1.5, tz), q.identity(), s.set(tr, tr * 0.85, tr)));
      crowns.setColorAt(ti++, c.setHSL(0.26 + rand() * 0.07, 0.45, 0.3 + rand() * 0.12));
    }
    for (let k = 0; k < housesPer; k++) {
      const a = (k / housesPer) * 6.28 + rand(), d = r * (0.35 + rand() * 0.3);
      const hx = x + Math.cos(a) * d, hz = z + Math.sin(a) * d * 0.5 + r * 0.2, yaw = rand() * 3.14;
      const w = 4 + rand() * 2.5, dd = 3 + rand(), base = ground(hx, hz) - 0.3;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      walls.setMatrixAt(hi, m.compose(p.set(hx, base, hz), q, s.set(w, 2.4, dd)));
      walls.setColorAt(hi, c.set(wallCols[(si + k) % wallCols.length]));
      roofs.setMatrixAt(hi, m.compose(p.set(hx, base + 2.4 + 0.6, hz), q, s.set(w + 0.6, 1.2, dd * 0.75)));
      roofs.setColorAt(hi++, c.set(roofCols[(si * 2 + k) % roofCols.length]));
    }
  });
  crowns.count = ti; walls.count = hi; roofs.count = hi;
  g.add(crowns, walls, roofs);
  // a small village mosque on the nearest island: white hall, green dome, slim minaret
  const [mx, mz, mr] = spots[0];
  const mg = 4.6 * Math.sqrt(Math.max(0, 1 - (8 / mr) ** 2 - (6 / (mr * 0.75)) ** 2)) - 2.3;
  const white = MAT({ color: '#eeeae0' }), dome = MAT({ color: '#5aa37a' });
  const hall = new THREE.Mesh(new THREE.BoxGeometry(7, 3.6, 6), white);
  hall.position.set(mx + 8, mg + 1.8, mz + 6);
  const dm = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), dome);
  dm.position.set(mx + 8, mg + 3.6, mz + 6);
  const minaret = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 9, 8), white);
  minaret.position.set(mx + 12.5, mg + 4.5, mz + 8.5);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 8), dome);
  cap.position.set(mx + 12.5, mg + 9.7, mz + 8.5);
  g.add(hall, dm, minaret, cap);
  return g;
}

/** White ducks floating on the haor in two flocks, drifting slowly along the shore. */
function ducks(n) {
  const body = new THREE.SphereGeometry(0.3, 8, 6);
  body.scale(1.25, 0.7, 0.8);
  const head = new THREE.SphereGeometry(0.13, 8, 6);
  head.translate(0.32, 0.22, 0);
  const beak = new THREE.ConeGeometry(0.05, 0.16, 5);
  beak.rotateZ(-Math.PI / 2);
  beak.translate(0.5, 0.2, 0);
  const white = new THREE.InstancedMesh(mergeAll([body, head]), MAT({ color: '#f4f1ea' }), n);
  const beaks = new THREE.InstancedMesh(beak, MAT({ color: '#e08a2a' }), n);
  white.frustumCulled = beaks.frustumCulled = false;
  const flock = Array.from({ length: n }, (_, i) => ({ f: i % 2, dx: (rand() - 0.5) * 9, dz: (rand() - 0.5) * 5, ph: rand() * 6 }));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const group = new THREE.Group();
  group.add(white, beaks);
  return {
    group,
    update(t, dt, v) {
      flock.forEach((d, i) => {
        const a = t * 0.025 + d.f * 3.1;                                       // each flock loops slowly along the shore
        const cx = (d.f ? -45 : 15) + Math.cos(a) * 22, cz = -40 - d.f * 25 + Math.sin(a) * 8;
        const heading = Math.atan2(-Math.cos(a) * 8, -Math.sin(a) * 22);
        p.set(cx + d.dx + Math.sin(t * 0.7 + d.ph) * 0.4, v.lakeY + 0.06 + Math.sin(t * 2 + d.ph) * 0.03, cz + d.dz);
        q.setFromAxisAngle(up, heading + Math.sin(t * 0.5 + d.ph) * 0.3);
        m.compose(p, q, s);
        white.setMatrixAt(i, m);
        beaks.setMatrixAt(i, m);
      });
      white.instanceMatrix.needsUpdate = beaks.instanceMatrix.needsUpdate = true;
    },
  };
}

/** A country boat (nouka) with its curved bamboo-mat shelter. */
function nouka() {
  const g = new THREE.Group();
  const hullG = new THREE.CylinderGeometry(0.85, 0.5, 7.5, 10, 1, false, 0, Math.PI);
  hullG.rotateZ(Math.PI / 2);
  hullG.rotateX(Math.PI);
  const p = hullG.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) + Math.pow(Math.abs(x) / 3.75, 3) * 0.6); }  // rising bow and stern
  hullG.computeVertexNormals();
  const hull = new THREE.Mesh(hullG, MAT({ color: '#5b3f28', side: THREE.DoubleSide }));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 2.4, 10, 1, true, 0, Math.PI), MAT({ color: '#8a7048', map: thatchTexture([2, 1]), side: THREE.DoubleSide }));
  roof.rotation.z = Math.PI / 2;
  roof.position.y = 0.35;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4, 5), MAT({ color: '#7a6040' }));
  pole.position.set(-3, 1.2, 0.3);
  pole.rotation.z = 0.5;
  g.add(hull, roof, pole);
  return g;
}

/** Palmyra (taal) palms of the Barind: tall straight trunks with a round head of fan leaves. */
function palmyras(spots) {
  const trunk = new THREE.CylinderGeometry(0.22, 0.3, 1, 7);
  trunk.translate(0, 0.5, 0);
  const fans = [];
  for (let k = 0; k < 14; k++) {
    const f = new THREE.CircleGeometry(1.3, 9, -0.9, 1.8);
    f.translate(0, 1.1, 0);
    f.rotateX(-0.5 - rand() * 0.9);
    f.rotateY((k / 14) * Math.PI * 2);
    fans.push(f);
  }
  const head = mergeAll(fans);
  const tm = new THREE.InstancedMesh(trunk, MAT({ color: '#4d4740' }), spots.length);
  const hm = new THREE.InstancedMesh(head, MAT({ color: '#4f7a34', side: THREE.DoubleSide }), spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  spots.forEach(([x, z], i) => {
    const h = 12 + rand() * 4;
    tm.setMatrixAt(i, m.compose(p.set(x, 0, z), q.identity(), s.set(1, h, 1)));
    hm.setMatrixAt(i, m.compose(p.set(x, h - 0.4, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28), s.setScalar(1.6 + rand() * 0.3)));
  });
  const g = new THREE.Group();
  for (const im of [tm, hm]) { im.castShadow = true; g.add(im); }
  return g;
}

// ---------------------------------------------------------------- helpers

/** Merge geometries into one (position, normal, uv; indices dropped). */
function mergeAll(list) {
  const pos = [], nor = [], uv = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    g.computeVertexNormals();
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    if (g.attributes.uv) uv.push(...g.attributes.uv.array); else uv.push(...new Array(g.attributes.position.count * 2).fill(0));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
