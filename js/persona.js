/* Which voice assistant the visitor gets: Bushra (Urdu/English) or Air (English).
   Default comes from the server (Pakistan -> Bushra, elsewhere -> Air); a visitor's own
   choice wins and is remembered. Elements with [data-persona-name] show the current name,
   buttons with [data-persona-pick="air|bushra"] let the visitor choose. */
(function () {
  'use strict';
  var NAMES = { bushra: 'Bushra', air: 'Air' };
  var pref = null, auto = null, subs = [];
  try { pref = localStorage.getItem('gvPersona'); auto = sessionStorage.getItem('gvPersonaAuto'); } catch (e) { /* storage blocked */ }
  if (!NAMES[pref]) pref = null;
  if (!NAMES[auto]) auto = null;

  var G = window.gvPersona = {};
  G.current = function () { return pref || auto || 'bushra'; };
  G.known = function () { return !!(pref || auto); };
  // Until the server (or the visitor) has chosen, stay neutral instead of showing the wrong name.
  G.name = function () { return G.known() ? NAMES[G.current()] : 'our voice agent'; };
  G.who = function () { return G.known() ? NAMES[G.current()] : 'The assistant'; };
  G.setAuto = function (p) {
    if (!NAMES[p] || auto === p) return;
    auto = p;
    try { sessionStorage.setItem('gvPersonaAuto', p); } catch (e) { /* ignore */ }
    G.render();
  };
  G.query = function () { return pref ? 'agent=' + pref : ''; };   // only an explicit choice overrides the server default
  G.onChange = function (fn) { subs.push(fn); };
  G.render = function () {
    document.querySelectorAll('[data-persona-name]').forEach(function (el) {
      var n = G.name();
      el.textContent = el.hasAttribute('data-persona-cap') ? n.charAt(0).toUpperCase() + n.slice(1) : n;   // cap = starts a sentence
    });
    document.querySelectorAll('[data-persona-pick]').forEach(function (b) { b.setAttribute('aria-pressed', String(G.known() && b.getAttribute('data-persona-pick') === G.current())); });
  };
  G.set = function (p) {
    if (!NAMES[p] || p === G.current()) return;
    pref = p;
    try { localStorage.setItem('gvPersona', p); } catch (e) { /* ignore */ }
    G.render();
    subs.forEach(function (fn) { fn(p); });
  };

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-persona-pick]');
    if (b) G.set(b.getAttribute('data-persona-pick'));
  });

  G.render();
  document.addEventListener('DOMContentLoaded', G.render);

  if (!auto) {
    fetch('/api/livekit-token?probe=1').then(function (r) { return r.json(); }).then(function (d) {
      if (d && NAMES[d.persona]) {
        G.setAuto(d.persona);
      }
    }).catch(function () { /* no API (local preview): keep the default */ });
  }
})();
