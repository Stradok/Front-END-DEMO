/* ==========================================================================
   Fragmented Orb — live WebGL hero visual.
   The 3D object itself is ported from fragmented-orb (1)/ (a newer AI-Studio
   export: procedural Arc Reactor core, studio-lit environment map, post-
   process bloom, streamlined panel geometry) — swapped in wholesale to
   replace the simpler sphere/corona/glow-sprite version this started from.
   Everything below the object itself — the scroll-jack, orbit-drag, and
   shard-drag interaction layer — is unchanged from before.
   ========================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

(function () {
  'use strict';

  const container = document.getElementById('gvOrbCanvas');
  if (!container) return;

  const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isNarrow = window.matchMedia('(max-width: 768px)').matches;

  let gl = null;
  try {
    const testCanvas = document.createElement('canvas');
    gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
  } catch (e) { gl = null; }
  if (!gl) return; // .gv-fallback-field stays visible behind — page never breaks

  const THEME = {
    coreInner: '#ffffff',
    coreOuter: '#ff001e',
    glowColor: '#ff002b',
    shellExterior: '#0b0c0f',
    ambientLight: '#120204',
    lightIntensity: 4.8,
  };

  const width = container.clientWidth;
  const height = container.clientHeight;

  const scene = new THREE.Scene();
  const baseFogColor = new THREE.Color(0x000000);
  const leakedFogColor = new THREE.Color(0x180205);
  scene.fog = new THREE.FogExp2(0x000000, 0.04);

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.set(0, 2.5, 10.5);

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isNarrow ? 1.25 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98; // balanced to avoid clipping the arc reactor's hot core
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 1);
  container.appendChild(renderer.domElement);

  // ---- studio reflection environment (canvas-baked equirect -> PMREM) ----
  // A metallic shell with nothing to reflect just renders near-black — this
  // is what actually gives the panels visible highlights/edge contours.
  function createStudioEnvironment() {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const w = 1024, h = 512;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    const keySoftbox = ctx.createRadialGradient(280, 110, 0, 280, 110, 140);
    keySoftbox.addColorStop(0, 'rgba(255,255,255,0.95)');
    keySoftbox.addColorStop(0.25, 'rgba(210,225,245,0.7)');
    keySoftbox.addColorStop(0.6, 'rgba(120,150,190,0.2)');
    keySoftbox.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = keySoftbox;
    ctx.fillRect(0, 0, w, h);

    const rimStrip = ctx.createLinearGradient(740, 0, 840, 0);
    rimStrip.addColorStop(0, 'rgba(0,0,0,0)');
    rimStrip.addColorStop(0.5, 'rgba(190,215,255,0.65)');
    rimStrip.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = rimStrip;
    ctx.fillRect(740, 80, 100, 320);

    const coolRim = ctx.createRadialGradient(880, 180, 0, 880, 180, 120);
    coolRim.addColorStop(0, 'rgba(140,180,230,0.45)');
    coolRim.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = coolRim;
    ctx.fillRect(760, 60, 240, 240);

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    texture.dispose();
    pmremGenerator.dispose();
    return envMap;
  }
  scene.environment = createStudioEnvironment();

  // ---- post-processing: bloom, tuned low/tight so only the hottest core
  // and glowing conduits actually bloom, not the whole scene ----
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.82, 0.45, 0.82);
  composer.addPass(bloomPass);

  // ---- shell panel material: precision titanium/gunmetal with clearcoat
  // and a subtle warm emissive so panels facing the core aren't pure black
  // even in shadow ----
  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(THEME.shellExterior),
    metalness: 0.88,
    roughness: 0.24,
    clearcoat: 0.35,
    clearcoatRoughness: 0.18,
    envMapIntensity: 2.6,
    emissive: new THREE.Color(0x180306),
    emissiveIntensity: 0.5,
    side: THREE.DoubleSide,
  });

  // ---- streamlined panel geometry: fewer, larger, precision-curved panels
  // with a slight margin gap between them for clean seams ----
  function addQuadWall(p1, p2, p3, p4, centroid, positions, normals, uvs, indices) {
    const v1 = p1.clone().sub(centroid);
    const v2 = p2.clone().sub(centroid);
    const v3 = p3.clone().sub(centroid);
    const v4 = p4.clone().sub(centroid);
    const normal = new THREE.Vector3().crossVectors(v2.clone().sub(v1), v4.clone().sub(v1)).normalize();
    const idx = positions.length / 3;
    positions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z, v4.x, v4.y, v4.z);
    normals.push(normal.x, normal.y, normal.z, normal.x, normal.y, normal.z, normal.x, normal.y, normal.z, normal.x, normal.y, normal.z);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
  }

  function generateSphericalFragments(outerRadius, innerRadius, latSegments, lonSegments, material) {
    const group = new THREE.Group();
    const fragments = [];

    for (let lat = 0; lat < latSegments; lat++) {
      const theta1 = (lat / latSegments) * Math.PI;
      const theta2 = ((lat + 1) / latSegments) * Math.PI;
      const rowSlices = Math.max(3, Math.round(lonSegments * Math.sin((theta1 + theta2) / 2)));

      for (let lon = 0; lon < rowSlices; lon++) {
        const phi1 = (lon / rowSlices) * Math.PI * 2;
        const phi2 = ((lon + 1) / rowSlices) * Math.PI * 2;
        const sub = 6;

        const positions = [], normals = [], uvs = [], indices = [];
        const outerVerts = [], innerVerts = [];

        // slight gap between adjacent panels when assembled, for clean seams
        const marginTheta = (theta2 - theta1) * 0.035;
        const marginPhi = (phi2 - phi1) * 0.035;
        const tStart = theta1 + marginTheta, tEnd = theta2 - marginTheta;
        const pStart = phi1 + marginPhi, pEnd = phi2 - marginPhi;

        for (let i = 0; i <= sub; i++) {
          outerVerts[i] = []; innerVerts[i] = [];
          const t = tStart + (tEnd - tStart) * (i / sub);
          for (let j = 0; j <= sub; j++) {
            const p = pStart + (pEnd - pStart) * (j / sub);
            outerVerts[i][j] = new THREE.Vector3(outerRadius * Math.sin(t) * Math.cos(p), outerRadius * Math.cos(t), outerRadius * Math.sin(t) * Math.sin(p));
            innerVerts[i][j] = new THREE.Vector3(innerRadius * Math.sin(t) * Math.cos(p), innerRadius * Math.cos(t), innerRadius * Math.sin(t) * Math.sin(p));
          }
        }

        const centroid = new THREE.Vector3();
        let totalV = 0;
        for (let i = 0; i <= sub; i++) for (let j = 0; j <= sub; j++) { centroid.add(outerVerts[i][j]); totalV++; }
        centroid.divideScalar(totalV);

        const geom = new THREE.BufferGeometry();

        for (let i = 0; i < sub; i++) {
          for (let j = 0; j < sub; j++) {
            const v0 = outerVerts[i][j].clone().sub(centroid);
            const v1 = outerVerts[i + 1][j].clone().sub(centroid);
            const v2 = outerVerts[i + 1][j + 1].clone().sub(centroid);
            const v3 = outerVerts[i][j + 1].clone().sub(centroid);
            const idx = positions.length / 3;
            positions.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);
            const n0 = outerVerts[i][j].clone().normalize(), n1 = outerVerts[i + 1][j].clone().normalize(), n2 = outerVerts[i + 1][j + 1].clone().normalize(), n3 = outerVerts[i][j + 1].clone().normalize();
            normals.push(n0.x, n0.y, n0.z, n1.x, n1.y, n1.z, n2.x, n2.y, n2.z, n3.x, n3.y, n3.z);
            uvs.push(j / sub, i / sub, j / sub, (i + 1) / sub, (j + 1) / sub, (i + 1) / sub, (j + 1) / sub, i / sub);
            indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
          }
        }

        for (let i = 0; i < sub; i++) {
          for (let j = 0; j < sub; j++) {
            const v0 = innerVerts[i][j].clone().sub(centroid);
            const v1 = innerVerts[i + 1][j].clone().sub(centroid);
            const v2 = innerVerts[i + 1][j + 1].clone().sub(centroid);
            const v3 = innerVerts[i][j + 1].clone().sub(centroid);
            const idx = positions.length / 3;
            positions.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);
            const n0 = innerVerts[i][j].clone().normalize().negate(), n1 = innerVerts[i + 1][j].clone().normalize().negate(), n2 = innerVerts[i + 1][j + 1].clone().normalize().negate(), n3 = innerVerts[i][j + 1].clone().normalize().negate();
            normals.push(n0.x, n0.y, n0.z, n1.x, n1.y, n1.z, n2.x, n2.y, n2.z, n3.x, n3.y, n3.z);
            uvs.push(j / sub, i / sub, j / sub, (i + 1) / sub, (j + 1) / sub, (i + 1) / sub, (j + 1) / sub, i / sub);
            indices.push(idx, idx + 2, idx + 1, idx, idx + 3, idx + 2);
          }
        }

        for (let j = 0; j < sub; j++) {
          addQuadWall(outerVerts[0][j], outerVerts[0][j + 1], innerVerts[0][j + 1], innerVerts[0][j], centroid, positions, normals, uvs, indices);
          addQuadWall(outerVerts[sub][j + 1], outerVerts[sub][j], innerVerts[sub][j], innerVerts[sub][j + 1], centroid, positions, normals, uvs, indices);
        }
        for (let i = 0; i < sub; i++) {
          addQuadWall(outerVerts[i + 1][0], outerVerts[i][0], innerVerts[i][0], innerVerts[i + 1][0], centroid, positions, normals, uvs, indices);
          addQuadWall(outerVerts[i][sub], outerVerts[i + 1][sub], innerVerts[i + 1][sub], innerVerts[i][sub], centroid, positions, normals, uvs, indices);
        }

        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geom.setIndex(indices);

        const mesh = new THREE.Mesh(geom, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.copy(centroid);
        const direction = centroid.clone().normalize();
        const rotAxis = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).normalize();
        const maxDist = 1.3 + Math.random() * 1.4;
        const rotRate = (0.18 + Math.random() * 0.35) * (Math.random() > 0.5 ? 1 : -1);
        const phase = Math.random() * 0.2;

        group.add(mesh);
        fragments.push({
          mesh, direction, basePosition: centroid.clone(), baseQuaternion: mesh.quaternion.clone(),
          rotationAxis: rotAxis, rotationRate: rotRate, maxDisplacement: maxDist, phaseOffset: phase,
          // manual drag state — layered on top of the phase-driven position, not
          // replacing it, so a dragged shard still animates in/out with the rest
          userOffset: new THREE.Vector3(), userGrabbed: false,
        });
      }
    }
    return { group, fragments };
  }

  const { group: shellGroup, fragments } = generateSphericalFragments(2.05, 1.78, 5, 10, shellMaterial);
  scene.add(shellGroup);

  // ---- procedural Arc Reactor core: radial-falloff plasma shader, chrome
  // condenser rings, and 12x3 copper induction coils per ring plane ----
  function createArcReactor() {
    const group = new THREE.Group();

    const heavyTitaniumMat = new THREE.MeshStandardMaterial({ color: 0x161a22, metalness: 0.94, roughness: 0.22, envMapIntensity: 2.6 });
    const tungstenArmorMat = new THREE.MeshStandardMaterial({ color: 0x0e1116, metalness: 0.92, roughness: 0.35, envMapIntensity: 2.0 });
    const chromeTrimMat = new THREE.MeshStandardMaterial({ color: 0xccd4e0, metalness: 0.98, roughness: 0.12, envMapIntensity: 3.2 });
    const solidCopperMat = new THREE.MeshStandardMaterial({ color: 0xd4622b, metalness: 0.92, roughness: 0.25, envMapIntensity: 2.2 });
    const darkCeramicMat = new THREE.MeshStandardMaterial({ color: 0x1c1416, metalness: 0.4, roughness: 0.5 });

    const corePlasmaColor = new THREE.Color(THEME.glowColor);
    const coreOuterColor = new THREE.Color(THEME.coreOuter);

    const coreShaderGeo = new THREE.SphereGeometry(0.72, 48, 48);
    const coreShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        innerColor: { value: new THREE.Color(0xffffff) },
        midColor: { value: new THREE.Color('#ff1838') },
        edgeColor: { value: coreOuterColor },
        time: { value: 0.0 },
        expansion: { value: 0.0 },
      },
      vertexShader: `varying vec3 vNormal; varying vec3 vPosition; varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vPosition = position;
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }`,
      fragmentShader: `uniform vec3 innerColor; uniform vec3 midColor; uniform vec3 edgeColor; uniform float time; uniform float expansion;
        varying vec3 vNormal; varying vec3 vPosition; varying vec3 vViewDir;
        void main() {
          float viewDot = max(0.0, dot(vNormal, vViewDir));
          float shimmer = 0.03 * sin(vPosition.y * 12.0 + time * 4.0) * cos(vPosition.x * 12.0 + time * 3.0);
          float falloff = clamp(pow(viewDot, 1.8) + shimmer, 0.0, 1.0);
          vec3 col = mix(edgeColor * 0.85, midColor * 1.8, smoothstep(0.0, 0.55, falloff));
          col = mix(col, innerColor * 2.2, smoothstep(0.55, 1.0, falloff));
          gl_FragColor = vec4(col, 1.0);
        }`,
      toneMapped: true,
    });
    const centralCoreMesh = new THREE.Mesh(coreShaderGeo, coreShaderMat);
    group.add(centralCoreMesh);

    const densePlasmaGeo = new THREE.SphereGeometry(0.86, 36, 36);
    const densePlasmaMat = new THREE.MeshStandardMaterial({ color: coreOuterColor, emissive: corePlasmaColor, emissiveIntensity: 1.4, transparent: true, opacity: 0.65, roughness: 0.1, metalness: 0.3 });
    const densePlasma = new THREE.Mesh(densePlasmaGeo, densePlasmaMat);
    group.add(densePlasma);

    const lensStackGroup = new THREE.Group();
    for (let l = 0; l < 4; l++) {
      const lensRadius = 0.56 + l * 0.11;
      const lensTube = 0.042 + l * 0.008;
      const stepTorusGeo = new THREE.TorusGeometry(lensRadius, lensTube, 16, 48);
      const stepTorus = new THREE.Mesh(stepTorusGeo, chromeTrimMat);
      stepTorus.rotation.x = Math.PI / 2;
      lensStackGroup.add(stepTorus);
      lensStackGroup.add(new THREE.Mesh(stepTorusGeo, heavyTitaniumMat));
    }
    group.add(lensStackGroup);

    const ringAssemblies = [];
    const orientations = [new THREE.Euler(0, 0, 0), new THREE.Euler(Math.PI / 2, 0, 0), new THREE.Euler(0, Math.PI / 2, 0)];

    orientations.forEach(function (euler, planeIdx) {
      const ringGroup = new THREE.Group();
      ringGroup.rotation.copy(euler);
      const radius = 1.30;

      ringGroup.add(new THREE.Mesh(new THREE.TorusGeometry(radius, 0.085, 20, 72), heavyTitaniumMat));
      ringGroup.add(new THREE.Mesh(new THREE.TorusGeometry(radius - 0.13, 0.05, 16, 64), tungstenArmorMat));

      const glowRingMat = new THREE.MeshBasicMaterial({ color: corePlasmaColor });
      const glowRing = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.065, 0.028, 12, 64), glowRingMat);
      ringGroup.add(glowRing);

      const stator = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.22, 0.036, 16, 56), chromeTrimMat);
      ringGroup.add(stator);

      const coilsGroup = new THREE.Group();
      const coilCount = 12;
      const coilBlockGeo = new THREE.BoxGeometry(0.16, 0.2, 0.15);
      const clampGeo = new THREE.BoxGeometry(0.08, 0.24, 0.18);
      const corePinGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8);

      for (let c = 0; c < coilCount; c++) {
        const angle = (c / coilCount) * Math.PI * 2;
        const singleCoil = new THREE.Group();
        singleCoil.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
        singleCoil.rotation.z = angle + Math.PI / 2;

        singleCoil.add(new THREE.Mesh(coilBlockGeo, solidCopperMat));
        singleCoil.add(new THREE.Mesh(clampGeo, tungstenArmorMat));

        const ceramicMesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.035, 0.13), darkCeramicMat);
        ceramicMesh.position.y = -0.1;
        singleCoil.add(ceramicMesh);

        const pinMesh = new THREE.Mesh(corePinGeo, chromeTrimMat);
        pinMesh.rotation.x = Math.PI / 2;
        singleCoil.add(pinMesh);

        coilsGroup.add(singleCoil);
      }
      ringGroup.add(coilsGroup);
      group.add(ringGroup);

      ringAssemblies.push({ ringGroup, stator, rotSpeed: (planeIdx === 1 ? -0.16 : 0.2) * (planeIdx === 2 ? 0.8 : 1.0) });
    });

    return {
      group: group,
      update: function (time, expansion) {
        coreShaderMat.uniforms.time.value = time;
        coreShaderMat.uniforms.expansion.value = expansion;
        const pulse = 1.0 + Math.sin(time * 3.6) * 0.02 + expansion * 0.05;
        centralCoreMesh.scale.setScalar(pulse);
        densePlasma.scale.setScalar(1.0 + Math.sin(time * 4.0) * 0.03 + expansion * 0.07);
        ringAssemblies.forEach(function (a) {
          a.ringGroup.rotation.z += a.rotSpeed * 0.01;
          a.stator.rotation.z -= a.rotSpeed * 0.014;
        });
        lensStackGroup.rotation.y = time * 0.08;
        lensStackGroup.rotation.z = Math.sin(time * 0.12) * 0.08;
      },
    };
  }
  const arcReactor = createArcReactor();
  scene.add(arcReactor.group);

  // ---- ambient optical glare: sprite-based bloom/haze that fills the void
  // as the shell opens, no geometric beam objects ----
  function createAmbientGlare() {
    const group = new THREE.Group();
    const themeColor = new THREE.Color(THEME.glowColor);

    function makeGlareTexture(size, stops) {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      stops.forEach(function (s) { grad.addColorStop(s[0], s[1]); });
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      return new THREE.CanvasTexture(c);
    }

    const coreTex = makeGlareTexture(512, [[0, 'rgba(255,255,255,1.0)'], [0.12, 'rgba(255,20,40,0.95)'], [0.35, 'rgba(230,0,30,0.55)'], [0.65, 'rgba(180,0,20,0.18)'], [1.0, 'rgba(0,0,0,0)']]);
    const coreGlareMat = new THREE.SpriteMaterial({ map: coreTex, color: themeColor, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.85, depthWrite: false });
    const coreGlareSprite = new THREE.Sprite(coreGlareMat);
    coreGlareSprite.scale.set(4.8, 4.8, 1);
    group.add(coreGlareSprite);

    const wideTex = makeGlareTexture(512, [[0, 'rgba(255,10,30,0.6)'], [0.4, 'rgba(200,0,20,0.25)'], [0.75, 'rgba(120,0,15,0.08)'], [1.0, 'rgba(0,0,0,0)']]);
    const wideGlareMat = new THREE.SpriteMaterial({ map: wideTex, color: themeColor, transparent: true, blending: THREE.AdditiveBlending, opacity: 0, depthWrite: false });
    const wideGlareSprite = new THREE.Sprite(wideGlareMat);
    wideGlareSprite.scale.set(13.0, 13.0, 1);
    group.add(wideGlareSprite);

    const streakCanvas = document.createElement('canvas');
    streakCanvas.width = 512; streakCanvas.height = 128;
    const sctx = streakCanvas.getContext('2d');
    const streakGrad = sctx.createRadialGradient(256, 64, 0, 256, 64, 256);
    streakGrad.addColorStop(0, 'rgba(255,230,240,0.9)');
    streakGrad.addColorStop(0.2, 'rgba(255,30,60,0.6)');
    streakGrad.addColorStop(0.6, 'rgba(200,0,30,0.15)');
    streakGrad.addColorStop(1.0, 'rgba(0,0,0,0)');
    sctx.fillStyle = streakGrad;
    sctx.fillRect(0, 0, 512, 128);
    const streakTex = new THREE.CanvasTexture(streakCanvas);
    const streakMat = new THREE.SpriteMaterial({ map: streakTex, color: themeColor, transparent: true, blending: THREE.AdditiveBlending, opacity: 0, depthWrite: false });
    const streakSprite = new THREE.Sprite(streakMat);
    streakSprite.scale.set(16.0, 1.4, 1);
    group.add(streakSprite);

    return {
      group: group,
      update: function (time, expansion) {
        const pulse = 1.0 + Math.sin(time * 3.2) * 0.04;
        const leakExposure = Math.max(0, (expansion - 0.03) / 0.97);

        coreGlareSprite.scale.set((4.5 + leakExposure * 2.8) * pulse, (4.5 + leakExposure * 2.8) * pulse, 1);
        coreGlareMat.opacity = 0.85 + leakExposure * 0.15;

        wideGlareMat.opacity = Math.pow(leakExposure, 1.2) * 0.65;
        wideGlareSprite.scale.set(12.0 + leakExposure * 6.0, 12.0 + leakExposure * 6.0, 1);

        streakMat.opacity = Math.pow(leakExposure, 1.5) * 0.75;
        streakSprite.scale.set((14.0 + leakExposure * 8.0) * (1.0 + Math.sin(time * 2.5) * 0.03), 1.2 + leakExposure * 1.6, 1);
      },
    };
  }
  const ambientGlare = createAmbientGlare();
  scene.add(ambientGlare.group);

  // ---- lighting rig ----
  const coreLight = new THREE.PointLight(THEME.coreOuter, 3.4, 20, 2.0);
  coreLight.castShadow = true;
  coreLight.shadow.bias = -0.002;
  scene.add(coreLight);
  const ambientWashLight = new THREE.PointLight(THEME.glowColor, 0.4, 16, 1.8);
  scene.add(ambientWashLight);
  const keyRimLight = new THREE.DirectionalLight(0xdde5f0, 1.8);
  keyRimLight.position.set(7, 10, 8);
  scene.add(keyRimLight);
  const fillRimLight = new THREE.DirectionalLight(new THREE.Color(THEME.ambientLight), 1.8);
  fillRimLight.position.set(-8, -5, -7);
  scene.add(fillRimLight);
  const underBounceLight = new THREE.DirectionalLight(0x350810, 1.2);
  underBounceLight.position.set(0, -6, 2);
  scene.add(underBounceLight);
  const ambientLight = new THREE.AmbientLight(0x0a0c10, 0.45);
  scene.add(ambientLight);

  // ---- particle dust ----
  const particleCount = isNarrow ? 1200 : 1800;
  const particleGeo = new THREE.BufferGeometry();
  const particlePositions = new Float32Array(particleCount * 3);
  const particleVelocities = new Float32Array(particleCount * 3);
  const particleScales = new Float32Array(particleCount);
  const particleRandoms = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    const radius = 0.9 + Math.pow(Math.random(), 0.75) * 5.2;
    const u = Math.random(), v = Math.random();
    const theta = u * 2.0 * Math.PI, phi = Math.acos(2.0 * v - 1.0);
    const sinPhi = Math.sin(phi);
    const x = radius * sinPhi * Math.cos(theta), y = radius * sinPhi * Math.sin(theta), z = radius * Math.cos(phi);
    particlePositions[i * 3] = x; particlePositions[i * 3 + 1] = y; particlePositions[i * 3 + 2] = z;
    particleVelocities[i * 3] = (Math.random() - 0.5) * 0.004 + (-y * 0.0022);
    particleVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.004 + (x * 0.0022);
    particleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.0035;
    particleScales[i] = 0.8 + Math.random() * 2.5;
    particleRandoms[i] = Math.random() * 10.0;
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  particleGeo.setAttribute('aScale', new THREE.BufferAttribute(particleScales, 1));
  particleGeo.setAttribute('aRandom', new THREE.BufferAttribute(particleRandoms, 1));

  const particleShaderMat = new THREE.ShaderMaterial({
    uniforms: {
      coreColor: { value: new THREE.Color(THEME.coreOuter) },
      glowColor: { value: new THREE.Color(THEME.glowColor) },
      ambientColor: { value: new THREE.Color(0x3a4856) },
      expansion: { value: 0.0 },
      time: { value: 0.0 },
    },
    vertexShader: `attribute float aScale; attribute float aRandom; uniform float time; uniform float expansion;
      varying vec3 vWorldPos; varying float vDist; varying float vRandom;
      void main() {
        vRandom = aRandom;
        vec3 pos = position;
        pos.x += sin(time * 0.4 + aRandom) * 0.09;
        pos.y += cos(time * 0.35 + aRandom * 1.3) * 0.09;
        pos.z += sin(time * 0.45 + aRandom * 2.1) * 0.09;
        vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
        vDist = length(pos);
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aScale * (20.0 / -mvPosition.z) * (1.0 + sin(time * 1.8 + aRandom) * 0.3);
        gl_Position = projectionMatrix * mvPosition;
      }`,
    fragmentShader: `uniform vec3 coreColor; uniform vec3 glowColor; uniform vec3 ambientColor; uniform float expansion;
      varying vec3 vWorldPos; varying float vDist; varying float vRandom;
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, dist);
        float coreIntensity = 1.0 / (1.0 + vDist * vDist * 0.3);
        float ambientWash = clamp(coreIntensity * 1.5 + expansion * 0.6, 0.0, 1.0);
        vec3 col = mix(ambientColor * 0.3, coreColor * 2.5, ambientWash);
        col = mix(col, glowColor * 3.2, pow(coreIntensity, 1.5));
        gl_FragColor = vec4(col, alpha * (0.45 + coreIntensity * 0.5 + expansion * 0.25));
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const particleSystem = new THREE.Points(particleGeo, particleShaderMat);
  scene.add(particleSystem);

  // ---- resize ----
  const resizeObserver = new ResizeObserver(function () {
    const w = container.clientWidth, h = container.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloomPass.resolution.set(w, h);
  });
  resizeObserver.observe(container);

  // ---- scroll-jack: wheel input over the orb drives the disassembly
  // animation directly and the page does not move; once fully disassembled
  // the lock releases and normal scrolling resumes. Wheel input NOT over
  // the orb (or once already released) passes straight through untouched.
  const heroCopy = document.getElementById('gvHeroCopy');
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  // Hidden the moment we know this script is actually running (WebGL check
  // above already passed) — `release()` below brings it back, either
  // instantly (touch/reduced-motion/scrolled-past-orb) or with a fade once
  // the disassembly finishes. If the module never got this far, it was
  // never touched and stays at its default full visibility.
  if (heroCopy) {
    heroCopy.style.opacity = '0';
    heroCopy.style.transform = 'translateY(16px)';
  }

  let orbProgress = 0;   // 0..1, driven by wheel deltaY while locked
  let locked = true;     // still intercepting wheel input to play the intro
  let released = false;  // intro is over — wheel/scroll behave normally from here on

  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

  function revealHeroCopy(animated) {
    if (!heroCopy) return;
    if (animated) {
      heroCopy.style.transition = 'opacity 0.9s cubic-bezier(0.16,1,0.3,1), transform 0.9s cubic-bezier(0.16,1,0.3,1)';
    } else {
      heroCopy.style.transition = 'none';
    }
    heroCopy.style.opacity = '1';
    heroCopy.style.transform = 'translateY(0)';
  }

  function release(opts) {
    if (released) return;
    released = true;
    locked = false;
    orbProgress = 1;
    revealHeroCopy(!(opts && opts.instant));
  }

  // Reduced-motion always skips straight to the end state — gating primary
  // content behind any animation isn't something to impose on someone who's
  // asked for less motion, and the noMotion branch in animate() never
  // reaches the reveal logic below (it returns early every frame), so this
  // has to run here.
  function autoplayIntro() {
    var duration = 2600; // ms
    var start = performance.now();
    function step(now) {
      if (released) return; // bailed out some other way mid-autoplay — don't fight it
      var t = Math.min(1, (now - start) / duration);
      orbProgress = t;
      if (t < 1) requestAnimationFrame(step);
      else release();
    }
    requestAnimationFrame(step);
  }

  if (noMotion) {
    release({ instant: true });
  } else if (!finePointer) {
    // Touch/coarse-pointer devices (mobile, tablets): wheel doesn't fire
    // reliably on a touch swipe, so scroll-jacking the intro behind it was
    // effectively skipping the animation entirely. Autoplay it once on
    // load instead — same visual intro, no gesture required — then hand
    // off to normal scrolling exactly like the desktop path does.
    autoplayIntro();
  } else {
    const onWheel = function (e) {
      if (released) return; // intro finished — let scrolling behave normally forever after
      if (window.scrollY > 2) { release({ instant: true }); return; } // got here some other way (anchor jump, etc.) — don't fight it

      const rect = container.getBoundingClientRect();
      const overOrb = e.clientX >= rect.left + rect.width * 0.22 && e.clientX <= rect.left + rect.width * 0.78
        && e.clientY >= rect.top && e.clientY <= rect.bottom;

      if (!overOrb) {
        // Scrolling from off to the side of the orb: let it through untouched,
        // no animation, page just scrolls — skip straight to the end state.
        release({ instant: true });
        return;
      }

      e.preventDefault();
      // A single standard mouse-wheel notch reports deltaY ~100-120, so this
      // divisor is tuned to finish the whole disassembly in one scroll click.
      orbProgress = Math.max(0, Math.min(1, orbProgress + e.deltaY / 110));
      if (orbProgress >= 1) release();
    };
    window.addEventListener('wheel', onWheel, { passive: false });
  }

  // ---- pointer interaction: drag empty space to orbit the camera, drag a
  // shard directly to pull it out of formation (fine-pointer only — touch
  // scrolling and shard-dragging want the same gesture, and touch scroll
  // wins). Released shards spring back toward their formation position.
  let cameraAngleY = 0.7;
  let cameraAngleX = 0.28;
  let userOrbiting = false;
  let draggedFragment = null;
  let lastPointerX = 0, lastPointerY = 0;
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  const dragPlane = new THREE.Plane();
  const dragPoint = new THREE.Vector3();
  const fragmentMeshes = fragments.map(function (f) { return f.mesh; });

  if (finePointer) {
    renderer.domElement.style.cursor = 'grab';

    renderer.domElement.addEventListener('pointerdown', function (e) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);
      const hits = raycaster.intersectObjects(fragmentMeshes, false);

      if (hits.length) {
        draggedFragment = fragments[fragmentMeshes.indexOf(hits[0].object)];
        draggedFragment.userGrabbed = true;
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        dragPlane.setFromNormalAndCoplanarPoint(camDir, hits[0].point);
        dragPoint.copy(hits[0].point);
        renderer.domElement.style.cursor = 'grabbing';
      } else {
        userOrbiting = true;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        renderer.domElement.style.cursor = 'grabbing';
      }
      renderer.domElement.setPointerCapture(e.pointerId);
    });

    renderer.domElement.addEventListener('pointermove', function (e) {
      if (draggedFragment) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointerNDC, camera);
        const hit = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(dragPlane, hit)) {
          const worldDelta = hit.clone().sub(dragPoint);
          // shellGroup keeps slowly rotating underneath — convert the drag
          // into the group's local space so the offset doesn't drift once
          // released back into a still-turning formation
          const localDelta = worldDelta.clone().applyQuaternion(shellGroup.quaternion.clone().invert());
          draggedFragment.userOffset.copy(localDelta);
        }
      } else if (userOrbiting) {
        const dx = e.clientX - lastPointerX;
        const dy = e.clientY - lastPointerY;
        cameraAngleY -= dx * 0.006;
        cameraAngleX = Math.max(-1.1, Math.min(1.1, cameraAngleX + dy * 0.006));
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
      }
    });

    const endDrag = function () {
      if (draggedFragment) draggedFragment.userGrabbed = false;
      draggedFragment = null;
      userOrbiting = false;
      renderer.domElement.style.cursor = 'grab';
    };
    renderer.domElement.addEventListener('pointerup', endDrag);
    renderer.domElement.addEventListener('pointercancel', endDrag);
  }

  let time = 0;
  let smoothedPhase = 0;
  let lastTime = performance.now();

  // ---- adaptive quality ----
  // Some machines (software WebGL, integrated GPUs, hi-dpi screens) can't hold
  // 60fps with bloom at full resolution. Watch the real frame rate and step
  // quality down until it holds: level 1 = render at 1x pixel ratio,
  // level 2 = drop bloom and shadows entirely.
  let qualityLevel = 0;
  let useBloom = true;
  let frameCount = 0;
  let frameSum = 0;
  let warmup = 1.0; // seconds to ignore after start/resume/step-down
  function renderFrame() {
    if (useBloom) composer.render(); else renderer.render(scene, camera);
  }
  function stepQualityDown() {
    qualityLevel++;
    if (qualityLevel === 1) {
      renderer.setPixelRatio(1);
      composer.setPixelRatio(1);
    } else {
      useBloom = false;
      renderer.shadowMap.enabled = false;
      scene.traverse(function (o) { if (o.material) o.material.needsUpdate = true; });
    }
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloomPass.resolution.set(w, h);
    warmup = 1.0; frameCount = 0; frameSum = 0;
  }
  function watchFrameRate(delta) {
    if (qualityLevel >= 2) return;
    if (warmup > 0) { warmup -= delta; return; }
    if (delta >= 0.1) return; // a pause/tab switch, not a slow frame
    frameSum += delta; frameCount++;
    if (frameCount >= 60) {
      if (frameCount / frameSum < 42) stepQualityDown();
      frameCount = 0; frameSum = 0;
    }
  }

  // Only render while the hero is on screen and the tab is visible —
  // otherwise bloom + particles keep burning GPU under the rest of the page.
  let heroVisible = true;
  let looping = true;
  function syncLoop() {
    const shouldRun = heroVisible && !document.hidden;
    if (shouldRun && !looping) {
      looping = true;
      lastTime = performance.now();
      warmup = 0.5;
      requestAnimationFrame(animate);
    }
  }
  new IntersectionObserver(function (entries) {
    heroVisible = entries[entries.length - 1].isIntersecting;
    syncLoop();
  }, { rootMargin: '100px 0px' }).observe(container);
  document.addEventListener('visibilitychange', syncLoop);

  function animate(now) {
    if (!heroVisible || document.hidden) { looping = false; return; }
    requestAnimationFrame(animate);
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    watchFrameRate(delta);

    if (noMotion) {
      // Static assembled orb, gentle glow breathing only — no drift, no spin.
      time += delta * 0.3;
      arcReactor.update(time, 0);
      renderFrame();
      return;
    }

    time += delta * 0.45;
    // Ease toward the wheel-driven target instead of snapping to it 1:1 —
    // this gives it weight: the orb visibly "catches up" to the scroll.
    smoothedPhase += (orbProgress - smoothedPhase) * (1 - Math.exp(-4.5 * delta));
    const expansionPhase = smoothedPhase;

    arcReactor.update(time, expansionPhase);
    ambientGlare.update(time, expansionPhase);

    particleShaderMat.uniforms.time.value = time;
    particleShaderMat.uniforms.expansion.value = expansionPhase;

    coreLight.intensity = 3.2 + expansionPhase * 2.2;
    ambientWashLight.intensity = 0.3 + expansionPhase * 1.5;
    ambientLight.intensity = 0.45 + expansionPhase * 0.3;

    if (scene.fog) {
      scene.fog.color.copy(baseFogColor).lerp(leakedFogColor, expansionPhase * 0.6);
    }

    shellGroup.rotation.y = time * 0.12;
    shellGroup.rotation.x = Math.sin(time * 0.08) * 0.12;

    for (let i = 0; i < fragments.length; i++) {
      const frag = fragments[i];
      const effectivePhase = Math.max(0, Math.min(1, expansionPhase + (frag.phaseOffset - 0.1) * 0.15 * expansionPhase));
      const displacement = frag.direction.clone().multiplyScalar(frag.maxDisplacement * effectivePhase);
      // A released shard eases its manual drag offset back to zero rather
      // than snapping — while held, userOffset is set directly by the
      // pointermove handler and left alone here.
      if (!frag.userGrabbed && (frag.userOffset.x || frag.userOffset.y || frag.userOffset.z)) {
        frag.userOffset.multiplyScalar(Math.exp(-6 * delta));
      }
      frag.mesh.position.copy(frag.basePosition).add(displacement).add(frag.userOffset);
      const rotAngle = frag.rotationRate * effectivePhase * 1.4;
      const qRot = new THREE.Quaternion().setFromAxisAngle(frag.rotationAxis, rotAngle);
      frag.mesh.quaternion.copy(frag.baseQuaternion).multiply(qRot);
    }

    const positions = particleGeo.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] += particleVelocities[i3];
      positions[i3 + 1] += particleVelocities[i3 + 1];
      positions[i3 + 2] += particleVelocities[i3 + 2];
      const distSq = positions[i3] * positions[i3] + positions[i3 + 1] * positions[i3 + 1] + positions[i3 + 2] * positions[i3 + 2];
      if (distSq > 36.0 || distSq < 0.6) {
        const newRadius = 1.2 + Math.random() * 2.8;
        const u = Math.random(), v = Math.random();
        const theta = u * 2.0 * Math.PI, phi = Math.acos(2.0 * v - 1.0);
        positions[i3] = newRadius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = newRadius * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = newRadius * Math.cos(phi);
      }
    }
    particleGeo.attributes.position.needsUpdate = true;

    // Slow, steady push-in as the orb disassembles — the same cinematic_push
    // logic from the source app. Ambient auto-orbit pauses while the visitor
    // is actively dragging the view themselves.
    const pushDistance = 11.5 - expansionPhase * 4.6;
    if (!userOrbiting) cameraAngleY += delta * 0.035;
    const camX = pushDistance * Math.sin(cameraAngleY) * Math.cos(cameraAngleX);
    const camY = pushDistance * Math.sin(cameraAngleX) + Math.sin(time * 0.2) * 0.3;
    const camZ = pushDistance * Math.cos(cameraAngleY) * Math.cos(cameraAngleX);
    camera.position.set(camX, camY, camZ);
    // Look slightly above the orb (world origin) instead of straight at it —
    // pushes the subject down into the lower part of the frame, grounded
    // near the dock, without a CSS shift that would expose an empty edge.
    camera.lookAt(0, 1.9, 0);

    renderFrame();
  }

  requestAnimationFrame(animate);
})();
