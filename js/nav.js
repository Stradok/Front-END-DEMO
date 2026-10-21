(function () {
  'use strict';
  var header = document.querySelector('header');
  var hero = document.getElementById('gvTop');
  if (!header || !hero || !('IntersectionObserver' in window)) return;

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      header.classList.toggle('gv-scrolled', !entry.isIntersecting);
    });
  }, { rootMargin: '-88px 0px 0px 0px', threshold: 0 });

  io.observe(hero);
})();
