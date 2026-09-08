import * as THREE from './vendor/three.module.min.js';

const VALID_STATES = new Set(['opening', 'idle', 'reading', 'typing', 'complete', 'error']);
const STATE_LABELS = {
  opening: 'Opening Thai\'s workspace',
  idle: 'Ready when you are',
  reading: 'Reviewing your question',
  typing: 'Thai is typing',
  complete: 'Answer ready',
  error: 'The assistant needs a moment',
};

function makeGradientMap() {
  const data = new Uint8Array([36, 132, 232]);
  const texture = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

function makeToonMaterial(color, gradientMap, options = {}) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap,
    roughness: 1,
    ...options,
  });
}

function applyTransform(object, transform = {}) {
  if (transform.position) object.position.set(...transform.position);
  if (transform.rotation) object.rotation.set(...transform.rotation);
  if (transform.scale) object.scale.set(...transform.scale);
  return object;
}

function outlinedPart(geometry, material, transform = {}, outlineScale = 1.045) {
  const group = applyTransform(new THREE.Group(), transform);
  const outline = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: 0x07111d,
    side: THREE.BackSide,
  }));
  outline.scale.setScalar(outlineScale);
  outline.renderOrder = 0;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1;
  group.add(outline, mesh);
  return group;
}

function plainPart(geometry, material, transform = {}) {
  return applyTransform(new THREE.Mesh(geometry, material), transform);
}

function createCity(scene, materials) {
  const wall = plainPart(
    new THREE.PlaneGeometry(16, 10),
    new THREE.MeshBasicMaterial({ color: 0x07172a }),
    { position: [0, 1, -4.6] },
  );
  scene.add(wall);

  const skyline = new THREE.Group();
  const buildings = [
    [-5.7, 0.3, 1.5, 4.4],
    [-4.1, -0.3, 1.25, 3.2],
    [-2.7, 0.7, 1.4, 5.2],
    [3.3, 0.2, 1.45, 4.2],
    [4.9, 0.9, 1.2, 5.6],
    [6.1, -0.2, 1.1, 3.4],
  ];
  for (const [x, y, width, height] of buildings) {
    const building = plainPart(
      new THREE.BoxGeometry(width, height, 0.25),
      materials.building,
      { position: [x, y, -4.15] },
    );
    skyline.add(building);
    const rows = Math.max(2, Math.floor(height / 0.65));
    for (let row = 0; row < rows; row += 1) {
      for (let column = -1; column <= 1; column += 2) {
        if ((row + column + Math.round(x)) % 3 === 0) continue;
        const window = plainPart(
          new THREE.PlaneGeometry(0.12, 0.16),
          materials.window,
          { position: [x + column * width * 0.22, y - height * 0.36 + row * 0.52, -3.99] },
        );
        skyline.add(window);
      }
    }
  }
  scene.add(skyline);

  const windowFrame = new THREE.Group();
  windowFrame.add(
    plainPart(new THREE.BoxGeometry(0.12, 9, 0.12), materials.frame, { position: [-1.9, 1, -3.8] }),
    plainPart(new THREE.BoxGeometry(0.12, 9, 0.12), materials.frame, { position: [2.35, 1, -3.8] }),
    plainPart(new THREE.BoxGeometry(8.8, 0.12, 0.12), materials.frame, { position: [0.2, 2.7, -3.8] }),
  );
  scene.add(windowFrame);

  const shelves = new THREE.Group();
  shelves.add(
    plainPart(new THREE.BoxGeometry(3.6, 0.15, 0.5), materials.wood, { position: [4.6, 3.2, -3.35] }),
    plainPart(new THREE.BoxGeometry(3.6, 0.15, 0.5), materials.wood, { position: [4.6, 1.25, -3.35] }),
  );
  const bookColors = [0x426286, 0xb56c45, 0x91624f, 0x28445f, 0xd2b676];
  for (let i = 0; i < 7; i += 1) {
    const height = 0.65 + (i % 3) * 0.14;
    shelves.add(plainPart(
      new THREE.BoxGeometry(0.23, height, 0.34),
      makeToonMaterial(bookColors[i % bookColors.length], materials.gradient),
      { position: [3.65 + i * 0.3, 3.62 + height * 0.5, -3.28], rotation: [0, 0, (i % 2 ? -1 : 1) * 0.035] },
    ));
  }
  scene.add(shelves);
}

