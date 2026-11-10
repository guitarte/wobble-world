// The last step of every frame: make the picture look printed. Ink lines where
// colours meet, halftone dots in the darker tones, colour plates that slip apart
// toward the corners like a misprinted comic, and a soft vignette.
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export class ComicPass extends Pass {
  constructor() {
    super();
    this.uniforms = { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1280, 720) }, uDot: { value: 6 }, uSlip: { value: 1 }, uInk: { value: 1 }, uFlash: { value: 0 } };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, depthTest: false, depthWrite: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uDot, uSlip, uInk, uFlash; varying vec2 vUv;
        float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
        void main(){
          vec2 px = 1.0 / uRes, d = vUv - 0.5; float r2 = dot(d, d);
          vec2 off = d * (0.0035 + r2 * 0.022) * uSlip;
          vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
          // ink where neighbouring colours differ a lot
          vec2 o = px * 1.15;
          vec3 a = texture2D(tDiffuse, vUv + o).rgb, b = texture2D(tDiffuse, vUv - o).rgb;
          vec3 e = texture2D(tDiffuse, vUv + vec2(o.x, -o.y)).rgb, f = texture2D(tDiffuse, vUv - vec2(o.x, -o.y)).rgb;
          float edge = length(a - b) + length(e - f);
          float ink = smoothstep(0.42, 0.9, edge) * uInk;
          // halftone: dots that grow as the tone gets darker
          float l = luma(c);
          vec2 hp = mat2(0.866, -0.5, 0.5, 0.866) * gl_FragCoord.xy / uDot;
          float hd = length(fract(hp) - 0.5);
          float tone = smoothstep(0.66, 0.12, l) * 0.56;
          float dots = (1.0 - smoothstep(tone - 0.07, tone + 0.07, hd)) * step(0.02, tone);
          c *= 1.0 - dots * 0.2;
          // punchier colour
          l = luma(c); c = mix(vec3(l), c, 1.16); c = (c - 0.5) * 1.05 + 0.5;
          c = mix(c, vec3(0.07, 0.04, 0.15), ink * 0.82);
          c *= 1.0 - r2 * 0.42;
          c = mix(c, vec3(1.0), uFlash);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.fsQuad = new FullScreenQuad(this.material);
  }
  setSize(w, h) { this.uniforms.uRes.value.set(w, h); }
  render(renderer, writeBuffer, readBuffer) {
    this.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.fsQuad.render(renderer);
  }
  dispose() { this.material.dispose(); this.fsQuad.dispose(); }
}
