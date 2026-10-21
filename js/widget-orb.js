/* ==========================================================================
   Air widget orb — Three.js particle swarm, genuinely audio-reactive.
   Reads window.gvVoiceLevel.air (0..1), written every frame by the Web
   Audio AnalyserNode in js/livekit-widget.js from Air's actual voice track
   — this is real amplitude, not a canned CSS animation cycling through
   connected/listening/speaking states like the hero orb's mini version.
   Only renders while the widget panel is open (a MutationObserver watches
   .lk-panel's `hidden` class) so it isn't burning GPU/battery in the
   background alongside the hero's own Three.js scene.
   ========================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

(function () {
  'use strict';

  var container = document.getElementById('lkOrbCanvas');
  var panel = document.querySelector('.lk-panel');
  if (!container || !panel) return;

  var noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isNarrow = window.matchMedia('(max-width: 768px)').matches;

  var gl = null;
  try {
    var testCanvas = document.createElement('canvas');
    gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
  } catch (e) { gl = null; }
  if (!gl) return; // the CSS orb underneath stays visible — page never breaks

  window.gvVoiceLevel = window.gvVoiceLevel || { air: 0 };

  // ---- real, detectable conversational states (not fabricated emotions) —
  // classes set by js/livekit-widget.js from actual LiveKit signals:
  // lk-air-speaking (ActiveSpeakersChanged, remote), lk-user-speaking
  // (ActiveSpeakersChanged, local), lk-thinking (mic on, neither party
  // currently active — the real gap between a user's turn and Air's reply).
  // lk-mood-off-topic is a SEPARATE signal, only meaningful while speaking —
  // set from a dedicated "lk.mood" text-stream topic the agent itself would
  // need to publish to (not wired up on the agent side yet; see
  // docs/agent-system-prompt.md for what that requires). Defaults to
  // on-topic/crimson if the agent never sends anything, so nothing breaks
  // if that side isn't configured.
  // Absence of the first three = idle (not connected, or connected and silent). ----
  var widgetRoot = document.querySelector('[data-livekit-widget]');
  function getVoiceState() {
    if (!widgetRoot) return 'idle';
    if (widgetRoot.classList.contains('lk-air-speaking')) {
      return widgetRoot.classList.contains('lk-mood-off-topic') ? 'off-topic' : 'speaking';
    }
    if (widgetRoot.classList.contains('lk-user-speaking')) return 'listening';
    if (widgetRoot.classList.contains('lk-thinking')) return 'thinking';
    return 'idle';
  }

  var ACCENT_HOT = 0xff5f72;

  // Color presets per real state — a white-core-to-edge gradient whose hue
  // and reach shift per state. Listening is deliberately cool (white/blue)
  // to read as distinct from the brand's crimson "speaking about Gyraq"
  // state; off-topic is desaturated gray to read as visibly "off."
  var presets = {
    idle: { white: new THREE.Color(0x8a8a8f), mid: new THREE.Color(0x431017), edge: new THREE.Color(0x160406) },
    listening: { white: new THREE.Color(0xffffff), mid: new THREE.Color(0xbfe3ff), edge: new THREE.Color(0x2f7fd6) },
    thinking: { white: new THREE.Color(0xfff0d6), mid: new THREE.Color(0xffa542), edge: new THREE.Color(0x7a3a08) },
    speaking: { white: new THREE.Color(0xffffff), mid: new THREE.Color(ACCENT_HOT), edge: new THREE.Color(0x7a0d18) },
    'off-topic': { white: new THREE.Color(0xcfcfd6), mid: new THREE.Color(0x6b6b78), edge: new THREE.Color(0x28282e) },
  };
  // Live-blended stops — eased toward whichever preset getVoiceState()
  // currently points at, so switching states fades rather than snaps.
  var curWhite = presets.idle.white.clone();
  var curMid = presets.idle.mid.clone();
  var curEdge = presets.idle.edge.clone();
  var colorScratch = new THREE.Color();

  function gradientColorInto(out, offset, t, white, mid, edge) {
    if (t < 0.45) { colorScratch.copy(white).lerp(mid, t / 0.45); }
    else { colorScratch.copy(mid).lerp(edge, Math.min(1, (t - 0.45) / 0.55)); }
    out[offset] = colorScratch.r; out[offset + 1] = colorScratch.g; out[offset + 2] = colorScratch.b;
  }

  var width = container.clientWidth || 320;
  var height = container.clientHeight || 320;

  var scene = new THREE.Scene();
  // Fog gives the web actual depth — strands further from camera dim
  // slightly instead of every point reading at the same flat brightness.
  scene.fog = new THREE.Fog(0x000000, 3.5, 8.5);
  var camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 20);
  camera.position.set(0, 0, 6.4);

  // Deliberately opaque, not transparent: UnrealBloomPass's final composite
  // doesn't preserve canvas alpha, so alpha:true + clearAlpha 0 renders as
  // solid black anyway — just with the transparency bug making it a visibly
  // mismatched box against the panel's backdrop instead of a matched one.
  // Solid black clear + the CSS radial mask below (fading the canvas edges
  // into the backdrop) is what actually makes it blend in.
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isNarrow ? 1.5 : 2));
  renderer.setClearColor(0x000000, 1);
  container.appendChild(renderer.domElement);

  var composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  var bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.9, 0.55, 0.15);
  composer.addPass(bloomPass);

  // ---- soft circular point sprite ----
  var spriteCanvas = document.createElement('canvas');
  spriteCanvas.width = 64; spriteCanvas.height = 64;
  var sctx = spriteCanvas.getContext('2d');
  var grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 64, 64);
  var spriteTexture = new THREE.CanvasTexture(spriteCanvas);

  // ---- organic energy-web sphere (Ultron/Vision-creation style): uneven
  // density, craggy irregular silhouette (not a geometrically perfect
  // sphere), white-hot core fading to crimson at the edge, plus a handful
  // of long sweeping strands crossing the whole ball rather than only
  // short local links ----
  var COUNT = isNarrow ? 1900 : 3000;
  var RADIUS = 1.7;
  var STRAY_FRACTION = 0.09; // sparse points flung out beyond the main body — stray sparks/tendrils, not part of the dense core
  var positions = new Float32Array(COUNT * 3);
  var basePositions = new Float32Array(COUNT * 3);
  var baseRadii = new Float32Array(COUNT);
  var randoms = new Float32Array(COUNT); // per-particle phase/weight seed
  var pointColors = new Float32Array(COUNT * 3);

  for (var i = 0; i < COUNT; i++) {
    // random point on a unit sphere (not Fibonacci — even spacing is exactly
    // the "too regular" look this replaces)
    var u = Math.random(), v = Math.random();
    var theta = u * Math.PI * 2;
    var phi = Math.acos(2 * v - 1);
    var dirX = Math.sin(phi) * Math.cos(theta);
    var dirY = Math.cos(phi);
    var dirZ = Math.sin(phi) * Math.sin(theta);

    // craggy radius: low-frequency lumpiness (a few overlapping sine lobes,
    // cheap stand-in for simplex noise) plus per-point jitter, biased so
    // more points sit mid-way out than right on the surface — reads as a
    // dense tangled interior with strands reaching toward an uneven edge
    var lobes = Math.sin(dirX * 2.3 + dirY * 1.1) + Math.sin(dirY * 2.7 - dirZ * 1.6) + Math.sin(dirZ * 2.1 + dirX * 1.8);
    var craggy = 0.82 + lobes * 0.09 + (Math.random() - 0.5) * 0.16;
    var isStray = i < COUNT * STRAY_FRACTION;
    var rad;
    if (isStray) {
      // a handful of sparks reaching well past the main body's edge —
      // this is what makes the silhouette read as "spread" rather than a
      // hard-edged ball, matching the way real energy/plasma refs trail off
      rad = RADIUS * craggy * (1.05 + Math.pow(Math.random(), 1.6) * 0.85);
    } else {
      var depthBias = Math.pow(Math.random(), 1.5); // still core-weighted, but less tightly than before
      rad = RADIUS * craggy * (0.3 + depthBias * 0.85);
    }

    basePositions[i * 3] = dirX * rad;
    basePositions[i * 3 + 1] = dirY * rad;
    basePositions[i * 3 + 2] = dirZ * rad;
    baseRadii[i] = rad;
    positions[i * 3] = basePositions[i * 3];
    positions[i * 3 + 1] = basePositions[i * 3 + 1];
    positions[i * 3 + 2] = basePositions[i * 3 + 2];
    randoms[i] = Math.random();

    gradientColorInto(pointColors, i * 3, Math.min(1, rad / RADIUS), curWhite, curMid, curEdge);
  }

  var particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));
  var particleMat = new THREE.PointsMaterial({
    size: isNarrow ? 0.026 : 0.022,
    map: spriteTexture,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  var points = new THREE.Points(particleGeo, particleMat);
  scene.add(points);

  // ---- web of connections: short local links (grid-bucketed nearest
  // neighbors, cheap) PLUS a sparse set of long random strands sweeping
  // across the whole ball — the long strands are what make the Ultron
  // reference read as chaotic energy rather than a neat mesh ----
  function buildWebLines() {
    var K = 3;
    var lineIndices = [];
    var cellSize = RADIUS * 0.3;
    var grid = {};
    function key(cx, cy, cz) { return cx + '_' + cy + '_' + cz; }
    for (var p = 0; p < COUNT; p++) {
      var cx = Math.floor(basePositions[p * 3] / cellSize);
      var cy = Math.floor(basePositions[p * 3 + 1] / cellSize);
      var cz = Math.floor(basePositions[p * 3 + 2] / cellSize);
      (grid[key(cx, cy, cz)] || (grid[key(cx, cy, cz)] = [])).push(p);
    }
    for (var a = 0; a < COUNT; a++) {
      var ax = basePositions[a * 3], ay = basePositions[a * 3 + 1], az = basePositions[a * 3 + 2];
      var cx2 = Math.floor(ax / cellSize), cy2 = Math.floor(ay / cellSize), cz2 = Math.floor(az / cellSize);
      var candidates = [];
      for (var dx = -1; dx <= 1; dx++) {
        for (var dy = -1; dy <= 1; dy++) {
          for (var dz = -1; dz <= 1; dz++) {
            var bucket = grid[key(cx2 + dx, cy2 + dy, cz2 + dz)];
            if (bucket) candidates = candidates.concat(bucket);
          }
        }
      }
      candidates.sort(function (m, n) {
        var dm = Math.pow(basePositions[m * 3] - ax, 2) + Math.pow(basePositions[m * 3 + 1] - ay, 2) + Math.pow(basePositions[m * 3 + 2] - az, 2);
        var dn = Math.pow(basePositions[n * 3] - ax, 2) + Math.pow(basePositions[n * 3 + 1] - ay, 2) + Math.pow(basePositions[n * 3 + 2] - az, 2);
        return dm - dn;
      });
      var added = 0;
      for (var c2 = 0; c2 < candidates.length && added < K; c2++) {
        var b = candidates[c2];
        if (b === a) continue;
        lineIndices.push(a, b);
        added++;
      }
    }
    // sparse long strands: ~1.5% of point count, connecting far-apart pairs
    var strandCount = Math.round(COUNT * 0.015);
    for (var s = 0; s < strandCount; s++) {
      lineIndices.push(Math.floor(Math.random() * COUNT), Math.floor(Math.random() * COUNT));
    }
    return lineIndices;
  }

  var lineIndices = buildWebLines();
  var linePositions = new Float32Array(lineIndices.length * 3);
  var lineColors = new Float32Array(lineIndices.length * 3);
  var lineBaseRadii = new Float32Array(lineIndices.length);
  for (var li = 0; li < lineIndices.length; li++) {
    var lp = lineIndices[li];
    lineBaseRadii[li] = baseRadii[lp];
    gradientColorInto(lineColors, li * 3, Math.min(1, baseRadii[lp] / RADIUS), curWhite, curMid, curEdge);
  }
  var lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  lineGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
  var lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  var lines = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(lines);

  // ---- white-hot core glow ----
  var coreMat = new THREE.SpriteMaterial({
    map: spriteTexture,
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  var core = new THREE.Sprite(coreMat);
  core.scale.set(0.55, 0.55, 1);
  scene.add(core);

  var ambientLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambientLight);

  // ---- resize ----
  var resizeObserver = new ResizeObserver(function () {
    var w = container.clientWidth, h = container.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloomPass.resolution.set(w, h);
  });
  resizeObserver.observe(container);

  // ---- only render while the panel is actually open ----
  var isOpen = !panel.classList.contains('hidden');
  var mo = new MutationObserver(function () {
    var nowOpen = !panel.classList.contains('hidden');
    if (nowOpen && !isOpen) { isOpen = true; lastTime = performance.now(); requestAnimationFrame(animate); }
    isOpen = nowOpen;
  });
  mo.observe(panel, { attributes: true, attributeFilter: ['class'] });

  var time = 0;
  var smoothedLevel = 0;
  var lastTime = performance.now();

  function animate(now) {
    if (!isOpen) return; // stop the loop entirely when closed — resumes via the MutationObserver above
    requestAnimationFrame(animate);
    var delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    var targetLevel = noMotion ? 0 : Math.min(1, window.gvVoiceLevel.air || 0);
    // Fast attack, slower release — mirrors how a real VU meter reads as
    // "reactive" rather than jittery: jumps up quickly on voice, eases back
    // down between words instead of chattering with every analyser frame.
    var rate = targetLevel > smoothedLevel ? 10 : 3.2;
    smoothedLevel += (targetLevel - smoothedLevel) * (1 - Math.exp(-rate * delta));

    time += delta * (noMotion ? 0.08 : 0.35 + smoothedLevel * 0.9);

    // Ease the whole gradient's colors toward whichever real state is
    // current — a fade between moods, not an instant snap.
    var target = presets[getVoiceState()];
    var colorRate = 1 - Math.exp(-3.2 * delta);
    curWhite.lerp(target.white, colorRate);
    curMid.lerp(target.mid, colorRate);
    curEdge.lerp(target.edge, colorRate);

    var pcArr = particleGeo.attributes.color.array;
    for (var ci = 0; ci < COUNT; ci++) {
      gradientColorInto(pcArr, ci * 3, Math.min(1, baseRadii[ci] / RADIUS), curWhite, curMid, curEdge);
    }
    particleGeo.attributes.color.needsUpdate = true;

    var lcArr = lineGeo.attributes.color.array;
    for (var cl = 0; cl < lineIndices.length; cl++) {
      gradientColorInto(lcArr, cl * 3, Math.min(1, lineBaseRadii[cl] / RADIUS), curWhite, curMid, curEdge);
    }
    lineGeo.attributes.color.needsUpdate = true;

    var pos = particleGeo.attributes.position.array;
    for (var i = 0; i < COUNT; i++) {
      var seed = randoms[i];
      var bx = basePositions[i * 3], by = basePositions[i * 3 + 1], bz = basePositions[i * 3 + 2];
      var jitterAmp = 0.03 + smoothedLevel * 0.22 * (0.4 + seed * 0.6);
      pos[i * 3] = bx + Math.sin(time * 2.2 + seed * 30) * jitterAmp;
      pos[i * 3 + 1] = by + Math.cos(time * 2.0 + seed * 22) * jitterAmp;
      pos[i * 3 + 2] = bz + Math.sin(time * 1.8 + seed * 17) * jitterAmp;
    }
    particleGeo.attributes.position.needsUpdate = true;

    var linePos = lineGeo.attributes.position.array;
    for (var l = 0; l < lineIndices.length; l++) {
      var idx = lineIndices[l];
      linePos[l * 3] = pos[idx * 3];
      linePos[l * 3 + 1] = pos[idx * 3 + 1];
      linePos[l * 3 + 2] = pos[idx * 3 + 2];
    }
    lineGeo.attributes.position.needsUpdate = true;

    var scale = 1.0 + smoothedLevel * 0.18;
    points.scale.setScalar(scale);
    lines.scale.setScalar(scale);
    points.rotation.y = time * 0.25;
    points.rotation.x = Math.sin(time * 0.15) * 0.15;
    lines.rotation.copy(points.rotation);

    // A slow breathing pulse while "thinking" — the real processing-gap
    // state — reads as pending/working, distinct from the audio-reactive
    // flicker that only applies while Air is actually speaking.
    var thinkPulse = getVoiceState() === 'thinking' ? (0.82 + Math.sin(time * 3.0) * 0.18) : 1;

    particleMat.opacity = (0.75 + smoothedLevel * 0.25) * thinkPulse;
    lineMat.opacity = (0.1 + smoothedLevel * 0.28) * thinkPulse;
    bloomPass.strength = (0.75 + smoothedLevel * 1.05) * thinkPulse;

    var corePulse = 1.0 + Math.sin(time * 3.4) * 0.05 + smoothedLevel * 0.35;
    core.scale.setScalar(0.55 * corePulse * (0.9 + thinkPulse * 0.1));
    coreMat.opacity = (0.75 + smoothedLevel * 0.25) * thinkPulse;

    composer.render();
  }

  if (isOpen) requestAnimationFrame(animate);
})();
