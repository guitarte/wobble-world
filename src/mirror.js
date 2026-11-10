// Mirror mode: the live camera picture fills the stage, so players see their
// real selves in their real room, and the game is drawn on top of it.
import * as THREE from 'three';
import { INK } from './toon.js';

const RING = new THREE.RingGeometry(0.76, 1.04, 32), RING_INK = new THREE.RingGeometry(0.62, 1.18, 32);

export class Mirror {
  constructor(app) {
    this.app = app; this.on = false; this.group = new THREE.Group(); this.group.visible = false; app.scene.add(this.group);
    // drawn first and without depth, so everything in the game lands on top of the picture
    this.mat = new THREE.MeshBasicMaterial({ color: 0x20264a, depthTest: false, depthWrite: false, fog: false, side: THREE.DoubleSide });
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat); this.plane.renderOrder = -5; this.plane.frustumCulled = false; this.group.add(this.plane);
    // a ring in the player's colour around each hand, so everyone can tell who is who
    this.rings = [];
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group(), c = new THREE.Mesh(RING, new THREE.MeshBasicMaterial({ color: 0xffffff })), k = new THREE.Mesh(RING_INK, new THREE.MeshBasicMaterial({ color: INK }));
      k.position.z = -0.02; g.add(k, c); g.visible = false; g.userData.c = c; this.group.add(g); this.rings.push(g);
    }
  }
  set(on) { this.on = on; this.group.visible = on; if (!on) for (const r of this.rings) r.visible = false; }
  update(dt, t, players) {
    if (!this.on) return;
    const tr = this.app.tracker, cv = tr.canvas, live = tr.mode === 'camera' && cv.width > 2;
    if (live && (!this.tex || this.tw !== cv.width || this.th !== cv.height)) {
      // a texture cannot change size once it is on the graphics card: make a new one
      this.tex?.dispose(); this.tex = new THREE.CanvasTexture(cv); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.generateMipmaps = false; this.tex.minFilter = THREE.LinearFilter;
      this.mat.map = this.tex; this.mat.color.set(0xf2f2f2); this.mat.needsUpdate = true; this.tw = cv.width; this.th = cv.height;
    }
    if (live && tr.frameN !== this.seen) { this.seen = tr.frameN; this.tex.needsUpdate = true; }
    this.plane.scale.set((tr.mirror ? -1 : 1) * tr.stageW, tr.stageH, 1);
    for (const r of this.rings) r.visible = false;
    for (const p of players) for (let h = 0; h < 2; h++) {
      const r = this.rings[p.slot * 2 + h], hd = p.rig.hands[h], s = Math.min(0.34, 0.24 * p.rig.S) * (1 + 0.08 * Math.sin(t * 6 + h * 2));
      r.visible = true; r.position.set(hd.x, hd.y, 0.25); r.scale.setScalar(s); r.userData.c.material.color.set(p.color);
    }
  }
}
