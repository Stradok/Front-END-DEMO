/* Gyraq text chatbot. Loaded on first interaction by js/chat-launcher.js.
   Talks to /api/chat (answers come only from the site's own content), renders replies as plain
   text with **bold** only, shows link cards, and hosts an in-chat enquiry form that posts to
   the existing /api/contact. Conversation lives in sessionStorage for this tab only. */
(function () {
  'use strict';
  var launcher = document.getElementById('gcLauncher');
  var MAX = 500;
  var CONTACT_EMAIL = 'services@gyraq.com';
  var WHATSAPP = 'https://wa.me/447544310018';
  var CHIPS = ['What does Gyraq do?', 'How does pricing work?', 'Take me to the voice agent page', 'I would like to book a meeting'];
  var GREETING = 'Hi, I am the Gyraq assistant. I can answer questions about our services and products, take you to the right page, or pass a message to the team.';

  var state = { msgs: [], busy: false };   // msgs: {role, content, actions?}
  try { state.msgs = JSON.parse(sessionStorage.getItem('gcMsgs') || '[]').slice(-40); } catch (e) { state.msgs = []; }
  function save() { try { sessionStorage.setItem('gcMsgs', JSON.stringify(state.msgs.slice(-40))); } catch (e) { /* storage blocked */ } }
  function flag(open) { try { sessionStorage.setItem('gcOpen', open ? '1' : '0'); } catch (e) { /* ignore */ } }

  // ---------- DOM ----------
  var panel = document.createElement('section');
  panel.id = 'gcPanel'; panel.className = 'gc-panel'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Gyraq assistant');
  panel.innerHTML =
    '<header class="gc-head"><span class="gc-title">Gyraq assistant</span>' +
    '<button type="button" class="gc-voice" hidden>Talk to <span data-persona-name>our voice agent</span></button>' +
    '<button type="button" class="gc-x" aria-label="Close chat">&times;</button></header>' +
    '<div class="gc-log" role="log" aria-live="polite" aria-relevant="additions"></div>' +
    '<div class="gc-chips"></div>' +
    '<form class="gc-form" autocomplete="off"><input class="gc-input" type="text" dir="auto" maxlength="' + MAX + '" placeholder="Ask about our services" aria-label="Your message">' +
    '<button class="gc-send" type="submit" aria-label="Send">&#10148;</button></form>' +
    '<p class="gc-fine">Messages are processed by an AI service and may be stored by it. Please do not share sensitive information.</p>';
  document.body.appendChild(panel);
  var log = panel.querySelector('.gc-log'), chips = panel.querySelector('.gc-chips'), form = panel.querySelector('.gc-form');
  var input = panel.querySelector('.gc-input'), sendBtn = panel.querySelector('.gc-send'), voiceBtn = panel.querySelector('.gc-voice');

  function scroll() { log.scrollTop = log.scrollHeight; }

  // Text with **bold** only. Everything else is inserted as text, never as HTML.
  function richText(el, text) {
    String(text).split(/(\*\*[^*]+\*\*)/g).forEach(function (part) {
      if (/^\*\*[^*]+\*\*$/.test(part)) { var s = document.createElement('strong'); s.textContent = part.slice(2, -2); el.appendChild(s); }
      else if (part) el.appendChild(document.createTextNode(part));
    });
  }
  function bubble(role, text) {
    var d = document.createElement('div');
    d.className = 'gc-msg ' + (role === 'user' ? 'gc-me' : 'gc-bot');
    d.setAttribute('dir', 'auto');
    richText(d, text);
    log.appendChild(d); scroll();
    return d;
  }

  // ---------- actions ----------
  function linkCard(a) {
    var el = document.createElement('a');
    el.className = 'gc-card';
    el.textContent = 'Open: ' + a.title;
    if (a.url) { el.href = a.url; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
    else el.href = a.path;
    log.appendChild(el); scroll();
  }

  function enquiryForm() {
    var f = document.createElement('form');
    f.className = 'gc-enq'; f.noValidate = true;
    f.innerHTML =
      '<div class="gc-enq-row"><input name="firstName" placeholder="First name" aria-label="First name" autocomplete="given-name" maxlength="100">' +
      '<input name="lastName" placeholder="Last name" aria-label="Last name" autocomplete="family-name" maxlength="100"></div>' +
      '<input name="email" type="email" placeholder="Email" aria-label="Email" autocomplete="email" maxlength="200">' +
      '<div class="gc-enq-row"><input name="company" placeholder="Company (optional)" aria-label="Company" maxlength="150">' +
      '<input name="phone" type="tel" placeholder="Phone (optional)" aria-label="Phone" autocomplete="tel" maxlength="40"></div>' +
      '<textarea name="message" placeholder="How can we help?" aria-label="Message" maxlength="1500" dir="auto"></textarea>' +
      '<input class="gc-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +   // honeypot: people never see it
      '<p class="gc-err" role="alert" hidden></p>' +
      '<button type="submit">Send to the team</button>' +
      '<p class="gc-alt">Prefer another way? Email <a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a> (<button type="button" data-copy>copy</button>) or <a href="' + WHATSAPP + '" target="_blank" rel="noopener noreferrer">WhatsApp +44 7544 310018</a>.</p>';
    var err = f.querySelector('.gc-err');
    function fail(t) { err.textContent = t; err.hidden = false; }
    f.addEventListener('input', function () { err.hidden = true; });
    f.querySelector('[data-copy]').addEventListener('click', function (e) {
      var b = e.currentTarget;
      var done = function () { b.textContent = 'copied'; setTimeout(function () { b.textContent = 'copy'; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(CONTACT_EMAIL).then(done, function () { b.textContent = CONTACT_EMAIL; });
      else b.textContent = CONTACT_EMAIL;
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = {}; ['firstName', 'lastName', 'email', 'company', 'phone', 'message'].forEach(function (k) { v[k] = f.elements[k].value.trim(); });
      if (!v.firstName || !v.lastName) return fail('Please add your first and last name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return fail('Please add a valid email address.');
      if (v.phone && v.phone.replace(/\D/g, '').length < 7) return fail('That phone number looks too short.');
      if (v.message.length < 5) return fail('Please write a short message.');
      err.hidden = true;
      var btn = f.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = 'Sending…';
      var message = v.message + (v.company ? '\n\nCompany: ' + v.company : '') + (v.phone ? '\nPhone: ' + v.phone : '') + '\n\n(Sent from the website chat)';
      fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName: v.firstName, lastName: v.lastName, email: v.email, message: message, website: f.elements.website.value }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok && d.ok, error: d.error }; }); })
        .then(function (r) {
          if (r.ok) {
            f.remove();
            reply('Thank you, ' + v.firstName + '. Your message was sent to the Gyraq team, and they will reply to **' + v.email + '**.');
          } else {
            btn.disabled = false; btn.textContent = 'Send to the team';
            fail(r.error || 'The message could not be sent. Please try again, or use the email or WhatsApp option below.');
          }
        })
        .catch(function () { btn.disabled = false; btn.textContent = 'Send to the team'; fail('Could not reach the server. Please try again, or use the email or WhatsApp option below.'); });
    });
    log.appendChild(f); scroll();
    f.elements.firstName.focus();
  }

  function runActions(actions, restore) {
    (actions || []).forEach(function (a) {
      if (a.type === 'link') {
        linkCard(a);
        if (a.navigate && a.path && !restore) {
          state.msgs[state.msgs.length - 1].nav = true; save(); flag(true);
          setTimeout(function () { window.location.assign(a.path); }, 1000);
        }
      } else if (a.type === 'enquiry') { if (!restore) enquiryForm(); }
    });
  }

  function reply(text, actions, noSave) {
    bubble('assistant', text);
    if (!noSave) { state.msgs.push({ role: 'assistant', content: text, actions: (actions || []).filter(function (a) { return a.type === 'link'; }) }); save(); }
    runActions(actions, false);
  }

  // ---------- sending ----------
  function send(text) {
    text = String(text || '').trim().slice(0, MAX);
    if (!text || state.busy) return;
    chips.hidden = true;
    bubble('user', text);
    state.msgs.push({ role: 'user', content: text }); save();
    state.busy = true; sendBtn.disabled = true;
    var typing = document.createElement('div'); typing.className = 'gc-typing'; typing.textContent = 'Thinking…'; log.appendChild(typing); scroll();

    var ctl = new AbortController(); var timer = setTimeout(function () { ctl.abort(); }, 32000);
    var history = state.msgs.slice(-8).map(function (m) { return { role: m.role, content: m.content }; });
    fetch('/api/chat', { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history }) })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        typing.remove();
        if (d && d.reply) reply(d.reply, d.actions);
        else reply('Something went wrong on my side. Please try again, or email ' + CONTACT_EMAIL + '.', [{ type: 'enquiry' }]);
      })
      .catch(function () {
        typing.remove();
        reply('I could not reach the assistant just now. Please try again in a moment, or email ' + CONTACT_EMAIL + '.', [{ type: 'enquiry' }]);
      })
      .then(function () { clearTimeout(timer); state.busy = false; sendBtn.disabled = false; input.focus(); });
  }

  // ---------- open / close ----------
  function renderHistory() {
    log.textContent = '';
    bubble('assistant', GREETING);
    state.msgs.forEach(function (m) {
      bubble(m.role, m.content);
      (m.actions || []).forEach(function (a) { if (a.type === 'link') linkCard(a); });
    });
    chips.hidden = state.msgs.length > 0;
  }
  chips.innerHTML = '';
  CHIPS.forEach(function (c) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'gc-chip'; b.textContent = c;
    b.addEventListener('click', function () { send(c); }); chips.appendChild(b);
  });

  var rendered = false;
  function open(quiet) {
    if (!rendered) { renderHistory(); rendered = true; }
    panel.hidden = false;
    if (launcher) { launcher.hidden = true; launcher.setAttribute('aria-expanded', 'true'); }
    voiceBtn.hidden = !(document.querySelector('.lk-toggle') || document.querySelector('.vc-pill'));
    if (window.gvPersona) window.gvPersona.render();
    flag(true);
    if (!quiet) input.focus();
    scroll();
  }
  function close() {
    panel.hidden = true;
    if (launcher) { launcher.hidden = false; launcher.setAttribute('aria-expanded', 'false'); launcher.focus(); }
    flag(false);
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); var t = input.value; input.value = ''; send(t); });
  panel.querySelector('.gc-x').addEventListener('click', close);
  panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  // Hand-off to the existing Bushra / Air voice experience.
  voiceBtn.addEventListener('click', function () {
    var t = document.querySelector('.lk-toggle') || document.querySelector('.vc-pill');
    close();
    if (t) setTimeout(function () { t.click(); }, 150);
  });

  window.gyraqChat = { open: open, close: close, toggle: function () { panel.hidden ? open() : close(); } };
})();
