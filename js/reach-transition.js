/* Hand-off to Reach: a circular reveal in Reach's navy grows from the click,
   the wordmark fades in, then we navigate. Uses the View Transitions API
   where available and a plain overlay everywhere else. Reduced motion,
   modified clicks and no-JS all fall through to the normal link. */
(function () {
  'use strict';

  var REVEAL_MS = 620;   // circle grows
  var HOLD_MS = 420;     // wordmark visible before navigating
  var EASE = 'cubic-bezier(0.76, 0, 0.24, 1)';
  var busy = false;

  function buildOverlay() {
    var el = document.createElement('div');
    el.className = 'gv-rt';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="gv-rt-mark"><b>Reach</b><span>by Gyraq</span></div>';
    return el;
  }

  function circle(x, y, r) { return 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'; }

  function go(href) { window.location.assign(href); }

  function finish(overlay, href) {
    overlay.classList.add('gv-rt-show');
    setTimeout(function () { go(href); }, HOLD_MS);
  }

  function viaOverlay(href, x, y, radius) {
    var overlay = buildOverlay();
    overlay.style.clipPath = circle(x, y, 0);
    document.body.appendChild(overlay);
    var anim = overlay.animate(
      [{ clipPath: circle(x, y, 0) }, { clipPath: circle(x, y, radius) }],
      { duration: REVEAL_MS, easing: EASE, fill: 'forwards' }
    );
    anim.onfinish = function () { overlay.style.clipPath = 'none'; finish(overlay, href); };
  }

  function start(href, x, y) {
    var radius = Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)));
    if (!document.startViewTransition) { viaOverlay(href, x, y, radius); return; }

    var overlay = buildOverlay();
    var transition;
    try {
      document.documentElement.classList.add('gv-vt');
      transition = document.startViewTransition(function () { document.body.appendChild(overlay); });
    } catch (err) {
      document.documentElement.classList.remove('gv-vt');
      viaOverlay(href, x, y, radius);
      return;
    }
    transition.ready.then(function () {
      document.documentElement.animate(
        { clipPath: [circle(x, y, 0), circle(x, y, radius)] },
        { duration: REVEAL_MS, easing: EASE, pseudoElement: '::view-transition-new(root)' }
      );
    }, function () { /* transition skipped: the overlay is already in place, just continue */ });
    transition.finished.then(function () { finish(overlay, href); }, function () { finish(overlay, href); });
  }

  function onClick(e) {
    var a = e.currentTarget;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (busy) { e.preventDefault(); return; }
    busy = true;
    e.preventDefault();

    var x = e.clientX, y = e.clientY;
    if (e.detail === 0 || (!x && !y)) {            // keyboard activation
      var r = a.getBoundingClientRect();
      x = r.left + r.width / 2; y = r.top + r.height / 2;
    }
    start(a.href, x, y);
  }

  document.querySelectorAll('a[data-reach-link]').forEach(function (a) {
    a.addEventListener('click', onClick);
  });

  // Coming back with the browser's Back button: clear the overlay and re-arm.
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    busy = false;
    document.documentElement.classList.remove('gv-vt');
    document.querySelectorAll('.gv-rt').forEach(function (n) { n.remove(); });
  });
})();
