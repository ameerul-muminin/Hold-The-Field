// Harvest day: once the rice is cut, sheaves lie in rows on the stubble and a crew carries them on their heads over
// the bund to the courtyard, where two men beat the grain out on a plank. Shown only after a harvest; if the field
// floods afterwards the carriers stop going in. Reads the eased view state, never the sim.
import * as THREE from 'three';
import { rand } from './noise.js';

const FIELD = { x0: -22, x1: 21, z0: -14, z1: 14 };          // inside the bund (the field is 48 x 32, centred)
const DROP = new THREE.Vector3(36.6, 0, 6.6);                 // the sheaf pile in the courtyard
const S = 1.3;                                                // same scale as Hashem
const X_AXIS = new THREE.Vector3(1, 0, 0);

const MAT = (o) => new THREE.MeshLambertMaterial(o);
const sheafGeo = (() => {
  const g = new THREE.CylinderGeometry(0.22, 0.3, 1.25, 7);
  g.rotateZ(Math.PI / 2);                                      // lies on its side
  return g;
})();
const sheafMat = MAT({ color: '#d9b452' });

export function harvestCrew({ mobile, H }) {
  const group = new THREE.Group();
  group.visible = false;

  // ---------------------------------------------------------------- sheaves in the field and the pile at home
  const nField = mobile ? 24 : 40, rows = 5;
  const field = new THREE.InstancedMesh(sheafGeo, sheafMat, nField);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < nField; i++) {
    const row = i % rows, k = Math.floor(i / rows), per = Math.ceil(nField / rows);
    const x = FIELD.x0 + 2 + (k + 0.5) / per * (FIELD.x1 - FIELD.x0 - 4) + (rand() - 0.5) * 1.5;
    const z = FIELD.z0 + 2 + (row + 0.5) / rows * (FIELD.z1 - FIELD.z0 - 4) + (rand() - 0.5) * 1.2;
    field.setMatrixAt(i, m.compose(p.set(x, 0.25, z), q.setFromAxisAngle(up, rand() * 6.28), s));
  }
  field.castShadow = true;
  const pileMax = nField;
  const pile = new THREE.InstancedMesh(sheafGeo, sheafMat, pileMax);
  for (let i = 0; i < pileMax; i++) {
    const layer = Math.floor(i / 8), a = (i % 8) / 8 * Math.PI * 2 + layer * 0.4, r = 1.2 - layer * 0.25;
    pile.setMatrixAt(i, m.compose(p.set(DROP.x + Math.cos(a) * r, H + 0.25 + layer * 0.42, DROP.z + Math.sin(a) * r), q.setFromAxisAngle(up, -a), s));
  }
  pile.castShadow = true;
  group.add(field, pile);

  // ---------------------------------------------------------------- carriers
  const lungis = ['#2f4e86', '#7a2f3a', '#3d6b4a', '#5a4a8a', '#8a6a2f'];
  const nCarry = mobile ? 3 : 5;
  const carriers = [];
  for (let i = 0; i < nCarry; i++) {
    const w = person(lungis[i % lungis.length], i % 2 ? '#e8e4d8' : null);
    const load = new THREE.Mesh(sheafGeo, sheafMat);
    load.position.set(0, 2.1, 0);
    load.rotation.y = Math.PI / 2;
    w.group.add(load);
    group.add(w.group);
    const zLane = -9 + i * (18 / Math.max(1, nCarry - 1));
    carriers.push({ w, load, phase: i / nCarry, zLane, pick: new THREE.Vector3(8 - i * 5, 0, zLane * 0.8) });
  }

  // ---------------------------------------------------------------- threshers at the plank
  const plank = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.5), MAT({ color: '#6b4a2e' }));
  plank.position.set(34.2, H + 0.3, 3.4);
  plank.rotation.x = -0.35;
  plank.castShadow = true;
  group.add(plank);
  const threshers = [[33.6, 4.6, Math.PI], [34.9, 4.5, Math.PI]].map(([x, z, yaw], i) => {
    const w = person(lungis[(i + 2) % lungis.length], i ? null : '#e8e4d8', true);
    w.group.position.set(x, H, z);
    w.group.rotation.y = yaw;
    group.add(w.group);
    return { w, phase: i * 0.55 };
  });

  let since = -1;
  return {
    group,
    update(t, dt, v) {
      const on = !!v.harvested;
      group.visible = on;
      if (!on) { since = -1; return; }
      if (since < 0) since = t;
      const elapsed = t - since, flooded = v.fieldWaterY > 0.25, drop = new THREE.Vector3(DROP.x, H, DROP.z);
      const trip = 26;                                                      // seconds for a round trip
      const carried = Math.min(nField, Math.floor(elapsed / trip * nCarry + 0.5));
      field.count = flooded ? 0 : nField - carried;
      pile.count = Math.min(pileMax, 4 + carried);
      field.instanceMatrix.needsUpdate = true;

      for (const c of carriers) {
        // field (pick up) -> over the bund -> up the mound -> the pile, and back; the field part is skipped once it floods
        const path = flooded
          ? [new THREE.Vector3(27, 0, c.zLane * 0.6), new THREE.Vector3(30, H, 2 + c.zLane * 0.2), drop]
          : [c.pick, new THREE.Vector3(22.6, 0, c.zLane), new THREE.Vector3(24, v.bundH, c.zLane), new THREE.Vector3(25.6, 0, c.zLane), new THREE.Vector3(30, H, 2 + c.zLane * 0.2), drop];
        const { pos, dir, loaded } = walk(path, ((elapsed / trip + c.phase) % 1));
        c.w.group.position.copy(pos);
        c.w.group.rotation.y = Math.atan2(dir.x, dir.z);
        c.load.visible = loaded && carried < nField + nCarry;
        c.w.pose(loaded ? 'carry' : 'walk', t * 6 + c.phase * 10);
      }
      for (const th of threshers) th.w.pose('thresh', t * 4.2 + th.phase * 6);
    },
  };
}

