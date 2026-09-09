import * as THREE from './vendor/three.module.min.js';

const ARTWORK_URL = new URL('../assets/images/digital-twin-studio.jpg', import.meta.url).href;
const VALID_STATES = new Set(['opening', 'idle', 'reading', 'typing', 'complete', 'error']);
const STATE_LABELS = {
  opening: 'Entering Thai\'s studio',
  idle: 'Ready when you are',
  reading: 'Reviewing your question',
  typing: 'Preparing a response',
  complete: 'Answer ready',
  error: 'The assistant needs a moment',
};
const STATE_ENERGY = {
  opening: 0.45,
  idle: 0.24,
  reading: 0.42,
  typing: 0.92,
  complete: 0.34,
  error: 0.12,
};

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,0.92)');
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.4)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeAtmosphere(glowTexture) {
  const group = new THREE.Group();
  const screenMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xf6b552,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const screenGlow = new THREE.Sprite(screenMaterial);
  screenGlow.position.set(0.3, -0.34, 0.03);
  screenGlow.scale.set(1.22, 0.68, 1);
  group.add(screenGlow);

  const cityMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0x2c8bc7,
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const cityGlow = new THREE.Sprite(cityMaterial);
  cityGlow.position.set(-0.78, 0.04, 0.02);
  cityGlow.scale.set(1.8, 1.25, 1);
  group.add(cityGlow);

  return { group, screenMaterial, cityMaterial };
}

function makeParticles() {
  const count = 44;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (Math.random() - 0.5) * 4;
    positions[index * 3 + 1] = (Math.random() - 0.5) * 2.4;
    positions[index * 3 + 2] = 0.08;
    speeds[index] = 0.018 + Math.random() * 0.028;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xf6cc78,
    size: 1.35,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.userData.speeds = speeds;
  return points;
}

