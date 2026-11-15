/* Menu backdrops (spec 003, FR-002, FR-005). Each arrival on the main menu shows the next style:
 * a hunter diorama, a world diorama, a 2D glyph rain, or the author's own images when
 * public/menu/manifest.json lists some. The 3D scenes reuse the shipped hunters and procedural
 * shapes only; they are original compositions, not reproductions of film shots. Nothing here
 * runs during a mission: the scene is disposed when play starts. */
import * as THREE from 'three';

export const BACKDROP_STYLES = Object.freeze(['hunter', 'world', 'glyphs', 'images']);
export const BACKDROP_WORLDS = Object.freeze(['jungle', 'pyramid', 'rooftops', 'ship']);
const STORE_KEY = 'yautja-menu-backdrop-v1';

/** The next style, world and hunter after the stored ones; images join only when available. */
export function nextBackdrop(previous, { hunters = 1, imagesAvailable = false } = {}) {
  const styles = BACKDROP_STYLES.filter(style => style !== 'images' || imagesAvailable);
  const last = previous && typeof previous === 'object' ? previous : {};
  const styleIndex = (Number.isInteger(last.styleIndex) ? last.styleIndex + 1 : 0) % styles.length;
  const style = styles[styleIndex];
  // The first visit of each kind starts at the first world and the first hunter.
  const world = style === 'world' ? (Number.isInteger(last.world) ? (last.world + 1) % BACKDROP_WORLDS.length : 0) : (Number.isInteger(last.world) ? last.world : -1);
  const hunter = style === 'hunter' ? (Number.isInteger(last.hunter) ? (last.hunter + 1) % Math.max(1, hunters) : 0) : (Number.isInteger(last.hunter) ? last.hunter : -1);
  return { styleIndex, style, world, hunter };
}

export function parseMenuImages(input) {
  return (Array.isArray(input?.images) ? input.images : []).filter(item => typeof item?.file === 'string' && /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|avif)$/.test(item.file))
    .map(item => ({ file: item.file, credit: typeof item.credit === 'string' ? item.credit.slice(0, 120) : '' })).slice(0, 24);
}

const GLYPHS = 'ᚠᚡᚢᚣᚤᚥᚦᚧᚨᚩᚪᚫᚬᚭᚮᚯᚰᚱᚲᚳᚴᚵᚶᚷᚸᚹᚺᚻᚼᚽᚾᚿᛀᛁᛂᛃᛄᛅᛆᛇᛈᛉᛊᛋ';

export class MenuBackdrop {
  constructor({ renderer, host, storage = globalThis.localStorage, fetchImpl = globalThis.fetch?.bind(globalThis), createHunter = null, hunterCount = 1, reducedMotion = () => false } = {}) {
    this.renderer = renderer; this.host = host; this.storage = storage; this.fetch = fetchImpl; this.createHunter = createHunter;
    this.hunterCount = hunterCount; this.reducedMotion = reducedMotion; this.images = [];
    this.active = false; this.choice = null; this.scene = null; this.time = 0;
    this.imagesReady = (async () => {
      try { const response = await this.fetch?.('/menu/manifest.json', { cache: 'no-cache' }); if (response?.ok) this.images = parseMenuImages(await response.json()); } catch {}
    })();
  }

  /** Picks the next backdrop and builds it. Called on page load and on each return from a mission. */
  async rotate() {
    await this.imagesReady;
    let previous = null;
    try { previous = JSON.parse(this.storage?.getItem(STORE_KEY) ?? 'null'); } catch {}
    this.choice = nextBackdrop(previous, { hunters: this.hunterCount, imagesAvailable: this.images.length > 0 });
    try { this.storage?.setItem(STORE_KEY, JSON.stringify(this.choice)); } catch {}
    this.dispose();
    this.build(this.choice);
    return this.choice;
  }

