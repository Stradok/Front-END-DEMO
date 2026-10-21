(function () {
  'use strict';

  var viewport = document.getElementById('gvMapViewport');
  var label = document.getElementById('gvMapLabel');
  var resetBtn = document.getElementById('gvMapReset');
  if (!viewport || !label || !resetBtn) return;

  var noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ZOOM = 4.5;
  var zoomedPin = null;

  function zoomOut() {
    viewport.style.transform = 'scale(1)';
    viewport.style.transformOrigin = '50% 50%';
    label.classList.remove('gv-in');
    resetBtn.classList.remove('gv-in');
    zoomedPin = null;
  }

  function zoomTo(pin) {
    var isSame = zoomedPin === pin;
    if (isSame) { zoomOut(); return; }
    zoomedPin = pin;

    var left = pin.style.left, top = pin.style.top;
    viewport.style.transformOrigin = left + ' ' + top;
    viewport.style.transform = noMotion ? 'scale(' + ZOOM + ')' : 'scale(' + ZOOM + ')';

    label.textContent = pin.getAttribute('title') || '';
    label.classList.add('gv-in');
    resetBtn.classList.add('gv-in');
  }

  document.querySelectorAll('.gv-map-pin').forEach(function (pin) {
    pin.addEventListener('click', function (e) {
      e.stopPropagation();
      zoomTo(pin);
    });
  });

  resetBtn.addEventListener('click', zoomOut);
})();
