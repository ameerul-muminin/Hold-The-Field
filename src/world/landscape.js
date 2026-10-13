// The countryside beyond the farm: the open land painted as a patchwork of rice plots divided by aal (narrow raised
// earth ridges), each plot at its own stage of the season; and a distant treeline closing the horizon, the way
// Bangladesh looks from any village road. The plots are drawn in the ground's shader, so they add no geometry.
import * as THREE from 'three';
import { rand } from './noise.js';

/**
 * Turns a terrain material into rice plots. Returns { setSeason(0..1) }: 0 = start of the sim's season, 1 = end.
 * Plots stay off the lake bed (low ground) and fade to the plain ground colour far away.
 */
export function patchwork(material) {
  const uniforms = { uSeason: { value: 0.3 } };
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = 'varying vec3 vWorldPos;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    );
    sh.fragmentShader = `uniform float uSeason; varying vec3 vWorldPos;
      float ph21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float pnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(ph21(i), ph21(i + vec2(1, 0)), f.x), mix(ph21(i + vec2(0, 1)), ph21(i + vec2(1, 1)), f.x), f.y); }
      vec3 plin(vec3 c) { return pow(c, vec3(2.2)); }
      ` + sh.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       {
         vec2 xz = vWorldPos.xz;
         // plot layout: a slightly turned, gently warped grid; each row shifted so the plots do not line up
         float a = 0.32; mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
         vec2 q = R * xz + (vec2(pnoise(xz * 0.015), pnoise(xz * 0.015 + 7.3)) - 0.5) * 10.0;
         vec2 size = vec2(17.0, 11.0);
         float row = floor(q.y / size.y);
         q.x += ph21(vec2(row, 3.1)) * size.x;
         size.x *= 0.7 + ph21(vec2(row, 9.7)) * 0.7;
         vec2 cell = floor(q / size), local = fract(q / size);
         float edge = min(min(local.x, 1.0 - local.x) * size.x, min(local.y, 1.0 - local.y) * size.y);
         float id = ph21(cell + 0.37), id2 = ph21(cell + 11.1);
         // the plot's stage: each one was planted a little earlier or later
         float s = (uSeason - (0.02 + id * 0.34)) / 0.66;
         vec3 mud = plin(vec3(0.45, 0.39, 0.30)), water = plin(vec3(0.42, 0.50, 0.50)), young = plin(vec3(0.56, 0.66, 0.38));
         vec3 lush = plin(vec3(0.38, 0.54, 0.26)), gold = plin(vec3(0.78, 0.68, 0.36)), straw = plin(vec3(0.68, 0.61, 0.45));
         vec3 c = mud;
         c = mix(c, water, smoothstep(-0.02, 0.03, s));
         c = mix(c, young, smoothstep(0.08, 0.2, s));
         c = mix(c, lush, smoothstep(0.25, 0.5, s));
         c = mix(c, gold, smoothstep(0.66, 0.84, s));
         c = mix(c, straw, smoothstep(0.88, 0.95, s));
         if (id2 < 0.09) c = plin(vec3(0.56, 0.58, 0.40));                       // a fallow plot, grazed
         c = mix(c, c * plin(vec3(1.0, 0.94, 0.8)), step(0.7, ph21(cell + 5.5)) * 0.6);   // some plots a little yellower
         // rice rows and ground grain inside the plot
         float rows = 0.94 + 0.06 * sin(local.x * size.x * 3.6);
         c *= rows * (0.88 + 0.24 * pnoise(xz * 0.8)) * (0.84 + 0.3 * id2);
         // aal: a thin grassy ridge round every plot, kept about a pixel wide in the distance
         float dist = distance(cameraPosition, vWorldPos);
         float w = 0.32, aa = fwidth(edge) * 1.5;
         float aal = (1.0 - smoothstep(w, w + aa, edge)) * (1.0 - smoothstep(220.0, 520.0, dist));
         c = mix(c, plin(vec3(0.42, 0.47, 0.30)), aal);
         // not on the lake bed, and fade back to the plain ground far away
         float mask = smoothstep(-0.6, -0.3, vWorldPos.y) * (1.0 - smoothstep(650.0, 950.0, length(xz)));
         diffuseColor.rgb = mix(diffuseColor.rgb, c * diffuse, mask);
       }`,
    );
  };
  material.customProgramCacheKey = () => 'patchwork';
  return { setSeason: (v) => { uniforms.uSeason.value = Math.max(0, Math.min(1, v)); } };
}

/** Distant treelines on the horizon. thetaStart/Length choose the arc (the haor leaves its lake side open). */
export function treeline({ full = true } = {}) {
  const group = new THREE.Group();
  const tex = treelineTexture();
  const arc = full ? [0, Math.PI * 2] : [-Math.PI / 2 - 0.15, Math.PI + 0.3];       // CylinderGeometry: theta 0 = +z (south)
  for (const [r, h, color, rep] of [[520, 30, '#2f4d2a', 14], [820, 46, '#3d5a3a', 18]]) {
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(rep * arc[1] / (Math.PI * 2), 1);
    const g = new THREE.CylinderGeometry(r, r, h, 160, 1, true, arc[0], arc[1]);
    g.translate(0, h / 2 - 3, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, map: t, alphaTest: 0.45, side: THREE.DoubleSide }));
    group.add(m);
  }
  return group;
}

function treelineTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128;
  const x = c.getContext('2d');
  x.clearRect(0, 0, c.width, c.height);
  x.fillStyle = '#ffffff';
  const blob = (cx, cy, r) => { for (const dx of [0, -1024, 1024]) { x.beginPath(); x.arc(cx + dx, cy, r, 0, Math.PI * 2); x.fill(); } };
  x.fillRect(0, 108, 1024, 20);                                       // the ground strip under the trees
  for (let i = 0; i < 160; i++) {                                     // rounded canopies of village groves
    const cx = rand() * 1024, r = 10 + rand() * 22, top = 40 + rand() * 50;
    blob(cx, 128 - top + r * 0.6, r);
    blob(cx, 120, r * 0.9);
  }
  for (let i = 0; i < 26; i++) {                                     // palms poking above the canopy
    const px = rand() * 1024, ph = 20 + rand() * 30;
    x.fillRect(px, 128 - 40 - ph, 2, ph + 10);
    for (let k = 0; k < 7; k++) {
      const a = Math.PI + (k / 6) * Math.PI;
      x.beginPath();
      x.ellipse(px + Math.cos(a) * 7, 128 - 40 - ph + Math.sin(a) * 3 + 3, 8, 2, a, 0, Math.PI * 2);
      x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