/** Position on a there-and-back walk along a polyline: u in [0,1), first half loaded (towards the pile). */
function walk(points, u) {
  const forward = u < 0.5, f = forward ? u * 2 : (1 - u) * 2;
  const lens = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) { const l = points[i].distanceTo(points[i - 1]); lens.push(l); total += l; }
  let d = f * total, i = 0;
  while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i++; }
  const a = points[i], b = points[i + 1], k = lens[i] ? d / lens[i] : 0;
  const pos = a.clone().lerp(b, k);
  const dir = b.clone().sub(a);
  if (!forward) dir.negate();
  dir.y = 0;
  return { pos, dir, loaded: forward };
}

/** A farm worker: lungi, vest or bare shoulders, a gamchha tied round the head. Poses: walk, carry, thresh. */
function person(lungi, vest = null, threshing = false) {
  const group = new THREE.Group();
  const skin = MAT({ color: ['#7a4f33', '#8a5d3d', '#6b4430'][Math.floor(rand() * 3)] });
  const body = new THREE.Group();
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.92, 12), MAT({ color: lungi }));
  legs.position.y = 0.5;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.6, 12), vest ? MAT({ color: vest }) : skin);
  torso.position.y = 1.26;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), skin);
  head.position.y = 1.74;
  head.scale.set(0.95, 1.1, 1);
  const gamchha = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.045, 6, 14), MAT({ color: '#c0392b' }));
  gamchha.rotation.x = Math.PI / 2;
  gamchha.position.y = 1.82;
  body.add(legs, torso, head, gamchha);
  const arm = (side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.27, 1.52, 0);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.62, 8), skin);
    upper.position.y = -0.31;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), skin);
    hand.position.y = -0.64;
    g.add(upper, hand);
    body.add(g);
    return g;
  };
  const armL = arm(-1), armR = arm(1);
  let sheaf = null;
  const armDir = new THREE.Vector3();
  if (threshing) {                                  // the sheaf held in both hands, swung over the head onto the plank
    sheaf = new THREE.Mesh(sheafGeo, sheafMat);
    sheaf.scale.set(0.8, 0.8, 0.8);
    body.add(sheaf);
  }
  group.add(body);
  group.scale.setScalar(S);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return {
    group,
    pose(kind, ph) {
      if (kind === 'thresh') {
        const swing = (Math.sin(ph) + 1) / 2;        // 0 = down on the plank, 1 = overhead
        const a = -0.5 - swing * 2.3;
        armL.rotation.set(a, 0, -0.15);
        armR.rotation.set(a, 0, 0.15);
        body.rotation.x = 0.35 - swing * 0.4;       // bends into the stroke
        // the sheaf extends from the hands along the arms
        armDir.set(0, -Math.cos(a), -Math.sin(a));
        sheaf.position.set(0, 1.52, 0).addScaledVector(armDir, 1.1);
        sheaf.quaternion.setFromUnitVectors(X_AXIS, armDir);
        return;
      }
      const stride = Math.sin(ph);
      body.position.y = Math.abs(Math.cos(ph)) * 0.04;
      body.rotation.z = stride * 0.03;
      if (kind === 'carry') {                        // both hands up, steadying the sheaf on the head
        armL.rotation.set(0, 0, -2.75);
        armR.rotation.set(0, 0, 2.75);
      } else {
        armL.rotation.set(stride * 0.45, 0, -0.08);
        armR.rotation.set(-stride * 0.45, 0, 0.08);
      }
    },
  };
}
