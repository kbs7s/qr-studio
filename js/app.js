/* QR Studio — Upgraded main app logic. Plain browser JS, no build step. */
(function () {
  'use strict';

  var t = I18N.t;
  var $ = function (id) { return document.getElementById(id); };

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------
  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
    } catch (e) { /* private mode / blocked storage */ }
    return null;
  }
  function readJSON(key) { try { return JSON.parse(store(key) || 'null'); } catch (e) { return null; } }

  var toastTimer;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2400);
  }

  function copy(text) {
    var done = function () { toast(t('copied')); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
      ta.remove();
    }
  }

  function debounce(fn, ms) {
    var h; return function () { var a = arguments, s = this; clearTimeout(h); h = setTimeout(function () { fn.apply(s, a); }, ms); };
  }

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'on') Object.keys(attrs.on).forEach(function (ev) { n.addEventListener(ev, attrs.on[ev]); });
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function luminance(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255].map(function (v) {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }).reduce(function (s, v, i) { return s + v * [0.2126, 0.7152, 0.0722][i]; }, 0);
  }
  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  function toUtf8Binary(s) {
    if (!/[^\x00-\x7f]/.test(s)) return s;
    var bytes = new TextEncoder().encode(s), out = '';
    for (var i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    return out;
  }

  // ---------------------------------------------------------------------------
  // Theme (Light / Dark manual toggle + system fallback)
  // ---------------------------------------------------------------------------
  var THEME_KEY = 'qrstudio.theme';
  function effectiveTheme() {
    var saved = store(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return 'dark';
  }
  function applyTheme(mode) {
    var theme = (mode === 'light') ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    var isDark = theme === 'dark';
    $('themeIconMoon').hidden = isDark;
    $('themeIconSun').hidden = !isDark;
    var meta = $('metaThemeColor');
    if (meta) meta.setAttribute('content', isDark ? '#09090d' : '#f6f5f0');
  }
  $('themeBtn').addEventListener('click', function () {
    var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    store(THEME_KEY, next);
    applyTheme(next);
  });
  applyTheme(store(THEME_KEY));

  // ---------------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------------
  var tabs = { create: $('tab-create'), scan: $('tab-scan'), history: $('tab-history') };
  function showTab(name) {
    Object.keys(tabs).forEach(function (k) {
      var on = k === name;
      tabs[k].setAttribute('aria-selected', String(on));
      $('panel-' + k).hidden = !on;
    });
    if (name !== 'scan') stopCamera();
    if (name === 'history') renderHistory();
    store('qrstudio.tab', name);
  }
  tabs.create.addEventListener('click', function () { showTab('create'); });
  tabs.scan.addEventListener('click', function () { showTab('scan'); });
  tabs.history.addEventListener('click', function () { showTab('history'); });

  var activeStudioTab = 'presets';
  function showStudioTab(name) {
    if (currentType === 'barcode') name = 'colors';
    activeStudioTab = name;
    document.querySelectorAll('#studioTabs [data-studio]').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.getAttribute('data-studio') === name));
    });
    document.querySelectorAll('[data-studio-pane]').forEach(function (pane) {
      var isTarget = pane.getAttribute('data-studio-pane') === name;
      var qrBlocked = currentType === 'barcode' && pane.hasAttribute('data-qr-only');
      pane.hidden = !isTarget || qrBlocked;
    });
  }
  document.querySelectorAll('#studioTabs [data-studio]').forEach(function (b) {
    b.addEventListener('click', function () { showStudioTab(b.getAttribute('data-studio')); });
  });

  // ---------------------------------------------------------------------------
  // CREATE: content type + form
  // ---------------------------------------------------------------------------
  var form = $('dataForm');
  var currentType = 'url';

  function setType(type) {
    currentType = type;
    document.querySelectorAll('#typeChips [data-type]').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.getAttribute('data-type') === type));
    });
    form.querySelectorAll('fieldset[data-form]').forEach(function (fs) {
      var on = fs.getAttribute('data-form') === type;
      fs.hidden = !on;
      fs.disabled = !on;
    });
    document.querySelectorAll('[data-qr-only]').forEach(function (n) { n.hidden = type === 'barcode'; });
    if (type === 'barcode') {
      showStudioTab('colors');
    } else {
      showStudioTab(activeStudioTab);
    }
    $('gradWrap').hidden = type === 'barcode' || !style.gradient;
    updateBarcodeHint();
    store('qrstudio.type', type);
    render();
  }
  document.querySelectorAll('#typeChips [data-type]').forEach(function (b) {
    b.addEventListener('click', function () { setType(b.getAttribute('data-type')); });
  });

  function formValues() {
    var fs = form.querySelector('fieldset[data-form="' + currentType + '"]');
    var v = {};
    if (!fs) return v;
    fs.querySelectorAll('input[name], textarea[name], select[name]').forEach(function (i) {
      v[i.name] = i.type === 'checkbox' ? i.checked : i.value;
    });
    return v;
  }

  function payload() { return Payloads.build[currentType](formValues()); }

  form.addEventListener('change', function () { render(); });

  // Wi-Fi niceties
  var secSel = form.querySelector('[name="security"]');
  function syncWifi() {
    var none = secSel.value === 'nopass';
    form.querySelectorAll('[data-wifi-pass]').forEach(function (n) { n.hidden = none; });
  }
  secSel.addEventListener('change', syncWifi);
  $('showPass').addEventListener('change', function (e) {
    form.querySelector('[name="password"]').type = e.target.checked ? 'text' : 'password';
  });
  syncWifi();

  function updateBarcodeHint() { $('bcHint').textContent = t('bcHint_' + $('bcFormat').value); }
  $('bcFormat').addEventListener('change', updateBarcodeHint);

  // Location
  $('locateBtn').addEventListener('click', function () {
    var msg = $('locateMsg');
    if (!navigator.geolocation) { msg.textContent = t('locationFailed'); return; }
    msg.textContent = t('locating');
    navigator.geolocation.getCurrentPosition(function (pos) {
      form.querySelector('[name="lat"]').value = pos.coords.latitude.toFixed(6);
      form.querySelector('[name="lng"]').value = pos.coords.longitude.toFixed(6);
      msg.textContent = '';
      render();
    }, function () { msg.textContent = t('locationFailed'); }, { enableHighAccuracy: true, timeout: 15000 });
  });

  // ---------------------------------------------------------------------------
  // CREATE: style studio
  // ---------------------------------------------------------------------------
  var DEFAULT_STYLE = {
    fg: '#111827', corner: '#4f46e5', bg: '#ffffff',
    gradient: false, grad: '#7c3aed', gradType: 'linear', gradAngle: 45, transparent: false,
    dot: 'rounded', cornerSq: 'extra-rounded', cornerDot: 'dot',
    frame: 'none', frameLabel: 'SCAN ME',
    ec: 'M', margin: 16, logo: null, quickIcon: null, logoSize: 0.35, logoClear: true
  };
  var style = Object.assign({}, DEFAULT_STYLE, readJSON('qrstudio.style') || {});

  var PRESETS = [
    { name: 'Indigo Atelier', fg: '#111827', corner: '#4f46e5', bg: '#ffffff', gradient: false, dot: 'rounded', cornerSq: 'extra-rounded', cornerDot: 'dot' },
    { name: 'Classic Ink', fg: '#000000', corner: '#000000', bg: '#ffffff', gradient: false, dot: 'square', cornerSq: 'square', cornerDot: 'square' },
    { name: 'Ocean Indigo', fg: '#1d4ed8', corner: '#1e3a8a', bg: '#eff6ff', gradient: true, grad: '#0ea5e9', gradType: 'linear', gradAngle: 45, dot: 'rounded', cornerSq: 'extra-rounded', cornerDot: 'dot' },
    { name: 'Sunset Coral', fg: '#9a3412', corner: '#be123c', bg: '#fff7ed', gradient: true, grad: '#e11d48', gradType: 'linear', gradAngle: 135, dot: 'dots', cornerSq: 'dot', cornerDot: 'dot' },
    { name: 'Forest Emerald', fg: '#14532d', corner: '#047857', bg: '#f0fdf4', gradient: false, dot: 'classy-rounded', cornerSq: 'extra-rounded', cornerDot: 'rounded' },
    { name: 'Royal Plum', fg: '#581c87', corner: '#9d174d', bg: '#fdf4ff', gradient: true, grad: '#db2777', gradType: 'linear', gradAngle: 45, dot: 'extra-rounded', cornerSq: 'extra-rounded', cornerDot: 'dot' },
    { name: 'Midnight Gold', fg: '#1e293b', corner: '#b45309', bg: '#fffbeb', gradient: false, dot: 'classy', cornerSq: 'classy', cornerDot: 'classy' },
    { name: 'Rose Quartz', fg: '#881337', corner: '#be185d', bg: '#fff1f2', gradient: true, grad: '#f43f5e', gradType: 'radial', gradAngle: 45, dot: 'dots', cornerSq: 'extra-rounded', cornerDot: 'dot' },
    { name: 'Carbon Slate', fg: '#1e293b', corner: '#334155', bg: '#f8fafc', gradient: false, dot: 'rounded', cornerSq: 'square', cornerDot: 'rounded' },
    { name: 'Cyber Mint', fg: '#0f766e', corner: '#0369a1', bg: '#f0fdfa', gradient: true, grad: '#2563eb', gradType: 'linear', gradAngle: 45, dot: 'extra-rounded', cornerSq: 'dot', cornerDot: 'dot' }
  ];

  var DOT_SHAPES = {
    'square': '<rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/>',
    'dots': '<circle cx="7" cy="7" r="4"/><circle cx="17" cy="7" r="4"/><circle cx="7" cy="17" r="4"/>',
    'rounded': '<path d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H11v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/>',
    'extra-rounded': '<path d="M3 7a4 4 0 0 1 4-4h10a4 4 0 0 1 0 8h-6v6a4 4 0 0 1-8 0z"/>',
    'classy': '<path d="M3 3h12a6 6 0 0 1 6 6v2H11v10H9a6 6 0 0 1-6-6z"/>',
    'classy-rounded': '<path d="M6 3h9a6 6 0 0 1 6 6v2H11v10H9a6 6 0 0 1-6-6V6a3 3 0 0 1 3-3z"/>'
  };
  var CORNER_SHAPES = {
    'square': '<path fill-rule="evenodd" d="M2 2h20v20H2zM6 6v12h12V6z"/>',
    'extra-rounded': '<path fill-rule="evenodd" d="M8 2h8a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6V8a6 6 0 0 1 6-6zm0 4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z"/>',
    'dot': '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"/>',
    'classy': '<path fill-rule="evenodd" d="M2 2h14a6 6 0 0 1 6 6v14H8a6 6 0 0 1-6-6zM6 6v10a2 2 0 0 0 2 2h10V8a2 2 0 0 0-2-2z"/>'
  };
  var CORNER_DOT_SHAPES = {
    'square': '<rect x="6" y="6" width="12" height="12"/>',
    'dot': '<circle cx="12" cy="12" r="6.5"/>',
    'rounded': '<rect x="6" y="6" width="12" height="12" rx="3"/>',
    'classy': '<path d="M6 6h8a4 4 0 0 1 4 4v8h-8a4 4 0 0 1-4-4z"/>'
  };
  var SHAPE_LABEL = {
    'square': 'shapeSquare', 'dots': 'shapeDots', 'rounded': 'shapeRounded', 'extra-rounded': 'shapeExtraRounded',
    'classy': 'shapeClassy', 'classy-rounded': 'shapeClassyRounded', 'dot': 'shapeDot'
  };

  var QUICK_ICONS = {
    wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1.2" fill="currentColor"/>',
    url: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    whatsapp: '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.6-5.2A8.5 8.5 0 1 1 21 11.5z"/>',
    contact: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    email: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/>',
    phone: '<path d="M22 17v3a2 2 0 0 1-2 2A19 19 0 0 1 2 4a2 2 0 0 1 2-2h3l2 5-2.5 1.5a11 11 0 0 0 5 5L13 13l5 2z"/>',
    geo: '<path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'
  };

  function makeIconLogoDataUrl(iconKey, accentHex) {
    var inner = QUICK_ICONS[iconKey] || QUICK_ICONS.star;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">' +
      '<rect x="6" y="6" width="116" height="116" rx="28" fill="' + accentHex + '"/>' +
      '<g transform="translate(28,28) scale(3)" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      inner.replace(/currentColor/g, '#ffffff') + '</g></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function buildQuickIcons() {
    var box = $('quickLogoIcons');
    box.innerHTML = '';
    Object.keys(QUICK_ICONS).forEach(function (k) {
      var b = el('button', { type: 'button', 'class': 'quick-icon-btn', 'aria-label': k, title: k });
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + QUICK_ICONS[k] + '</svg>';
      b.setAttribute('aria-pressed', String(style.quickIcon === k));
      b.addEventListener('click', function () {
        if (style.quickIcon === k) {
          style.quickIcon = null;
          style.logo = null;
        } else {
          style.quickIcon = k;
          style.logo = makeIconLogoDataUrl(k, style.corner || style.fg);
          if (style.ec === 'L' || style.ec === 'M') style.ec = 'H';
        }
        syncStyleControls();
        styleChanged();
      });
      box.appendChild(b);
    });
  }

  function buildShapePicker(container, shapes, key) {
    container.innerHTML = '';
    Object.keys(shapes).forEach(function (name) {
      var b = el('button', { type: 'button', role: 'radio', 'class': 'shape', 'data-shape': name });
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + shapes[name] + '</svg>';
      b.appendChild(el('span', { text: t(SHAPE_LABEL[name]) }));
      b.setAttribute('aria-checked', String(style[key] === name));
      b.addEventListener('click', function () {
        style[key] = name;
        container.querySelectorAll('.shape').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
        styleChanged();
      });
      container.appendChild(b);
    });
  }

  function buildPresets() {
    var box = $('presets');
    box.innerHTML = '';
    PRESETS.forEach(function (p, i) {
      var bgc = p.gradient ? 'linear-gradient(135deg,' + p.fg + ',' + p.grad + ')' : p.fg;
      var active = style.fg === p.fg && style.corner === p.corner && style.bg === p.bg && !!style.gradient === !!p.gradient;
      var sw = el('span', { 'class': 'preset-swatch', 'aria-hidden': 'true' });
      sw.style.background = 'radial-gradient(circle at 50% 50%, ' + p.bg + ' 0 26%, transparent 28%), ' + bgc;
      sw.style.borderColor = p.corner;
      var b = el('button', { type: 'button', 'class': 'preset-card', title: p.name, 'aria-pressed': String(active) }, [
        sw,
        el('span', { 'class': 'preset-name', text: p.name })
      ]);
      b.addEventListener('click', function () {
        Object.assign(style, p);
        if (style.quickIcon) style.logo = makeIconLogoDataUrl(style.quickIcon, style.corner || style.fg);
        syncStyleControls();
        styleChanged();
      });
      box.appendChild(b);
    });
  }

  function syncStyleControls() {
    $('fgColor').value = style.fg;
    $('cornerColor').value = style.corner;
    $('bgColor').value = style.bg;
    $('gradColor').value = style.grad;
    $('fgHex').textContent = style.fg.toUpperCase();
    $('cornerHex').textContent = style.corner.toUpperCase();
    $('bgHex').textContent = style.bg.toUpperCase();
    $('useGradient').checked = style.gradient;
    $('gradWrap').hidden = currentType === 'barcode' || !style.gradient;
    $('gradType').value = style.gradType || 'linear';
    $('gradAngle').value = style.gradAngle != null ? style.gradAngle : 45;
    $('gradAngleVal').textContent = ($('gradAngle').value) + '°';
    $('gradAngleWrap').hidden = (style.gradType === 'radial');
    $('transparentBg').checked = style.transparent;
    $('margin').value = style.margin;
    $('marginVal').textContent = style.margin + ' px';
    $('logoSize').value = style.logoSize;
    $('logoSizeVal').textContent = Math.round(style.logoSize * 100) + '%';
    $('logoClear').checked = style.logoClear;
    $('logoThumb').hidden = !style.logo;
    if (style.logo) $('logoThumb').src = style.logo;
    $('logoRemove').hidden = !style.logo;
    $('logoOpts').hidden = !style.logo;
    $('frameLabelInput').value = style.frameLabel != null ? style.frameLabel : 'SCAN ME';
    $('frameTextWrap').hidden = (style.frame === 'none' || !style.frame);

    document.querySelectorAll('#framePicker [data-frame]').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.getAttribute('data-frame') === (style.frame || 'none')));
    });
    document.querySelectorAll('#ecPicker [data-ec]').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.getAttribute('data-ec') === style.ec));
    });

    buildShapePicker($('dotShapes'), DOT_SHAPES, 'dot');
    buildShapePicker($('cornerShapes'), CORNER_SHAPES, 'cornerSq');
    buildShapePicker($('cornerDotShapes'), CORNER_DOT_SHAPES, 'cornerDot');
    buildPresets();
    buildQuickIcons();
  }

  function styleChanged() {
    var saved = Object.assign({}, style);
    if (saved.logo && saved.logo.length > 300000) saved.logo = null;
    store('qrstudio.style', JSON.stringify(saved));
    render();
  }

  [['fgColor', 'fg', 'fgHex'], ['cornerColor', 'corner', 'cornerHex'], ['bgColor', 'bg', 'bgHex'], ['gradColor', 'grad', null]].forEach(function (p) {
    $(p[0]).addEventListener('input', function (e) {
      style[p[1]] = e.target.value;
      if (p[2]) $(p[2]).textContent = e.target.value.toUpperCase();
      if (p[1] === 'corner' && style.quickIcon) {
        style.logo = makeIconLogoDataUrl(style.quickIcon, style.corner);
        $('logoThumb').src = style.logo;
      }
      styleChanged();
    });
  });

  $('swapColorsBtn').addEventListener('click', function () {
    var tmp = style.fg;
    style.fg = style.bg;
    style.bg = tmp;
    syncStyleControls();
    styleChanged();
  });

  $('useGradient').addEventListener('change', function (e) {
    style.gradient = e.target.checked;
    $('gradWrap').hidden = !style.gradient;
    styleChanged();
  });
  $('gradType').addEventListener('change', function (e) {
    style.gradType = e.target.value;
    $('gradAngleWrap').hidden = (style.gradType === 'radial');
    styleChanged();
  });
  $('gradAngle').addEventListener('input', function (e) {
    style.gradAngle = +e.target.value;
    $('gradAngleVal').textContent = style.gradAngle + '°';
    styleChanged();
  });
  $('transparentBg').addEventListener('change', function (e) { style.transparent = e.target.checked; styleChanged(); });
  $('margin').addEventListener('input', function (e) {
    style.margin = +e.target.value;
    $('marginVal').textContent = style.margin + ' px';
    styleChanged();
  });
  $('logoSize').addEventListener('input', function (e) {
    style.logoSize = +e.target.value;
    $('logoSizeVal').textContent = Math.round(style.logoSize * 100) + '%';
    styleChanged();
  });
  $('logoClear').addEventListener('change', function (e) { style.logoClear = e.target.checked; styleChanged(); });

  document.querySelectorAll('#framePicker [data-frame]').forEach(function (b) {
    b.addEventListener('click', function () {
      style.frame = b.getAttribute('data-frame');
      syncStyleControls();
      styleChanged();
    });
  });
  $('frameLabelInput').addEventListener('input', function (e) {
    style.frameLabel = e.target.value;
    styleChanged();
  });

  document.querySelectorAll('#ecPicker [data-ec]').forEach(function (b) {
    b.addEventListener('click', function () {
      style.ec = b.getAttribute('data-ec');
      syncStyleControls();
      styleChanged();
    });
  });

  $('resetStyle').addEventListener('click', function () {
    style = Object.assign({}, DEFAULT_STYLE);
    syncStyleControls(); styleChanged();
  });

  $('logoInput').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    shrinkImage(f, 256).then(function (dataUrl) {
      style.logo = dataUrl;
      style.quickIcon = null;
      if (style.ec === 'L' || style.ec === 'M') style.ec = 'H';
      syncStyleControls(); styleChanged();
    });
  });
  $('logoRemove').addEventListener('click', function () {
    style.logo = null; style.quickIcon = null;
    syncStyleControls(); styleChanged();
  });

  function shrinkImage(file, max) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }

  // ---------------------------------------------------------------------------
  // CREATE: render
  // ---------------------------------------------------------------------------
  var PREVIEW_SIZE = 640;
  var qr = null;
  var lastPayload = '';
  var qrBox = el('div', { 'class': 'qr-box' });
  var bcCanvas = el('canvas', { 'class': 'bc-canvas', hidden: '' });
  $('qrHolder').appendChild(qrBox);
  $('qrHolder').appendChild(bcCanvas);

  var TWO_D = { datamatrix: 1, pdf417: 1, azteccode: 1 };
  function bwipOptions(data, scale) {
    var fmt = $('bcFormat').value;
    var o = {
      bcid: fmt, scale: scale,
      text: data,
      barcolor: style.fg.slice(1), textcolor: style.fg.slice(1),
      paddingwidth: 8, paddingheight: 8
    };
    if (!TWO_D[fmt]) { o.height = 16; o.includetext = true; o.textxalign = 'center'; }
    if (!style.transparent) o.backgroundcolor = style.bg.slice(1);
    return o;
  }

  function stylingOptions(data, size) {
    var dots = { type: style.dot, color: style.fg };
    if (style.gradient) {
      var rad = ((style.gradAngle != null ? style.gradAngle : 45) * Math.PI) / 180;
      dots.gradient = {
        type: style.gradType === 'radial' ? 'radial' : 'linear',
        rotation: rad,
        colorStops: [{ offset: 0, color: style.fg }, { offset: 1, color: style.grad }]
      };
    }
    var scale = size / PREVIEW_SIZE;
    return {
      width: size, height: size, type: 'canvas',
      data: toUtf8Binary(data),
      margin: Math.round(style.margin * scale),
      image: style.logo || undefined,
      qrOptions: { errorCorrectionLevel: style.ec, mode: 'Byte', typeNumber: 0 },
      dotsOptions: dots,
      cornersSquareOptions: { type: style.cornerSq, color: style.corner },
      cornersDotOptions: { type: style.cornerDot, color: style.corner },
      backgroundOptions: { color: style.transparent ? 'transparent' : style.bg },
      imageOptions: { hideBackgroundDots: style.logoClear, imageSize: style.logoSize, margin: Math.round(6 * scale), crossOrigin: 'anonymous' }
    };
  }

  function updateContrastBadge(ratio, inverted) {
    var badge = $('contrastBadge');
    if (!badge) return;
    var r = ratio.toFixed(1);
    badge.hidden = false;
    badge.className = 'contrast-pill ' + ((ratio >= 4.5 && !inverted) ? 'good' : (ratio >= 3 && !inverted) ? 'ok' : 'bad');
    var key = (ratio >= 4.5 && !inverted) ? 'contrastGood' : (ratio >= 3 && !inverted) ? 'contrastOk' : 'contrastBad';
    badge.textContent = t(key, { r: r });
  }

  function syncFramePreview() {
    var wrap = $('qrFrameWrap');
    var lbl = $('qrFrameLabel');
    var frame = (currentType === 'barcode') ? 'none' : (style.frame || 'none');
    wrap.className = 'qr-frame-wrap' + (frame !== 'none' ? ' frame-' + frame : '');
    wrap.style.setProperty('--frame-accent', style.corner || style.fg);
    var txt = (style.frameLabel || '').trim() || t('frameLabelPh');
    lbl.textContent = txt;
    lbl.hidden = (frame === 'none');
  }

  function render() {
    var data = payload();
    lastPayload = data;
    var info = $('qrInfo'), warn = $('qrWarn'), holder = $('qrHolder'), wrap = $('qrFrameWrap');
    var hasData = !!data;
    $('emptyHint').hidden = hasData;
    ['downloadBtn', 'copyImageBtn', 'shareBtn', 'copyPayloadBtn'].forEach(function (id) { $(id).disabled = !hasData; });

    if (!hasData) {
      wrap.hidden = true; info.textContent = ''; warn.hidden = true; $('contrastBadge').hidden = true;
      return;
    }
    wrap.hidden = false;
    syncFramePreview();

    if (currentType === 'barcode') {
      if (typeof bwipjs === 'undefined') {
        wrap.hidden = true; info.textContent = '';
        warn.textContent = t('bcInvalid'); warn.hidden = false;
        return;
      }
      try {
        bwipjs.toCanvas(bcCanvas, bwipOptions(data, 3));
      } catch (err) {
        wrap.hidden = true; info.textContent = '';
        warn.textContent = t('bcInvalid'); warn.hidden = false;
        ['downloadBtn', 'copyImageBtn', 'shareBtn', 'copyPayloadBtn'].forEach(function (id) { $(id).disabled = true; });
        lastPayload = '';
        return;
      }
      qrBox.hidden = true; bcCanvas.hidden = false;
      holder.classList.add('is-barcode');
      holder.hidden = false;
      info.textContent = $('bcFormat').selectedOptions[0].textContent + ' · ' + Array.from(data).length + ' ' + (I18N.lang === 'ar' ? 'حرفاً' : 'chars');
      var bgBc = style.transparent ? '#ffffff' : style.bg;
      var bcRatio = contrast(style.fg, bgBc);
      var invBc = luminance(style.fg) > luminance(bgBc);
      updateContrastBadge(bcRatio, invBc);
      var badBc = bcRatio < 3 || invBc;
      warn.textContent = badBc ? t('lowContrast') : '';
      warn.hidden = !badBc;
      return;
    }

    try {
      var meta = QRCode.create(data, { errorCorrectionLevel: style.ec });
      info.textContent = t('qrInfo', { v: meta.version, n: meta.modules.size, c: Array.from(data).length });
    } catch (err) {
      wrap.hidden = true; info.textContent = ''; $('contrastBadge').hidden = true;
      warn.textContent = t('tooLong'); warn.hidden = false;
      return;
    }

    var opts = stylingOptions(data, PREVIEW_SIZE);
    if (!qr) {
      qr = new QRCodeStyling(opts);
      qr.append(qrBox);
    } else {
      qr.update(opts);
    }
    qrBox.hidden = false; bcCanvas.hidden = true;
    holder.classList.remove('is-barcode');
    holder.hidden = false;

    var bg = style.transparent ? '#ffffff' : style.bg;
    var worst = Math.min(contrast(style.fg, bg), contrast(style.corner, bg), style.gradient ? contrast(style.grad, bg) : 99);
    var inverted = luminance(style.fg) > luminance(bg);
    updateContrastBadge(worst, inverted);
    var problems = [];
    if (worst < 3 || inverted) problems.push(t('lowContrast'));
    warn.textContent = problems.join(' ');
    warn.hidden = !problems.length;
  }
  var renderSoon = debounce(render, 60);
  form.addEventListener('input', renderSoon);

  // Composite optional frame onto PNG export
  function composeFramedPng(qrBlob, size) {
    var frame = (currentType === 'barcode') ? 'none' : (style.frame || 'none');
    if (frame === 'none') return Promise.resolve(qrBlob);
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(qrBlob);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var pad = Math.round(size * 0.065);
        var band = Math.round(size * 0.16);
        var w = size + pad * 2;
        var h = size + pad * 2 + band;
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var ctx = c.getContext('2d');
        var r = Math.round(size * 0.06);
        var accent = style.corner || style.fg;
        var isCard = frame === 'card';

        ctx.fillStyle = isCard ? '#ffffff' : accent;
        roundRect(ctx, 0, 0, w, h, r);
        ctx.fill();
        if (isCard) {
          ctx.strokeStyle = 'rgba(15,23,42,0.12)';
          ctx.lineWidth = Math.max(2, Math.round(size * 0.005));
          ctx.stroke();
        }

        var qrY = (frame === 'top') ? (pad + band) : pad;
        ctx.save();
        roundRect(ctx, pad, qrY, size, size, Math.round(r * 0.6));
        ctx.clip();
        if (!isCard) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(pad, qrY, size, size);
        }
        ctx.drawImage(img, pad, qrY, size, size);
        ctx.restore();

        var txt = (style.frameLabel || '').trim() || t('frameLabelPh');
        ctx.fillStyle = isCard ? accent : '#ffffff';
        ctx.font = '800 ' + Math.round(size * 0.072) + 'px system-ui, -apple-system, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var textY = (frame === 'top') ? (pad + band * 0.5) : (pad + size + band * 0.55);
        ctx.fillText(txt, w / 2, textY, size);

        c.toBlob(resolve, 'image/png');
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(qrBlob); };
      img.src = url;
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function exportBlob(fmt, size) {
    fmt = fmt || $('exportFormat').value;
    size = size || +$('exportSize').value;
    if (currentType === 'barcode') {
      if (fmt === 'svg') {
        return Promise.resolve(new Blob([bwipjs.toSVG(bwipOptions(lastPayload, 2))], { type: 'image/svg+xml' }));
      }
      var probe = document.createElement('canvas');
      bwipjs.toCanvas(probe, bwipOptions(lastPayload, 1));
      var c = document.createElement('canvas');
      bwipjs.toCanvas(c, bwipOptions(lastPayload, Math.max(2, Math.round(size / probe.width))));
      return new Promise(function (resolve) { c.toBlob(resolve, 'image/png'); });
    }
    var opts = stylingOptions(lastPayload, size);
    opts.type = fmt === 'svg' ? 'svg' : 'canvas';
    return new QRCodeStyling(opts).getRawData(fmt === 'svg' ? 'svg' : 'png').then(function (blob) {
      return fmt === 'png' ? composeFramedPng(blob, size) : blob;
    });
  }

  function fileName(ext) {
    var base = currentType === 'barcode' ? $('bcFormat').value : 'qr-' + currentType;
    return base + '-' + new Date().toISOString().slice(0, 10) + '.' + (ext || 'png');
  }

  $('downloadBtn').addEventListener('click', function () {
    if (!lastPayload) return;
    var fmt = $('exportFormat').value;
    exportBlob(fmt).then(function (blob) { downloadBlob(blob, fileName(fmt)); });
    saveCreated();
  });

  $('copyImageBtn').addEventListener('click', function () {
    if (!lastPayload) return;
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      toast(t('imageCopyFailed'));
      return;
    }
    exportBlob('png', 1200).then(function (blob) {
      return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    }).then(function () {
      toast(t('imageCopied'));
      saveCreated();
    }).catch(function () {
      toast(t('imageCopyFailed'));
    });
  });

  $('copyPayloadBtn').addEventListener('click', function () { if (lastPayload) { copy(lastPayload); saveCreated(); } });

  var PRINT_COLS = { 1: 1, 4: 2, 6: 2, 12: 3, 20: 4 };
  $('printBtn').addEventListener('click', function () {
    if (!lastPayload) return;
    var n = +$('printCopies').value, caption = $('printCaption').value.trim();
    exportBlob('png', 1200).then(function (blob) {
      var area = $('printArea'), url = URL.createObjectURL(blob);
      area.innerHTML = '';
      area.style.setProperty('--cols', PRINT_COLS[n] || 2);
      area.dir = I18N.lang === 'ar' ? 'rtl' : 'ltr';
      var loads = [];
      for (var i = 0; i < n; i++) {
        var img = el('img', { src: url, alt: '' });
        loads.push(new Promise(function (r) { img.onload = img.onerror = r; }));
        area.appendChild(el('div', { 'class': 'print-cell' }, [img, caption ? el('p', { text: caption, dir: 'auto' }) : null]));
      }
      Promise.all(loads).then(function () {
        window.print();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      });
    });
    saveCreated();
  });

  if (navigator.canShare && window.File) {
    try {
      if (navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] })) $('shareBtn').hidden = false;
    } catch (e) { /* not supported */ }
  }
  $('shareBtn').addEventListener('click', function () {
    if (!lastPayload) return;
    saveCreated();
    exportBlob('png').then(function (blob) {
      var file = new File([blob], fileName('png'), { type: 'image/png' });
      return navigator.share({ files: [file], title: t('appName') });
    }).catch(function () { /* user cancelled */ });
  });

  // ---------------------------------------------------------------------------
  // SCAN: camera (html5-qrcode)
  // ---------------------------------------------------------------------------
  var scanner = null, scanning = false, cameraId = null;

  function camMsg(s) { $('camMsg').textContent = s || ''; }
  function setCamButton() {
    $('camBtn').querySelector('span').textContent = t(scanning ? 'stopCamera' : 'startCamera');
    $('viewfinder').classList.toggle('live', scanning);
  }

  function startCamera() {
    if (!window.isSecureContext) { camMsg(t('cameraInsecure')); return; }
    if (typeof Html5Qrcode === 'undefined') { camMsg(t('cameraError')); return; }
    if (!scanner) {
      scanner = new Html5Qrcode('reader', { verbose: false, experimentalFeatures: { useBarCodeDetectorIfSupported: true } });
    }
    camMsg(t('scanning'));
    var source = cameraId || { facingMode: 'environment' };
    var config = {
      fps: 12,
      qrbox: function (w, h) { var s = Math.floor(Math.min(w, h) * 0.8); return { width: s, height: s }; },
      aspectRatio: 1
    };
    scanning = true; setCamButton();
    scanner.start(source, config, onCameraScan, function () { /* frame without code */ })
      .then(function () { listCameras(); setupCamTools(); })
      .catch(function (err) {
        scanning = false; setCamButton();
        var m = String(err && (err.name || err.message || err));
        if (/NotAllowed|Permission/i.test(m)) camMsg(t('cameraDenied'));
        else if (/NotFound|Overconstrained|no camera/i.test(m)) camMsg(t('noCamera'));
        else camMsg(t('cameraError'));
      });
  }

  var torchFeature = null, zoomFeature = null;
  function setupCamTools() {
    torchFeature = zoomFeature = null;
    try {
      var caps = scanner.getRunningTrackCameraCapabilities();
      var tf = caps.torchFeature(), zf = caps.zoomFeature();
      if (tf.isSupported()) torchFeature = tf;
      if (zf.isSupported()) zoomFeature = zf;
    } catch (e) { /* not supported */ }
    $('torchBtn').hidden = !torchFeature;
    $('torchBtn').setAttribute('aria-pressed', 'false');
    $('zoomWrap').hidden = !zoomFeature;
    if (zoomFeature) {
      var z = $('zoomRange');
      z.min = zoomFeature.min(); z.max = zoomFeature.max(); z.step = zoomFeature.step() || 0.1;
      z.value = zoomFeature.value() || zoomFeature.min();
    }
    $('camTools').hidden = !torchFeature && !zoomFeature;
  }
  $('torchBtn').addEventListener('click', function () {
    if (!torchFeature) return;
    var on = $('torchBtn').getAttribute('aria-pressed') !== 'true';
    torchFeature.apply(on).then(function () { $('torchBtn').setAttribute('aria-pressed', String(on)); }).catch(function () {});
  });
  $('zoomRange').addEventListener('input', function (e) {
    if (zoomFeature) zoomFeature.apply(+e.target.value).catch(function () {});
  });

  function stopCamera() {
    $('camTools').hidden = true;
    if (!scanner || !scanning) return Promise.resolve();
    scanning = false; setCamButton(); camMsg('');
    return scanner.stop().catch(function () {});
  }

  function listCameras() {
    if (typeof Html5Qrcode === 'undefined') return;
    Html5Qrcode.getCameras().then(function (cams) {
      var sel = $('cameraSelect');
      if (!cams || cams.length < 2) { sel.hidden = true; return; }
      sel.innerHTML = '';
      cams.forEach(function (c, i) { sel.appendChild(el('option', { value: c.id, text: c.label || (t('camera') + ' ' + (i + 1)) })); });
      try {
        var track = scanner.getRunningTrackSettings && scanner.getRunningTrackSettings();
        if (track && track.deviceId) sel.value = track.deviceId;
      } catch (e) { /* ignore */ }
      sel.hidden = false;
    }).catch(function () {});
  }
  $('cameraSelect').addEventListener('change', function (e) {
    cameraId = e.target.value;
    stopCamera().then(startCamera);
  });

  function onCameraScan(text, res) {
    var fmt = res && res.result && res.result.format && res.result.format.formatName;
    stopCamera();
    if (navigator.vibrate) navigator.vibrate(60);
    showResult(text, fmt);
  }

  $('camBtn').addEventListener('click', function () { scanning ? stopCamera() : startCamera(); });
  if (!window.isSecureContext) camMsg(t('cameraInsecure'));

  // ---------------------------------------------------------------------------
  // SCAN: image files
  // ---------------------------------------------------------------------------
  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { resolve(img); setTimeout(function () { URL.revokeObjectURL(url); }, 0); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }

  function canvasFrom(img, maxSide, pad) {
    var s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    var w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
    var c = document.createElement('canvas');
    c.width = w + pad * 2; c.height = h + pad * 2;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, pad, pad, w, h);
    return c;
  }

  function zxingDecode(canvas) {
    if (typeof ZXing === 'undefined') return null;
    var hints = new Map();
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    var reader = new ZXing.MultiFormatReader();
    reader.setHints(hints);
    var src = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
    var attempts = [src, src.invert()];
    for (var i = 0; i < attempts.length; i++) {
      try {
        var r = reader.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(attempts[i])));
        return { text: r.getText(), format: ZXing.BarcodeFormat[r.getBarcodeFormat()] };
      } catch (e) { /* try next */ }
    }
    return null;
  }

  function decodeImageFile(file) {
    return loadImage(file).then(function (img) {
      var native = ('BarcodeDetector' in window)
        ? new window.BarcodeDetector().detect(img).then(function (codes) {
            return codes && codes[0] ? { text: codes[0].rawValue, format: codes[0].format } : null;
          }).catch(function () { return null; })
        : Promise.resolve(null);
      return native.then(function (hit) {
        if (hit) return hit;
        var sizes = [1600, 900, 2600];
        for (var i = 0; i < sizes.length; i++) {
          var r = zxingDecode(canvasFrom(img, sizes[i], Math.round(sizes[i] * 0.04)));
          if (r) return r;
        }
        if (typeof Html5Qrcode === 'undefined') return null;
        var host = $('fileScanHost') || document.body.appendChild(el('div', { id: 'fileScanHost', hidden: '' }));
        return new Html5Qrcode(host.id, { verbose: false }).scanFileV2(file, false)
          .then(function (res) { return { text: res.decodedText, format: res.result && res.result.format && res.result.format.formatName }; })
          .catch(function () { return null; });
      });
    });
  }

  function handleFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    var msg = $('fileMsg');
    msg.textContent = t('reading');
    stopCamera();
    decodeImageFile(file).then(function (r) {
      if (!r) { msg.textContent = t('notFound'); return; }
      msg.textContent = '';
      showResult(r.text, r.format);
    }).catch(function () { msg.textContent = t('notFound'); });
  }

  $('scanFile').addEventListener('change', function (e) {
    handleFile(e.target.files && e.target.files[0]);
    e.target.value = '';
  });
  var dz = $('dropzone');
  ['dragenter', 'dragover'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('over'); });
  });
  dz.addEventListener('drop', function (e) { handleFile(e.dataTransfer.files && e.dataTransfer.files[0]); });
  document.addEventListener('paste', function (e) {
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image/') === 0) {
        e.preventDefault();
        showTab('scan');
        handleFile(items[i].getAsFile());
        return;
      }
    }
  });

  // ---------------------------------------------------------------------------
  // SCAN: show result
  // ---------------------------------------------------------------------------
  var lastResult = null;
  var KIND_LABEL = {
    product: 'kindProduct', barcode: 'kindBarcode', url: 'kindUrl', text: 'kindText',
    wifi: 'kindWifi', contact: 'kindContact', whatsapp: 'kindWhatsapp', email: 'kindEmail',
    sms: 'kindSms', phone: 'kindPhone', geo: 'kindGeo', event: 'kindEvent'
  };

  var CP1252 = { 0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
    0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
    0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
    0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f };
  function fixMojibake(s) {
    if (!/[\u0080-\u00ff]/.test(s) || !window.TextDecoder) return s;
    try {
      var bytes = new Uint8Array(s.length);
      for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i);
        if (c > 0xff) { c = CP1252[c]; if (c === undefined) return s; }
        bytes[i] = c;
      }
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) { return s; }
  }

  function showResult(text, format, fromHistory) {
    text = fixMojibake(String(text));
    lastResult = { text: text, format: format };
    if (!fromHistory) addHistory({ mode: 'scan', text: text, format: format || '' });
    renderResult();
    var card = $('resultCard');
    card.hidden = false;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function loadScannedIntoCreate(rawText) {
    var p = Payloads.parse(rawText);
    var mapType = (p.kind === 'product' || p.kind === 'barcode') ? 'text' : (Payloads.build[p.kind] ? p.kind : 'text');
    var fs = form.querySelector('fieldset[data-form="' + mapType + '"]');
    if (fs) {
      if (mapType === 'url') fs.querySelector('[name="url"]').value = p.url || rawText;
      else if (mapType === 'text') fs.querySelector('[name="text"]').value = p.text || rawText;
      else if (mapType === 'wifi') {
        fs.querySelector('[name="ssid"]').value = p.ssid || '';
        fs.querySelector('[name="security"]').value = p.security || 'WPA';
        fs.querySelector('[name="password"]').value = p.password || '';
        fs.querySelector('[name="hidden"]').checked = !!p.hidden;
        syncWifi();
      } else if (mapType === 'whatsapp') {
        fs.querySelector('[name="waNumber"]').value = p.number || '';
        fs.querySelector('[name="waMessage"]').value = p.message || '';
      } else if (mapType === 'email') {
        fs.querySelector('[name="to"]').value = p.to || '';
        fs.querySelector('[name="subject"]').value = p.subject || '';
        fs.querySelector('[name="body"]').value = p.body || '';
      } else if (mapType === 'sms') {
        fs.querySelector('[name="number"]').value = p.number || '';
        fs.querySelector('[name="message"]').value = p.message || '';
      } else if (mapType === 'phone') {
        fs.querySelector('[name="number"]').value = p.number || '';
      } else if (mapType === 'geo') {
        fs.querySelector('[name="lat"]').value = p.lat != null ? p.lat : '';
        fs.querySelector('[name="lng"]').value = p.lng != null ? p.lng : '';
        fs.querySelector('[name="label"]').value = p.label || '';
      } else if (mapType === 'contact') {
        fs.querySelector('[name="firstName"]').value = p.name || '';
        fs.querySelector('[name="phone"]').value = (p.phones && p.phones[0]) || '';
        fs.querySelector('[name="email"]').value = (p.emails && p.emails[0]) || '';
        fs.querySelector('[name="org"]').value = p.org || '';
      } else if (mapType === 'event') {
        fs.querySelector('[name="eventTitle"]').value = p.title || '';
        fs.querySelector('[name="eventLocation"]').value = p.location || '';
        fs.querySelector('[name="eventDesc"]').value = p.description || '';
      }
    }
    showTab('create');
    setType(mapType);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderResult() {
    if (!lastResult) return;
    var p = Payloads.parse(lastResult.text);
    if (/ean|upc/i.test(lastResult.format || '') && /^\d{6,14}$/.test(lastResult.text.trim())) {
      p = { kind: 'product', raw: lastResult.text, code: lastResult.text.trim() };
    }
    var fields = $('resultFields'), actions = $('resultActions'), warn = $('resultWarn');
    fields.innerHTML = ''; actions.innerHTML = ''; warn.hidden = true;
    $('resultKind').textContent = t(KIND_LABEL[p.kind] || 'kindText');
    $('resultRaw').textContent = lastResult.text;

    function field(labelKey, value, ltr) {
      if (value == null || value === '' || (Array.isArray(value) && !value.length)) return;
      fields.appendChild(el('dt', { text: t(labelKey) }));
      fields.appendChild(el('dd', { text: Array.isArray(value) ? value.join('\n') : String(value), dir: ltr ? 'ltr' : 'auto' }));
    }
    function linkBtn(labelKey, href, primary) {
      var a = el('a', { 'class': 'btn' + (primary ? ' btn-primary' : ''), href: href, text: t(labelKey) });
      if (/^https?:/i.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      actions.appendChild(a);
    }
    function btn(labelKey, fn, primary) {
      actions.appendChild(el('button', { type: 'button', 'class': 'btn' + (primary ? ' btn-primary' : ''), text: t(labelKey), on: { click: fn } }));
    }

    switch (p.kind) {
      case 'url':
        field('url', p.url, true);
        warn.textContent = t('linkWarning'); warn.hidden = false;
        linkBtn('openLink', p.url, true);
        break;
      case 'whatsapp':
        field('number', p.number, true);
        field('message', p.message);
        linkBtn('openWhatsApp', p.url, true);
        break;
      case 'wifi':
        field('network', p.ssid);
        field('security', p.security === 'nopass' ? t('secNone') : p.security, true);
        field('password', p.password, true);
        if (p.hidden) field('hidden', t('yes'));
        if (p.password) btn('copyPassword', function () { copy(p.password); }, true);
        break;
      case 'contact':
        field('firstName', p.name);
        field('phone', p.phones, true);
        field('email', p.emails, true);
        field('org', p.org);
        field('jobTitle', p.title);
        field('website', p.urls, true);
        field('address', p.address);
        field('note', p.note);
        btn('saveContact', function () {
          var vcf = p.vcard || Payloads.build.contact({
            firstName: p.name, phone: p.phones[0], email: p.emails[0], org: p.org, website: p.urls[0], address: p.address, note: p.note
          });
          downloadBlob(new Blob([vcf], { type: 'text/vcard;charset=utf-8' }), ((p.name || 'contact').replace(/[\\/:*?"<>|]+/g, '') || 'contact') + '.vcf');
        }, true);
        if (p.phones[0]) linkBtn('callNumber', 'tel:' + p.phones[0].replace(/[^\d+*#]/g, ''));
        if (p.emails[0]) linkBtn('sendEmail', 'mailto:' + p.emails[0]);
        break;
      case 'event':
        field('eventTitle', p.title);
        field('eventStart', p.start, true);
        field('eventEnd', p.end, true);
        field('eventLocation', p.location);
        field('eventDesc', p.description);
        btn('saveEvent', function () {
          var body = p.ics.indexOf('BEGIN:VCALENDAR') >= 0 ? p.ics : ('BEGIN:VCALENDAR\nVERSION:2.0\n' + p.ics + '\nEND:VCALENDAR');
          downloadBlob(new Blob([body], { type: 'text/calendar;charset=utf-8' }), ((p.title || 'event').replace(/[\\/:*?"<>|]+/g, '') || 'event') + '.ics');
        }, true);
        break;
      case 'email':
        field('to', p.to, true);
        field('subject', p.subject);
        field('body', p.body);
        linkBtn('sendEmail', lastResult.text.trim().toLowerCase().indexOf('mailto:') === 0 ? lastResult.text.trim()
          : 'mailto:' + p.to + '?subject=' + encodeURIComponent(p.subject) + '&body=' + encodeURIComponent(p.body), true);
        break;
      case 'sms':
        field('number', p.number, true);
        field('message', p.message);
        linkBtn('sendSms', 'sms:' + p.number.replace(/[^\d+*#]/g, '') + (p.message ? '?body=' + encodeURIComponent(p.message) : ''), true);
        break;
      case 'phone':
        field('number', p.number, true);
        linkBtn('callNumber', 'tel:' + p.number.replace(/[^\d+*#]/g, ''), true);
        break;
      case 'geo':
        field('lat', p.lat, true);
        field('lng', p.lng, true);
        field('placeLabel', p.label);
        linkBtn('openMap', 'https://www.google.com/maps/search/?api=1&query=' + p.lat + ',' + p.lng, true);
        break;
      case 'product':
        field('product', p.code, true);
        linkBtn('searchWeb', 'https://www.google.com/search?q=' + encodeURIComponent(p.code), true);
        break;
      default:
        field('text', p.text);
    }
    if (lastResult.format) field('format', String(lastResult.format).replace(/_/g, ' '), true);

    btn('editInCreate', function () { loadScannedIntoCreate(lastResult.text); });
    btn('copyText', function () { copy(lastResult.text); });
    btn('scanAgain', function () {
      $('resultCard').hidden = true;
      lastResult = null;
      if (window.isSecureContext) startCamera();
    });
  }

  // ---------------------------------------------------------------------------
  // HISTORY (with pinning, stats, JSON backup, live badge)
  // ---------------------------------------------------------------------------
  var HISTORY_KEY = 'qrstudio.history', HISTORY_MAX = 100;
  var historyFilter = 'all';

  function loadHistory() { var h = readJSON(HISTORY_KEY); return Array.isArray(h) ? h : []; }
  function saveHistory(list) {
    while (list.length) {
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); syncHistoryBadge(list); return; }
      catch (e) { if (list.length === 1) return; list = list.slice(0, Math.floor(list.length * 0.8)); }
    }
    store(HISTORY_KEY, null);
    syncHistoryBadge([]);
  }
  function syncHistoryBadge(list) {
    list = list || loadHistory();
    var badge = $('historyCountBadge');
    if (badge) {
      badge.textContent = String(list.length);
      badge.hidden = list.length === 0;
    }
  }
  function addHistory(entry) {
    var existing = loadHistory();
    var prev = existing.find(function (h) { return h.mode === entry.mode && h.text === entry.text; });
    var list = existing.filter(function (h) { return !(h.mode === entry.mode && h.text === entry.text); });
    entry.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    entry.ts = Date.now();
    entry.pinned = prev ? !!prev.pinned : false;
    list.unshift(entry);
    saveHistory(list.slice(0, HISTORY_MAX));
    if (!$('panel-history').hidden) renderHistory();
  }
  function saveCreated() {
    if (!lastPayload) return;
    addHistory({ mode: 'create', text: lastPayload, type: currentType, fields: formValues() });
  }

  function summarize(h) {
    var kind = h.mode === 'create' ? (h.type === 'barcode' ? 'barcode' : Payloads.parse(h.text).kind) : Payloads.parse(h.text).kind;
    if (h.mode === 'scan' && /ean|upc/i.test(h.format || '')) kind = 'product';
    var p = Payloads.parse(h.text), title = h.text;
    if (p.kind === 'wifi') title = p.ssid;
    else if (p.kind === 'contact') title = p.name || (p.phones[0] || '') || (p.emails[0] || '');
    else if (p.kind === 'whatsapp') title = p.number + (p.message ? ' · ' + p.message : '');
    else if (p.kind === 'email') title = p.to + (p.subject ? ' · ' + p.subject : '');
    else if (p.kind === 'sms' || p.kind === 'phone') title = p.number;
    else if (p.kind === 'geo') title = p.label || (p.lat + ', ' + p.lng);
    else if (p.kind === 'event') title = p.title || p.start;
    return { kind: kind, title: String(title || h.text).replace(/\s+/g, ' ').slice(0, 120) };
  }

  var KIND_ICON = {
    url: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/>',
    contact: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    whatsapp: '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.6-5.2A8.5 8.5 0 1 1 21 11.5z"/>',
    email: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/>',
    sms: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    phone: '<path d="M22 17v3a2 2 0 0 1-2 2A19 19 0 0 1 2 4a2 2 0 0 1 2-2h3l2 5-2.5 1.5a11 11 0 0 0 5 5L13 13l5 2z"/>',
    geo: '<path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
    event: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    product: '<path d="M3 5v14M7 5v14M10 5v14M14 5v14M17 5v14M21 5v14"/>',
    barcode: '<path d="M3 5v14M7 5v14M10 5v14M14 5v14M17 5v14M21 5v14"/>',
    text: '<path d="M4 6h16M4 12h16M4 18h10"/>'
  };

  function renderHistory() {
    var all = loadHistory();
    $('statTotal').textContent = String(all.length);
    $('statCreated').textContent = String(all.filter(function (x) { return x.mode === 'create'; }).length);
    $('statScanned').textContent = String(all.filter(function (x) { return x.mode === 'scan'; }).length);
    syncHistoryBadge(all);

    var q = $('historySearch').value.trim().toLowerCase();
    var list = all.filter(function (h) {
      if (historyFilter === 'pinned' && !h.pinned) return false;
      if (historyFilter === 'scan' && h.mode !== 'scan') return false;
      if (historyFilter === 'create' && h.mode !== 'create') return false;
      return !q || h.text.toLowerCase().indexOf(q) >= 0;
    });
    // Pinned items first, then newest
    list.sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.ts - a.ts); });

    var ul = $('historyList');
    ul.innerHTML = '';
    var fmt;
    try { fmt = new Intl.DateTimeFormat(I18N.lang === 'ar' ? 'ar' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { fmt = null; }
    list.forEach(function (h) {
      var sm = summarize(h);
      var icon = el('span', { 'class': 'h-icon', 'aria-hidden': 'true' });
      icon.innerHTML = '<svg viewBox="0 0 24 24">' + (KIND_ICON[sm.kind] || KIND_ICON.text) + '</svg>';
      var when = fmt ? fmt.format(new Date(h.ts)) : new Date(h.ts).toLocaleString();
      var li = el('li', { 'class': 'history-item' + (h.pinned ? ' pinned' : '') }, [
        icon,
        el('span', { 'class': 'h-title', dir: 'auto', text: (h.pinned ? '★ ' : '') + sm.title }),
        el('span', { 'class': 'h-meta', text: t(h.mode === 'scan' ? 'scanned' : 'created') + ' · ' + t(KIND_LABEL[sm.kind] || 'kindText') + ' · ' + when }),
        el('div', { 'class': 'h-actions' }, [
          el('button', { type: 'button', 'class': 'btn btn-primary btn-sm', text: t('open'), on: { click: function () { openHistory(h); } } }),
          el('button', { type: 'button', 'class': 'btn btn-sm', text: t('copyText'), on: { click: function () { copy(h.text); } } }),
          el('button', { type: 'button', 'class': 'btn btn-ghost btn-sm', text: t(h.pinned ? 'unpin' : 'pin'), on: { click: function () {
            var updated = loadHistory().map(function (x) { return x.id === h.id ? Object.assign({}, x, { pinned: !x.pinned }) : x; });
            saveHistory(updated);
            renderHistory();
          } } }),
          el('button', { type: 'button', 'class': 'btn btn-ghost btn-sm btn-danger', text: t('remove'), on: { click: function () {
            saveHistory(loadHistory().filter(function (x) { return x.id !== h.id; }));
            renderHistory();
          } } })
        ])
      ]);
      ul.appendChild(li);
    });
    $('historyEmpty').hidden = list.length > 0;
    $('clearHistory').hidden = all.length === 0;
    $('exportHistoryBtn').hidden = all.length === 0;
  }

  function openHistory(h) {
    if (h.mode === 'scan') {
      showTab('scan');
      showResult(h.text, h.format, true);
      return;
    }
    var type = Payloads.build[h.type] ? h.type : 'text';
    var fs = form.querySelector('fieldset[data-form="' + type + '"]');
    var fields = h.fields || { text: h.text };
    if (fs) {
      fs.querySelectorAll('input[name], textarea[name], select[name]').forEach(function (i) {
        if (!(i.name in fields)) return;
        if (i.type === 'checkbox') i.checked = !!fields[i.name]; else i.value = fields[i.name];
      });
    }
    if (type === 'wifi') syncWifi();
    showTab('create');
    setType(type);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $('historySearch').addEventListener('input', debounce(renderHistory, 120));
  document.querySelectorAll('#historyFilter [data-filter]').forEach(function (b) {
    b.addEventListener('click', function () {
      historyFilter = b.getAttribute('data-filter');
      document.querySelectorAll('#historyFilter [data-filter]').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
      renderHistory();
    });
  });

  $('exportHistoryBtn').addEventListener('click', function () {
    var data = loadHistory();
    if (!data.length) return;
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'qr-studio-history-' + new Date().toISOString().slice(0, 10) + '.json');
    toast(t('historyExported'));
  });

  var clearTimer = null;
  $('clearHistory').addEventListener('click', function () {
    var b = $('clearHistory');
    if (!b.classList.contains('armed')) {
      b.classList.add('armed'); b.textContent = t('clearConfirm');
      clearTimer = setTimeout(function () { b.classList.remove('armed'); b.textContent = t('clearHistory'); }, 3000);
      return;
    }
    clearTimeout(clearTimer);
    b.classList.remove('armed'); b.textContent = t('clearHistory');
    store(HISTORY_KEY, null);
    renderHistory();
  });

  // ---------------------------------------------------------------------------
  // Install (PWA) + service worker
  // ---------------------------------------------------------------------------
  var deferredPrompt = null;
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    $('installBtn').hidden = false;
  });
  window.addEventListener('appinstalled', function () { $('installBtn').hidden = true; deferredPrompt = null; });
  if (isIOS && !isStandalone) $('installBtn').hidden = false;

  $('installBtn').addEventListener('click', function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () { deferredPrompt = null; $('installBtn').hidden = true; });
    } else {
      openInstallHelp();
    }
  });

  // Install guide dialog, with a QR code of the app's own address.
  var APP_URL = location.origin + location.pathname.replace(/index\.html$/, '');
  var appQr = null;
  function openInstallHelp() {
    var d = $('installDialog');
    var platform = isIOS ? 'ios' : /android/i.test(navigator.userAgent) ? 'android' : 'desktop';
    // Show the visitor's own platform first.
    var first = d.querySelector('.install-step[data-platform="' + platform + '"]');
    d.insertBefore(first, d.querySelector('.install-step'));
    $('appUrl').textContent = APP_URL;
    if (!appQr) {
      appQr = new QRCodeStyling({
        width: 360, height: 360, type: 'canvas', data: APP_URL, margin: 10,
        qrOptions: { errorCorrectionLevel: 'M' },
        dotsOptions: { type: 'rounded', color: '#0f172a' },
        cornersSquareOptions: { type: 'extra-rounded', color: '#0f766e' },
        cornersDotOptions: { type: 'dot', color: '#0f766e' },
        backgroundOptions: { color: '#ffffff' }
      });
      appQr.append($('appQr'));
    }
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  $('helpBtn').addEventListener('click', openInstallHelp);
  $('installClose').addEventListener('click', function () { $('installDialog').close ? $('installDialog').close() : $('installDialog').removeAttribute('open'); });
  $('installDialog').addEventListener('click', function (e) { if (e.target === e.currentTarget && e.currentTarget.close) e.currentTarget.close(); });
  $('copyAppUrl').addEventListener('click', function () { copy(APP_URL); });
  if (location.hash === '#install') setTimeout(openInstallHelp, 300);

  function showBanner(text, actionLabel, action) {
    var b = $('banner');
    b.innerHTML = '';
    b.appendChild(el('span', { text: text }));
    if (actionLabel) b.appendChild(el('button', { type: 'button', 'class': 'btn btn-primary btn-sm', text: actionLabel, on: { click: action } }));
    b.appendChild(el('button', { type: 'button', 'class': 'btn btn-ghost btn-sm', 'aria-label': 'Close', text: '×', on: { click: function () { b.hidden = true; } } }));
    b.hidden = false;
  }

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () {
      var hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        reg.addEventListener('updatefound', function () {
          var nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', function () {
            if (nw.state !== 'installed') return;
            if (hadController) showBanner(t('updateReady'), t('reload'), function () { location.reload(); });
            else toast(t('offlineReady'));
          });
        });
      }).catch(function () { /* offline support unavailable */ });
    });
  }

  // ---------------------------------------------------------------------------
  // Language + boot
  // ---------------------------------------------------------------------------
  $('langBtn').addEventListener('click', function () { I18N.toggle(); });
  I18N.onChange(function () {
    syncStyleControls();
    setCamButton();
    if (!window.isSecureContext) camMsg(t('cameraInsecure'));
    updateBarcodeHint();
    render();
    renderResult();
    if (!$('panel-history').hidden) renderHistory();
  });

  I18N.apply();
  syncStyleControls();
  setCamButton();
  syncHistoryBadge();
  var savedType = store('qrstudio.type');
  setType(Payloads.build[savedType] ? savedType : 'url');
  var hashTab = location.hash.slice(1);
  var startTab = tabs[hashTab] ? hashTab : (store('qrstudio.tab') || 'create');
  showTab(tabs[startTab] ? startTab : 'create');
})();

