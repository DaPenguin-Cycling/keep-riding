/**
 * Contact form submission.
 *
 * Posts to the Google Apps Script web app in _config.yml (forms.endpoint) and
 * shows the result inline instead of navigating away.
 *
 * Progressive enhancement: the form has a real `action` and `method="post"`, so
 * with JavaScript off or if this file fails to load, the browser submits it
 * normally and the Apps Script returns its own confirmation page. Nothing here
 * is required for the form to work — it just makes it nicer when it runs.
 *
 * On CORS: an Apps Script /exec URL answers with a 302 to
 * script.googleusercontent.com, which does send Access-Control-Allow-Origin.
 * That only helps if the request is a "simple" one that skips the preflight,
 * because Apps Script will not answer an OPTIONS request. Passing
 * URLSearchParams as the body sets Content-Type to
 * application/x-www-form-urlencoded automatically and we add no custom headers,
 * which keeps it simple and lets us read the JSON reply.
 */
(function () {
  'use strict';

  var form = document.getElementById('contact-form');
  if (!form || !window.fetch || !window.URLSearchParams) return;

  var block = form.closest('.form_block');
  var done = block && block.querySelector('.form_success-message');
  var fail = block && block.querySelector('.form_error-message');
  var button = form.querySelector('[type="submit"]');
  var idleLabel = button ? button.value : 'Send Message';
  var busyLabel = (button && button.getAttribute('data-wait')) || 'Sending...';

  function show(el) { if (el) el.classList.add('is-visible'); }
  function hide(el) { if (el) el.classList.remove('is-visible'); }

  function busy(isBusy) {
    if (!button) return;
    button.disabled = isBusy;
    button.value = isBusy ? busyLabel : idleLabel;
  }

  form.addEventListener('submit', function (event) {
    // Let the browser handle its own validation messages first.
    if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;

    event.preventDefault();
    hide(fail);
    busy(true);

    fetch(form.action, {
      method: 'POST',
      body: new URLSearchParams(new FormData(form))
    })
      .then(function (response) {
        return response.json().catch(function () {
          // Reachable but unreadable — treat a 2xx as sent rather than telling
          // someone it failed when it may well have gone through.
          return { ok: response.ok };
        });
      })
      .then(function (result) {
        if (result && result.ok) {
          form.hidden = true;
          show(done);
          // Move focus to the confirmation so it is announced and so keyboard
          // users are not left on a button that no longer exists.
          if (done) {
            done.setAttribute('tabindex', '-1');
            done.focus();
          }
        } else {
          busy(false);
          show(fail);
        }
      })
      .catch(function () {
        busy(false);
        show(fail);
      });
  });
})();
