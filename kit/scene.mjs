/* mechbench · 三维舞台（kit）
 * 相机/灯光/地面/剖切/目标轮廓/拾取/拖放/取景/循环 —— 所有物品共用。
 * 物品只给几何（model.mjs）、数值（manifest.scene）、回调。
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

const DEFAULT = {
  spawn: [255, 26, 155],
  renderer: { exposure: 0.94, pixelRatio: 1.5 },
  camera: { fov: 32, near: 2, far: 6000, defaultFocus: 'engine' },
  orbit: { minDistance: 190, maxDistance: 1800, minPolar: 0.06, maxPolar: 0.54 },
  bench: { y: -110, color: 0xdfe5ea, size: 4000 },
  env: 0.48,
  lights: {
    hemi: [0xffffff, 0x9aa7b3, 0.62],
    key: { color: 0xfff6ec, intensity: 2.0, pos: [-190, 300, 240] },
    fill: { color: 0xdce8f4, intensity: 0.85, pos: [280, 90, 240] },
    rim: { color: 0xcfe0f0, intensity: 0.8, pos: [160, 200, -300] },
  },
  cut: { normal: [0, 0, -1], constant: 0 },
  ghost: { color: 0x9aa4ad, opacity: 0.62 },
  target: { color: 0x2f6f9f, opacity: 0.17 },
  focus: {},
  nearRadius: { wide: 52, narrow: 66 },
};

function merge(base, over) {
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    const v = over[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(base[k] || {}, v) : v;
  }
  return out;
}

export function createStage(opts) {
  const cfg = merge(DEFAULT, opts.config);
  const host = opts.host;
  const stageEl = opts.stageEl;
  const worldGroup = opts.world;
  const modules = opts.modules || [];
  const model = opts.model || {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 渲染器 / 场景 ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, cfg.renderer.pixelRatio));
  renderer.setSize(stageEl.clientWidth, stageEl.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = cfg.renderer.exposure;
  renderer.localClippingEnabled = true;
  renderer.domElement.setAttribute('aria-label', '三维装配台：选中模块后拖到安装位置，也可用「装到这里」按钮');
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(worldGroup);
  const camera = new THREE.PerspectiveCamera(cfg.camera.fov, stageEl.clientWidth / stageEl.clientHeight, cfg.camera.near, cfg.camera.far);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.085;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.rotateSpeed = 0.62;
  controls.zoomSpeed = 0.8;
  controls.panSpeed = 0.8;
  controls.minDistance = cfg.orbit.minDistance;
  controls.maxDistance = cfg.orbit.maxDistance;
  controls.minPolarAngle = Math.PI * cfg.orbit.minPolar;
  controls.maxPolarAngle = Math.PI * cfg.orbit.maxPolar;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environmentIntensity = cfg.env;

  const [hs, hg, hi] = cfg.lights.hemi;
  scene.add(new THREE.HemisphereLight(hs, hg, hi));
  for (const k of ['key', 'fill', 'rim']) {
    const l = cfg.lights[k];
    if (!l) continue;
    const dir = new THREE.DirectionalLight(l.color, l.intensity);
    dir.position.set(...l.pos);
    scene.add(dir);
  }

  if (cfg.bench !== false) {
  const bench = new THREE.Mesh(
    new THREE.PlaneGeometry(cfg.bench.size, cfg.bench.size),
    new THREE.MeshStandardMaterial({ color: cfg.bench.color, roughness: 0.97, metalness: 0 })
  );
  bench.rotation.x = -Math.PI / 2;
  bench.position.y = cfg.bench.y;
  scene.add(bench);
  }

  /* ---------- 剖切 ---------- */
  const CUT = new THREE.Plane(vec(...cfg.cut.normal), cfg.cut.constant);
  const GHOST = new THREE.MeshStandardMaterial({
    color: cfg.ghost.color, roughness: 0.9, metalness: 0,
    transparent: true, opacity: cfg.ghost.opacity, depthWrite: false,
    side: THREE.DoubleSide, clippingPlanes: [CUT],
  });
  const TARGET = new THREE.MeshBasicMaterial({
    color: cfg.target.color, transparent: true, opacity: cfg.target.opacity,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const ghostGroup = new THREE.Group();
  scene.add(ghostGroup);
  let targetKey = null;

  /* ---------- 视图状态 ---------- */
  const view = {
    crankDeg: 0, camDeg: 0, speed: 1, running: false, cut: false, solid: false,
    navigation: 'rotate', selected: null, offsets: new Map(), drag: null, focus: cfg.camera.defaultFocus,
    hintOn: false,
  };
  const SPAWN = vec(...cfg.spawn);

  const byKey = model.byKey;
  const info = new Map(
    modules.map((m) => {
      const b = model.moduleBounds(m.parts);
      return [m.id, { ...m, bounds: b, center: b.getCenter(vec()), size: b.getSize(vec()) }];
    })
  );

  const socketEl = document.getElementById('socket');
  const previewEl = document.getElementById('preview-label');
  const state = () => (opts.getState ? opts.getState() : {});

  /* ---------- 摆位与材质 ---------- */
  const moduleOffsetTarget = (id) => {
    if (state().placed?.includes(id)) return vec();
    if (typeof cfg.spawnFor === 'function') {
      const v = cfg.spawnFor(id, info.get(id), state(), view);
      if (v) return v.isVector3 ? v.clone() : vec(...v);
    }
    return SPAWN.clone();
  };

  function render(dt = 1) {
    const s = state();
    for (const m of modules) {
      const installed = s.placed?.includes(m.id);
      const selected = s.selected === m.id;
      const visible = installed || selected;
      let off = view.offsets.get(m.id);
      if (!off) {
        off = moduleOffsetTarget(m.id).clone();
        view.offsets.set(m.id, off);
      }
      if (view.drag?.id !== m.id) {
        const want = moduleOffsetTarget(m.id);
        if (reduced || dt === 1) off.copy(want);
        else off.lerp(want, Math.min(1, dt * 12));
      }
      for (const key of m.parts) {
        const p = byKey.get(key);
        if (!p) continue;
        p.g.visible =
          visible && !(cfg.hiddenPart && cfg.hiddenPart(key, s));
        p.g.position.copy(off);
        materials(p, installed || view.solid);
      }
    }
    model.applyMotion(view, s);
    worldGroup.updateMatrixWorld(true);
  }

  // 剖开：外壳换玻璃；带 userData.cutaway 的网格（被切掉的那半）直接隐藏
  function materials(p, showSolid) {
    const cutting = showSolid && view.cut;
    p.g.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.cutaway) o.visible = !cutting;
      const ghost = cutting && (p.shell || o.userData.socketCover) && !(view.focus !== 'all' && view.focus === p.key);
      if (ghost) {
        if (!p.ghostMat) {
          p.ghostMat = GHOST.clone();
          p.ghostMat.opacity = 0.58 + 0.06 * Math.min(p.layer || 0, 2);
        }
        o.material = p.ghostMat;
        o.renderOrder = 3;
      } else if (o.material !== o.userData.omat) {
        o.material = o.userData.omat;
        o.renderOrder = 0;
      }
    });
  }

  /* ---------- 目标轮廓 ---------- */
  function setTarget(keys) {
    const want = keys ? keys.join('|') : null;
    const always = typeof opts.targetAlways === 'function' ? opts.targetAlways() : !!opts.targetAlways;
    const show = !!keys && keys.length && (view.hintOn || always);
    if (want === targetKey && !show) {
      ghostGroup.visible = show;
      return;
    }
    for (const c of [...ghostGroup.children]) ghostGroup.remove(c);
    targetKey = want;
    if (!show) {
      ghostGroup.visible = false;
      return;
    }
    for (const key of keys) {
      const p = byKey.get(key);
      if (!p) continue;
      const clone = p.obj.clone(true);
      clone.traverse((o) => {
        if (o.isMesh) o.material = TARGET;
      });
      ghostGroup.add(clone);
    }
    ghostGroup.visible = true;
  }

  /* ---------- 相机 ---------- */
  const box = new THREE.Box3();
  for (const p of model.PARTS || []) box.union(new THREE.Box3().setFromObject(p.g));
  const MODEL_CENTER = box.getCenter(vec());
  const MODEL_SIZE = box.getSize(vec());

  function focusSpec(name) {
    const f = cfg.focus[name] || {};
    const dir = f.dir || [0, 18];
    if (f.box) {
      const b = typeof f.box === 'function' ? f.box(state(), view) : f.box;
      return { center: vec(...b[0]), size: vec(...b[1]), dir, fit: f.fit || 1 };
    }
    if (name === cfg.camera.defaultFocus || !name) return { center: MODEL_CENTER.clone(), size: MODEL_SIZE.clone(), dir, fit: f.fit || 1.1 };
    const p = byKey.get(name);
    if (!p) return { center: MODEL_CENTER.clone(), size: MODEL_SIZE.clone(), dir, fit: f.fit || 1.1 };
    const b = new THREE.Box3().setFromObject(p.g);
    const size = b.getSize(vec());
    size.set(Math.max(size.x, 30), Math.max(size.y, 30), Math.max(size.z, 30));
    return { center: b.getCenter(vec()), size, dir, fit: f.fit || 1.75 };
  }

  function fitCamera(name = cfg.camera.defaultFocus) {
    view.focus = name;
    const { center, size, dir, fit } = focusSpec(name);
    const f = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const narrow = stageEl.clientWidth < 620;
    const usableW = stageEl.clientWidth - (narrow ? 40 : 90);
    const usableH = stageEl.clientHeight - (narrow ? 150 : 40);
    const dist =
      Math.max(
        (size.y / (2 * f)) * (stageEl.clientHeight / usableH),
        (size.x / (2 * f * camera.aspect)) * (stageEl.clientWidth / usableW)
      ) * fit + 40;
    const [yaw, pitch] = dir.map((d) => (d * Math.PI) / 180);
    camera.position.copy(center).add(vec(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(dist));
    controls.target.copy(center);
    controls.update();
  }

  let userNavigated = false;
  controls.addEventListener('start', () => {
    userNavigated = true;
  });

  /* ---------- 导航 ---------- */
  function setNavigation(mode) {
    view.navigation = mode;
    controls.mouseButtons.LEFT = mode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    controls.touches.ONE = mode === 'pan' ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    for (const b of document.querySelectorAll('[data-tool]')) {
      if (b.dataset.tool === 'rotate' || b.dataset.tool === 'pan') b.setAttribute('aria-pressed', String(b.dataset.tool === mode));
    }
    renderer.domElement.style.cursor = mode === 'pan' ? 'move' : 'grab';
  }

  /* ---------- 屏幕坐标 ---------- */
  function project(v) {
    const p = v.clone().project(camera);
    return { x: (p.x * 0.5 + 0.5) * stageEl.clientWidth, y: (-0.5 * p.y + 0.5) * stageEl.clientHeight };
  }

  function nearTarget(id) {
    const next = opts.nextModule ? opts.nextModule() : null;
    if (!next || !info.get(id)) return false;
    const a = project(info.get(id).center.clone().add(view.offsets.get(id) || vec()));
    const b = project(info.get(next.id).center);
    const r = stageEl.clientWidth < 620 ? cfg.nearRadius.narrow : cfg.nearRadius.wide;
    return Math.hypot(a.x - b.x, a.y - b.y) < r;
  }

  function overlay() {
    const s = state();
    const next = opts.nextModule ? opts.nextModule() : null;
    const showSocket = !!next && s.phase === 'build' && !s.lab;
    if (socketEl) {
      socketEl.hidden = !showSocket;
      if (showSocket) {
        const md = info.get(next.id);
        const p = project(vec(md.center.x, md.bounds.max.y + 16, md.center.z));
        socketEl.style.left = p.x + 'px';
        socketEl.style.top = p.y + 'px';
        socketEl.disabled = !s.selected;
        socketEl.classList.toggle('near', !!s.selected && nearTarget(s.selected));
      }
    }
    const sel = s.selected && info.get(s.selected);
    if (previewEl) {
      previewEl.hidden = !sel || s.phase !== 'build';
      if (sel) {
        const c = sel.center.clone().add(view.offsets.get(sel.id) || vec());
        const p = project(vec(c.x, c.y + sel.size.y / 2 + 14, c.z));
        previewEl.style.left = p.x + 'px';
        previewEl.style.top = p.y + 'px';
      }
    }
    if (next) setTarget(next.parts);
    else setTarget(null);
  }

  /* ---------- 拾取与拖放 ---------- */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const clickables = [];
  for (const p of model.PARTS || []) p.g.traverse((o) => o.isMesh && clickables.push(o));

  function rayAt(e) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2);
    raycaster.setFromCamera(pointer, camera);
  }
  const visibleIn = (o) => {
    for (let x = o; x; x = x.parent) if (!x.visible) return false;
    return true;
  };
  function pickKey(e) {
    rayAt(e);
    const hit = raycaster.intersectObjects(clickables.filter(visibleIn), false)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o && !o.userData.key) o = o.parent;
    return o ? o.userData.key : null;
  }

  const canDrag = () => (opts.canDrag ? opts.canDrag() : true) && view.navigation !== 'pan';
  let downPt = null;

  renderer.domElement.addEventListener('pointerdown', (e) => {
    downPt = { x: e.clientX, y: e.clientY };
  }, { capture: true });

  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !canDrag()) return;
    const s = state();
    const m = info.get(s.selected);
    if (!m) return;
    rayAt(e);
    const objs = m.parts.map((k) => byKey.get(k).g).filter(Boolean);
    const hit = raycaster.intersectObjects(objs, true).find((h) => visibleIn(h.object));
    if (!hit) return;
    const off = view.offsets.get(m.id) || vec();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(vec()), m.center.clone().add(off));
    const point = raycaster.ray.intersectPlane(plane, vec());
    if (!point) return;
    view.drag = { id: m.id, pointerId: e.pointerId, plane, start: point.clone(), offset: off.clone() };
    controls.enabled = false;
    renderer.domElement.setPointerCapture?.(e.pointerId);
    renderer.domElement.style.cursor = 'grabbing';
    e.preventDefault();
    e.stopImmediatePropagation();
  }, { capture: true });

  renderer.domElement.addEventListener('pointermove', (e) => {
    if (!view.drag || view.drag.pointerId !== e.pointerId) return;
    rayAt(e);
    const p = raycaster.ray.intersectPlane(view.drag.plane, vec());
    if (p) {
      if (!view.offsets.has(view.drag.id)) view.offsets.set(view.drag.id, vec());
      view.offsets.get(view.drag.id).copy(view.drag.offset).add(p.sub(view.drag.start));
    }
    socketEl?.classList.toggle('near', nearTarget(view.drag.id));
    e.preventDefault();
    e.stopImmediatePropagation();
  }, { capture: true });

  function releaseDrag(e, cancel) {
    if (!view.drag || view.drag.pointerId !== e.pointerId) return;
    const id = view.drag.id;
    const onTarget = !cancel && nearTarget(id);
    view.drag = null;
    controls.enabled = true;
    renderer.domElement.releasePointerCapture?.(e.pointerId);
    setNavigation(view.navigation);
    socketEl?.classList.remove('near');
    if (!cancel && onTarget) opts.onDrop?.(id, true);
    else if (!cancel) opts.onDrop?.(id, false);
    e.stopImmediatePropagation();
  }
  renderer.domElement.addEventListener('pointerup', (e) => releaseDrag(e, false), { capture: true });
  renderer.domElement.addEventListener('pointercancel', (e) => releaseDrag(e, true), { capture: true });

  renderer.domElement.addEventListener('click', (e) => {
    // 旋转/平移后松手也会派发 click：位移 > 5px 就不算点击
    if (downPt && Math.hypot(e.clientX - downPt.x, e.clientY - downPt.y) > 5) return;
    if (view.drag) return;
    const k = pickKey(e);
    if (k && opts.onPickKey) opts.onPickKey(k, view.focus === k);
  });

  /* ---------- 局部放大窗（同一个 canvas 里用 scissor 画第二视角） ---------- */
  const insetEl = document.getElementById('inset');
  const insetCam = new THREE.PerspectiveCamera(cfg.inset?.fov || 36, 1, cfg.inset?.near || 0.1, cfg.inset?.far || 500);
  function drawInset() {
    if (!insetEl || !cfg.inset) return;
    const s = state();
    const ic = cfg.inset;
    const fits = stageEl.clientWidth > (ic.minWidth || 760) && stageEl.clientHeight > (ic.minHeight || 430);
    const spec = fits && ic.visible?.(s, view) ? ic.target?.(s, view) : null;
    const part = spec && byKey.get(spec.part);
    insetEl.hidden = !part;
    if (!part) return;
    const title = insetEl.querySelector('#inset-title');
    if (title && spec.title) title.textContent = spec.title;
    const target = part.g.localToWorld(vec(...(spec.local || [0, 0, 0])));
    insetCam.position.copy(target).add(vec(...spec.offset));
    insetCam.lookAt(target);
    const r = insetEl.getBoundingClientRect(), base = stageEl.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    insetCam.aspect = r.width / r.height;
    insetCam.updateProjectionMatrix();
    const x = r.left - base.left, y = stageEl.clientHeight - (r.bottom - base.top);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, stageEl.clientWidth, stageEl.clientHeight);
    renderer.setScissor(x, y, r.width, r.height);
    renderer.setViewport(x, y, r.width, r.height);
    renderer.setScissorTest(true);
    renderer.clearDepth();
    renderer.render(scene, insetCam);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, stageEl.clientWidth, stageEl.clientHeight);
  }

  /* ---------- 尺寸与循环 ---------- */
  function resize() {
    const w = stageEl.clientWidth, h = stageEl.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (!userNavigated) fitCamera(view.focus);
  }
  new ResizeObserver(resize).observe(stageEl);

  function start() {
    let prev = performance.now();
    renderer.setAnimationLoop((now) => {
      const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000));
      prev = now;
      opts.tick?.(dt);
      render(dt);
      controls.update();
      overlay();
      renderer.render(scene, camera);
      drawInset();
    });
  }

  resize();
  render(1);
  fitCamera(view.focus);

  return {
    view, renderer, scene, camera, controls, info, spawn: SPAWN, fitCamera, setNavigation, project,
    nearTarget, overlay, render, start, setTarget, resize,
    get solidScreen() {
      return renderer.domElement;
    },
  };
}
