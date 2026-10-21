/* Small voice card for service and product pages. When a visitor arrives from the
   services panel's "See details" button (flag in sessionStorage, set on that click) it
   connects straight away and asks the agent to explain this page. Otherwise it shows
   an "Ask <name> about this page" pill. Listen-only until the visitor taps the mic. */
(function () {
  'use strict';
  var P = window.gvPersona;
  if (!P) return;
  var LK_SRC = 'https://cdn.jsdelivr.net/npm/livekit-client@2/dist/livekit-client.umd.min.js';
  var h1 = document.querySelector('h1');
  var topic = h1 ? h1.textContent.trim() : document.title;
  var LK = null, room = null, starting = null, micOn = false, sentContext = false, waitTimer = null;

  var pill = document.createElement('button');
  pill.type = 'button'; pill.className = 'vc-pill';
  pill.innerHTML = '<span class="vc-orb" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span>Ask <span data-persona-name>our voice agent</span> about this page</span>';

  var card = document.createElement('div');
  card.className = 'vc-card'; card.hidden = true; card.setAttribute('role', 'region'); card.setAttribute('aria-label', 'Voice assistant');
  card.innerHTML =
    '<div class="vc-head"><span class="vc-orb" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><strong data-persona-name>our voice agent</strong>' +
    '<span class="gv-persona" role="group" aria-label="Voice language" style="margin-left:auto"><button type="button" data-persona-pick="air">English</button><button type="button" data-persona-pick="bushra">Urdu</button></span></div>' +
    '<p class="vc-status" aria-live="polite"></p>' +
    '<div class="vc-row"><button type="button" class="vc-btn vc-btn-main" data-act="hear" hidden>Tap to hear</button>' +
    '<button type="button" class="vc-btn" data-act="mic" aria-pressed="false">Ask a question</button>' +
    '<button type="button" class="vc-btn" data-act="end">End</button></div>';
  document.body.appendChild(pill); document.body.appendChild(card);
  P.render();

  var statusEl = card.querySelector('.vc-status');
  var hearBtn = card.querySelector('[data-act="hear"]');
  var micBtn = card.querySelector('[data-act="mic"]');
  function status(t) { statusEl.textContent = t; }

  function loadSDK() {
    if (window.LivekitClient) { LK = window.LivekitClient; return Promise.resolve(LK); }
    return new Promise(function (resolve) {
      var el = document.createElement('script');
      el.src = LK_SRC;
      el.onload = function () { LK = window.LivekitClient; resolve(LK); };
      el.onerror = function () { resolve(null); };
      document.head.appendChild(el);
    });
  }

  function sendContext() {
    if (sentContext || !room) return;
    sentContext = true;
    var msg = 'I just opened the page "' + topic + '" on the Gyraq website. Please start talking now: explain in two or three short sentences what this is and what it does for a business, then ask what I would like to know.';
    try { room.localParticipant.sendText(msg, { topic: 'lk.chat' }); } catch (e) { console.error('Context send failed', e); }
  }

  function end() {
    clearTimeout(waitTimer);
    if (room) { try { room.disconnect(); } catch (e) { /* already closed */ } room = null; }
    document.querySelectorAll('audio[data-vc]').forEach(function (a) { a.remove(); });
    micOn = false; sentContext = false; starting = null;
    micBtn.setAttribute('aria-pressed', 'false');
    card.classList.remove('vc-live'); card.hidden = true; pill.hidden = false;
  }

  function start() {
    if (starting || room) return starting;
    pill.hidden = true; card.hidden = false; hearBtn.hidden = true;
    status('Connecting…');
    var qs = [P.query(), 'topic=' + encodeURIComponent(topic.slice(0, 80))].filter(Boolean).join('&');
    starting = loadSDK().then(function (sdk) {
      if (!sdk) throw new Error('Voice SDK failed to load');
      return fetch('/api/livekit-token?' + qs);
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.token) throw new Error((d && d.error) || 'No token');
      if (d.persona) P.setAuto(d.persona);
      var r = room = new LK.Room();
      r.on(LK.RoomEvent.TrackSubscribed, function (track) {
        if (track.kind !== 'audio') return;
        var a = track.attach(); a.autoplay = true; a.setAttribute('data-vc', ''); document.body.appendChild(a);
      });
      r.on(LK.RoomEvent.ParticipantConnected, function () { status(P.who() + ' joined'); setTimeout(sendContext, 700); });
      r.on(LK.RoomEvent.ActiveSpeakersChanged, function (sp) {
        var talking = sp.some(function (p) { return !p.isLocal; });
        card.classList.toggle('vc-live', talking);
        if (talking) status(P.who() + ' is speaking…');
      });
      r.on(LK.RoomEvent.AudioPlaybackStatusChanged, function () { hearBtn.hidden = r.canPlaybackAudio; });
      r.on(LK.RoomEvent.Disconnected, function () { if (room === r) end(); });
      return r.connect(d.url, d.token).then(function () {
        status('Connected');
        try { r.startAudio(); } catch (e) { /* needs a tap: the button below handles it */ }
        hearBtn.hidden = r.canPlaybackAudio;
        if (r.remoteParticipants && r.remoteParticipants.size) setTimeout(sendContext, 700);
        waitTimer = setTimeout(function () { if (room === r && !(r.remoteParticipants && r.remoteParticipants.size)) status('Could not reach ' + P.who().toLowerCase() + ' right now.'); }, 15000);
      });
    }).catch(function (err) {
      console.error('Voice card connect failed', err);
      status('Could not connect right now.');
      room = null; starting = null;
    });
    return starting;
  }

  pill.addEventListener('click', start);
  card.querySelector('[data-act="end"]').addEventListener('click', end);
  hearBtn.addEventListener('click', function () { if (room) room.startAudio().then(function () { hearBtn.hidden = true; }); });
  micBtn.addEventListener('click', function () {
    if (!room) return;
    var on = !micOn;
    room.localParticipant.setMicrophoneEnabled(on).then(function () {
      micOn = on; micBtn.setAttribute('aria-pressed', String(on)); micBtn.textContent = on ? 'Mic on' : 'Ask a question';
      status(on ? 'Listening…' : 'Connected');
    }).catch(function () { status('Mic blocked. Check the browser permission.'); });
  });
  P.onChange(function () { if (room) { end(); start(); } });
  window.addEventListener('pagehide', function () { if (room) { try { room.disconnect(); } catch (e) { /* ignore */ } } });

  var flag = null;
  try { flag = sessionStorage.getItem('gvAutoTalk'); sessionStorage.removeItem('gvAutoTalk'); } catch (e) { /* ignore */ }
  if (flag && flag === location.pathname) start();
})();
