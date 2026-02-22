/*!
 * ru-guard.js v1.0.0
 * Detects Russian users and applies content restrictions.
 * License: MIT
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RuGuard = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ─── Defaults ──────────────────────────────────────────────────────────── */

  var DEFAULTS = {
    /**
     * How to detect Russian users:
     *   'timezone'     — only by browser timezone  (sync, instant)
     *   'ip'           — only by IP geolocation    (async, ~100–300 ms)
     *   'ip+timezone'  — IP AND timezone must match (async, strictest)
     *   'ip|timezone'  — IP OR  timezone matches   (async, broadest)
     */
    detection: 'ip|timezone',

    /**
     * Primary IP-geolocation API endpoint.
     * Must return JSON with a `country_code` field (ISO 3166-1 alpha-2).
     * Default: ipapi.co (free, no key, 1 000 req/day)
     */
    ipApiUrl: 'https://ipapi.co/json/',

    /**
     * Fallback endpoint if the primary fails.
     * ip-api.com: free, no key, 45 req/min, returns `countryCode`.
     */
    ipApiFallbackUrl: 'https://ip-api.com/json/',

    /** Timeout in ms for each IP API request */
    ipTimeout: 4000,

    /** Words to blur inside .ru-censor-words blocks */
    censoredWords: ['VPN', 'впн', 'ВПН'],

    /** CSS blur radius */
    blurAmount: '20px',

    /** Alert message for .ru-censor-alert */
    alertText: 'Материал недоступен на территории РФ',

    /** Warning message for .ru-only-alert shown to non-Russian visitors */
    nonRuAlertText: 'Этот материал предназначен только для аудитории из России',
  };

  /* ─── Russian IANA timezone list ────────────────────────────────────────── */

  var RU_TZ = {
    'Europe/Kaliningrad':1, 'Europe/Moscow':1,      'Europe/Samara':1,
    'Asia/Yekaterinburg':1, 'Asia/Omsk':1,          'Asia/Novosibirsk':1,
    'Asia/Novokuznetsk':1,  'Asia/Barnaul':1,       'Asia/Tomsk':1,
    'Asia/Krasnoyarsk':1,   'Asia/Irkutsk':1,       'Asia/Chita':1,
    'Asia/Yakutsk':1,       'Asia/Ust-Nera':1,      'Asia/Vladivostok':1,
    'Asia/Sakhalin':1,      'Asia/Srednekolymsk':1, 'Asia/Magadan':1,
    'Asia/Kamchatka':1,     'Asia/Anadyr':1
  };

  /* ─── Timezone detection (sync) ─────────────────────────────────────────── */

  function detectRuByTimezone() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return !!(tz && RU_TZ[tz]);
    } catch (e) {
      return false;
    }
  }

  /* ─── IP detection (async) ──────────────────────────────────────────────── */

  /** Fetch a URL with an AbortController timeout; returns parsed JSON or null */
  function fetchJson(url, timeoutMs) {
    return new Promise(function (resolve) {
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = ctrl
        ? setTimeout(function () { ctrl.abort(); }, timeoutMs)
        : null;

      var opts = ctrl ? { signal: ctrl.signal } : {};
      fetch(url, opts)
        .then(function (r) {
          clearTimeout(timer);
          return r.ok ? r.json() : null;
        })
        .then(function (data) { resolve(data); })
        .catch(function () { clearTimeout(timer); resolve(null); });
    });
  }

  /** Extract country code from various API response shapes */
  function extractCountry(data) {
    if (!data) return null;
    // ipapi.co  → { country_code: "RU" }
    // ip-api.com → { countryCode: "RU" }
    return (data.country_code || data.countryCode || data.country || '').toUpperCase() || null;
  }

  /** Detect Russian IP; tries primary then fallback */
  function detectRuByIp(cfg) {
    return fetchJson(cfg.ipApiUrl, cfg.ipTimeout).then(function (data) {
      var country = extractCountry(data);
      if (country) return country === 'RU';

      // Primary failed — try fallback
      return fetchJson(cfg.ipApiFallbackUrl, cfg.ipTimeout).then(function (fb) {
        var fbCountry = extractCountry(fb);
        return fbCountry ? fbCountry === 'RU' : null; // null = unknown
      });
    });
  }

  /* ─── Combined detection ────────────────────────────────────────────────── */

  /**
   * Returns a Promise<{ isRu: bool, method: string, tzMatch: bool, ipMatch: bool|null }>
   */
  function detect(cfg) {
    var tzMatch = detectRuByTimezone();

    if (cfg.detection === 'timezone') {
      return Promise.resolve({ isRu: tzMatch, method: 'timezone', tzMatch: tzMatch, ipMatch: null });
    }

    return detectRuByIp(cfg).then(function (ipMatch) {
      var isRu;
      if (cfg.detection === 'ip') {
        // Unknown IP (both APIs failed) → fall back to timezone
        isRu = (ipMatch === null) ? tzMatch : ipMatch;
      } else if (cfg.detection === 'ip+timezone') {
        isRu = (ipMatch === null) ? tzMatch : (ipMatch && tzMatch);
      } else {
        // 'ip|timezone' — default
        isRu = (ipMatch === null) ? tzMatch : (ipMatch || tzMatch);
      }
      return { isRu: !!isRu, method: cfg.detection, tzMatch: tzMatch, ipMatch: ipMatch };
    });
  }

  /* ─── DOM helpers ───────────────────────────────────────────────────────── */

  var OVERLAY_BASE = [
    'position:absolute', 'inset:0', 'display:flex',
    'align-items:center', 'justify-content:center',
    'color:#fff',
    'font-family:system-ui,-apple-system,sans-serif',
    'font-size:13px', 'font-weight:600', 'text-align:center',
    'padding:16px', 'letter-spacing:.03em', 'z-index:9999',
    'pointer-events:none', 'border-radius:inherit',
    'box-sizing:border-box', 'filter:none',
  ].join(';');

  function makeOverlay(text, bgColor) {
    var ov = document.createElement('div');
    ov.setAttribute('role', 'status');
    ov.setAttribute('aria-label', text);
    ov.style.cssText = OVERLAY_BASE + ';background:' + bgColor + ';';
    ov.textContent = text;
    return ov;
  }

  function wrapWithOverlay(el, overlay) {
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;display:block;width:100%;';
    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(el);
    wrapper.appendChild(overlay);
  }

  /** Apply blur + optional overlay */
  function applyCensor(el, alertText, blur) {
    el.style.filter = 'blur(' + blur + ')';
    el.style.userSelect = 'none';
    el.style.webkitUserSelect = 'none';

    if (alertText) {
      wrapWithOverlay(el, makeOverlay('\uD83D\uDEAB\u2002' + alertText, 'rgba(0,0,0,0.62)'));
    } else {
      // Still needs a wrapper so position:relative works without mutating el layout
      var w = document.createElement('div');
      w.style.cssText = 'position:relative;display:block;width:100%;';
      el.parentNode.insertBefore(w, el);
      w.appendChild(el);
    }
  }

  function escRx(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** Walk text nodes in `el`, wrap matched words in blurred spans */
  function censorWords(el, words, blur) {
    if (!words || !words.length) return;
    var rx = new RegExp('(' + words.map(escRx).join('|') + ')', 'gi');
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);

    for (var i = 0; i < nodes.length; i++) {
      var tn = nodes[i], val = tn.nodeValue;
      if (!rx.test(val)) { rx.lastIndex = 0; continue; }
      rx.lastIndex = 0;

      var frag = document.createDocumentFragment(), last = 0, m;
      while ((m = rx.exec(val)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(val.slice(last, m.index)));
        var span = document.createElement('span');
        span.style.cssText = 'filter:blur(' + blur + ');user-select:none;-webkit-user-select:none;display:inline-block;cursor:not-allowed;';
        span.setAttribute('title', 'Слово заблокировано');
        span.textContent = m[0];
        frag.appendChild(span);
        last = m.index + m[0].length;
      }
      if (last < val.length) frag.appendChild(document.createTextNode(val.slice(last)));
      tn.parentNode.replaceChild(frag, tn);
    }
  }

  /* ─── Apply DOM rules based on detection result ─────────────────────────── */

  function applyRules(isRu, cfg) {
    var result = { hidden: 0, censored: 0, alerts: 0, wordBlocks: 0, ruOnly: 0, ruOnlyAlerts: 0 };
    var i, els;

    if (isRu) {
      /* ── Rules for Russian users ── */

      // ru-hide → invisible
      els = document.querySelectorAll('.ru-hide');
      for (i = 0; i < els.length; i++) els[i].style.display = 'none';
      result.hidden = els.length;

      // ru-censor (no alert)
      els = document.querySelectorAll('.ru-censor:not(.ru-censor-alert)');
      for (i = 0; i < els.length; i++) applyCensor(els[i], null, cfg.blurAmount);
      result.censored = els.length;

      // ru-censor-alert
      els = document.querySelectorAll('.ru-censor-alert');
      for (i = 0; i < els.length; i++) applyCensor(els[i], cfg.alertText, cfg.blurAmount);
      result.alerts = els.length;

      // ru-censor-words
      els = document.querySelectorAll('.ru-censor-words');
      for (i = 0; i < els.length; i++) censorWords(els[i], cfg.censoredWords, cfg.blurAmount);
      result.wordBlocks = els.length;

      // ru-only → stays visible (nothing to do)
      // ru-only-alert → stays visible, no overlay

    } else {
      /* ── Rules for non-Russian users ── */

      // ru-only → hidden
      els = document.querySelectorAll('.ru-only:not(.ru-only-alert)');
      for (i = 0; i < els.length; i++) els[i].style.display = 'none';
      result.ruOnly = els.length;

      // ru-only-alert → show warning overlay (content stays, overlaid with message)
      els = document.querySelectorAll('.ru-only-alert');
      for (i = 0; i < els.length; i++) {
        wrapWithOverlay(
          els[i],
          makeOverlay('\u26A0\uFE0F\u2002' + cfg.nonRuAlertText, 'rgba(120,70,0,0.75)')
        );
      }
      result.ruOnlyAlerts = els.length;
    }

    return result;
  }

  /* ─── Public API ────────────────────────────────────────────────────────── */

  /**
   * Merge user config over defaults.
   */
  function mergeConfig(config) {
    var cfg = {}, k;
    for (k in DEFAULTS) cfg[k] = DEFAULTS[k];
    if (config) for (k in config) cfg[k] = config[k];
    return cfg;
  }

  /**
   * run(config?) → Promise<result>
   * Detects the user, applies DOM rules immediately, resolves with a result object.
   */
  function run(config) {
    var cfg = mergeConfig(config);
    return detect(cfg).then(function (det) {
      var rules = applyRules(det.isRu, cfg);
      return Object.assign ? Object.assign({}, det, rules)
        : (function () {
            var r = {}, k;
            for (k in det)   r[k] = det[k];
            for (k in rules) r[k] = rules[k];
            return r;
          })();
    });
  }

  /**
   * init(config?) → Promise<result>
   * Waits for DOMContentLoaded, then runs.
   */
  function init(config) {
    return new Promise(function (resolve) {
      function go() { run(config).then(resolve); }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', go);
      } else {
        go();
      }
    });
  }

  /**
   * isRussianUser(config?) → Promise<bool>
   * Convenience: just resolves to the boolean detection result.
   */
  function isRussianUser(config) {
    return detect(mergeConfig(config)).then(function (d) { return d.isRu; });
  }

  return { run: run, init: init, isRussianUser: isRussianUser };
});

/* Auto-bootstrap: <script src="ru-guard.js" data-auto></script> */
(function () {
  var me = document.currentScript;
  if (me && me.hasAttribute('data-auto') && typeof RuGuard !== 'undefined') {
    RuGuard.init();
  }
})();
