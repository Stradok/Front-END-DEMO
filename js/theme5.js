(function () {
  'use strict';
  var G = window.Gyraq;
  var form = G.$('#t5ContactForm');
  var note = G.$('#t5Note');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var body = note && note.value.trim() ? note.value.trim() : "I'd like to talk about a project.";
    var url = 'mailto:services@gyraq.com?subject=' + encodeURIComponent('Book a meeting') + '&body=' + encodeURIComponent(body);
    window.location.href = url;
  });
})();
