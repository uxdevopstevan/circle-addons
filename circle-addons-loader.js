/**
 * Circle Addons Loader
 *
 * Loads a specific version of circle-addons.js based on query string:
 * - ?debugVersion=v1.3  -> {__CIRCLE_ADDONS_SCRIPTS_BASE_URL__}/v1.3/circle-addons.js
 * - ?debugVersion=1.3   -> same as above (auto-prefixes "v")
 *
 * If no debug param is present (or invalid), it loads the defaultVersion.
 *
 * Usage in CMS:
 *   <script src="https://.../circle-addons-loader.js"></script>
 */
(function () {
  'use strict';

  var BASE = __CIRCLE_ADDONS_SCRIPTS_BASE_URL__;
  var PROD_FILE = 'circle-addons.min.js';
  var DEBUG_FILE = 'circle-addons.js';

  // Change this default (or override via window.CIRCLE_ADDONS_DEFAULT_VERSION before this script runs)
  var defaultVersion = (window.CIRCLE_ADDONS_DEFAULT_VERSION || 'v2') + '';

  function getParam(name) {
    try {
      return new URLSearchParams(window.location.search || '').get(name);
    } catch (e) {
      return null;
    }
  }

  function normalizeVersion(raw) {
    if (!raw) return null;
    var v = String(raw).trim();
    if (!v) return null;

    // allow: v1, v1.2, v1.2.3 or 1, 1.2, 1.2.3
    if (v[0] !== 'v' && v[0] !== 'V') v = 'v' + v;
    v = 'v' + v.slice(1); // force lowercase "v"

    if (!/^v\d+(?:\.\d+){0,2}$/.test(v)) return null;
    return v;
  }

  function buildUrl(version) {
    // e.g. BASE + "v1.3/" + FILE
    return BASE + encodeURIComponent(version) + '/' + FILE;
  }

  function alreadyLoaded(url) {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i] && scripts[i].src === url) return true;
    }
    return false;
  }

  var debugVersion = normalizeVersion(getParam('debugVersion'));
  var chosenVersion = debugVersion || normalizeVersion(defaultVersion);
  var fileName = debugVersion ? DEBUG_FILE : PROD_FILE;

  if (!chosenVersion) {
    // Fall back to a conservative known path if the defaultVersion is misconfigured
    chosenVersion = 'v2';
  }

  var url = BASE + encodeURIComponent(chosenVersion) + '/' + fileName;

  if (alreadyLoaded(url)) return;

  var tag = document.createElement('script');
  tag.src = url;
  tag.async = true;

  tag.onload = function () {
    // Minimal log so it’s easy to confirm which version was used.
    // (Safe in production; remove if you prefer silence.)
    try {
      console.log('[Circle Addons Loader] Loaded', chosenVersion, url);
    } catch (e) {}
  };

  tag.onerror = function () {
    try {
      console.error('[Circle Addons Loader] Failed to load', chosenVersion, url);
    } catch (e) {}
  };

  (document.head || document.documentElement || document.body).appendChild(tag);
})();