export function initializeCharacterScene(mount, options = {}) {
  if (!mount) throw new Error('Character scene mount is required.');
  if (mount.dataset.sceneStatus === 'ready' && mount.__sceneController) return mount.__sceneController;

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

  mount.dataset.sceneStatus = 'loading';
  renderer.setClearColor(0x06111f, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.domElement.setAttribute('aria-hidden', 'true');
  mount.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 2;

  const artworkGroup = new THREE.Group();
  scene.add(artworkGroup);

  const artworkMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const artwork = new THREE.Mesh(new THREE.PlaneGeometry(2 * (1672 / 940), 2), artworkMaterial);
  artwork.position.z = 0;
  artworkGroup.add(artwork);

  const glowTexture = makeGlowTexture();
  const atmosphere = makeAtmosphere(glowTexture);
  artworkGroup.add(atmosphere.group);
  const particles = makeParticles();
  scene.add(particles);

  let imageAspect = 1672 / 940;
  let baseX = 0;
  let state = 'opening';
  let energy = STATE_ENERGY.opening;
  let targetEnergy = energy;
  let running = false;
  let shouldRun = false;
  let destroyed = false;
  let loaded = false;
  let frameId = 0;
  let lastTime = performance.now();
  const pointer = new THREE.Vector2();
  const targetPointer = new THREE.Vector2();

  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    ARTWORK_URL,
    (texture) => {
      if (destroyed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      imageAspect = texture.image.naturalWidth / texture.image.naturalHeight || imageAspect;
      artwork.geometry.dispose();
      artwork.geometry = new THREE.PlaneGeometry(2 * imageAspect, 2);
      artworkMaterial.map = texture;
      artworkMaterial.needsUpdate = true;
      loaded = true;
      mount.dataset.sceneStatus = 'ready';
      resize();
      renderOnce();
    },
    undefined,
    (error) => {
      mount.dataset.sceneStatus = 'fallback';
      options.onError?.(error);
    },
  );

  function resize() {
    if (destroyed) return;
    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);
    const viewAspect = width / height;
    renderer.setSize(width, height, false);
    camera.left = -viewAspect;
    camera.right = viewAspect;
    camera.top = 1;
    camera.bottom = -1;
    camera.updateProjectionMatrix();

    const coverScale = Math.max(1, viewAspect / imageAspect);
    artworkGroup.scale.setScalar(coverScale);
    const focusX = viewAspect < 0.82 ? 0.665 : viewAspect < 1.25 ? 0.59 : 0.5;
    baseX = -(focusX - 0.5) * 2 * imageAspect * coverScale;
    artworkGroup.position.x = baseX;
    artworkGroup.position.y = 0;
    renderOnce();
  }

  function updateParticles(delta) {
    const position = particles.geometry.attributes.position;
    const speeds = particles.userData.speeds;
    for (let index = 0; index < position.count; index += 1) {
      let y = position.getY(index) + speeds[index] * delta;
      if (y > 1.25) y = -1.25;
      position.setY(index, y);
    }
    position.needsUpdate = true;
  }

  function draw(now) {
    if (!running || destroyed) return;
    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    pointer.lerp(targetPointer, 0.035);
    energy += (targetEnergy - energy) * 0.045;

    const drift = Math.sin(now * 0.00018) * 0.006;
    artworkGroup.position.x = baseX + pointer.x * 0.025;
    artworkGroup.position.y = drift + pointer.y * 0.014;
    atmosphere.screenMaterial.opacity = 0.075 + energy * 0.12 + Math.sin(now * 0.0032) * energy * 0.014;
    atmosphere.cityMaterial.opacity = 0.055 + energy * 0.025;
    particles.material.opacity = 0.1 + energy * 0.12;
    updateParticles(delta);
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(draw);
  }

  function renderOnce() {
    if (destroyed) return;
    atmosphere.screenMaterial.opacity = 0.075 + targetEnergy * 0.12;
    atmosphere.cityMaterial.opacity = 0.055 + targetEnergy * 0.025;
    particles.material.opacity = 0.1 + targetEnergy * 0.12;
    renderer.render(scene, camera);
  }

  function pause() {
    shouldRun = false;
    stopAnimation();
  }

  function stopAnimation() {
    running = false;
    cancelAnimationFrame(frameId);
  }

  function resume() {
    shouldRun = true;
    startAnimation();
  }

  function startAnimation() {
    if (destroyed || document.hidden) return;
    if (motionQuery.matches) {
      renderOnce();
      return;
    }
    if (running) return;
    running = true;
    lastTime = performance.now();
    frameId = requestAnimationFrame(draw);
  }

  function setState(nextState) {
    if (!VALID_STATES.has(nextState)) return;
    state = nextState;
    targetEnergy = STATE_ENERGY[state];
    options.onStateLabel?.(STATE_LABELS[state]);
    if (motionQuery.matches) renderOnce();
  }

  function handlePointerMove(event) {
    const rect = mount.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    targetPointer.set(
      THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1),
      THREE.MathUtils.clamp(-((event.clientY - rect.top) / rect.height - 0.5) * 2, -1, 1),
    );
  }

  function handlePointerLeave() {
    targetPointer.set(0, 0);
  }

  function handleVisibility() {
    if (document.hidden) stopAnimation();
    else if (shouldRun) startAnimation();
  }

  function handleMotionChange() {
    if (motionQuery.matches) stopAnimation();
    else if (shouldRun) startAnimation();
    renderOnce();
  }

  function handleContextLost(event) {
    event.preventDefault();
    stopAnimation();
    mount.dataset.sceneStatus = 'fallback';
    options.onError?.(new Error('WebGL context lost.'));
  }

  function handleContextRestored() {
    mount.dataset.sceneStatus = loaded ? 'ready' : 'loading';
    options.onStateLabel?.(STATE_LABELS[state]);
    resize();
    if (shouldRun) startAnimation();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    pause();
    mount.removeEventListener('pointermove', handlePointerMove);
    mount.removeEventListener('pointerleave', handlePointerLeave);
    document.removeEventListener('visibilitychange', handleVisibility);
    renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
    motionQuery.removeEventListener?.('change', handleMotionChange);
    resizeObserver?.disconnect();
    artwork.geometry.dispose();
    artworkMaterial.map?.dispose();
    artworkMaterial.dispose();
    glowTexture.dispose();
    atmosphere.screenMaterial.dispose();
    atmosphere.cityMaterial.dispose();
    particles.geometry.dispose();
    particles.material.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    delete mount.__sceneController;
  }

  const controller = { setState, pause, resume, resize, destroy };
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  mount.__sceneController = controller;
  mount.addEventListener('pointermove', handlePointerMove, { passive: true });
  mount.addEventListener('pointerleave', handlePointerLeave, { passive: true });
  document.addEventListener('visibilitychange', handleVisibility);
  renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);
  renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored, false);
  motionQuery.addEventListener?.('change', handleMotionChange);
  resizeObserver?.observe(mount);
  options.onStateLabel?.(STATE_LABELS[state]);
  resize();
  resume();
  return controller;
}