  build(choice) {
    this.layer = document.createElement('div'); this.layer.className = `menu-backdrop menu-backdrop-${choice.style}`; this.layer.setAttribute('aria-hidden', 'true');
    this.host?.prepend(this.layer);
    if (choice.style === 'glyphs') this._buildGlyphs();
    else if (choice.style === 'images') this._buildImages();
    else {
      this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(42, 1, .1, 400); this.disposables = [];
      if (choice.style === 'hunter') this._buildHunter(Math.max(0, choice.hunter)); else this._buildWorld(BACKDROP_WORLDS[Math.max(0, choice.world)]);
    }
    document.body.classList.add('menu-backdrop-live');
    document.body.dataset.menuBackdrop = choice.style === 'world' ? `world-${BACKDROP_WORLDS[Math.max(0, choice.world)]}` : choice.style;
  }

  get rendersScene() { return Boolean(this.scene); }
  show() { this.active = true; if (this.layer) this.layer.hidden = false; document.body.classList.add('menu-backdrop-live'); }
  hide() { this.active = false; if (this.layer) this.layer.hidden = true; document.body.classList.remove('menu-backdrop-live'); }

  _track(...items) { this.disposables.push(...items); return items[0]; }
  _mat(options) { return this._track(new THREE.MeshStandardMaterial(options)); }
  _geo(geometry) { return this._track(geometry); }

