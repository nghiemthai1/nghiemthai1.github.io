import * as THREE from './vendor/three.module.min.js';

const GLOBE_RADIUS = 5;
// Radians per second: one unhurried revolution in about seven minutes.
const AUTO_ROTATION_SPEED = 0.015;
const PARALLAX_LERP = 0.035;
const MAX_TILT = 0.045;
const MAX_CAMERA_X = 0.25;

const atmosphereVertexShader = `
  varying vec3 vViewNormal;
  varying vec3 vViewDirection;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewNormal = normalize(normalMatrix * normal);
    vViewDirection = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const atmosphereFragmentShader = `
  varying vec3 vViewNormal;
  varying vec3 vViewDirection;
  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vViewNormal), normalize(vViewDirection))), 3.5);
    float key = max(dot(normalize(vViewNormal), normalize(vec3(-.45, .85, .2))), 0.0);
    gl_FragColor = vec4(0.824, 0.714, 0.463, rim * (.006 + .10 * pow(key, 2.0)));
  }
`;

const headVertexShader = `
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = min(10.0, 64.0 / -viewPosition.z);
  }
`;

const headFragmentShader = `
  uniform float uOpacity;
  void main() {
    float distanceFromCenter = length(gl_PointCoord - vec2(0.5));
    float glow = 1.0 - smoothstep(0.06, 0.5, distanceFromCenter);
    float core = 1.0 - smoothstep(0.02, 0.16, distanceFromCenter);
    if (glow < 0.01) discard;
    gl_FragColor = vec4(0.824, 0.714, 0.463, (glow * .62 + core * .38) * uOpacity * .78);
  }
