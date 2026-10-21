/* Nav behaviour shared by every page: Products dropdown (desktop) and the mobile menu.
   Buttons carry aria-expanded and point at their panel with aria-controls. */
(function () {
  'use strict';

  var toggles = Array.prototype.slice.call(document.querySelectorAll('.nv-dd-btn, .nv-menu-btn, .nv-sub-btn'));
  if (!toggles.length) return;

  function panelOf(btn) { return document.getElementById(btn.getAttribute('aria-controls')); }

  function setOpen(btn, open) {
    var panel = panelOf(btn);
    if (!panel) return;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.hidden = !open;
    if (btn.classList.contains('nv-sub-btn')) {
      var sign = btn.querySelector('span');
      if (sign) sign.textContent = open ? '−' : '+';
    }
  }

  function closeAll(except, restoreFocus) {
    toggles.forEach(function (b) {
      if (b === except) return;
      if (b.getAttribute('aria-expanded') === 'true') {
        setOpen(b, false);
        if (restoreFocus) b.focus();
      }
    });
  }

  toggles.forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = btn.getAttribute('aria-expanded') !== 'true';
      // the Products sub-list lives inside the mobile menu, so it must not close its parent
      if (!btn.classList.contains('nv-sub-btn')) closeAll(btn, false);
      setOpen(btn, open);
    });
  });

  document.addEventListener('click', function (e) {
    toggles.forEach(function (b) {
      var panel = panelOf(b);
      if (b.getAttribute('aria-expanded') !== 'true' || b.classList.contains('nv-sub-btn')) return;
      if (panel && !panel.contains(e.target) && !b.contains(e.target)) setOpen(b, false);
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var openBtn = toggles.filter(function (b) { return b.getAttribute('aria-expanded') === 'true' && !b.classList.contains('nv-sub-btn'); })[0];
    if (!openBtn) return;
    setOpen(openBtn, false);
    openBtn.focus();
  });

  // Tabbing out of the desktop dropdown closes it.
  document.querySelectorAll('[data-nv-dd]').forEach(function (dd) {
    dd.addEventListener('focusout', function (e) {
      if (!dd.contains(e.relatedTarget)) { var b = dd.querySelector('.nv-dd-btn'); if (b) setOpen(b, false); }
    });
  });

  // Following a link in the mobile menu closes it (anchors on the same page don't reload).
  document.querySelectorAll('.nv-mobile a').forEach(function (a) {
    a.addEventListener('click', function () { closeAll(null, false); });
  });
})();
