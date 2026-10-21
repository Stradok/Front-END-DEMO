/* Chat launcher. Tiny on purpose: the chat itself (js/chat.js) is only fetched on first interaction. */
(function () {
  'use strict';
  if (document.getElementById('gcLauncher')) return;
  var b = document.createElement('button');
  b.id = 'gcLauncher'; b.type = 'button'; b.className = 'gc-launcher';
  b.setAttribute('aria-label', 'Chat with the Gyraq assistant');
  b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'gcPanel');
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg><span>Chat</span>';
  document.body.appendChild(b);

  var loading = null;
  function load() {
    if (window.gyraqChat) return Promise.resolve(window.gyraqChat);
    if (loading) return loading;
    loading = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = '/js/chat.js';
      s.onload = function () { resolve(window.gyraqChat || null); };
      s.onerror = function () { loading = null; resolve(null); };
      document.head.appendChild(s);
    });
    return loading;
  }
  ['pointerenter', 'focus', 'touchstart'].forEach(function (ev) { b.addEventListener(ev, load, { once: true, passive: true }); });
  b.addEventListener('click', function () { load().then(function (c) { if (c) c.toggle(); }); });

  // Same-session continuity: if the panel was open on the previous page, reopen it.
  try { if (sessionStorage.getItem('gcOpen') === '1') load().then(function (c) { if (c) c.open(true); }); } catch (e) { /* storage blocked */ }
})();
