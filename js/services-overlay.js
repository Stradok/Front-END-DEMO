(function () {
  'use strict';
  var LISTS = {
    business: [
    { name: 'CORE SERVICES', icon: 'ph:headset', items: ['AI Voice Agents', 'Website Design', 'Workflow Automation', 'Lead Generation'] },
    { name: 'EXPANDED DIGITAL SERVICES', icon: 'ph:globe-hemisphere-west', items: ['AI Search / GEO', 'Review Automation', 'Local SEO & Maps'] },
    { name: 'AI WORKFLOW & RETENTION', icon: 'ph:flow-arrow', items: ['AI Intake & Social DMs', 'Database Reactivation', 'AI CRM & Lead Pipelines', 'Automated No-Show Protection'] }
    ],
    ml: [
      { name: 'COMPUTER VISION', icon: 'ph:eye', items: ['Object Detection & Counting', 'Visual Quality Inspection', 'OCR & Document Extraction', 'Video & Camera Analytics'] },
      { name: 'PREDICTIVE MODELS', icon: 'ph:chart-line-up', items: ['Demand & Sales Forecasting', 'Churn & Lead Scoring', 'Anomaly & Fraud Detection', 'Recommendation Systems'] },
      { name: 'LANGUAGE & DEPLOYMENT', icon: 'ph:chat-circle-text', items: ['Custom AI Assistants on Your Data', 'Text Classification & Sentiment', 'Speech-to-Text & Call Analysis', 'Model Deployment & Monitoring'] }
    ]
  };

  // What Bushra says when a service is tapped: label -> [blurb, service page slug]. ML items share one page.
  var ML = 'custom-machine-learning';
  var INFO = {
    'AI Voice Agents': ['An AI voice agent picks up every call in a real conversation, knows your services, hours and pricing, and books straight into your calendar. It is the fix for calls you miss after hours.', 'ai-voice-agents'],
    'Website Design': ['A fast, clear website built to turn visitors into enquiries, and structured so Google and AI assistants can read it properly.', 'website-design'],
    'Workflow Automation': ['We connect the tools you already use so leads, bookings, follow-ups and reports move on their own, with no retyping.', 'workflow-automation'],
    'Lead Generation': ['We set up the channels that bring enquiries in, qualify them, and hand your team real prospects with the context they need.', 'lead-generation'],
    'AI Search / GEO': ['This makes your business easy for AI assistants and search engines to find, understand and recommend. We improve the signals, but nobody can promise a position.', 'ai-search-geo'],
    'Review Automation': ['We ask the right customers for a review at the right moment and help you reply to every review quickly.', 'review-automation'],
    'Local SEO & Maps': ['Your Google profile, listings, reviews and local pages, set up so customers searching nearby can find you.', 'local-seo-maps'],
    'AI Intake & Social DMs': ['An AI front desk for Instagram, Facebook and WhatsApp. It replies straight away, asks the right questions and passes real leads to your team.', 'ai-intake-social-dms'],
    'Database Reactivation': ['Personal outreach to your past customers, so the ones who are ready to come back get booked again.', 'database-reactivation'],
    'AI CRM & Lead Pipelines': ['One pipeline from first enquiry to finished job, so every lead has an owner and a next step. We also build CRMs for specific trades.', 'ai-crm-lead-pipelines'],
    'Automated No-Show Protection': ['Automatic confirmations, reminders and re-booking, so fewer appointments turn into empty slots.', 'no-show-protection'],
    'Object Detection & Counting': ['Models that find and count things in images or video, trained on your own photos.'],
    'Visual Quality Inspection': ['Computer vision that checks products or work against your standards, learned from your examples.'],
    'OCR & Document Extraction': ['Reads your documents and pulls out the fields you need, so nobody has to retype them.'],
    'Video & Camera Analytics': ['Turns camera footage into counts, alerts and reports for your site.'],
    'Demand & Sales Forecasting': ['Forecasts built from your own sales history.'],
    'Churn & Lead Scoring': ['Scores customers and leads by how likely they are to leave or buy, based on your past records.'],
    'Anomaly & Fraud Detection': ['Flags the transactions or readings that look wrong compared with your normal.'],
    'Recommendation Systems': ['Suggests the next product or action from what your customers have actually done.'],
    'Custom AI Assistants on Your Data': ['An assistant that answers from your own documents and records, with its sources.'],
    'Text Classification & Sentiment': ['Sorts messages, tickets and reviews by topic and tone automatically.'],
    'Speech-to-Text & Call Analysis': ['Transcribes your calls and pulls out what was said and what happened next.'],
    'Model Deployment & Monitoring': ['Gets a model into real use and keeps checking that it still works.']
  };

  var ov = document.getElementById('gvSvcOverlay');
  if (!ov) return;
  var titleEl = document.getElementById('gvOvTitle');
  var colsEl = document.getElementById('gvOvCols');
  var cta = ov.querySelector('.gv-ov-cta');
  var closeBtn = ov.querySelector('.gv-ov-close');
  var sheet = document.getElementById('gvSheet');
  var shTag = document.getElementById('gvShTag');
  var shTitle = document.getElementById('gvShTitle');
  var shBlurb = document.getElementById('gvShBlurb');
  var shPoints = document.getElementById('gvShPoints');
  var more = document.getElementById('gvOvMore');
  var talk = document.getElementById('gvOvTalk');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var run = 0, lastTrigger = null;

  // Detail card: expands inline, below the lists on wide screens and under the tapped group on phones,
  // so the services stay visible and nothing is covered.
  var sheetOpen = false, openFor = null;
  var narrow = window.matchMedia('(max-width: 767px)');

  function anchorFor(li) { return narrow.matches ? li.closest('.gv-ov-col') : colsEl; }
  function place(li) { anchorFor(li).after(sheet); }

  function showSheet(li, label, groupName, info) {
    var slug = info[1] || ML;
    var facts = (window.GV_SERVICES && GV_SERVICES[slug] && info[1]) ? GV_SERVICES[slug].points
      : ['Trained on your own data', 'The first step is a look at your data, before any promise'];
    shTag.textContent = groupName;
    shTitle.textContent = label;
    shBlurb.textContent = info[0];
    shPoints.textContent = '';
    facts.forEach(function (f) { var li2 = document.createElement('li'); li2.textContent = f; shPoints.appendChild(li2); });
    more.href = '/services/' + slug;

    var moved = sheet.previousElementSibling !== anchorFor(li);
    if (sheetOpen && moved) { sheet.classList.remove('gv-sheet-open'); }
    place(li);
    sheet.hidden = false;
    void sheet.offsetWidth;   // commit the closed state so the expand transitions
    sheet.classList.remove('gv-sheet-swap'); void sheet.offsetWidth; sheet.classList.add('gv-sheet-swap');   // replays the staggered content
    requestAnimationFrame(function () { sheet.classList.add('gv-sheet-open'); });
    sheetOpen = true; openFor = li;
    setTimeout(function () { if (sheetOpen) sheet.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' }); }, reduced ? 0 : 120);
  }

  function closeSheet() {
    if (!sheetOpen) return;
    sheetOpen = false;
    sheet.classList.remove('gv-sheet-open');
    colsEl.querySelectorAll('li[aria-pressed="true"]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
    var li = openFor; openFor = null;
    setTimeout(function () { if (!sheetOpen) sheet.hidden = true; }, reduced ? 0 : 480);
    if (li && li.isConnected) li.focus({ preventScroll: true });
  }

  // Everything is in the DOM and clickable straight away; rows just fade in top to bottom.
  function play(title, groups) {
    run++;
    titleEl.textContent = title;
    sheetOpen = true; closeSheet(); sheet.hidden = true; ov.querySelector('.gv-ov-inner').after(sheet);
    colsEl.textContent = '';
    cta.classList.remove('gv-ov-show');
    sheetOpen = true; closeSheet();

    var n = 0, reveal = [];
    groups.forEach(function (g) {
      var col = document.createElement('div'); col.className = 'gv-ov-col';
      var h = document.createElement('h3');
      var ic = document.createElement('iconify-icon'); ic.setAttribute('icon', g.icon); ic.setAttribute('aria-hidden', 'true'); h.appendChild(ic);
      var hTxt = document.createElement('span'); hTxt.textContent = g.name; h.appendChild(hTxt);
      col.appendChild(h); reveal.push([h, 0]);
      var ul = document.createElement('ul'); ul.style.padding = 0; col.appendChild(ul);
      g.items.forEach(function (t, row) {
        var li = document.createElement('li');
        var num = document.createElement('span'); num.className = 'n'; num.textContent = (++n) + '.';
        var txt = document.createElement('span'); txt.textContent = t;
        li.appendChild(num); li.appendChild(txt); ul.appendChild(li);
        li.tabIndex = 0; li.setAttribute('role', 'button'); li.setAttribute('aria-pressed', 'false');
        var pick = function () {
          var info = INFO[t]; if (!info) return;
          if (sheetOpen && openFor === li) { closeSheet(); return; }
          colsEl.querySelectorAll('li[aria-pressed="true"]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
          li.setAttribute('aria-pressed', 'true');
          showSheet(li, t, g.name, info);
        };
        li.addEventListener('click', pick);
        li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
        reveal.push([li, row + 1]);
      });
      colsEl.appendChild(col);
    });

    reveal.forEach(function (r) { r[0].classList.add('gv-ov-rv'); r[0].style.transitionDelay = reduced ? '0s' : (r[1] * 0.05) + 's'; });
    void colsEl.offsetWidth;
    // Rows are in the DOM and clickable immediately. The fade-in starts as the red wipe lifts.
    var id = run;
    setTimeout(function () {
      if (id !== run) return;
      reveal.forEach(function (r) { r[0].classList.add('gv-ov-in'); });
      cta.classList.add('gv-ov-show'); ov.classList.add('gv-ov-ready');
    }, reduced ? 0 : 320);
  }

  var wipe = document.createElement('div');
  wipe.className = 'gv-ov-wipe';
  document.body.appendChild(wipe);

  // The reveal grows from wherever the visitor clicked (or the card centre for keyboard).
  function setOrigin(trigger, e) {
    var r = trigger.getBoundingClientRect();
    var x = e && e.clientX ? e.clientX : r.left + r.width / 2;
    var y = e && e.clientY ? e.clientY : r.top + r.height / 2;
    [ov, wipe].forEach(function (el) { el.style.setProperty('--ox', x + 'px'); el.style.setProperty('--oy', y + 'px'); });
  }

  function open(trigger, e) {
    lastTrigger = trigger;
    setOrigin(trigger, e);
    ov.hidden = false;
    document.body.classList.add('gv-ov-lock');
    void ov.offsetWidth; // commit the collapsed state so the reveal actually transitions
    ov.classList.add('gv-ov-on');
    if (!reduced) {
      wipe.classList.remove('gv-ov-wipe-go');
      void wipe.offsetWidth;
      wipe.classList.add('gv-ov-wipe-go');
    }
    closeBtn.focus();
    play(trigger.getAttribute('data-svc-title') || 'What we can do for your business',
      LISTS[trigger.getAttribute('data-svc-list')] || LISTS.business);
  }

  function close() {
    run++;
    sheetOpen = true; closeSheet();
    if (lastTrigger) {
      var r = lastTrigger.getBoundingClientRect();
      ov.style.setProperty('--ox', r.left + r.width / 2 + 'px');
      ov.style.setProperty('--oy', r.top + r.height / 2 + 'px');
    }
    ov.classList.remove('gv-ov-on');
    document.body.classList.remove('gv-ov-lock');
    setTimeout(function () { if (!ov.classList.contains('gv-ov-on')) ov.hidden = true; }, reduced ? 0 : 760);
    if (lastTrigger) lastTrigger.focus();
  }

  document.querySelectorAll('.gv-svc-open').forEach(function (el) {
    el.addEventListener('click', function (e) { open(el, e); });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(el); }
    });
  });
  // Close button: falls under gravity, and where it hits the bottom of the
  // screen the red wipe spreads out and swallows the overlay, revealing the page.
  var dropping = false;
  function dropClose() {
    if (dropping) return;
    if (reduced || !closeBtn.animate) { close(); return; }
    dropping = true;
    run++;
    sheetOpen = true; closeSheet();
    var r = closeBtn.getBoundingClientRect();
    var dist = Math.max(0, window.innerHeight - r.bottom);
    var dur = Math.max(300, Math.sqrt(dist) * 18);
    var fall = closeBtn.animate([
      { transform: 'translateY(0) rotate(0deg)' },
      { transform: 'translateY(' + dist + 'px) rotate(28deg)' }
    ], { duration: dur, easing: 'cubic-bezier(.55, 0, 1, .45)', fill: 'forwards' });
    fall.onfinish = function () {
      var x = r.left + r.width / 2, y = window.innerHeight;
      wipe.style.setProperty('--ox', x + 'px');
      wipe.style.setProperty('--oy', y + 'px');
      wipe.classList.remove('gv-ov-wipe-go');
      void wipe.offsetWidth;
      wipe.classList.add('gv-ov-wipe-go');
      // the wipe covers the screen ~55% into its 0.9s run; swap pages under it
      setTimeout(function () {
        ov.classList.remove('gv-ov-on');
        ov.hidden = true;
        document.body.classList.remove('gv-ov-lock');
        fall.cancel();
        dropping = false;
        if (lastTrigger) lastTrigger.focus({ preventScroll: true });
      }, 520);
    };
  }
  more.addEventListener('click', function () {
    try { sessionStorage.setItem('gvAutoTalk', new URL(more.href, location.href).pathname); } catch (e) { /* storage blocked: page just won't auto-start */ }
  });
  closeBtn.addEventListener('click', dropClose);
  // Hand off to the live voice widget: close the overlay, then open Bushra.
  talk.addEventListener('click', function () {
    close();
    setTimeout(function () { var t = document.querySelector('.lk-toggle'); if (t) t.click(); }, reduced ? 0 : 450);
  });
  cta.addEventListener('click', dropClose);
  document.getElementById('gvShClose').addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || ov.hidden || dropping) return;
    if (sheetOpen) closeSheet(); else dropClose();   // first Esc closes the sheet, the next closes the overlay
  });
})();
