(function () {
  'use strict';

  var G = {};
  window.Gyraq = G;

  G.$ = function (s, r) { return (r || document).querySelector(s); };
  G.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  G.noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  G.finePointer = window.matchMedia('(pointer: fine)').matches;
  if (G.noMotion) document.documentElement.classList.add('no-motion');

  var yearEl = document.getElementById('t5Year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
