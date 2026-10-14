// Life on the open land: white egrets (bok) standing in the plots, pecking, and a loose flock flying slow loops over the
// fields; small herds of deshi cattle grazing with their herder. All instanced, all on the ground's real height.
// More egrets come when the plots are wet or freshly cut, the way they follow water and the plough.
import * as THREE from 'three';
import { rand } from './noise.js';
import { person } from './harvest.js';

const up = new THREE.Vector3(0, 1, 0), xAxis = new THREE.Vector3(1, 0, 0), zAxis = new THREE.Vector3(0, 0, 1);

export function wildlife({ flood, mobile, clear, groves = [], heightAt = () => 0 }) {
  const group = new THREE.Group();
  const free = (x, z, r) => (!flood || z > -4) && clear(x, z, r) && !groves.some(([gx, gz, gr]) => Math.hypot(x - gx, z - gz) < gr + r + 4);
  // the first few go where the default camera looks (the plots west of the field), the rest anywhere on the land
  const place = (n, dMin, dMax, r, nearView = 0) => {
    const out = [];
    for (let guard = 0; out.length < n && guard < 3000; guard++) {
      const a = rand() * Math.PI * 2, d = dMin + rand() * (dMax - dMin);
      const inView = out.length < nearView && guard < 1500;
      const x = inView ? -95 + rand() * 50 : Math.cos(a) * d, z = inView ? -6 + rand() * 46 : Math.sin(a) * d + 15;
      if (free(x, z, r) && !out.some(([ox, oz]) => Math.hypot(x - ox, z - oz) < r * 2.5)) out.push([x, z]);
    }
    return out;
  };

  // ---------------------------------------------------------------- egrets standing in the plots (and in the field)
  const birds = [];
  for (const [cx, cz] of place(mobile ? 5 : 9, 34, 230, 5, mobile ? 2 : 4)) {
    const n = 3 + Math.floor(rand() * 4);
    for (let k = 0; k < n; k++) birds.push(egretState(cx + (rand() - 0.5) * 9, cz + (rand() - 0.5) * 7));
  }
  const inField = [[-15, -8], [-6, 9], [11, -4]].map(([x, z]) => egretState(x, z, true));
  const allStanding = [...birds, ...inField];
  const standing = new THREE.InstancedMesh(egretGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), allStanding.length);
  standing.frustumCulled = false;
  standing.castShadow = true;
  group.add(standing);

  // ---------------------------------------------------------------- a flock in flight
  const nFly = mobile ? 6 : 10;
  const flyBody = new THREE.InstancedMesh(flyingGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), nFly);
  const wingG = new THREE.PlaneGeometry(0.5, 1.0);
  wingG.rotateX(-Math.PI / 2);
  wingG.translate(0, 0, 0.5);                                  // root at the body, tip out along +z
  const wingMat = new THREE.MeshLambertMaterial({ color: '#f6f4ee', side: THREE.DoubleSide });
  const wingL = new THREE.InstancedMesh(wingG, wingMat, nFly), wingR = new THREE.InstancedMesh(wingG, wingMat, nFly);
  for (const im of [flyBody, wingL, wingR]) { im.frustumCulled = false; group.add(im); }

  // ---------------------------------------------------------------- cattle and their herders
  const herds = place(mobile ? 2 : 4, 45, 200, 12, 1).map(([x, z]) => ({ x, z, x0: x, z0: z, ph: rand() * 10 }));
  const cows = [];
  const coats = ['#8a5636', '#e8e2d6', '#3a3230', '#a5683f', '#d8cbb2', '#6b4a35'];
  herds.forEach((h, hi) => {
    const n = mobile ? 4 : 5;
    for (let k = 0; k < n; k++) cows.push({ herd: h, x: h.x + (rand() - 0.5) * 8, z: h.z + (rand() - 0.5) * 8, yaw: rand() * 6.28, tx: 0, tz: 0, state: 'graze', timer: rand() * 8, coat: coats[(hi * 3 + k) % coats.length] });
  });
  const cattle = new THREE.InstancedMesh(cowGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), Math.max(1, cows.length));
  cattle.count = cows.length;
  const col = new THREE.Color();
  cows.forEach((c, i) => cattle.setColorAt(i, col.set(c.coat)));
  cattle.castShadow = true;
  cattle.frustumCulled = false;
  group.add(cattle);
  const herders = herds.map((h, i) => {
    const w = person(['#2f4e86', '#5a4a8a', '#3d6b4a', '#7a2f3a'][i % 4], i % 2 ? '#e8e4d8' : null);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 5), new THREE.MeshLambertMaterial({ color: '#6b4a2e' }));
    stick.position.set(0.32, 0.85, 0.15);
    stick.rotation.z = 0.15;
    w.group.add(stick);
    group.add(w.group);
    return { w, h, x: h.x + 6, z: h.z + 4 };
  });

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), mw = new THREE.Matrix4();
  return {
    group,
    update(t, dt, v) {
      // egrets: more of them while the plots are wet or just cut
      const season = v.season ?? 0.3;
      const share = season < 0.45 || season > 0.85 ? 1 : 0.4;
      const shown = Math.round(birds.length * share);
      allStanding.forEach((b, i) => {
        let visible = i < shown;
        if (b.field) visible = !v.harvested && v.growth < 0.6 && v.fieldWaterY < 0.25;
        b.timer -= dt;
        if (b.timer <= 0) {                                    // peck, look up, take a step
          b.state = b.state === 'peck' ? 'stand' : rand() < 0.5 ? 'peck' : 'step';
          b.timer = b.state === 'stand' ? 1.5 + rand() * 3 : b.state === 'peck' ? 0.6 + rand() * 0.8 : 1.2;
          if (b.state === 'step') b.yaw += (rand() - 0.5) * 1.6;
        }
        if (b.state === 'step') { b.x += Math.cos(b.yaw) * dt * 0.35; b.z -= Math.sin(b.yaw) * dt * 0.35; }
        const pitch = b.state === 'peck' ? 0.55 + Math.sin(t * 14) * 0.08 : 0;
        q.setFromAxisAngle(up, b.yaw).multiply(q2.setFromAxisAngle(zAxis, -pitch));
        p.set(b.x, (b.field ? 0.02 : heightAt(b.x, b.z)) + (visible ? 0 : -50), b.z);
        standing.setMatrixAt(i, m.compose(p, q, s.set(1.25, 1.25, 1.25)));
      });
      standing.instanceMatrix.needsUpdate = true;

      // the flock: a slow loop over the fields in a loose V, grounded in a storm
      const flying = (v.storm ?? 0) < 0.55;
      flyBody.visible = wingL.visible = wingR.visible = flying;
      if (flying) {
        const a = t * (Math.PI * 2 / 90), R = 150;
        const cx = -30 + Math.cos(a) * R, cz = 90 + Math.sin(a) * R * 0.7;
        const heading = Math.atan2(-Math.cos(a) * R * 0.7, -Math.sin(a) * R);       // direction of travel
        for (let i = 0; i < nFly; i++) {
          const rank = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
          const back = rank * 2.2, lat = side * rank * 1.6;
          const fx = cx - Math.cos(heading) * back + Math.sin(heading) * lat;
          const fz = cz + Math.sin(heading) * back + Math.cos(heading) * lat;
          p.set(fx, 30 + Math.sin(t * 0.4 + i) * 1.5 - rank * 0.3, fz);
          q.setFromAxisAngle(up, heading);
          m.compose(p, q, s.set(1.4, 1.4, 1.4));
          flyBody.setMatrixAt(i, m);
          const flap = Math.sin(t * 5.5 + i * 0.7) * 0.6;
          wingL.setMatrixAt(i, mw.multiplyMatrices(m, new THREE.Matrix4().makeRotationX(-flap)));
          wingR.setMatrixAt(i, mw.multiplyMatrices(m, new THREE.Matrix4().makeRotationX(Math.PI + flap)));
        }
        s.set(1, 1, 1);
        flyBody.instanceMatrix.needsUpdate = wingL.instanceMatrix.needsUpdate = wingR.instanceMatrix.needsUpdate = true;
      }

      // cattle: graze, then amble to a fresh patch near the herd, which itself drifts slowly
      for (const h of herds) { h.x = h.x0 + Math.sin(t * 0.01 + h.ph) * 10; h.z = h.z0 + Math.cos(t * 0.013 + h.ph) * 7; }
      cows.forEach((c, i) => {
        c.timer -= dt;
        if (c.timer <= 0) {
          if (c.state === 'graze') {
            c.state = 'walk';
            c.tx = c.herd.x + (rand() - 0.5) * 12; c.tz = c.herd.z + (rand() - 0.5) * 10;
            c.timer = 10;
          } else { c.state = 'graze'; c.timer = 6 + rand() * 10; }
        }
        let pitch = 0.12;
        if (c.state === 'walk') {
          const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz);
          if (d < 0.3) { c.state = 'graze'; c.timer = 6 + rand() * 10; } else {
            const want = Math.atan2(-dz, dx);
            c.yaw += Math.atan2(Math.sin(want - c.yaw), Math.cos(want - c.yaw)) * Math.min(1, dt * 1.5);
            c.x += Math.cos(c.yaw) * dt * 0.45; c.z -= Math.sin(c.yaw) * dt * 0.45;
            pitch = 0;
          }
        }
        q.setFromAxisAngle(up, c.yaw).multiply(q2.setFromAxisAngle(zAxis, -pitch - Math.sin(t * 0.8 + i) * 0.03));
        cattle.setMatrixAt(i, m.compose(p.set(c.x, heightAt(c.x, c.z), c.z), q, s.set(1.25, 1.25, 1.25)));
      });
      s.set(1, 1, 1);
      cattle.instanceMatrix.needsUpdate = true;
      for (const hd of herders) {                         // the herder keeps to the edge of the herd, leaning on his stick
        const tx = hd.h.x + 7, tz = hd.h.z + 5, dx = tx - hd.x, dz = tz - hd.z, d = Math.hypot(dx, dz);
        const moving = d > 0.4;
        if (moving) { hd.x += dx / d * dt * 0.6; hd.z += dz / d * dt * 0.6; }
        hd.w.group.position.set(hd.x, heightAt(hd.x, hd.z), hd.z);
        hd.w.group.rotation.y = moving ? Math.atan2(dx, dz) : Math.atan2(hd.h.x - hd.x, hd.h.z - hd.z);
        hd.w.pose('walk', moving ? t * 5 : 0);
      }
    },
  };
}

