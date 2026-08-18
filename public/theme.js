/* Your Shop shared light/dark switch — v1.3
 *
 * Two jobs, and the order matters:
 *
 *   1. Set the theme on <html> BEFORE the page paints. Load this with a
 *      plain <script src> in <head> — not defer, not at the end of body.
 *      Deferred, the browser paints the light page first and the shop
 *      floor gets a white flash on every navigation at night.
 *
 *   2. Render a toggle into <span id="theme-toggle"> once the DOM is up.
 *
 * Default is whatever the operating system asks for. A choice made here
 * overrides that and sticks, per browser, until the user clears it.
 *
 * Keep this file identical across apps — copy it, don't fork it.
 */
(function () {
  var KEY = 'kanban-theme';
  var root = document.documentElement;

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function systemPref() {
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
  }

  // Runs at parse time, before first paint.
  apply(stored() || systemPref());

  // Follow the OS while the user hasn't expressed a preference of their
  // own — so a machine set to switch at sunset carries the apps with it.
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () { if (!stored()) apply(systemPref()); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  var SUN =
    '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/>' +
    '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2' +
    'M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var MOON =
    '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  function mount() {
    var slot = document.getElementById('theme-toggle');
    // Fall back to the header's control cluster, same as the app switcher, so
    // an app gets the toggle without editing its markup.
    if (!slot) {
      var host = document.querySelector('.app-header .controls, .app-header .right, .controls');
      if (!host) return;
      slot = document.createElement('span');
      slot.id = 'theme-toggle';
      host.appendChild(slot);
    }
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle';
    btn.innerHTML = SUN + MOON;
    function label() {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      btn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
      btn.setAttribute('title', 'Switch to ' + next + ' theme');
    }
    label();
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      apply(next);
      try { localStorage.setItem(KEY, next); } catch (e) { /* private mode */ }
      label();
    });
    slot.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
