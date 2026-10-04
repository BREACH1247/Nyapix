import * as THREE from "../vendor/three/three.module.js";

// An articulated, locally rendered toy character. No downloaded models or CDN.
export class Pet3D {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(384, 384, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.lost = false;
    this.renderer.domElement.addEventListener("webglcontextlost", (event) => { event.preventDefault(); this.lost = true; });
    this.renderer.domElement.addEventListener("webglcontextrestored", () => { this.lost = false; });
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1.5, 1.5, 2.8, -0.2, 0.1, 30);
    this.camera.position.set(0, 0.8, 8);
    this.camera.lookAt(0, 0.8, 0);
    // Camera bounds are relative to its center, so use a centered composition.
    this.camera.top = 1.5; this.camera.bottom = -1.5;
    this.camera.position.y = 1.35;
    this.camera.lookAt(0, 1.35, 0);
    this.camera.updateProjectionMatrix();
    this.scene.add(new THREE.HemisphereLight(0xfff8ee, 0x777c94, 2.1));
    const key = new THREE.DirectionalLight(0xffead3, 3.4); key.position.set(-3, 5, 5); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xe0ecff, 1.2); fill.position.set(4, 2, 3); this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 2.5); rim.position.set(1, 4, -3); this.scene.add(rim);
    this.sphere = new THREE.SphereGeometry(1, 28, 20);
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.cone = new THREE.ConeGeometry(1, 1, 3);
    this.materials = new Map();
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.key = "";
  }

  material(color, shiny = false) {
    const key = `${color}/${shiny}`;
    if (!this.materials.has(key)) this.materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: shiny ? 0.19 : 0.77, metalness: 0 }));
    return this.materials.get(key);
  }
  mesh(parent, geometry, color, position, scale, shiny = false) {
    const mesh = new THREE.Mesh(geometry, this.material(color, shiny));
    mesh.position.set(...position); mesh.scale.set(...scale); parent.add(mesh); return mesh;
  }
  ball(parent, color, position, scale, shiny = false) { return this.mesh(parent, this.sphere, color, position, scale, shiny); }
  group(parent, position) { const g = new THREE.Group(); g.position.set(...position); parent.add(g); return g; }

  build(s) {
    if (this.rig) this.scene.remove(this.rig);
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
    this.rig = new THREE.Group(); this.scene.add(this.rig);
    this.dog = s.petKind === "dog";
    const fur = s.furColor, mark = s.markColor, cream = s.bellyColor;
    this.body = this.group(this.rig, [0, 0.72, 0]);
    this.ball(this.body, fur, [0, 0, 0], [0.47, 0.64, 0.38]);
    this.ball(this.body, cream, [0, -0.04, 0.29], [0.31, 0.43, 0.16]);
    this.ball(this.body, fur, [-0.37, -0.33, 0.01], [0.24, 0.28, 0.29]);
    this.ball(this.body, fur, [0.37, -0.33, 0.01], [0.24, 0.28, 0.29]);
    this.paws = [-1, 1].map((side) => {
      const group = this.group(this.rig, [side * 0.28, 0.64, 0.24]);
      this.ball(group, fur, [0, -0.18, 0], [0.16, 0.34, 0.17]);
      this.ball(group, cream, [0, -0.44, 0.07], [0.22, 0.13, 0.28]);
      return group;
    });
    this.head = this.group(this.rig, [0, 1.71, 0.05]);
    this.ball(this.head, fur, [0, 0, 0], [0.68, 0.62, 0.53]);
    this.ears = [-1, 1].map((side) => {
      const ear = this.group(this.head, [side * (this.dog ? 0.58 : 0.43), this.dog ? 0.28 : 0.46, 0]);
      if (this.dog) {
        this.ball(ear, mark, [side * 0.04, -0.34, 0], [0.235, 0.48, 0.18]);
        this.ball(ear, s.innerEarColor, [side * 0.035, -0.36, 0.16], [0.115, 0.28, 0.035]);
      } else {
        this.mesh(ear, this.cone, fur, [0, 0.12, 0], [0.30, 0.52, 0.26]).rotation.y = Math.PI;
        this.mesh(ear, this.cone, s.innerEarColor, [0, 0.12, 0.15], [0.18, 0.33, 0.08]).rotation.y = Math.PI;
      }
      return ear;
    });
    this.patchGroup = this.group(this.head, [0, 0, 0]);
    if (["blaze", "tuxedo"].includes(s.pattern)) this.ball(this.patchGroup, cream, [0, 0.10, 0.485], [0.13, 0.40, 0.055]);
    if (["patches", "calico", "cow"].includes(s.pattern)) {
      this.ball(this.patchGroup, mark, [-0.31, 0.13, 0.40], [0.30, 0.35, 0.14]);
      if (s.pattern === "calico") this.ball(this.patchGroup, cream, [0.33, 0.3, 0.35], [0.25, 0.22, 0.10]);
    }
    if (["saddle", "blacktan", "siamese"].includes(s.pattern)) {
      this.ball(this.body, mark, [0.27, 0.16, -0.03], [0.29, 0.43, 0.37]);
      if (s.pattern !== "saddle") this.ball(this.patchGroup, mark, [0, 0.09, 0.36], [0.58, 0.44, 0.20]);
    }
    if (s.pattern === "tabby") for (let i = -1; i <= 1; i++) this.ball(this.patchGroup, mark, [i * 0.15, 0.43, 0.36], [0.045, 0.16, 0.045]);
    if (s.pattern === "spotted") for (const [x, y] of [[-0.37, 0.35], [0.23, 0.43], [0.48, -0.1]]) this.ball(this.patchGroup, mark, [x, y, 0.39], [0.10, 0.085, 0.065]);
    this.eyes = [-1, 1].map((side) => {
      const eye = this.group(this.head, [side * 0.29, 0.06, 0.47]);
      this.ball(eye, s.eyeColor, [0, 0, 0], [0.207, 0.238, 0.095]);
      const pupil = this.group(eye, [0, 0, 0.05]);
      this.ball(pupil, s.pupilColor || "#241e24", [0, 0, 0], [0.159, 0.192, 0.083], true);
      this.ball(pupil, "#fffaf0", [-0.055, 0.072, 0.075], [0.05, 0.052, 0.021], true);
      this.ball(pupil, "#fffaf0", [0.059, -0.063, 0.075], [0.02, 0.023, 0.011], true);
      return { eye, pupil };
    });
    this.ball(this.head, cream, [-0.13, -0.24, 0.48], [this.dog ? 0.29 : 0.23, 0.20, 0.20]);
    this.ball(this.head, cream, [0.13, -0.24, 0.48], [this.dog ? 0.29 : 0.23, 0.20, 0.20]);
    this.ball(this.head, s.noseColor, [0, -0.19, 0.68], [this.dog ? 0.14 : 0.085, 0.09, 0.075], true);
    this.ball(this.head, "#473035", [0, -0.37, 0.64], [0.09, 0.035, 0.032]);
    this.tongue = this.ball(this.head, s.innerEarColor, [0.025, -0.42, 0.66], [0.07, 0.12, 0.036]);
    if (!this.dog) for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
      const whisker = this.ball(this.head, mark, [side * 0.46, -0.23 - i * 0.06, 0.51], [0.19, 0.008, 0.008]);
      whisker.rotation.z = side * (0.10 - i * 0.13);
    }
    this.accessory = this.group(this.rig,[0,1.1,0]);
    if (s.accessory !== "none") {
      this.ball(this.accessory, s.collarColor || "#6d958d", [0, 0, 0.01], [0.43, 0.085, 0.36]);
      if (s.accessory === "bow") {
        for(const side of [-1,1]) this.ball(this.accessory,s.collarColor,[side*.14,-.08,.40],[.16,.12,.06]);
        this.ball(this.accessory,"#e8bc68",[0,-.08,.45],[.06,.07,.05]);
      } else if (s.accessory === "bandana") {
        const cloth=this.mesh(this.accessory,this.cone,s.collarColor,[0,-.17,.38],[.28,.40,.04]);cloth.rotation.z=Math.PI;
      } else this.ball(this.accessory, "#e8bc68", [0, -.06, .38], [.083, .105, .028], true);
    }
    this.toy = this.ball(this.head,"#b18ccd",[0,-.48,.73],[.24,.17,.14]);
    this.ball(this.toy,"#ffd48c",[0,0,.8],[.2,1.01,.25]);
    this.lens = this.group(this.rig,[.55,.78,.60]);
    this.ball(this.lens,"#59787b",[0,0,0],[.22,.22,.055]);
    this.ball(this.lens,"#b9e5e4",[0,0,.045],[.16,.16,.025],true);
    this.mesh(this.lens,this.box,"#59787b",[.09,-.27,0],[.08,.30,.07]).rotation.z=.3;
    this.tail = this.group(this.rig, [0.40, 0.46, -0.13]);
    let segment = this.tail;
    for (let i = 0; i < (this.dog ? 5 : 8); i++) {
      this.ball(segment, i === (this.dog ? 4 : 7) ? cream : fur, [0.08, 0.09, 0], [0.105, 0.16, 0.11]);
      segment = this.group(segment, [this.dog ? 0.105 : i > 4 ? -0.02 : 0.09, 0.12, 0]);
    }
    this.keyboard = this.group(this.rig, [0, 0.13, 0.59]);
    this.mesh(this.keyboard, this.box, "#aaa0bf", [0, 0, 0], [0.96, 0.07, 0.34]);
    for (let row = 0; row < 2; row++) for (let i = 0; i < 8; i++) this.mesh(this.keyboard, this.box, "#ebe6f3", [-0.39 + i * 0.11, 0.046, -0.085 + row * 0.15], [0.075, 0.025, 0.09]);
    this.bowl = this.group(this.rig, [0, 0.13, 0.74]);
    this.ball(this.bowl, "#6eaca8", [0, 0, 0], [0.43, 0.16, 0.30]);
    this.ball(this.bowl, "#bce4e8", [0, 0.11, 0], [0.36, 0.05, 0.24], true);
    this.key = JSON.stringify([s.petKind, s.furColor, s.bellyColor, s.markColor, s.innerEarColor, s.eyeColor, s.pupilColor, s.noseColor, s.collarColor, s.pattern, s.accessory]);
  }

  render(pet) {
    const s = pet.settings;
    const key = JSON.stringify([s.petKind, s.furColor, s.bellyColor, s.markColor, s.innerEarColor, s.eyeColor, s.pupilColor, s.noseColor, s.collarColor, s.pattern, s.accessory]);
    if (key !== this.key) this.build(s);
    const t = pet.tailT, mode = pet.mode;
    const now = performance.now();
    const ease = 1 - Math.exp(-Math.min(.05, (now - (this.lastFrame || now - 16)) / 1000) * 15);
    this.lastFrame = now;
    const sleep = mode === "sleep", happy = pet.pet > 0.2 || mode === "hop", typing = ["knead","edit"].includes(mode), walking = ["hunt", "home","toy"].includes(mode)||(mode==='fetch'&&['flight','chase','return'].includes(pet.fetch?.phase));
    const wave = mode === "wave", sniff = mode === "sniff", drink = mode === "water", stretch = mode === "stretch";
    this.rig.rotation.set(0, -0.16, pet.wobble * 0.45 + pet.tilt * 0.4);
    this.rig.scale.set(1, 1, 1);
    this.rig.position.x = mode === "toy" ? Math.sin(pet.modeT * 1.2) * .12 : 0;
    if (mode === "chase") this.rig.rotation.y = pet.modeT * 5;
    this.body.scale.x = sleep ? 1.25 : 1;
    this.body.scale.y = 1 + Math.sin(t * (sleep ? 1.7 : 2.4)) * 0.018;
    this.head.position.y = sleep ? 1.35 : sniff || drink ? 1.49 : 1.71;
    this.head.position.x = sleep ? -.2 : 0;
    if(sleep) { this.body.scale.y *= .65; this.head.position.y = .95; }
    this.accessory.visible = !sleep;
    this.head.rotation.set(drink ? 0.30 : sleep ? 0.15 : -pet.lookY * 0.09, pet.lookX * 0.14, mode === "think" ? Math.sin(t * 1.6) * 0.16 : mode === "waiting" ? 0.17 : pet.lookX * -0.055);
    if (pet.vibing) {
      if(s.musicStyle !== "bob") this.rig.rotation.z += Math.sin(t * (s.musicStyle === "dance" ? 4 : 2.5)) * (s.musicStyle === "dance" ? .12 : .055);
      this.head.rotation.z += Math.sin(t * 2.5 - .4) * .08;
      this.head.rotation.x += s.musicStyle === "bob" ? Math.sin(t * 5) * .18 : 0;
      this.head.position.y += Math.sin(t * 5) * .025;
    }
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      this.ears[i].rotation.z = side * (this.dog ? 0.10 : -0.10) + Math.sin(t * (happy ? 9 : 2) + i) * (happy ? 0.12 : 0.025);
      this.ears[i].rotation.x = walking ? Math.sin(pet.walkT) * 0.12 : 0;
      const eyeOpen = sleep ? .055 : Math.max(.055, (happy ? .78 : mode === "think" ? .9 : 1) * (1 - pet.blink));
      this.eyes[i].eye.scale.y += (eyeOpen - this.eyes[i].eye.scale.y) * Math.min(1, ease * 1.8);
      this.eyes[i].eye.rotation.z = happy ? (i === 0 ? -.06 : .06) : 0;
      this.eyes[i].pupil.position.x = pet.lookX * 0.035;
      this.eyes[i].pupil.position.y = -pet.lookY * 0.026;
      const paw = this.paws[i];
      paw.rotation.set(0, 0, 0); paw.position.y = 0.64;
      if (typing) { paw.rotation.x = -0.4 - Math.max(0, Math.sin(pet.pawBeat * 2 + i * Math.PI)) * 0.55; paw.position.y += Math.max(0, Math.sin(pet.pawBeat * 2 + i * Math.PI)) * 0.12; }
      if (walking) paw.rotation.x = Math.sin(pet.walkT + i * Math.PI) * 0.42;
      if (wave && i === 1) paw.rotation.z = 2.2 + Math.sin(t * 9) * 0.16;
      if (stretch) paw.rotation.z = side * (this.dog ? 0.45 : 2.5) * pet.stretchBlend;
      if (mode === "groom" && i === 1) { paw.rotation.z = 2.1 + Math.sin(t*7)*.2; this.head.rotation.z = -.12; }
      if (mode === "test" && i === 1) paw.rotation.x = -1;
      if (pet.vibing && s.musicStyle === "dance") paw.rotation.z = side * (.5 + Math.sin(t*8+i)*.4);
      if (sleep) paw.rotation.z = side * .8;
    }
    if (stretch && this.dog) { this.head.position.y -= pet.stretchBlend * 0.25; this.body.rotation.x = -0.14 * pet.stretchBlend; }
    else this.body.rotation.x = 0;
    this.tail.rotation.z = Math.sin(t * (happy ? 16 : this.dog ? 7 : 3)) * (sleep ? 0.035 : happy ? 0.38 : 0.17);
    this.tail.rotation.x = Math.sin(t * 4) * 0.14;
    if(sleep) this.tail.rotation.z = -1.4;
    const pant = this.dog && mode === "idle" && t % 11 > 8;
    const tongueTarget = sleep ? 0 : drink ? .8 + Math.sin(t * 10) * .2 : happy || pant ? .65 + Math.sin(t * 5) * .10 : mode === "reply" ? .35 : 0;
    this.tongueAmount = (this.tongueAmount || 0) + (tongueTarget - (this.tongueAmount || 0)) * ease;
    this.tongue.visible = this.tongueAmount > .02;
    this.tongue.scale.y = .12 * this.tongueAmount;
    this.tongue.position.y = -.35 - .10 * this.tongueAmount;
    this.tongue.rotation.z = Math.sin(t * 3) * .06 * this.tongueAmount;
    this.keyboard.visible = typing;
    this.bowl.visible = drink;
    this.toy.visible = mode === "toy" || (mode==='fetch'&&pet.fetch?.phase==='return');
    this.lens.visible = mode === "test";
    this.lens.rotation.z = Math.sin(t*3)*.12;
    this.scene.updateMatrixWorld(true);
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement;
  }

  hitTest(x, y) {
    if (!this.rig) return false;
    this.pointer.set(x * 2 - 1, 1 - y * 2);
    this.ray.setFromCamera(this.pointer, this.camera);
    return this.ray.intersectObject(this.rig, true).some((hit) => {
      for (let node = hit.object; node; node = node.parent) if (!node.visible) return false;
      return true;
    });
  }
  dispose() {
    for (const material of this.materials.values()) material.dispose();
    this.sphere.dispose(); this.box.dispose(); this.cone.dispose();
    this.renderer.dispose(); this.renderer.forceContextLoss();
  }
}