function egretState(x, z, field = false) {
  return { x, z, yaw: rand() * 6.28, state: 'stand', timer: rand() * 3, field };
}

// ---------------------------------------------------------------- models (one merged, vertex-coloured mesh each)

/** A standing egret, facing +x: white body and S-neck, yellow bill, dark legs. About 0.9 m tall. */
function egretGeometry() {
  const white = [0.96, 0.95, 0.92], yellow = [0.92, 0.72, 0.2], dark = [0.15, 0.14, 0.12];
  const body = new THREE.SphereGeometry(0.2, 8, 6); body.scale(1.5, 0.75, 0.8); body.rotateZ(0.25); body.translate(0, 0.86, 0);
  const neck = new THREE.CylinderGeometry(0.035, 0.045, 0.5, 5); neck.rotateZ(-0.3); neck.translate(0.24, 1.16, 0);
  const head = new THREE.SphereGeometry(0.065, 6, 5); head.translate(0.33, 1.42, 0);
  const bill = new THREE.ConeGeometry(0.022, 0.2, 5); bill.rotateZ(-Math.PI / 2); bill.translate(0.48, 1.41, 0);
  const tail = new THREE.ConeGeometry(0.06, 0.22, 5); tail.rotateZ(Math.PI / 2 + 0.3); tail.translate(-0.33, 0.8, 0);
  const legs = [-0.06, 0.06].map((zz) => { const l = new THREE.CylinderGeometry(0.014, 0.014, 0.66, 4); l.translate(0, 0.33, zz); return l; });
  return mergeColored([[body, white], [neck, white], [head, white], [tail, white], [bill, yellow], ...legs.map((l) => [l, dark])]);
}

