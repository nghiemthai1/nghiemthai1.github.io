import * as THREE from './vendor/three.module.min.js';

const DESKTOP_MOBILE_ARTWORK_SCALE = 1.08 * 1.05;
const MOBILE_ARTWORK_ASPECT = 941 / 1672;
const MOBILE_ARTWORK_URLS = Object.freeze({
  rest: new URL('../assets/images/digital-twin-shared/chin/frame-00-rest.jpg', import.meta.url).href,
  lift: new URL('../assets/images/digital-twin-shared/chin/frame-01-lift.jpg', import.meta.url).href,
  rise: new URL('../assets/images/digital-twin-shared/chin/frame-02-rise.jpg', import.meta.url).href,
  approach: new URL('../assets/images/digital-twin-shared/chin/frame-03-approach.jpg', import.meta.url).href,
  contact: new URL('../assets/images/digital-twin-shared/chin/frame-04-contact.jpg', import.meta.url).href,
  settled: new URL('../assets/images/digital-twin-shared/chin/frame-05-settled.jpg', import.meta.url).href,
  halfBlink: new URL('../assets/images/digital-twin-shared/chin/frame-06-half-blink.jpg', import.meta.url).href,
  blink: new URL('../assets/images/digital-twin-shared/chin/frame-07-blink.jpg', import.meta.url).href,
  focus: new URL('../assets/images/digital-twin-shared/screen-focus/frame-00-focus.jpg', import.meta.url).href,
  focusHalfBlink: new URL('../assets/images/digital-twin-shared/screen-focus/frame-01-half-blink.jpg', import.meta.url).href,
  focusBlink: new URL('../assets/images/digital-twin-shared/screen-focus/frame-02-blink.jpg', import.meta.url).href,
  typingCenter: new URL('../assets/images/digital-twin-shared/typing/frame-00-center.jpg', import.meta.url).href,
  typingLeft: new URL('../assets/images/digital-twin-shared/typing/frame-01-left-press.jpg', import.meta.url).href,
  typingRight: new URL('../assets/images/digital-twin-shared/typing/frame-02-right-press.jpg', import.meta.url).href,
  typingBlink: new URL('../assets/images/digital-twin-shared/typing/frame-03-blink.jpg', import.meta.url).href,
  errorApology: new URL('../assets/images/digital-twin-shared/error-apology/frame-00-apology.jpg', import.meta.url).href,
  errorDowncast: new URL('../assets/images/digital-twin-shared/error-apology/frame-01-downcast.jpg', import.meta.url).href,
  errorHalfBlink: new URL('../assets/images/digital-twin-shared/error-apology/frame-02-half-blink.jpg', import.meta.url).href,
  errorBlink: new URL('../assets/images/digital-twin-shared/error-apology/frame-03-blink.jpg', import.meta.url).href,
  reactionNotice: new URL('../assets/images/digital-twin-shared/click-reaction/frame-00-notice.jpg', import.meta.url).href,
});
const VALID_STATES = new Set(['opening', 'idle', 'composing', 'reading', 'typing', 'complete', 'error']);
const RESTING_STATES = new Set(['idle', 'composing', 'complete']);
const CLICK_REACTION_STATES = new Set(['idle', 'complete']);
const STATE_LABELS = {
  opening: 'Opening the conversation',
  idle: 'Ready when you are',
  composing: 'Reviewing your question',
  reading: 'Reviewing your question',
  typing: 'Preparing a response',
  complete: 'Answer ready',
  error: 'The assistant needs a moment',
};
const MOBILE_HEAD_ARTWORK_UV = Object.freeze({ x: 0.56, yFromTop: 0.36 });

const MOBILE_ENTRY_POSE_STRIP = Object.freeze([
  [0, 'rest'],
  [0.42, 'rest'],
  [0.6, 'lift'],
  [0.78, 'rise'],
  [0.96, 'approach'],
  [1.14, 'contact'],
  [1.32, 'settled'],
]);