  _particles(count, spread, color, size, { fall = 0, rise = 0 } = {}) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { positions[i * 3] = (Math.random() - .5) * spread.x; positions[i * 3 + 1] = Math.random() * spread.y; positions[i * 3 + 2] = (Math.random() - .5) * spread.z; }
    const geometry = this._geo(new THREE.BufferGeometry()); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = this._track(new THREE.PointsMaterial({ color, size, transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending }));
    const points = new THREE.Points(geometry, material); points.userData = { fall, rise, spread }; this.scene.add(points);
    (this.particles ??= []).push(points);
    return points;
  }

  _buildHunter(index) {
    const s = this.scene; s.background = new THREE.Color(0x05080d); s.fog = new THREE.FogExp2(0x0a1016, .06);
    s.add(new THREE.HemisphereLight(0x29435a, 0x0b0705, .75));
    const fill = new THREE.DirectionalLight(0xffe2c4, .55); fill.position.set(-3, 3, 8); s.add(fill);
    const moon = new THREE.DirectionalLight(0x9fc3ff, 1.6); moon.position.set(-4, 7, 3); s.add(moon);
    const plasma = new THREE.PointLight(0x4fd4ff, 9, 9, 2); plasma.position.set(1.6, 2.6, -1.4); s.add(plasma); this.flicker = plasma;
    const ember = new THREE.PointLight(0xff3a1a, 5, 8, 2); ember.position.set(-1.6, .6, 1.6); s.add(ember); this.ember = ember;
    const ground = new THREE.Mesh(this._geo(new THREE.CircleGeometry(14, 48)), this._mat({ color: 0x1a1612, roughness: .95 })); ground.rotation.x = -Math.PI / 2; s.add(ground);
    const rock = this._mat({ color: 0x2b2620, roughness: .9, flatShading: true });
    for (let i = 0; i < 9; i++) {
      const stone = new THREE.Mesh(this._geo(new THREE.DodecahedronGeometry(.3 + Math.random() * .7, 0)), rock);
      const angle = i / 9 * Math.PI * 2 + .4; stone.position.set(Math.cos(angle) * (3 + Math.random() * 3), .15, Math.sin(angle) * (3 + Math.random() * 3) - 1.5); stone.rotation.set(Math.random(), Math.random(), 0); s.add(stone);
    }
    // Trophy spikes: original staging, bone-coloured spheres on poles.
    const bone = this._mat({ color: 0xd8cdb4, roughness: .6 }), wood = this._mat({ color: 0x3a2a1c, roughness: .9 });
    for (const [x, z] of [[-2.6, -2.2], [-3.4, -.6], [2.9, -2.6]]) {
      const pole = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(.04, .06, 2.2, 6)), wood); pole.position.set(x, 1.1, z); s.add(pole);
      const skull = new THREE.Mesh(this._geo(new THREE.SphereGeometry(.17, 12, 10)), bone); skull.scale.set(1, 1.15, 1.1); skull.position.set(x, 2.3, z); s.add(skull);
    }
    this._particles(220, new THREE.Vector3(12, 5, 10), 0xff6a2a, .05, { rise: .35 });
    this._particles(160, new THREE.Vector3(18, 6, 14), 0x6fa8c8, .03, { fall: .05 });
    if (this.createHunter) {
      try {
        const hunter = this.createHunter(s, index); this.hunter = hunter;
        // Faces the camera; hidden while its model loads so the stand-in never shows.
        hunter.mesh.position.set(0, 0, 0); hunter.mesh.rotation.y = .35; hunter.mesh.visible = hunter.generatedVisualState !== 'loading';
      } catch { this.hunter = null; }
    }
    this.cameraPath = time => {
      const angle = Math.sin(time * .08) * .45 + .15;
      // Hunters stand up to 4.3 m tall: frame the whole figure on the right half of the screen.
      this.camera.position.set(Math.sin(angle) * 9 - 2.4, 2.6 + Math.sin(time * .13) * .15, Math.cos(angle) * 9);
      this.camera.lookAt(-2.1, 2.1, 0);
    };
  }

  _buildWorld(world) {
    const s = this.scene;
    if (world === 'jungle') {
      s.background = new THREE.Color(0x061109); s.fog = new THREE.FogExp2(0x0b1d10, .045);
      s.add(new THREE.HemisphereLight(0x5f8f6a, 0x0a0f08, .7));
      const moon = new THREE.DirectionalLight(0xbfe6c8, 1.2); moon.position.set(3, 10, -4); s.add(moon);
      const bark = this._mat({ color: 0x2a2116, roughness: 1 }), leaf = this._mat({ color: 0x163d1e, roughness: .9, flatShading: true });
      for (let i = 0; i < 70; i++) {
        const x = (Math.random() - .5) * 60, z = -Math.random() * 70 + 8; if (Math.abs(x) < 2.5) continue;
        const height = 6 + Math.random() * 10, trunk = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(.18, .35, height, 6)), bark); trunk.position.set(x, height / 2, z); s.add(trunk);
        const crown = new THREE.Mesh(this._geo(new THREE.IcosahedronGeometry(1.6 + Math.random() * 2, 0)), leaf); crown.position.set(x, height, z); s.add(crown);
      }
      const ground = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(120, 120)), this._mat({ color: 0x14200f, roughness: 1 })); ground.rotation.x = -Math.PI / 2; s.add(ground);
      this._particles(260, new THREE.Vector3(40, 6, 50), 0xd9ff7a, .08, { rise: .1 });
      this.cameraPath = time => { this.camera.position.set(Math.sin(time * .05) * 2, 1.7, 6 - (time * .6) % 40); this.camera.lookAt(this.camera.position.x * .5, 2.2, this.camera.position.z - 12); };
    } else if (world === 'pyramid') {
      s.background = new THREE.Color(0x0b1220); s.fog = new THREE.FogExp2(0x1a2638, .022);
      s.add(new THREE.HemisphereLight(0x9fb7d8, 0x1a1f28, .8));
      const sun = new THREE.DirectionalLight(0xdfe9ff, 1.1); sun.position.set(-6, 8, 6); s.add(sun);
      const stone = this._mat({ color: 0x6d6a66, roughness: .9, flatShading: true });
      for (let step = 0; step < 9; step++) { const size = 36 - step * 4, block = new THREE.Mesh(this._geo(new THREE.BoxGeometry(size, 2.2, size)), stone); block.position.set(0, 1.1 + step * 2.2, -55); s.add(block); }
      const beam = new THREE.Mesh(this._geo(new THREE.CylinderGeometry(.6, .6, 80, 12, 1, true)), this._track(new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending })));
      beam.position.set(0, 60, -55); s.add(beam);
      const snow = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(200, 200)), this._mat({ color: 0xc9d6e6, roughness: .8 })); snow.rotation.x = -Math.PI / 2; s.add(snow);
      this._particles(700, new THREE.Vector3(60, 30, 60), 0xffffff, .09, { fall: 2.2 });
      this.cameraPath = time => { const a = Math.sin(time * .04) * .5; this.camera.position.set(Math.sin(a) * 34, 6 + Math.sin(time * .1), Math.cos(a) * 34 - 55 + 30); this.camera.lookAt(0, 9, -55); };
    } else if (world === 'rooftops') {
      s.background = new THREE.Color(0x07060c); s.fog = new THREE.FogExp2(0x14101c, .03);
      s.add(new THREE.HemisphereLight(0x6b5d8a, 0x0a0608, .5));
      const neon = new THREE.PointLight(0xff2848, 14, 30, 2); neon.position.set(4, 6, -6); s.add(neon); this.flicker = neon;
      const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 128; const g = canvas.getContext('2d');
      g.fillStyle = '#0d0c12'; g.fillRect(0, 0, 64, 128);
      for (let y = 4; y < 128; y += 8) for (let x = 4; x < 64; x += 8) if (Math.random() < .35) { g.fillStyle = Math.random() < .8 ? '#e8c27a' : '#7ad0ff'; g.fillRect(x, y, 4, 4); }
      const texture = this._track(new THREE.CanvasTexture(canvas)); texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = THREE.NearestFilter;
      const facade = this._mat({ color: 0x222028, roughness: .7, emissive: 0xffffff, emissiveIntensity: .9, emissiveMap: texture, map: texture });
      for (let i = 0; i < 46; i++) {
        const w = 4 + Math.random() * 6, h = 8 + Math.random() * 30, x = (Math.random() - .5) * 90, z = -12 - Math.random() * 80;
        const building = new THREE.Mesh(this._geo(new THREE.BoxGeometry(w, h, w)), facade); building.position.set(x, h / 2 - 6, z); s.add(building);
      }
      const roof = new THREE.Mesh(this._geo(new THREE.BoxGeometry(14, .4, 14)), this._mat({ color: 0x1c1b20, roughness: .6, metalness: .3 })); roof.position.set(0, -.2, -2); s.add(roof);
      this._particles(900, new THREE.Vector3(40, 25, 40), 0x9fb8d6, .05, { fall: 14 });
      this.cameraPath = time => { this.camera.position.set(-3 + Math.sin(time * .06) * 2, 2.2, 4); this.camera.lookAt(Math.sin(time * .05) * 8, 6, -40); };
    } else {
      // La Lame Patiente (Ascension ship): an original corridor of ribs and red lights.
      s.background = new THREE.Color(0x050203); s.fog = new THREE.FogExp2(0x1a0606, .07);
      s.add(new THREE.HemisphereLight(0x5a2020, 0x050202, .5));
      const hull = this._mat({ color: 0x2a2624, roughness: .55, metalness: .6 }), glow = this._track(new THREE.MeshBasicMaterial({ color: 0xff2a10 }));
      for (let i = 0; i < 16; i++) {
        const rib = new THREE.Mesh(this._geo(new THREE.TorusGeometry(3.2, .22, 6, 18, Math.PI * 1.1)), hull); rib.rotation.z = -Math.PI * .05; rib.position.set(0, 0, -i * 3.2); s.add(rib);
        const lamp = new THREE.Mesh(this._geo(new THREE.BoxGeometry(.12, .5, .12)), glow); lamp.position.set(i % 2 ? 2.6 : -2.6, 1.2, -i * 3.2); s.add(lamp);
        if (i % 3 === 0) { const light = new THREE.PointLight(0xff3018, 4, 9, 2); light.position.set(0, 2, -i * 3.2); s.add(light); }
      }
      const floor = new THREE.Mesh(this._geo(new THREE.PlaneGeometry(6, 60)), this._mat({ color: 0x181414, roughness: .4, metalness: .7 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -.6, -24); s.add(floor);
      this._particles(200, new THREE.Vector3(5, 4, 50), 0xff5030, .04, { rise: .15 });
      this.cameraPath = time => { this.camera.position.set(Math.sin(time * .2) * .3, 1.2, 2 - (time * .9) % 24); this.camera.lookAt(0, 1.1, this.camera.position.z - 10); };
    }
  }

  _buildGlyphs() {
    const canvas = document.createElement('canvas'); canvas.className = 'menu-glyph-rain'; this.layer.append(canvas); this.glyphCanvas = canvas;
    const columns = Math.ceil(innerWidth / 22); this.glyphDrops = Array.from({ length: columns }, () => Math.random() * -40);
  }

  _buildImages() {
    this.imageIndex = 0;
    for (const [index, image] of this.images.entries()) {
      const slide = document.createElement('div'); slide.className = 'menu-image-slide'; slide.style.backgroundImage = `url("/menu/${image.file}")`;
      slide.classList.toggle('visible', index === 0); slide.dataset.credit = image.credit; this.layer.append(slide);
    }
    this.imageTimer = setInterval(() => {
      const slides = [...this.layer.querySelectorAll('.menu-image-slide')]; if (slides.length < 2) return;
      slides[this.imageIndex].classList.remove('visible'); this.imageIndex = (this.imageIndex + 1) % slides.length; slides[this.imageIndex].classList.add('visible');
    }, 9000);
  }

  /** One frame. Called by the game loop only while the main menu or title is on screen. */
  render(delta) {
    if (!this.active) return;
    const calm = this.reducedMotion(); this.time += calm ? delta * .25 : delta;
    if (this.glyphCanvas) return this._drawGlyphs(calm);
    if (!this.scene) return;
    const gl = this.renderer?.renderer; if (!gl) return;
    const size = gl.getSize(new THREE.Vector2()); this.camera.aspect = size.x / Math.max(1, size.y); this.camera.updateProjectionMatrix();
    this.cameraPath?.(this.time);
    for (const points of this.particles ?? []) {
      const array = points.geometry.attributes.position.array, { fall, rise, spread } = points.userData;
      for (let i = 1; i < array.length; i += 3) { array[i] += (rise - fall) * delta; if (array[i] < 0) array[i] = spread.y; if (array[i] > spread.y) array[i] = 0; }
      points.geometry.attributes.position.needsUpdate = true;
      if (points.position.z !== this.camera.position.z && fall > 1) points.position.set(this.camera.position.x, 0, this.camera.position.z - 10);
    }
    if (this.flicker) {
      this.flicker.userData.base ??= this.flicker.intensity;
      this.flicker.intensity = this.flicker.userData.base * (.85 + Math.sin(this.time * 7) * .08 + Math.random() * .07);
    }
    if (this.ember) this.ember.intensity = 4 + Math.sin(this.time * 3.1) * 1.2 + Math.random() * .6;
    try { this.hunter?.update?.(delta, null); } catch { this.hunter = null; }
    if (this.hunter?.mesh) { this.hunter.mesh.position.set(0, 0, 0); this.hunter.mesh.rotation.y = .35; this.hunter.mesh.visible = this.hunter.generatedVisualState !== 'loading'; }
    gl.setScissorTest(false); gl.setViewport(0, 0, size.x, size.y);
    gl.render(this.scene, this.camera);
  }

  _drawGlyphs(calm) {
    const canvas = this.glyphCanvas, ratio = Math.min(2, devicePixelRatio || 1);
    if (canvas.width !== Math.round(innerWidth * ratio)) { canvas.width = Math.round(innerWidth * ratio); canvas.height = Math.round(innerHeight * ratio); }
    const g = canvas.getContext('2d'), size = 20 * ratio;
    g.fillStyle = 'rgba(4, 3, 6, .16)'; g.fillRect(0, 0, canvas.width, canvas.height);
    g.font = `${size}px serif`;
    this.glyphDrops.forEach((drop, column) => {
      const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      g.fillStyle = column % 7 === 0 ? 'rgba(255, 196, 90, .9)' : 'rgba(255, 50, 30, .55)';
      g.fillText(glyph, column * 22 * ratio, drop * size);
      this.glyphDrops[column] = drop * size > canvas.height && Math.random() > .975 ? 0 : drop + (calm ? .12 : .45);
    });
  }

  dispose() {
    if (this.imageTimer) clearInterval(this.imageTimer); this.imageTimer = null;
    try { this.hunter?.dispose?.(); } catch {}
    this.hunter = null;
    for (const item of this.disposables ?? []) item.dispose?.();
    this.disposables = []; this.particles = []; this.scene = null; this.cameraPath = null; this.flicker = null; this.ember = null; this.glyphCanvas = null;
    this.layer?.remove(); this.layer = null;
    document.body.classList.remove('menu-backdrop-live'); delete document.body.dataset.menuBackdrop;
  }
}