function createMug(materials) {
  const mug = new THREE.Group();
  mug.add(outlinedPart(
    new THREE.CylinderGeometry(0.32, 0.29, 0.62, 16, 1, true),
    materials.mug,
  ));
  mug.add(plainPart(
    new THREE.TorusGeometry(0.26, 0.07, 8, 18, Math.PI * 1.55),
    materials.mug,
    { position: [0.32, 0.03, 0], rotation: [Math.PI / 2, 0, Math.PI / 2] },
  ));
  mug.add(plainPart(new THREE.CircleGeometry(0.29, 18), materials.coffee, {
    position: [0, 0.31, 0],
    rotation: [-Math.PI / 2, 0, 0],
  }));
  return mug;
}

function createDesk(scene, materials) {
  const desk = new THREE.Group();
  desk.add(outlinedPart(
    new THREE.BoxGeometry(8.8, 0.32, 2.5),
    materials.wood,
    { position: [0, -2.28, 0.45] },
    1.018,
  ));
  desk.add(
    plainPart(new THREE.BoxGeometry(0.3, 2.6, 0.3), materials.frame, { position: [-3.7, -3.65, 0.55] }),
    plainPart(new THREE.BoxGeometry(0.3, 2.6, 0.3), materials.frame, { position: [3.7, -3.65, 0.55] }),
  );

  const mug = createMug(materials);
  mug.position.set(3.05, -1.94, 0.78);
  mug.rotation.y = -0.2;
  desk.add(mug);

  const pencilCup = new THREE.Group();
  pencilCup.add(outlinedPart(new THREE.CylinderGeometry(0.25, 0.22, 0.58, 10), materials.cup));
  for (let i = 0; i < 4; i += 1) {
    pencilCup.add(plainPart(
      new THREE.CylinderGeometry(0.025, 0.025, 0.8 + i * 0.08, 6),
      i % 2 ? materials.gold : materials.shirt,
      { position: [-0.12 + i * 0.08, 0.55, 0], rotation: [0, 0, -0.08 + i * 0.04] },
    ));
  }
  pencilCup.position.set(-3.1, -1.92, 0.7);
  desk.add(pencilCup);
  scene.add(desk);
  return desk;
}

function createArm(side, materials) {
  const arm = new THREE.Group();
  const upper = outlinedPart(
    new THREE.CylinderGeometry(0.24, 0.3, 1.35, 10),
    materials.blazer,
    { position: [0, -0.6, 0] },
  );
  arm.add(upper);

  const forearm = new THREE.Group();
  forearm.position.set(0, -1.15, 0);
  forearm.add(outlinedPart(
    new THREE.CylinderGeometry(0.19, 0.25, 1.18, 10),
    materials.blazer,
    { position: [0, -0.48, 0], rotation: [0.22, 0, 0] },
  ));
  forearm.add(outlinedPart(
    new THREE.SphereGeometry(0.22, 12, 9),
    materials.skin,
    { position: [0, -1.03, 0.22], scale: [1.15, 0.7, 1.45] },
  ));
  arm.add(forearm);
  arm.userData.forearm = forearm;
  arm.userData.side = side;
  return arm;
}

