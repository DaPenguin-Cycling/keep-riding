/**
 * Mobile navigation toggle.
 *
 * Replaces js/webflow.js, which was 217KB (plus an 89KB jQuery dependency) and,
 * by the end of the rewrite, was only still being loaded to open and close this
 * one menu. Every other Webflow class on the site is styling only.
 *
 * It reuses Webflow's own CSS hooks rather than introducing new ones:
 *   - `[data-nav-menu-open]` on the menu is what webflow.css uses to show it
 *     (`display: block !important` plus absolute positioning under the bar).
 *   - Below 992px, `.w-nav[data-collapse='medium'] .w-nav-menu` is display:none,
 *     so the attribute is the whole show/hide mechanism.
 * That means no new CSS is needed to position the panel.
 *
 * Improvements on what Webflow did: the trigger is a real <button>, so it is
 * focusable and operable from the keyboard natively; `aria-expanded` and
 * `aria-controls` are kept accurate; Escape closes and returns focus to the
 * button; and the menu closes on outside click, on following a link, and when
 * the viewport grows past the breakpoint.
 *
 * Note: with JavaScript disabled the menu cannot be opened on a phone. That was
 * equally true of webflow.js. The footer carries the same five links, so every
 * page is still reachable.
 */
(function () {
  'use strict';

  var nav = document.querySelector('.nav_container');
  if (!nav) return;

  var button = nav.querySelector('.w-nav-button');
  var menu = nav.querySelector('.w-nav-menu');
  if (!button || !menu) return;

  var OPEN_ATTR = 'data-nav-menu-open';

  if (!menu.id) menu.id = 'nav-menu';
  button.setAttribute('aria-controls', menu.id);
  button.setAttribute('aria-expanded', 'false');

  function isOpen() {
    return menu.hasAttribute(OPEN_ATTR);
  }

  function open() {
    menu.setAttribute(OPEN_ATTR, '');
    button.setAttribute('aria-expanded', 'true');
  }

  function close(returnFocus) {
    if (!isOpen()) return;
    menu.removeAttribute(OPEN_ATTR);
    button.setAttribute('aria-expanded', 'false');
    if (returnFocus) button.focus();
  }

  button.addEventListener('click', function () {
    if (isOpen()) close(); else open();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' || event.key === 'Esc') close(true);
  });

  // Tapping anywhere outside the bar dismisses it.
  document.addEventListener('click', function (event) {
    if (isOpen() && !nav.contains(event.target)) close();
  });

  // Following a link should not leave the panel hanging open behind the new page.
  menu.addEventListener('click', function (event) {
    if (event.target.closest('a')) close();
  });

  // Growing past the collapse breakpoint restores the full bar; drop the
  // attribute so the menu is not left in a half-open state.
  var wide = window.matchMedia('(min-width: 992px)');
  function onBreakpoint() {
    if (wide.matches) close();
  }
  if (wide.addEventListener) wide.addEventListener('change', onBreakpoint);
  else if (wide.addListener) wide.addListener(onBreakpoint);
})();
