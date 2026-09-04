import * as THREE from './vendor/three.module.min.js';

const GLOBE_RADIUS = 5;
const POINT_COUNT = 2600;
const AUTO_ROTATION_SPEED = 0.055;
const PARALLAX_LERP = 0.035;
const MAX_TILT = 0.16;
const MAX_CAMERA_X = 1.1;

const pointVertexShader = `
  attribute float aAccent;
  attribute float aPhase;
  varying float vAccent;
  varying float vFacing;
  varying float vPhase;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 viewNormal = normalize(normalMatrix * normalize(position));
    vec3 viewDirection = normalize(-viewPosition.xyz);
    vAccent = aAccent;
    vFacing = dot(viewNormal, viewDirection);
    vPhase = aPhase;
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = mix(1.7, 3.35, aAccent) * min(2.0, 12.0 / -viewPosition.z);
  }
`;

const pointFragmentShader = `
  uniform float uTime;
  uniform vec3 uAccentColor;
  varying float vAccent;
  varying float vFacing;
  varying float vPhase;

  void main() {
    float distanceFromCenter = length(gl_PointCoord - vec2(0.5));
    float disc = 1.0 - smoothstep(0.34, 0.5, distanceFromCenter);
    float hemisphere = mix(0.08, 0.82, smoothstep(-0.2, 0.42, vFacing));
    float pulse = 0.84 + 0.16 * sin(uTime * 1.0 + vPhase);
    vec3 paleBlue = vec3(0.72, 0.91, 1.0);
    vec3 accentOrange = uAccentColor * pulse;
    vec3 color = mix(paleBlue, accentOrange, vAccent);
    float alpha = disc * hemisphere * mix(0.62, 0.94, vAccent);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

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
    float rim = pow(1.0 - abs(dot(vViewNormal, vViewDirection)), 2.8);
    gl_FragColor = vec4(0.34, 0.79, 1.0, rim * 0.23);
  }
`;

const headVertexShader = `
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = min(6.0, 36.0 / -viewPosition.z);
  }
`;

const headFragmentShader = `
  uniform float uOpacity;
  void main() {
    float distanceFromCenter = length(gl_PointCoord - vec2(0.5));
    float glow = 1.0 - smoothstep(0.08, 0.5, distanceFromCenter);
    if (glow < 0.01) discard;
    gl_FragColor = vec4(1.0, 0.52, 0.24, glow * uOpacity);
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

function createGlobePoints() {
  const positions = new Float32Array(POINT_COUNT * 3);
  const accents = new Float32Array(POINT_COUNT);
  const phases = new Float32Array(POINT_COUNT);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let index = 0; index < POINT_COUNT; index += 1) {
    const y = 1 - (index / (POINT_COUNT - 1)) * 2;
    const ringRadius = Math.sqrt(1 - y * y);
    const theta = goldenAngle * index;
    const offset = index * 3;
    positions[offset] = Math.cos(theta) * ringRadius * GLOBE_RADIUS;
    positions[offset + 1] = y * GLOBE_RADIUS;
    positions[offset + 2] = Math.sin(theta) * ringRadius * GLOBE_RADIUS;
    accents[index] = index % 33 === 0 ? 1 : 0;
    phases[index] = (index * 2.399963) % (Math.PI * 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aAccent', new THREE.BufferAttribute(accents, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAccentColor: { value: new THREE.Color('#ff7a33') },
    },
    vertexShader: pointVertexShader,
    fragmentShader: pointFragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.renderOrder = 2;
  return points;
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
    new THREE.SphereGeometry(GLOBE_RADIUS * 1.14, 64, 40),
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
    const angle = start.angleTo(end);
    const control = start.clone().add(end).normalize().multiplyScalar(
      GLOBE_RADIUS * (1.17 + angle * 0.24),
    );
    const curve = new THREE.QuadraticBezierCurve3(start, control, end);
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(88));
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x8be5ff,
      transparent: true,
      opacity: 0.11,
      depthTest: false,
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
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const head = new THREE.Points(headGeometry, headMaterial);
    head.renderOrder = 4;
    group.add(head);
    flights.push({ curve, head, phase: index / flightCoordinates.length });
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
  globe.position.set(4.25, -2.65, 0);
  globe.rotation.z = 0.36;
  scene.add(globe);

  const globePoints = createGlobePoints();
  globe.add(createAtmosphere(), globePoints);
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
    globe.position.x = width < 768 ? 1.55 : width < 1050 ? 3.2 : 4.25;
    globe.position.y = width < 768 ? -3.35 : -2.65;
    render();
  };

  const updateFlights = () => {
    flights.forEach(({ curve, head, phase }) => {
      const progress = (elapsed * 0.075 + phase) % 1;
      head.position.copy(curve.getPoint(progress));
      head.material.uniforms.uOpacity.value = Math.sin(progress * Math.PI) * 0.78;
    });
  };

  const tick = (time) => {
    frameId = 0;
    if (destroyed || document.hidden || motionQuery.matches) return;

    const delta = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    elapsed += delta;
    easedPointer.lerp(pointer, PARALLAX_LERP);
    globe.rotation.x = easedPointer.y * MAX_TILT;
    globe.rotation.y = elapsed * AUTO_ROTATION_SPEED + easedPointer.x * MAX_TILT;
    camera.position.x = easedPointer.x * MAX_CAMERA_X;
    camera.lookAt(0, 0, 0);
    globePoints.material.uniforms.uTime.value = elapsed;
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
    renderer.dispose();
    renderer.domElement.remove();
    delete mount.dataset.initialized;
  };
}