const MOBILE_BLINK_POSE_STRIP = Object.freeze([
  [0, 'settled'],
  [4.55, 'settled'],
  [4.66, 'halfBlink'],
  [4.77, 'blink'],
  [4.88, 'halfBlink'],
  [4.99, 'settled'],
  [11.65, 'settled'],
  [11.76, 'halfBlink'],
  [11.87, 'blink'],
  [11.98, 'halfBlink'],
  [12.09, 'settled'],
  [13.4, 'settled'],
]);

const MOBILE_SCREEN_FOCUS_POSE_STRIP = Object.freeze([
  [0, 'focus'],
  [2.8, 'focus'],
  [2.91, 'focusHalfBlink'],
  [3.02, 'focusBlink'],
  [3.13, 'focusHalfBlink'],
  [3.24, 'focus'],
  [5.4, 'focus'],
]);

const MOBILE_TYPING_POSE_STRIP = Object.freeze([
  [0, 'typingCenter'],
  [0.1, 'typingLeft'],
  [0.2, 'typingCenter'],
  [0.3, 'typingRight'],
  [0.4, 'typingCenter'],
  [0.5, 'typingLeft'],
  [0.6, 'typingCenter'],
  [0.7, 'typingRight'],
  [0.8, 'typingCenter'],
  [0.95, 'typingLeft'],
  [1.1, 'typingCenter'],
  [1.25, 'typingRight'],
  [1.4, 'typingCenter'],
  [1.55, 'typingLeft'],
  [1.7, 'typingCenter'],
  [1.85, 'typingRight'],
  [2, 'typingCenter'],
  [2.45, 'typingCenter'],
  [2.56, 'typingBlink'],
  [2.67, 'typingCenter'],
  [3.2, 'typingCenter'],
]);

const MOBILE_ERROR_POSE_STRIP = Object.freeze([
  [0, 'errorApology'],
  [0.22, 'errorApology'],
  [0.32, 'errorHalfBlink'],
  [0.42, 'errorBlink'],
  [0.52, 'errorHalfBlink'],
  [0.64, 'errorApology'],
]);

const CLICK_REACTION_POSE_STRIP = Object.freeze([
  [0, 'settled'],
  [0.08, 'reactionNotice'],
  [0.96, 'settled'],
]);

function makeWhiteTexture() {
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  texture.needsUpdate = true;
  return texture;
}

