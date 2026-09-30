/**
 * The events GA4 does not capture on its own.
 *
 * Enhanced measurement (on by default in the property) already handles
 * page_view, scroll, outbound clicks, and file downloads, so none of that is
 * repeated here. What it misses on this site:
 *
 *   - `mailto:` links. They are not outbound clicks — the browser hands them to
 *     a mail app and never navigates — so GA4 sees nothing at all.
 *   - The contact form. Enhanced measurement's form_submit listens for a normal
 *     submit; js/contact-form.js calls preventDefault and posts with fetch, so
 *     that signal is unreliable. This fires only after the endpoint confirms.
 *   - The Work With Me calls to action. These are ordinary internal links, so
 *     GA4 records the resulting page_view but nothing about what drove it.
 *   - The video clips. Enhanced measurement's video_* events cover embedded
 *     YouTube only. These seven are self-hosted <video>, so without the
 *     listeners below there is no record that anyone ever pressed play.
 *   - WhatsApp and the social profiles. Technically outbound clicks, so
 *     already counted — but only as a generic `click` that has to be filtered
 *     by URL to find.
 *
 * This site exists partly to attract sponsors, which shapes what is worth
 * measuring. Three tiers, and they are not equally important:
 *
 *   LEAD       contact_form_submit, email_click
 *              Someone got in touch. These are the ones to mark as key events.
 *   INTENT     work_with_me_click
 *              Someone went looking for the partnership page. Not a lead, but
 *              the best predictor of one, and the thing to optimise for.
 *   AUDIENCE   video_play, video_complete, strava_click, facebook_click
 *              Evidence of reach and engagement — what a prospective sponsor
 *              actually asks about. Deliberately NOT key events: marking these
 *              would inflate the conversion rate and bury the real leads.
 *
 * On event names versus parameters. Custom parameters do not appear in GA4
 * reports until someone registers them as custom dimensions in the admin, so
 * anything that must work with zero setup gets its own event name. Parameters
 * carry the detail that is worth the extra step:
 *
 *   form_topic     on contact_form_submit — Cycling / Event / Partnership /
 *                  Media / Something else. The form already asks and the
 *                  answer was being discarded. On a sponsorship site this is
 *                  the difference between "someone wrote in" and "someone
 *                  wrote in about sponsorship", which is the whole question.
 *   link_location  on the click events — nav, footer, or the heading of the
 *                  section the link sits in, so two CTAs on one page can be
 *                  told apart.
 *   video_title    on the video events.
 *
 * Note that "which page" needs no parameter at all: GA4 attaches
 * page_location to every event automatically, so a mailto click on the
 * contact page is already distinguishable from one anywhere else.
 *
 * This file is loaded only by _includes/analytics.html, which means only when
 * a measurement ID is configured and only in a production build. `trackEvent`
 * still checks for gtag before calling it, so a blocked or failed gtag.js
 * makes this a no-op rather than a TypeError.
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

  /**
   * Where on the page a link sits. Combined with the page_location GA4 sends
   * for free, this answers "which button did they press" rather than merely
   * "which page were they on" — the difference between knowing the home page
   * produces leads and knowing which block on it does.
   *
   * Falls back through nav, footer, then the nearest section's own heading,
   * slugged. That yields readable values like `work_with_me` or `latest_ride`
   * without needing a data attribute on every link in the markup.
   */
  function linkLocation(el) {
    if (!el.closest) return 'unknown';
    if (el.closest('.nav_container')) return 'nav';
    if (el.closest('footer')) return 'footer';
    var section = el.closest('section, header');
    if (section) {
      var heading = section.querySelector('h1, h2');
      if (heading && heading.textContent) {
        return heading.textContent.trim().toLowerCase()
          .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
      }
    }
    return 'body';
  }

  // One delegated listener on the document rather than per-link binding: it
  // covers the footer and every page's body with one handler, and it keeps
  // working if markup is added later. Capture phase, so a handler that stops
  // propagation somewhere in between cannot swallow the hit.
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href]');
    if (!link) return;

    var href = link.getAttribute('href') || '';
    var where = linkLocation(link);

    if (href.indexOf('mailto:') === 0) {
      window.trackEvent('email_click', { link_location: where });

    // Dormant rather than dead. The WhatsApp option is hidden until there is
    // a wa.link business link (see contact.whatsapp_url in _config.yml); this
    // branch handles both spellings and starts reporting the day it returns.
    } else if (href.indexOf('wa.me') !== -1 || href.indexOf('wa.link') !== -1) {
      window.trackEvent('whatsapp_click', { link_location: where });

    } else if (href.indexOf('/work-with-me') !== -1) {
      window.trackEvent('work_with_me_click', { link_location: where });

    } else if (href.indexOf('strava.com') !== -1 || href.indexOf('strava.app.link') !== -1) {
      window.trackEvent('strava_click', { link_location: where });

    } else if (href.indexOf('facebook.com') !== -1) {
      window.trackEvent('facebook_click', { link_location: where });
    }
  }, true);

  /**
   * Self-hosted video.
   *
   * GA4's automatic video tracking is YouTube-only, so these seven clips were
   * invisible — which matters here, because "do people actually watch them"
   * is the first thing a prospective sponsor asks and the site could not
   * answer it.
   *
   * `play` fires again after every pause, so the first one per clip is the
   * only one that means anything; a `played` flag keeps the count honest.
   * `ended` is left unguarded on purpose — watching a clip twice really is
   * two completions.
   *
   * The title comes from the <figcaption>, falling back to the aria-label the
   * markup already sets. Titles rather than filenames so the report reads
   * like the page.
   */
  var videos = document.querySelectorAll('video');
  Array.prototype.forEach.call(videos, function (video) {
    var figure = video.closest ? video.closest('figure') : null;
    var caption = figure ? figure.querySelector('figcaption') : null;
    var title = (caption && caption.textContent.trim()) ||
                video.getAttribute('aria-label') || 'untitled';
    var played = false;

    video.addEventListener('play', function () {
      if (played) return;
      played = true;
      window.trackEvent('video_play', { video_title: title });
    });

    video.addEventListener('ended', function () {
      window.trackEvent('video_complete', { video_title: title });
    });
  });
})();
