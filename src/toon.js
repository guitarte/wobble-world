// The comic-book look: two-tone cel shading with halftone dots where light
// turns to shadow, a coloured rim light, and thick ink outlines made by drawing
// each shape again, slightly inflated, in black.
import * as THREE from 'three';

export const TOON = { uDot: { value: 7 } }; // halftone cell size in device pixels (set on resize)
export const INK = 0x140c2a;
const LIGHT = new THREE.Vector3(-0.5, 0.62, 0.6).normalize();
const RIMDIR = new THREE.Vector3(0.85, 0.3, -0.25).normalize();
const hsl = { h: 0, s: 0, l: 0 };

// Shadows lean toward violet and get richer, not just darker.
export function shadeOf(color, amt = 1) {
  const c = new THREE.Color(color); c.getHSL(hsl, THREE.SRGBColorSpace);
  let dh = 0.74 - hsl.h; if (dh > 0.5) dh -= 1; if (dh < -0.5) dh += 1;
  c.setHSL((hsl.h + dh * 0.2 * amt + 1) % 1, Math.min(1, hsl.s * 1.1 + 0.08), hsl.l * (1 - 0.38 * amt), THREE.SRGBColorSpace);
  return c;
}
export function tint(color, toward, k) { return new THREE.Color(color).lerp(new THREE.Color(toward), k); }

const VS = `varying vec3 vN; varying vec3 vV;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`;
const FS = `uniform vec3 uColor, uShade, uRim, uLight, uRimDir; uniform float uRimAmt, uSpec, uDot, uFlash, uOpacity;
varying vec3 vN; varying vec3 vV;
void main(){
  vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n; vec3 v = normalize(vV);
  float ndl = dot(n, uLight);
  // halftone: shadow-coloured dots that grow until they merge into solid shadow
  vec2 p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / uDot;
  float d = length(fract(p) - 0.5);
  float band = smoothstep(-0.32, 0.3, ndl);
  float r = (1.0 - band) * 0.76;
  float lit = smoothstep(r - 0.05, r + 0.05, d);
  vec3 c = mix(uShade, uColor, lit);
  // glossy streak (hair)
  float sp = step(0.94, dot(n, normalize(uLight + v))) * uSpec;
  c = mix(c, mix(uColor, vec3(1.0), 0.6), sp);
  // rim light from behind, on the side away from the key light
  float fres = 1.0 - max(dot(n, v), 0.0);
  float rim = step(0.6, fres) * step(0.15, dot(n, uRimDir));
  c = mix(c, uRim, rim * uRimAmt);
  c = mix(c, vec3(1.0), uFlash);
  gl_FragColor = vec4(c, uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function toonMat(color, o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uShade: { value: o.shade !== undefined ? new THREE.Color(o.shade) : shadeOf(color, o.shadeAmt ?? 1) },
      uRim: { value: new THREE.Color(o.rim ?? 0xffffff) }, uRimAmt: { value: o.rimAmt ?? 0.9 }, uSpec: { value: o.spec ?? 0 },
      uDot: TOON.uDot, uLight: { value: LIGHT }, uRimDir: { value: RIMDIR }, uFlash: { value: 0 }, uOpacity: { value: o.opacity ?? 1 },
    },
    vertexShader: VS, fragmentShader: FS, side: o.side ?? THREE.FrontSide, transparent: (o.opacity ?? 1) < 1,
  });
}

// Black shell drawn inside-out and pushed outward along the normals.
export function inkMat(thick = 0.035, color = INK) {
  return new THREE.ShaderMaterial({
    uniforms: { uThick: { value: thick }, uInk: { value: new THREE.Color(color) } }, side: THREE.BackSide,
    vertexShader: `uniform float uThick;
      void main(){
        #ifdef USE_INSTANCING
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        #else
        vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * normal);
        #endif
        mv.xyz += n * uThick * max(1.0, -mv.z / 13.0); // far things get a thicker shell so the line stays the same width on screen
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uInk; void main(){ gl_FragColor = vec4(uInk, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  });
}
// A mesh with its ink outline attached.
export function inked(geo, mat, ink) {
  const m = new THREE.Mesh(geo, mat);
  if (ink) { const h = new THREE.Mesh(geo, ink); h.matrixAutoUpdate = false; m.add(h); m.userData.hull = h; }
  return m;
}
export const SHARED_INK = inkMat(0.04);
export const THIN_INK = inkMat(0.022);
// Give every solid, lit mesh under root an outline.
export function inkGroup(root, ink = SHARED_INK) {
  const list = []; root.traverse(o => { if (o.isMesh && !o.isInstancedMesh && !o.userData.hull && !o.userData.noInk && o.material && (o.material.isMeshToonMaterial || o.material.uniforms?.uShade) && !o.material.transparent) list.push(o); });
  for (const m of list) { const h = new THREE.Mesh(m.geometry, ink); h.userData.noInk = true; h.matrixAutoUpdate = false; m.add(h); m.userData.hull = h; }
  return root;
}

// Three-step ramp for the standard toon material used on scenery.
export const GRADIENT = (() => {
  const t = new THREE.DataTexture(new Uint8Array([118, 110, 150, 255, 196, 192, 214, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
export const sceneToon = (color, o = {}) => { const { roughness, metalness, clearcoat, flatShading, envMapIntensity, ...rest } = o; return new THREE.MeshToonMaterial({ color, gradientMap: GRADIENT, ...rest }); };