`;

const flightCoordinates = [
  [[40.7, -74.0], [51.5, -0.1]],
  [[34.1, -118.2], [35.7, 139.7]],
  [[1.3, 103.8], [37.8, -122.4]],
  [[25.2, 55.3], [48.9, 2.4]],
  [[19.4, -99.1], [-23.6, -46.6]],
  [[-33.9, 151.2], [22.3, 114.2]],
  [[52.5, 13.4], [28.6, 77.2]],
  [[43.7, -79.4], [19.1, 72.9]],
  [[-1.3, 36.8], [-26.2, 28.0]],
  [[47.6, -122.3], [37.6, 127.0]],
  [[41.0, 29.0], [13.8, 100.5]],
  [[-33.4, -70.7], [-33.9, 18.4]],
  [[41.9, -87.6], [49.3, -123.1]],
  [[40.7, -74.0], [25.8, -80.2]],
  [[40.7, -74.0], [41.9, -87.6]],
  [[41.9, -87.6], [34.1, -118.2]],
  [[37.8, -122.4], [47.6, -122.3]],
  [[25.8, -80.2], [4.7, -74.1]],
  [[4.7, -74.1], [-23.6, -46.6]],
  [[-23.6, -46.6], [-34.6, -58.4]],
  [[19.4, -99.1], [32.8, -96.8]],
];

function pointOnGlobe(latitude, longitude) {
  const phi = THREE.MathUtils.degToRad(90 - latitude);
  const theta = THREE.MathUtils.degToRad(longitude + 180);
  return new THREE.Vector3(
    -GLOBE_RADIUS * Math.sin(phi) * Math.cos(theta),
    GLOBE_RADIUS * Math.cos(phi),
    GLOBE_RADIUS * Math.sin(phi) * Math.sin(theta),
  );
}

function createAtmosphere() {
  const material = new THREE.ShaderMaterial({
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    side: THREE.BackSide,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS * 1.012, 96, 64),
    material,
  );
  shell.renderOrder = 1;
  return shell;
}

function createFlights() {
  const group = new THREE.Group();
  const flights = [];

  flightCoordinates.forEach(([from, to], index) => {
    const start = pointOnGlobe(from[0], from[1]);
    const end = pointOnGlobe(to[0], to[1]);
    // Lift an interpolated great-circle direction above the opaque surface.
    const curve = new THREE.Curve();
    curve.getPoint = (t, target = new THREE.Vector3()) => target.copy(start)
      .lerp(end, t).normalize().multiplyScalar(GLOBE_RADIUS * (1.006 + Math.sin(t * Math.PI) * (.012 + start.angleTo(end) * .035)));
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(88));
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xd2b676,
      transparent: true,
      opacity: 0.09,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    line.renderOrder = 3;
    group.add(line);

    const headGeometry = new THREE.BufferGeometry();
    headGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const headMaterial = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: headVertexShader,
      fragmentShader: headFragmentShader,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const head = new THREE.Points(headGeometry, headMaterial);
    head.renderOrder = 4;
    group.add(head);
    flights.push({ curve, head, phase: index / flightCoordinates.length });
    const nodes = new THREE.Points(
      new THREE.BufferGeometry().setFromPoints([start.clone().multiplyScalar(1.008), end.clone().multiplyScalar(1.008)]),
      new THREE.ShaderMaterial({
        uniforms: { uOpacity: { value: .45 } },
        vertexShader: headVertexShader,
        fragmentShader: headFragmentShader,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    group.add(nodes);
  });

  return { group, flights };
}

export function initializeHeroGlobe() {
  const mount = document.querySelector('.hero-globe');
  if (!mount || mount.dataset.initialized === 'true') return () => {};

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch (error) {
    console.warn('The hero globe could not start because WebGL is unavailable.', error);
    return () => {};
  }

  mount.dataset.initialized = 'true';
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.setAttribute('aria-hidden', 'true');
  mount.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
  camera.position.set(0, 0, 13.5);

  const globe = new THREE.Group();
  // Never display a featureless sphere if a required geographic texture is missing.
  globe.visible = false;
  mount.dataset.textureState = 'loading';
  globe.position.set(4.25, -2.65, 0);
  globe.scale.setScalar(1.08);
  globe.rotation.z = -0.32;
  scene.add(globe);

  globe.add(createAtmosphere());
  // Local Earth imagery from the official Three.js planet example assets.
  // Keep the surface opaque so far-side routes are correctly occluded.
  let pendingTextures = 3;
  const onTextureLoaded = () => {
    if (destroyed) return;
    pendingTextures -= 1;
    if (pendingTextures === 0) {
      globe.visible = true;
      mount.dataset.textureState = 'ready';
      render();
    }
  };
  const onTextureError = (error) => {
    if (destroyed) return;
    mount.dataset.textureState = 'error';
    console.warn('Earth texture failed to load; the decorative globe is hidden.', error);
  };
  const earthTexture = new THREE.TextureLoader().load(
    new URL('../assets/images/earth-surface.jpg', import.meta.url).href,
    onTextureLoaded, undefined, onTextureError,
  );
  const lightsTexture = new THREE.TextureLoader().load(
    new URL('../assets/images/earth-lights.png', import.meta.url).href,
    onTextureLoaded, undefined, onTextureError,
  );
  const oceanTexture = new THREE.TextureLoader().load(
    new URL('../assets/images/earth-ocean-mask.jpg', import.meta.url).href,
    onTextureLoaded, undefined, onTextureError,
  );
  [earthTexture, lightsTexture, oceanTexture].forEach((texture) => {
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  });
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS, 96, 64),
    new THREE.ShaderMaterial({
      uniforms: {
        earthMap: { value: earthTexture },
        lightsMap: { value: lightsTexture },
        oceanMap: { value: oceanTexture },
        goldColor: { value: new THREE.Color(0xd2b676) },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vUv = uv;
          vec4 p = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vView = normalize(-p.xyz);
          gl_Position = projectionMatrix * p;
        }
      `,
      fragmentShader: `
        uniform sampler2D earthMap;
        uniform sampler2D lightsMap;
        uniform sampler2D oceanMap;
        uniform vec3 goldColor;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vec3 tex = texture2D(earthMap, vUv).rgb;
          // A dedicated geographic mask preserves deserts, ice, and coastlines.
          float ocean = texture2D(oceanMap, vUv).r;
          float land = 1.0 - smoothstep(.35, .75, ocean);
          float detail = dot(tex, vec3(.3, .5, .2));
          vec3 n = normalize(vNormal);
          vec3 view = normalize(vView);
          vec3 keyDirection = normalize(vec3(-.45, .85, .3));
          float light = max(dot(n, keyDirection), 0.0);
          vec3 sea = vec3(.002, .004, .009);
          vec3 continent = vec3(.012, .019, .030) + detail * vec3(.028, .044, .068);
          vec3 color = mix(sea, continent, land) * (.34 + light * .85) * .48;
          // Restrained sky reflection and a small ocean highlight preserve surface detail.
          vec3 halfDirection = normalize(keyDirection + view);
          float reflection = max(dot(n, halfDirection), 0.0);
          float oceanGlint = pow(reflection, 100.0) * ocean;
          float skyReflection = pow(reflection, 12.0);
          color += vec3(.028, .042, .070) * skyReflection * mix(.20, .36, ocean);
          color += vec3(.24, .32, .46) * oceanGlint * .17;
          float bounce = max(dot(n, normalize(vec3(-.8, -.35, .6))), 0.0);
          color += vec3(.002, .007, .014) * bounce;
          // Real night-light geography, recolored warm gold rather than a uniform dot grid.
          vec3 night = texture2D(lightsMap, vUv).rgb;
          float cities = smoothstep(.055, .65, max(night.r, night.g));
          // THREE.Color converts the approved gold from sRGB into the shader's linear space.
          color += pow(cities, 1.2) * goldColor * land * .55;
          vec2 texel = vec2(1.0 / 2048.0, 1.0 / 1024.0);
          float nearby = texture2D(lightsMap, vUv + texel).r
            + texture2D(lightsMap, vUv - texel).r
            + texture2D(lightsMap, vUv + vec2(texel.x, -texel.y)).r
            + texture2D(lightsMap, vUv + vec2(-texel.x, texel.y)).r;
          color += smoothstep(.45, 1.9, nearby) * goldColor * .06 * land;
          // Faint geographic graticule leaves the continents visually dominant.
          vec2 grid = abs(fract(vUv * vec2(24., 12.)) - .5);
          float lines = smoothstep(.491, .499, max(grid.x, grid.y));
          color += lines * vec3(.001, .004, .008);
          float rim = pow(1.0 - max(dot(n, view), 0.0), 4.5);
          color += rim * vec3(.50, .43, .28) * (.015 + pow(light, 2.0) * .20);
          color += rim * vec3(.045, .070, .12) * (.10 + light * .55);
          // Let the lower hemisphere fall into shadow while the upper limb catches the key light.
          float falloff = smoothstep(-.65, .65, n.y);
          color *= .28 + .72 * falloff;
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }),
  );
  globe.add(surface);
  const { group: flightGroup, flights } = createFlights();
  globe.add(flightGroup);

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = new THREE.Vector2();
  const easedPointer = new THREE.Vector2();
  let elapsed = 0;
  let lastTime = performance.now();
  let frameId = 0;
  let destroyed = false;

  const render = () => renderer.render(scene, camera);

  const resize = () => {
    const { width, height } = mount.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    // Keep the globe cropped beyond the right edge as a quiet ambient backdrop.
    const isMobile = width < 768;
    const viewWidth = viewHeight * camera.aspect;
    globe.position.x = viewWidth * (isMobile ? .85 : .46);
    globe.scale.setScalar(isMobile ? .76 : 1.08);
    globe.position.y = -1.65;
    render();
  };

  const updateFlights = () => {
    flights.forEach(({ curve, head, phase }) => {
      const progress = (elapsed * 0.075 + phase) % 1;
      head.position.copy(curve.getPoint(progress));
      head.material.uniforms.uOpacity.value = Math.sin(progress * Math.PI);
    });
  };

  const tick = (time) => {
    frameId = 0;
    if (destroyed || document.hidden || motionQuery.matches) return;

    const delta = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    elapsed += delta;
    easedPointer.lerp(pointer, PARALLAX_LERP);
    globe.rotation.x = .12 + easedPointer.y * MAX_TILT;
    globe.rotation.y = -1.12 - elapsed * AUTO_ROTATION_SPEED + easedPointer.x * MAX_TILT;
    camera.position.x = easedPointer.x * MAX_CAMERA_X;
    camera.lookAt(0, 0, 0);
    updateFlights();
    render();
    frameId = requestAnimationFrame(tick);
  };

  const startAnimation = () => {
    if (frameId || destroyed || document.hidden || motionQuery.matches) return;
    lastTime = performance.now();
    frameId = requestAnimationFrame(tick);
  };

  const stopAnimation = () => {
    if (!frameId) return;
    cancelAnimationFrame(frameId);
    frameId = 0;
  };

  const handlePointerMove = (event) => {
    if (motionQuery.matches) return;
    const bounds = mount.getBoundingClientRect();
    pointer.set(
      THREE.MathUtils.clamp(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1),
      THREE.MathUtils.clamp(-(((event.clientY - bounds.top) / bounds.height) * 2 - 1), -1, 1),
    );
  };

  const handlePointerLeave = () => pointer.set(0, 0);
  const handleVisibility = () => {
    if (document.hidden) stopAnimation();
    else startAnimation();
  };
  const handleMotionPreference = () => {
    if (motionQuery.matches) {
      stopAnimation();
      render();
    } else {
      startAnimation();
    }
  };

  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
  const header = mount.closest('header');
  resizeObserver?.observe(mount);
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  header?.addEventListener('pointerleave', handlePointerLeave);
  document.addEventListener('visibilitychange', handleVisibility);
  motionQuery.addEventListener?.('change', handleMotionPreference);

  globe.rotation.y = -1.12;
  globe.rotation.x = .12;
  resize();
  updateFlights();
  render();
  startAnimation();

  return () => {
    destroyed = true;
    stopAnimation();
    resizeObserver?.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', handlePointerMove);
    header?.removeEventListener('pointerleave', handlePointerLeave);
    document.removeEventListener('visibilitychange', handleVisibility);
    motionQuery.removeEventListener?.('change', handleMotionPreference);
    scene.traverse((object) => {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose());
      } else {
        object.material?.dispose();
      }
    });
    earthTexture.dispose();
    lightsTexture.dispose();
    oceanTexture.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    delete mount.dataset.initialized;
    delete mount.dataset.textureState;
  };
}
