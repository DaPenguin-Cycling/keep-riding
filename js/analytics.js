/**
 * The events GA4 does not capture on its own.
 *
 * Enhanced measurement (on by default in the property) already handles
 * page_view, scroll, outbound clicks, and file downloads, so none of that is
 * repeated here. What it misses on this site:
 *
 *   - `mailto:` links. They are not outbound clicks — the browser hands them to
 *     a mail app and never navigates — so GA4 sees nothing at all. On a site
 *     whose contact page leads with an email address, that is the conversion.
 *   - The contact form. Enhanced measurement's form_submit listens for a normal
 *     submit; js/contact-form.js calls preventDefault and posts with fetch, so
 *     that signal is unreliable. This fires only after the endpoint confirms.
 *   - WhatsApp. This one *is* an outbound click, so it is technically already
 *     counted — but only as a generic `click` event that has to be filtered by
 *     URL to find. A named event shows up in Reports → Engagement → Events with
 *     no setup.
 *
 * Distinct event names rather than one `contact` event with a `method`
 * parameter: custom parameters need registering as custom dimensions in the GA4
 * admin before any report will show them, and nobody is going to do that.
 * Separate names are visible immediately.
 *
 * This file is loaded only by _includes/analytics.html, which means only when a
 * measurement ID is configured and only in a production build. `trackEvent`
 * still checks for gtag before calling it, so a blocked or failed gtag.js makes
 * this a no-op instead of a TypeError.
 */
(function () {
  'use strict';

  /**
   * Send one event to GA4. Safe to call whether or not gtag.js loaded.
   * Exposed on `window` so js/contact-form.js can report a successful submit
   * without knowing anything about analytics.
   */
  window.trackEvent = function (name, params) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, params || {});
  };

  // One delegated listener on the document rather than per-link binding: it
  // covers the footer and every page's body with one handler, and it keeps
  // working if markup is added later. Capture phase, so a handler that stops
  // propagation somewhere in between cannot swallow the hit.
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href]');
    if (!link) return;

    var href = link.getAttribute('href') || '';

    if (href.indexOf('mailto:') === 0) {
      window.trackEvent('email_click');
    } else if (href.indexOf('wa.me') !== -1 || href.indexOf('wa.link') !== -1) {
      window.trackEvent('whatsapp_click');
    }
  }, true);
})();