function createCharacter(scene, materials) {
  const character = new THREE.Group();
  character.position.set(0.65, -0.18, 0.05);

  const torso = outlinedPart(
    new THREE.CylinderGeometry(0.92, 1.34, 2.35, 8),
    materials.blazer,
    { position: [0, -0.55, -0.1], scale: [1.08, 1, 0.72] },
    1.035,
  );
  character.add(torso);
  character.add(plainPart(
    new THREE.BoxGeometry(0.68, 1.78, 0.25),
    materials.shirt,
    { position: [0, -0.42, 0.65], rotation: [0.06, 0, 0] },
  ));
  character.add(plainPart(
    new THREE.ConeGeometry(0.11, 0.72, 4),
    materials.gold,
    { position: [0, -0.4, 0.83], rotation: [Math.PI, 0, 0] },
  ));

  character.add(outlinedPart(
    new THREE.CylinderGeometry(0.26, 0.31, 0.5, 12),
    materials.skin,
    { position: [0, 0.73, -0.03] },
  ));

  const head = new THREE.Group();
  head.position.set(0, 1.45, 0);
  head.add(outlinedPart(
    new THREE.SphereGeometry(0.82, 28, 20),
    materials.skin,
    { scale: [0.9, 1.08, 0.82] },
    1.035,
  ));
  head.add(
    outlinedPart(new THREE.SphereGeometry(0.18, 12, 9), materials.skin, { position: [-0.77, 0, 0], scale: [0.55, 1, 0.55] }),
    outlinedPart(new THREE.SphereGeometry(0.18, 12, 9), materials.skin, { position: [0.77, 0, 0], scale: [0.55, 1, 0.55] }),
  );

  const hairCap = outlinedPart(
    new THREE.SphereGeometry(0.84, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
    materials.hair,
    { position: [0, 0.27, -0.02], rotation: [-0.12, 0, 0], scale: [0.94, 0.72, 0.86] },
    1.035,
  );
  head.add(hairCap);
  const hairShapes = [
    [-0.56, 0.55, 0.37, -0.48, 0.34],
    [-0.25, 0.73, 0.43, -0.2, 0.44],
    [0.08, 0.78, 0.45, 0.05, 0.46],
    [0.38, 0.7, 0.42, 0.35, 0.42],
    [0.6, 0.52, 0.35, 0.56, 0.34],
  ];
  for (const [x, y, length, rotation, width] of hairShapes) {
    head.add(outlinedPart(
      new THREE.ConeGeometry(width * 0.44, length, 7),
      materials.hair,
      { position: [x, y, 0.25], rotation: [1.18, 0, rotation] },
      1.03,
    ));
  }

  const eyes = new THREE.Group();
  eyes.position.z = 0.69;
  for (const side of [-1, 1]) {
    const eye = plainPart(
      new THREE.SphereGeometry(0.095, 12, 8),
      materials.ink,
      { position: [side * 0.31, 0.09, 0], scale: [1.22, 0.52, 0.38] },
    );
    eyes.add(eye);
    eyes.userData[side < 0 ? 'left' : 'right'] = eye;
    head.add(plainPart(
      new THREE.BoxGeometry(0.31, 0.045, 0.045),
      materials.hair,
      { position: [side * 0.31, 0.28, 0.66], rotation: [0, 0, side * -0.08] },
    ));
  }
  head.add(eyes);
  head.add(plainPart(
    new THREE.ConeGeometry(0.075, 0.28, 6),
    materials.skinShadow,
    { position: [0, -0.08, 0.75], rotation: [Math.PI / 2, 0, 0] },
  ));
  head.add(plainPart(
    new THREE.BoxGeometry(0.27, 0.025, 0.025),
    materials.mouth,
    { position: [0, -0.34, 0.72], rotation: [0, 0, -0.03] },
  ));
  character.add(head);

  const leftArm = createArm(-1, materials);
  leftArm.position.set(-0.92, 0.22, 0.2);
  leftArm.rotation.set(-0.18, 0.1, 0.72);
  const rightArm = createArm(1, materials);
  rightArm.position.set(0.92, 0.22, 0.2);
  rightArm.rotation.set(-0.18, -0.1, -0.72);
  character.add(leftArm, rightArm);

  const laptop = new THREE.Group();
  laptop.position.set(-0.2, -1.5, 1.18);
  laptop.add(outlinedPart(
    new THREE.BoxGeometry(2.8, 0.13, 1.45),
    materials.laptop,
    { rotation: [0.08, 0, 0] },
    1.018,
  ));
  const lid = new THREE.Group();
  lid.position.set(0, 0.03, -0.65);
  lid.rotation.x = -0.27;
  lid.add(outlinedPart(
    new THREE.BoxGeometry(2.72, 1.65, 0.12),
    materials.laptop,
    { position: [0, 0.78, 0] },
    1.018,
  ));
  lid.add(plainPart(
    new THREE.CircleGeometry(0.2, 18),
    materials.logo,
    { position: [0, 0.78, 0.071], rotation: [0, Math.PI, 0] },
  ));
  laptop.add(lid);
  character.add(laptop);

  character.userData = { head, eyes, leftArm, rightArm, laptop };
  scene.add(character);
  return character;
}

function createMaterials(gradient) {
  const shared = { gradient };
  return {
    ...shared,
    blazer: makeToonMaterial(0x596a83, gradient),
    shirt: makeToonMaterial(0x86a5c8, gradient),
    skin: makeToonMaterial(0xd8a078, gradient),
    skinShadow: makeToonMaterial(0xb87458, gradient),
    hair: makeToonMaterial(0x171d2a, gradient),
    ink: new THREE.MeshBasicMaterial({ color: 0x080d16 }),
    mouth: new THREE.MeshBasicMaterial({ color: 0x6e3840 }),
    laptop: makeToonMaterial(0x17253b, gradient),
    logo: new THREE.MeshBasicMaterial({ color: 0xd2b676 }),
    wood: makeToonMaterial(0x6e3d2d, gradient),
    frame: makeToonMaterial(0x15243a, gradient),
    building: makeToonMaterial(0x0d2843, gradient),
    window: new THREE.MeshBasicMaterial({ color: 0xe7b95b }),
    mug: makeToonMaterial(0x182b43, gradient),
    coffee: new THREE.MeshBasicMaterial({ color: 0x341c16 }),
    cup: makeToonMaterial(0x3f536f, gradient),
    gold: makeToonMaterial(0xd2b676, gradient),
  };
}

function setCharacterPose(character, state, seconds, reducedMotion) {
  const { head, eyes, leftArm, rightArm } = character.userData;
  const stepped = reducedMotion ? 0 : Math.floor(seconds * 12) / 12;
  const breathing = reducedMotion ? 0 : Math.sin(stepped * 2.1) * 0.018;
  character.position.y = -0.18 + breathing;

  let headX = -0.03;
  let headY = 0;
  if (state === 'reading') headX = 0.2;
  if (state === 'typing') headX = 0.16;
  if (state === 'complete') {
    headX = -0.08;
    headY = -0.08;
  }
  if (state === 'error') {
    headX = 0.08;
    headY = 0.12;
  }
  head.rotation.x += (headX - head.rotation.x) * 0.12;
  head.rotation.y += (headY - head.rotation.y) * 0.12;

  const blinkPhase = stepped % 4.2;
  const blink = !reducedMotion && blinkPhase > 4.03 ? 0.14 : 1;
  eyes.userData.left.scale.y = 0.52 * blink;
  eyes.userData.right.scale.y = 0.52 * blink;

  const isTyping = state === 'typing' && !reducedMotion;
  const leftBeat = isTyping ? Math.sin(stepped * 17) * 0.09 : 0;
  const rightBeat = isTyping ? Math.sin(stepped * 17 + Math.PI) * 0.09 : 0;
  leftArm.userData.forearm.rotation.x = -0.42 + leftBeat;
  rightArm.userData.forearm.rotation.x = -0.42 + rightBeat;
  leftArm.rotation.y = 0.1 + leftBeat * 0.35;
  rightArm.rotation.y = -0.1 - rightBeat * 0.35;
}

export function initializeCharacterScene(mount, options = {}) {
  if (!mount) throw new Error('Character scene mount is required.');
  if (mount.dataset.sceneStatus === 'ready' && mount.__sceneController) return mount.__sceneController;

  mount.dataset.sceneStatus = 'loading';
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch (error) {
    mount.dataset.sceneStatus = 'fallback';
    options.onError?.(error);
    throw error;
  }

  renderer.setClearColor(0x07172a, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.domElement.setAttribute('aria-hidden', 'true');
  mount.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07172a, 0.035);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0.4, 0.55, 10.8);
  camera.lookAt(0.35, -0.2, 0);

  const gradient = makeGradientMap();
  const materials = createMaterials(gradient);
  createCity(scene, materials);
  createDesk(scene, materials);
  const character = createCharacter(scene, materials);

  scene.add(new THREE.HemisphereLight(0x8fc6ff, 0x1b1420, 1.6));
  const key = new THREE.DirectionalLight(0xffc873, 4.2);
  key.position.set(4.5, 7, 6);
  scene.add(key);
  const rim = new THREE.PointLight(0x4caeff, 3.8, 18);
  rim.position.set(-5, 2.5, 4);
  scene.add(rim);

  let state = 'opening';
  let running = false;
  let destroyed = false;
  let frameId = 0;
  let startedAt = performance.now();
  let lastFrame = 0;

  const render = () => renderer.render(scene, camera);
  const resize = () => {
    const { width, height } = mount.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 700 ? 1.35 : 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = width < 520 ? 12.5 : 10.8;
    camera.updateProjectionMatrix();
    render();
  };

  const tick = (time) => {
    frameId = 0;
    if (!running || destroyed || document.hidden || motionQuery.matches) return;
    const frameInterval = mount.clientWidth < 700 ? 1000 / 30 : 1000 / 60;
    if (time - lastFrame >= frameInterval) {
      lastFrame = time;
      setCharacterPose(character, state, (time - startedAt) / 1000, false);
      render();
    }
    frameId = requestAnimationFrame(tick);
  };

  const resume = () => {
    running = true;
    if (destroyed || document.hidden || motionQuery.matches || frameId) {
      setCharacterPose(character, state, 0, motionQuery.matches);
      render();
      return;
    }
    startedAt = performance.now();
    frameId = requestAnimationFrame(tick);
  };

  const pause = () => {
    running = false;
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
  };

  const setState = (nextState) => {
    state = VALID_STATES.has(nextState) ? nextState : 'idle';
    mount.dataset.characterState = state;
    options.onStateLabel?.(STATE_LABELS[state]);
    setCharacterPose(character, state, 0, motionQuery.matches);
    render();
  };

  const handleVisibility = () => {
    if (document.hidden) {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
    } else if (running) {
      resume();
    }
  };
  const handleMotion = () => {
    if (motionQuery.matches) {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
      setCharacterPose(character, state, 0, true);
      render();
    } else if (running) {
      resume();
    }
  };
  const handleContextLost = (event) => {
    event.preventDefault();
    pause();
    mount.dataset.sceneStatus = 'fallback';
    options.onError?.(new Error('WebGL context lost.'));
  };
  const handleContextRestored = () => {
    mount.dataset.sceneStatus = 'ready';
    render();
    resume();
  };

  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(mount);
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', handleVisibility);
  motionQuery.addEventListener?.('change', handleMotion);
  renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
  renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

  const destroy = () => {
    destroyed = true;
    pause();
    resizeObserver?.disconnect();
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', handleVisibility);
    motionQuery.removeEventListener?.('change', handleMotion);
    renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
    scene.traverse((object) => {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material?.dispose();
    });
    gradient.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    delete mount.__sceneController;
    mount.dataset.sceneStatus = 'fallback';
  };

  const controller = { setState, pause, resume, resize, destroy };
  mount.__sceneController = controller;
  mount.dataset.sceneStatus = 'ready';
  setState('opening');
  resize();
  resume();
  return controller;
}
