/* ==========================================================================
   Full-screen LiveKit AI Assistant widget.
   Connects to a LiveKit room on first open, publishes the visitor's mic on
   request, and plays Air's replies as audio. This is a voice-first surface:
   no transcript or reply text is rendered — the only messages shown are the
   ones the visitor types themselves.
   ========================================================================== */
(function () {
  'use strict';

  // Shared bridge to js/widget-orb.js — a plain `window` property rather than
  // an ES module export, since this script and the orb's module script have
  // no other way to talk to each other without a bundler.
  window.gvVoiceLevel = window.gvVoiceLevel || { air: 0 };

  document.querySelectorAll('[data-livekit-widget]').forEach(function (root) {
    var LK = window.LivekitClient;
    var LK_SRC = 'https://cdn.jsdelivr.net/npm/livekit-client@2/dist/livekit-client.umd.min.js';
    var lkLoading = null;
    var tokenEndpoint = root.dataset.tokenEndpoint || '/api/livekit-token';

    var panel = root.querySelector('.lk-panel');
    var toggleBtn = root.querySelector('.lk-toggle');
    var closeBtn = root.querySelector('.lk-close');
    var micBtn = root.querySelector('.lk-mic');
    var form = root.querySelector('.lk-form');
    var input = root.querySelector('.lk-input');
    var messages = root.querySelector('.lk-messages');
    var statusEl = root.querySelector('.lk-status');
    var iconChat = root.querySelector('.lk-icon-chat');
    var iconClose = root.querySelector('.lk-icon-close');
    var iconMic = root.querySelector('.lk-icon-mic');
    var iconMicOff = root.querySelector('.lk-icon-mic-off');

    function pname() { return window.gvPersona ? gvPersona.who() : 'The assistant'; }
    var room = null;
    var connecting = null; // in-flight connect promise, so double-clicks don't open two rooms
    var micOn = false;
    var open = false;
    var audioCtx = null;
    var analyserRaf = null;

    function setStatus(text) { if (statusEl) statusEl.textContent = text; }

    // Real amplitude analysis on Air's actual voice track — not a canned
    // animation. window.gvVoiceLevel.air (0..1) is read every frame by
    // js/widget-orb.js to drive the particle swarm's scale/turbulence.
    function analyzeAirAudio(track) {
      try {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx || !track.mediaStreamTrack) return;
        if (!audioCtx) audioCtx = new AudioCtx();
        var source = audioCtx.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));
        var analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.55;
        source.connect(analyser);
        var data = new Uint8Array(analyser.frequencyBinCount);

        if (analyserRaf) cancelAnimationFrame(analyserRaf);
        (function tick() {
          analyser.getByteFrequencyData(data);
          var sum = 0;
          for (var i = 0; i < data.length; i++) sum += data[i];
          window.gvVoiceLevel.air = (sum / data.length) / 255;
          analyserRaf = requestAnimationFrame(tick);
        })();
      } catch (e) { /* audio-reactive visuals are enhancement-only — voice playback still works without them */ }
    }

    function stopAnalyzingAirAudio() {
      if (analyserRaf) cancelAnimationFrame(analyserRaf);
      analyserRaf = null;
      window.gvVoiceLevel.air = 0;
    }

    function appendMessage(who, text) {
      if (!messages) return;
      var empty = messages.querySelector('.lk-empty');
      if (empty) empty.remove();
      var row = document.createElement('div');
      row.className = who === 'me'
        ? 'self-end bg-[#ef233c] text-white rounded-2xl rounded-br-sm px-3.5 py-2 max-w-[85%]'
        : 'self-start bg-zinc-800 text-zinc-100 rounded-2xl rounded-bl-sm px-3.5 py-2 max-w-[85%]';
      row.textContent = text;
      messages.appendChild(row);
      messages.scrollTop = messages.scrollHeight;
    }

    function openPanel() {
      open = true;
      if (panel) panel.classList.remove('hidden');
      if (iconChat) iconChat.classList.add('hidden');
      if (iconClose) iconClose.classList.remove('hidden');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
      document.body.classList.add('gv-widget-open');
      ensureConnected();
    }
    function closePanel() {
      open = false;
      if (panel) panel.classList.add('hidden');
      if (iconChat) iconChat.classList.remove('hidden');
      if (iconClose) iconClose.classList.add('hidden');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('gv-widget-open');
    }

    function resetConversation() {
      if (!messages) return;
      messages.innerHTML = '<div class="lk-empty text-zinc-500 text-center text-xs mt-8">Say hello, or press the mic, to start.</div>';
    }

    function endCall() {
      // Actually ends the LiveKit session — the room was staying connected
      // in the background even after the panel was just hidden.
      if (room) {
        room.disconnect();
        room = null;
      }
      micOn = false;
      reflectMic();
      setStatus('Not connected');
      resetConversation();
      root.classList.remove('lk-connected', 'lk-listening', 'lk-air-speaking', 'lk-user-speaking', 'lk-thinking', 'lk-mood-off-topic');
      stopAnalyzingAirAudio();
      closePanel();
    }

    // The voice SDK is big and only needed once someone opens the widget,
    // so it is fetched on demand instead of blocking page load.
    function loadSDK() {
      if (window.LivekitClient) { LK = window.LivekitClient; return Promise.resolve(LK); }
      if (lkLoading) return lkLoading;
      lkLoading = new Promise(function (resolve) {
        var el = document.createElement('script');
        el.src = LK_SRC;
        el.onload = function () { LK = window.LivekitClient; resolve(LK); };
        el.onerror = function () { lkLoading = null; resolve(null); };
        document.head.appendChild(el);
      });
      return lkLoading;
    }
    if (toggleBtn) ['pointerenter', 'touchstart', 'focus'].forEach(function (ev) {
      toggleBtn.addEventListener(ev, loadSDK, { once: true, passive: true });
    });

    function ensureConnected() {
      if (room) return Promise.resolve(room);
      if (connecting) return connecting;
      setStatus('Connecting…');
      connecting = loadSDK().then(function (sdk) {
        if (!sdk) throw new Error('Voice SDK failed to load');
        return fetch(tokenEndpoint + (window.gvPersona && gvPersona.query() ? '?' + gvPersona.query() : ''));
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data || !data.token || !data.url) throw new Error(data && data.error || 'No token returned');
          if (window.gvPersona && data.persona) gvPersona.setAuto(data.persona);
          room = new LK.Room();

          room.on(LK.RoomEvent.Connected, function () { setStatus('Connected'); root.classList.add('lk-connected'); });
          room.on(LK.RoomEvent.Disconnected, function () { setStatus('Not connected'); room = null; root.classList.remove('lk-connected', 'lk-listening', 'lk-air-speaking', 'lk-user-speaking', 'lk-thinking', 'lk-mood-off-topic'); stopAnalyzingAirAudio(); });
          room.on(LK.RoomEvent.ParticipantConnected, function () { setStatus(pname() + ' joined'); });
          room.on(LK.RoomEvent.TrackSubscribed, function (track) {
            if (track.kind === 'audio') {
              var el = track.attach();
              el.autoplay = true;
              document.body.appendChild(el);
              analyzeAirAudio(track);
            }
          });
          // Drives the orb through real, detectable states — not fabricated
          // emotions. lk-user-speaking is actual voice-activity on the local
          // participant (distinct from lk-listening, which just means the
          // mic toggle is on); lk-thinking is the real gap between the user
          // finishing a turn and Air starting to reply, not a guess.
          room.on(LK.RoomEvent.ActiveSpeakersChanged, function (speakers) {
            var airSpeaking = speakers.some(function (p) { return !p.isLocal; });
            var userSpeaking = speakers.some(function (p) { return p.isLocal; });
            var thinking = micOn && !airSpeaking && !userSpeaking;
            root.classList.toggle('lk-air-speaking', airSpeaking);
            root.classList.toggle('lk-user-speaking', userSpeaking);
            root.classList.toggle('lk-thinking', thinking);
            setStatus(airSpeaking ? pname() + ' is speaking…' : userSpeaking ? 'Listening…' : thinking ? 'Thinking…' : (micOn ? 'Listening…' : 'Connected'));
          });

          // Voice is a spoken conversation, not a chat log — no transcript or
          // reply bubbles are rendered here. Only messages the visitor types
          // in the input below ever appear (appended directly on submit).

          // A separate, non-conversational signal: if the agent is configured
          // with a "set_mood" Client tool (LiveKit's Actions → Client tools —
          // real RPC the agent calls, not a text message), this drives the
          // orb's off-topic color in js/widget-orb.js. Handles the payload
          // as either a raw "on-topic"/"off-topic" string or a JSON object
          // with a relevance/mood/value field, since the exact shape the
          // Agent Builder sends depends on how the tool's parameter is
          // configured there. No agent config for this at all just leaves
          // it at the on-topic/crimson default — this never breaks the call.
          try {
            room.localParticipant.registerRpcMethod('set_mood', function (data) {
              var raw = (data && data.payload) || '';
              var mood = raw.trim().toLowerCase();
              try {
                var parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                  mood = String(parsed.relevance || parsed.mood || parsed.value || '').trim().toLowerCase();
                }
              } catch (e) { /* not JSON — raw string is the value */ }
              root.classList.toggle('lk-mood-off-topic', mood === 'off-topic');
              return 'ok';
            });
          } catch (e) { /* SDK version may not support RPC — voice still works */ }

          return room.connect(data.url, data.token).then(function () { return room; });
        })
        .catch(function (err) {
          console.error('LiveKit connect failed', err);
          setStatus('Could not connect');
          room = null;
          return null;
        })
        .finally(function () { connecting = null; });
      return connecting;
    }

    function reflectMic() {
      if (micBtn) {
        micBtn.setAttribute('aria-pressed', String(micOn));
        micBtn.setAttribute('aria-label', micOn ? 'Microphone is on — tap to mute' : 'Microphone is off — tap to unmute');
        micBtn.classList.toggle('bg-[#ef233c]', micOn);
        micBtn.classList.toggle('text-white', micOn);
        micBtn.classList.toggle('bg-zinc-800', !micOn);
        micBtn.classList.toggle('text-zinc-300', !micOn);
      }
      // Plain mic icon = live; crossed-out mic = muted. (State, not action.)
      if (iconMic) iconMic.classList.toggle('hidden', !micOn);
      if (iconMicOff) iconMicOff.classList.toggle('hidden', micOn);
    }

    function setMic(on) {
      if (!room) return;
      room.localParticipant.setMicrophoneEnabled(on).then(function () {
        micOn = on;
        reflectMic();
        root.classList.toggle('lk-listening', on);
        if (on) {
          setStatus('Listening…');
          // Belt-and-suspenders: LiveKit has been observed publishing this
          // track in a server-side-muted state even though enable() resolved
          // successfully. Force an explicit unmute on the publication itself.
          try {
            var pub = room.localParticipant.getTrackPublication(LK.Track.Source.Microphone);
            if (pub && pub.isMuted) pub.unmute();
          } catch (e) { console.error('Explicit unmute failed', e); }
        }
      }).catch(function (err) {
        console.error('Microphone toggle failed', err);
        micOn = false;
        reflectMic();
        root.classList.remove('lk-listening');
        setStatus('Mic blocked — check browser/site permissions');
      });
    }

    // Switching language mid-call: hang up and reconnect to the other agent.
    if (window.gvPersona) gvPersona.onChange(function () {
      if (!room) return;
      room.disconnect(); room = null;
      setStatus('Switching…');
      if (open) ensureConnected();
    });

    if (toggleBtn) toggleBtn.addEventListener('click', function () { open ? closePanel() : openPanel(); });
    if (closeBtn) closeBtn.addEventListener('click', endCall);
    if (micBtn) {
      micBtn.addEventListener('click', function () {
        ensureConnected().then(function () { setMic(!micOn); });
      });
    }
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var text = input.value.trim();
        if (!text) return;
        appendMessage('me', text);
        input.value = '';
        ensureConnected().then(function () {
          if (!room) return;
          try { room.localParticipant.sendText(text, { topic: 'lk.chat' }); }
          catch (err) { console.error('Send failed', err); }
        });
      });
    }

    // A page-level "open the assistant" CTA (outside the widget root) can trigger it too.
    document.querySelectorAll('.lk-open-btn').forEach(function (btn) {
      btn.addEventListener('click', openPanel);
    });
  });
})();