/** A flying egret's body, facing +x: neck tucked, legs trailing (the wings are separate, to flap). */
function flyingGeometry() {
  const white = [0.96, 0.95, 0.92], yellow = [0.92, 0.72, 0.2], dark = [0.15, 0.14, 0.12];
  const body = new THREE.SphereGeometry(0.18, 8, 6); body.scale(1.7, 0.7, 0.75);
  const head = new THREE.SphereGeometry(0.06, 6, 5); head.translate(0.32, 0.06, 0);
  const bill = new THREE.ConeGeometry(0.02, 0.18, 5); bill.rotateZ(-Math.PI / 2); bill.translate(0.45, 0.05, 0);
  const legs = new THREE.CylinderGeometry(0.014, 0.014, 0.6, 4); legs.rotateZ(Math.PI / 2); legs.translate(-0.55, -0.02, 0);
  return mergeColored([[body, white], [head, white], [bill, yellow], [legs, dark]]);
}

/** A small deshi cow, facing +x. The coat is white in the geometry and tinted per instance. */
function cowGeometry() {
  const coat = [1, 1, 1], horn = [0.9, 0.86, 0.78], hoof = [0.2, 0.18, 0.16];
  const body = new THREE.CapsuleGeometry(0.34, 0.95, 4, 10); body.rotateZ(Math.PI / 2); body.translate(0, 0.95, 0);
  const hump = new THREE.SphereGeometry(0.2, 8, 6); hump.translate(0.45, 1.25, 0);
  const neck = new THREE.CylinderGeometry(0.13, 0.17, 0.45, 8); neck.rotateZ(-1.0); neck.translate(0.8, 1.0, 0);
  const head = new THREE.BoxGeometry(0.42, 0.3, 0.26); head.rotateZ(-0.7); head.translate(1.05, 0.78, 0);
  const horns = [-0.1, 0.1].map((zz) => { const h = new THREE.ConeGeometry(0.035, 0.18, 5); h.translate(0.95, 0.98, zz); return h; });
  const parts = [[body, coat], [hump, coat], [neck, coat], [head, coat], ...horns.map((h) => [h, horn])];
  for (const [lx, lz] of [[0.45, 0.17], [0.45, -0.17], [-0.45, 0.17], [-0.45, -0.17]]) {
    const leg = new THREE.CylinderGeometry(0.06, 0.05, 0.72, 5); leg.translate(lx, 0.36, lz);
    const hf = new THREE.CylinderGeometry(0.055, 0.06, 0.08, 5); hf.translate(lx, 0.04, lz);
    parts.push([leg, coat], [hf, hoof]);
  }
  const tail = new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4); tail.rotateZ(-0.25); tail.translate(-0.85, 0.75, 0);
  parts.push([tail, coat]);
  return mergeColored(parts);
}

/** Merge [geometry, rgb] pairs into one geometry with a per-vertex colour (values given in sRGB). */
function mergeColored(parts) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for (const [g0, rgb] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    g.computeVertexNormals();
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    c.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
    for (let i = 0; i < g.attributes.position.count; i++) col.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