function makeChromaMaterial(alphaMap) {
  return new THREE.ShaderMaterial({
    uniforms: {
      frameMap: { value: null },
      alphaMap: { value: alphaMap },
      opacity: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D frameMap;
      uniform sampler2D alphaMap;
      uniform float opacity;
      varying vec2 vUv;
      void main() {
        vec4 frame = texture2D(frameMap, vUv);
        float strongestOtherChannel = max(frame.r, frame.b);
        float greenDominance = frame.g - strongestOtherChannel;
        float greenBrightness = smoothstep(0.52, 0.76, frame.g);
        float keyStrength = smoothstep(0.27, 0.48, greenDominance) * greenBrightness;
        float edgeAlpha = 1.0 - keyStrength;
        float maskAlpha = texture2D(alphaMap, vUv).r;
        float finalAlpha = frame.a * edgeAlpha * maskAlpha * opacity;
        if (finalAlpha < 0.004) discard;
        vec3 color = frame.rgb;
        color.g = mix(min(color.g, strongestOtherChannel + 0.08), color.g, edgeAlpha);
        vec2 faceUv = (vUv - vec2(0.56, 0.7)) / vec2(0.13, 0.22);
        vec2 raisedHandUv = (vUv - vec2(0.5, 0.53)) / vec2(0.085, 0.17);
        vec2 deskHandUv = (vUv - vec2(0.65, 0.14)) / vec2(0.13, 0.1);
        float skinRegion = max(
          1.0 - smoothstep(0.72, 1.0, length(faceUv)),
          max(
            1.0 - smoothstep(0.72, 1.0, length(raisedHandUv)),
            1.0 - smoothstep(0.72, 1.0, length(deskHandUv))
          )
        );
        float skinWarmth = smoothstep(0.035, 0.2, color.r - color.g)
          * smoothstep(0.015, 0.16, color.g - color.b);
        float skinToneBalance = skinRegion * skinWarmth;
        color.g += skinToneBalance * max(color.r - color.g, 0.0) * 0.34;
        color.b += skinToneBalance * max(color.r - color.b, 0.0) * 0.28;
        gl_FragColor = vec4(color, finalAlpha);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
}

function samplePoseStrip(time, keyframes) {
  for (let index = 1; index < keyframes.length; index += 1) {
    const previous = keyframes[index - 1];
    const next = keyframes[index];
    if (time > next[0]) continue;
    if (previous[1] === next[1]) return { [next[1]]: 1 };
    const duration = next[0] - previous[0];
    const progress = THREE.MathUtils.clamp((time - previous[0]) / duration, 0, 1);
    const activePose = progress < 0.5 ? previous[1] : next[1];
    return { [activePose]: 1 };
  }
  return { [keyframes.at(-1)[1]]: 1 };
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
  renderer.domElement.style.pointerEvents = 'auto';
  renderer.domElement.style.touchAction = 'manipulation';
  mount.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 2;

  const whiteMaskTexture = makeWhiteTexture();
  const mobileArtworkGroup = new THREE.Group();
  const mobileArtworkGeometry = new THREE.PlaneGeometry(2 * MOBILE_ARTWORK_ASPECT, 2);
  const mobileArtworkMaterial = makeChromaMaterial(whiteMaskTexture);
  const mobileArtwork = new THREE.Mesh(mobileArtworkGeometry, mobileArtworkMaterial);
  mobileArtwork.position.z = 0;
  mobileArtwork.renderOrder = 0;
  mobileArtworkGroup.add(mobileArtwork);
  scene.add(mobileArtworkGroup);

  const imageAspect = MOBILE_ARTWORK_ASPECT;
  let baseX = 0;
  let baseY = 0;
  let baseScale = 1;
  let state = 'opening';
  let running = false;
  let shouldRun = false;
  let destroyed = false;
  let loaded = false;
  let mobileEpoch = performance.now();
  let actionEpoch = performance.now();
  let reactionEpoch = performance.now();
  let reactionActive = false;
  let reactionTimer = 0;
  let frameId = 0;
  let lastTime = performance.now();
  let lastHeadPositionReport = 0;
  const pointer = new THREE.Vector2();
  const targetPointer = new THREE.Vector2();

  const textureLoader = new THREE.TextureLoader();
  const mobileFrameTextures = new Map();
  const mobileFrameHitSamplers = new Map();
  let mobileFramesRequested = false;
  const hitRaycaster = new THREE.Raycaster();
  const hitPointer = new THREE.Vector2();

  function prepareTexture(texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
  }

  function createHitSampler(image) {
    const canvas = document.createElement('canvas');
    canvas.width = 188;
    canvas.height = 334;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return context;
  }

  function loadMobileFrames() {
    if (mobileFramesRequested) return;
    mobileFramesRequested = true;
    mount.dataset.mobileAnimationStatus = 'loading';
    Object.entries(MOBILE_ARTWORK_URLS).forEach(([name, url]) => {
      textureLoader.load(
        url,
        (texture) => {
          if (destroyed) {
            texture.dispose();
            return;
          }
          prepareTexture(texture);
          mobileFrameTextures.set(name, texture);
          mobileFrameHitSamplers.set(name, createHitSampler(texture.image));
          if (!mobileArtworkMaterial.uniforms.frameMap.value || name === 'settled') {
            mobileArtworkMaterial.uniforms.frameMap.value = texture;
          }
          mount.dataset.mobileAnimationStatus = mobileFrameTextures.size === Object.keys(MOBILE_ARTWORK_URLS).length
            ? 'ready'
            : 'loading';
          renderOnce();
          if (mobileArtworkMaterial.uniforms.opacity.value > 0) {
            loaded = true;
            mount.dataset.sceneStatus = 'ready';
          }
        },
        undefined,
        (error) => {
          mount.dataset.mobileAnimationStatus = 'partial';
          console.warn(`The mobile ${name} animation frame could not load.`, error);
        },
      );
    });
  }

  let compact = window.innerWidth <= 700;
  loadMobileFrames();

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

    const wasCompact = compact;
    compact = window.innerWidth <= 700;
    loadMobileFrames();
    if (compact && !wasCompact) mobileEpoch = performance.now();
    baseScale = compact ? 1.08
      : Math.min(DESKTOP_MOBILE_ARTWORK_SCALE, viewAspect / imageAspect);
    // Align the desktop portrait with the right edge, leaving a small motion inset.
    baseX = compact ? 0.38
      : Math.max(0, viewAspect - imageAspect * baseScale - 0.03);
    // Keep the enlarged portrait below the desktop disclosure controls.
    baseY = compact ? -0.04 : -0.08;
    const activeGroup = mobileArtworkGroup;
    activeGroup.scale.setScalar(baseScale);
    activeGroup.position.x = baseX;
    activeGroup.position.y = baseY;
    renderOnce();
  }

  function getHeadScreenPosition() {
    const headUv = MOBILE_HEAD_ARTWORK_UV;
    const activeGroup = mobileArtworkGroup;
    const localHead = new THREE.Vector3(
      (headUv.x - 0.5) * 2 * imageAspect,
      (0.5 - headUv.yFromTop) * 2,
      0,
    );
    activeGroup.updateMatrixWorld(true);
    localHead.applyMatrix4(activeGroup.matrixWorld).project(camera);
    const bounds = renderer.domElement.getBoundingClientRect();
    return {
      x: bounds.left + (localHead.x + 1) * 0.5 * bounds.width,
      y: bounds.top + (1 - localHead.y) * 0.5 * bounds.height,
    };
  }

  function getArtworkUv(clientX, clientY) {
    const bounds = renderer.domElement.getBoundingClientRect();
    if (!bounds.width || !bounds.height || clientX < bounds.left || clientX > bounds.right
      || clientY < bounds.top || clientY > bounds.bottom) return null;
    hitPointer.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    mobileArtworkGroup.updateMatrixWorld(true);
    hitRaycaster.setFromCamera(hitPointer, camera);
    return hitRaycaster.intersectObject(mobileArtwork, false)[0]?.uv || null;
  }

  function isCharacterUv(uv, sampleArtwork = true) {
    if (!uv) return false;
    const yFromTop = 1 - uv.y;
    const headX = (uv.x - 0.55) / 0.27;
    const headY = (yFromTop - 0.37) / 0.23;
    const torsoX = (uv.x - 0.53) / 0.48;
    const torsoY = (yFromTop - 0.58) / 0.24;
    const inHead = headX * headX + headY * headY <= 1;
    const inUpperBody = torsoX * torsoX + torsoY * torsoY <= 1 && yFromTop <= 0.66;
    if (!inHead && !inUpperBody) return false;
    if (!sampleArtwork) return true;

    const sampler = mobileFrameHitSamplers.get(mount.dataset.mobileFrame)
      || mobileFrameHitSamplers.get('settled');
    if (!sampler) return true;
    const x = Math.min(sampler.canvas.width - 1, Math.max(0, Math.floor(uv.x * sampler.canvas.width)));
    const y = Math.min(sampler.canvas.height - 1, Math.max(0, Math.floor(yFromTop * sampler.canvas.height)));
    const [red, green, blue] = sampler.getImageData(x, y, 1, 1).data;
    const strongestOtherChannel = Math.max(red, blue);
    return green < 150 || green - strongestOtherChannel < 70;
  }

  function cancelClickReaction() {
    reactionActive = false;
    mount.dataset.characterReaction = 'inactive';
    if (reactionTimer) {
      window.clearTimeout(reactionTimer);
      reactionTimer = 0;
    }
  }

  function triggerClickReaction() {
    if (!CLICK_REACTION_STATES.has(state)) return;
    cancelClickReaction();
    reactionActive = true;
    reactionEpoch = performance.now();
    mount.dataset.characterReaction = 'active';
    if (motionQuery.matches) {
      renderOnce();
      reactionTimer = window.setTimeout(() => {
        cancelClickReaction();
        renderOnce();
      }, 220);
    }
  }

  function reportHeadScreenPosition(now = performance.now(), force = false) {
    if (!options.onHeadPosition || (!force && now - lastHeadPositionReport < 120)) return;
    lastHeadPositionReport = now;
    options.onHeadPosition(getHeadScreenPosition());
  }

  function updateCharacterPose(now, snap = false) {
    const elapsed = Math.max(0, (now - mobileEpoch) / 1000);
    const actionElapsed = Math.max(0, (now - actionEpoch) / 1000);
    const reactionElapsed = Math.max(0, (now - reactionEpoch) / 1000);
    const showingClickReaction = reactionActive
      && CLICK_REACTION_STATES.has(state)
      && reactionElapsed <= CLICK_REACTION_POSE_STRIP.at(-1)[0];
    if (reactionActive && !showingClickReaction) cancelClickReaction();
    const showingErrorExpression = state === 'error'
      && (snap || actionElapsed <= MOBILE_ERROR_POSE_STRIP.at(-1)[0]);
    let frameWeights;
    if (showingClickReaction) {
      frameWeights = snap
        ? { reactionNotice: 1 }
        : samplePoseStrip(reactionElapsed, CLICK_REACTION_POSE_STRIP);
    } else if (showingErrorExpression) {
      frameWeights = snap
        ? { errorApology: 1 }
        : samplePoseStrip(actionElapsed, MOBILE_ERROR_POSE_STRIP);
    } else if (state === 'composing' || state === 'reading') {
      frameWeights = snap
        ? { focus: 1 }
        : samplePoseStrip(actionElapsed % MOBILE_SCREEN_FOCUS_POSE_STRIP.at(-1)[0], MOBILE_SCREEN_FOCUS_POSE_STRIP);
    } else if (state === 'typing') {
      frameWeights = snap
        ? { typingCenter: 1 }
        : samplePoseStrip(actionElapsed % MOBILE_TYPING_POSE_STRIP.at(-1)[0], MOBILE_TYPING_POSE_STRIP);
    } else {
      frameWeights = snap
        ? { settled: 1 }
        : elapsed <= MOBILE_ENTRY_POSE_STRIP.at(-1)[0]
          ? samplePoseStrip(elapsed, MOBILE_ENTRY_POSE_STRIP)
          : samplePoseStrip(
            (elapsed - MOBILE_ENTRY_POSE_STRIP.at(-1)[0]) % MOBILE_BLINK_POSE_STRIP.at(-1)[0],
            MOBILE_BLINK_POSE_STRIP,
          );
    }
    const requestedFrame = Object.keys(frameWeights)[0] || 'settled';
    mount.dataset.mobileFrame = requestedFrame;
    mount.dataset.mobileMode = showingClickReaction
      ? 'click-reaction'
      : showingErrorExpression
      ? 'error-apology'
      : state === 'composing' || state === 'reading'
      ? 'screen-focus'
      : state === 'typing' ? 'typing' : 'resting';
    const nextTexture = mobileFrameTextures.get(requestedFrame)
      || (showingClickReaction ? mobileFrameTextures.get('reactionNotice') : null)
      || (showingErrorExpression ? mobileFrameTextures.get('errorApology') : null)
      || (state === 'typing' ? mobileFrameTextures.get('typingCenter') : null)
      || (state === 'composing' || state === 'reading' ? mobileFrameTextures.get('focus') : null)
      || mobileFrameTextures.get('settled')
      || mobileFrameTextures.get('rest');
    if (nextTexture) mobileArtworkMaterial.uniforms.frameMap.value = nextTexture;
    mobileArtworkMaterial.uniforms.opacity.value = nextTexture ? 1 : 0;
  }

  function draw(now) {
    if (!running || destroyed) return;
    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    pointer.lerp(targetPointer, 1 - Math.exp(-delta * 4.2));
    updateCharacterPose(now);

    const resting = RESTING_STATES.has(state);
    const breathWave = Math.sin(now * 0.00112) * 0.7 + Math.sin(now * 0.00053 + 1.1) * 0.3;
    const breath = resting ? breathWave * 0.0019 : breathWave * 0.00055;
    const drift = Math.sin(now * 0.00016) * 0.0045 + (resting ? breathWave * 0.0024 : 0);
    const activeGroup = mobileArtworkGroup;
    activeGroup.scale.setScalar(baseScale * (1 + breath));
    activeGroup.position.x = baseX + pointer.x * 0.025;
    activeGroup.position.y = baseY + drift + pointer.y * 0.014;
    activeGroup.rotation.x = -pointer.y * 0.005;
    activeGroup.rotation.y = pointer.x * 0.009;
    activeGroup.rotation.z = 0;
    renderer.render(scene, camera);
    reportHeadScreenPosition(now);
    frameId = requestAnimationFrame(draw);
  }

  function renderOnce() {
    if (destroyed) return;
    updateCharacterPose(performance.now(), motionQuery.matches);
    if (motionQuery.matches) {
      const activeGroup = mobileArtworkGroup;
      activeGroup.scale.setScalar(baseScale);
      activeGroup.position.x = baseX;
      activeGroup.position.y = baseY;
      activeGroup.rotation.set(0, 0, 0);
    }
    renderer.render(scene, camera);
    reportHeadScreenPosition(performance.now(), true);
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
    const previousState = state;
    state = nextState;
    if (!CLICK_REACTION_STATES.has(state)) cancelClickReaction();
    if ((state === 'composing' || state === 'reading' || state === 'typing' || state === 'error') && state !== previousState) {
      actionEpoch = performance.now();
    }
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
    const uv = getArtworkUv(event.clientX, event.clientY);
    renderer.domElement.style.cursor = CLICK_REACTION_STATES.has(state) && isCharacterUv(uv, false)
      ? 'pointer'
      : 'default';
  }

  function handlePointerLeave() {
    targetPointer.set(0, 0);
    renderer.domElement.style.cursor = 'default';
  }

  function handleCharacterClick(event) {
    if (!CLICK_REACTION_STATES.has(state) || !isCharacterUv(getArtworkUv(event.clientX, event.clientY))) return;
    event.preventDefault();
    event.stopPropagation();
    triggerClickReaction();
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
    renderer.domElement.removeEventListener('click', handleCharacterClick);
    document.removeEventListener('visibilitychange', handleVisibility);
    renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
    motionQuery.removeEventListener?.('change', handleMotionChange);
    resizeObserver?.disconnect();
    mobileArtworkGeometry.dispose();
    mobileArtworkMaterial.dispose();
    mobileFrameTextures.forEach((texture) => texture.dispose());
    whiteMaskTexture.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    delete mount.__sceneController;
  }

  const controller = { setState, pause, resume, resize, destroy, getHeadScreenPosition };
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  mount.__sceneController = controller;
  mount.addEventListener('pointermove', handlePointerMove, { passive: true });
  mount.addEventListener('pointerleave', handlePointerLeave, { passive: true });
  renderer.domElement.addEventListener('click', handleCharacterClick);
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
