/* QR Studio — main app logic. Plain browser JS, no build step. */
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

  // Relative luminance contrast ratio (WCAG formula).
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

  // qr-code-styling's encoder maps each JS char to one byte, so we hand it the
  // UTF-8 bytes as a "binary string". This keeps Arabic and emoji intact.
  function toUtf8Binary(s) {
    if (!/[^\x00-\x7f]/.test(s)) return s;
    var bytes = new TextEncoder().encode(s), out = '';
    for (var i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    return out;
  }

  // ---------------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------------
  var tabs = { create: $('tab-create'), scan: $('tab-scan') };
  function showTab(name) {
    Object.keys(tabs).forEach(function (k) {
      var on = k === name;
      tabs[k].setAttribute('aria-selected', String(on));
      $('panel-' + k).hidden = !on;
    });
    if (name !== 'scan') stopCamera();
    store('qrstudio.tab', name);
  }
  tabs.create.addEventListener('click', function () { showTab('create'); });
  tabs.scan.addEventListener('click', function () { showTab('scan'); });

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
      fs.disabled = !on; // so names shared across fieldsets don't collide
    });
    store('qrstudio.type', type);
    render();
  }
  document.querySelectorAll('#typeChips [data-type]').forEach(function (b) {
    b.addEventListener('click', function () { setType(b.getAttribute('data-type')); });
  });

  function formValues() {
    var fs = form.querySelector('fieldset[data-form="' + currentType + '"]');
    var v = {};
    fs.querySelectorAll('input[name], textarea[name], select[name]').forEach(function (i) {
      v[i.name] = i.type === 'checkbox' ? i.checked : i.value;
    });
    return v;
  }

  function payload() { return Payloads.build[currentType](formValues()); }

  form.addEventListener('change', function () { render(); });

  // Wi‑Fi niceties
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
  // CREATE: style
  // ---------------------------------------------------------------------------
  var DEFAULT_STYLE = {
    fg: '#0f172a', corner: '#0f766e', bg: '#ffffff',
    gradient: false, grad: '#0f766e', transparent: false,
    dot: 'rounded', cornerSq: 'extra-rounded', cornerDot: 'dot',
    ec: 'M', margin: 16, logo: null, logoSize: 0.35, logoClear: true
  };
  var style = Object.assign({}, DEFAULT_STYLE, readJSON('qrstudio.style') || {});

  var PRESETS = [
    { fg: '#0f172a', corner: '#0f766e', bg: '#ffffff', gradient: false },
    { fg: '#000000', corner: '#000000', bg: '#ffffff', gradient: false, dot: 'square', cornerSq: 'square', cornerDot: 'square' },
    { fg: '#1d4ed8', corner: '#1e3a8a', bg: '#eff6ff', gradient: true, grad: '#7c3aed' },
    { fg: '#9a3412', corner: '#7c2d12', bg: '#fff7ed', gradient: true, grad: '#db2777', dot: 'dots', cornerSq: 'dot', cornerDot: 'dot' },
    { fg: '#14532d', corner: '#166534', bg: '#f0fdf4', gradient: false, dot: 'classy-rounded', cornerSq: 'extra-rounded', cornerDot: 'square' },
    { fg: '#581c87', corner: '#be185d', bg: '#fdf4ff', gradient: true, grad: '#be185d', dot: 'extra-rounded' }
  ];

  // Tiny SVG previews for each shape option (drawn in a 24×24 box).
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
      var b = el('button', { type: 'button', 'class': 'preset', 'aria-label': t('presets') + ' ' + (i + 1) });
      b.style.background = 'radial-gradient(circle at 50% 50%, ' + p.bg + ' 0 28%, transparent 29%), ' + bgc;
      b.style.borderColor = p.corner;
      b.addEventListener('click', function () {
        Object.assign(style, p);
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
    $('useGradient').checked = style.gradient;
    $('gradWrap').hidden = !style.gradient;
    $('transparentBg').checked = style.transparent;
    $('ecLevel').value = style.ec;
    $('margin').value = style.margin;
    $('logoSize').value = style.logoSize;
    $('logoClear').checked = style.logoClear;
    $('logoThumb').hidden = !style.logo;
    if (style.logo) $('logoThumb').src = style.logo;
    $('logoRemove').hidden = !style.logo;
    $('logoOpts').hidden = !style.logo;
    buildShapePicker($('dotShapes'), DOT_SHAPES, 'dot');
    buildShapePicker($('cornerShapes'), CORNER_SHAPES, 'cornerSq');
    buildShapePicker($('cornerDotShapes'), CORNER_DOT_SHAPES, 'cornerDot');
  }

  function styleChanged() {
    var saved = Object.assign({}, style);
    // Keep stored logos small; a big one simply isn't remembered.
    if (saved.logo && saved.logo.length > 300000) saved.logo = null;
    store('qrstudio.style', JSON.stringify(saved));
    render();
  }

  [['fgColor', 'fg'], ['cornerColor', 'corner'], ['bgColor', 'bg'], ['gradColor', 'grad']].forEach(function (p) {
    $(p[0]).addEventListener('input', function (e) { style[p[1]] = e.target.value; styleChanged(); });
  });
  $('useGradient').addEventListener('change', function (e) { style.gradient = e.target.checked; $('gradWrap').hidden = !style.gradient; styleChanged(); });
  $('transparentBg').addEventListener('change', function (e) { style.transparent = e.target.checked; styleChanged(); });
  $('ecLevel').addEventListener('change', function (e) { style.ec = e.target.value; styleChanged(); });
  $('margin').addEventListener('input', function (e) { style.margin = +e.target.value; styleChanged(); });
  $('logoSize').addEventListener('input', function (e) { style.logoSize = +e.target.value; styleChanged(); });
  $('logoClear').addEventListener('change', function (e) { style.logoClear = e.target.checked; styleChanged(); });
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
      // Logos hide part of the code, so raise error correction.
      if (style.ec === 'L' || style.ec === 'M') style.ec = 'H';
      syncStyleControls(); styleChanged();
    });
  });
  $('logoRemove').addEventListener('click', function () { style.logo = null; syncStyleControls(); styleChanged(); });

  // Downscale big logos so the app stays fast and storage stays small.
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

  function stylingOptions(data, size) {
    var dots = { type: style.dot, color: style.fg };
    if (style.gradient) {
      dots.gradient = { type: 'linear', rotation: Math.PI / 4, colorStops: [{ offset: 0, color: style.fg }, { offset: 1, color: style.grad }] };
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

  function render() {
    var data = payload();
    lastPayload = data;
    var info = $('qrInfo'), warn = $('qrWarn'), holder = $('qrHolder');
    var hasData = !!data;
    $('emptyHint').hidden = hasData;
    ['downloadBtn', 'shareBtn', 'copyPayloadBtn'].forEach(function (id) { $(id).disabled = !hasData; });

    if (!hasData) { holder.hidden = true; info.textContent = ''; warn.hidden = true; return; }

    // node-qrcode validates capacity and reports the symbol size.
    try {
      var meta = QRCode.create(data, { errorCorrectionLevel: style.ec });
      info.textContent = t('qrInfo', { v: meta.version, n: meta.modules.size, c: Array.from(data).length });
    } catch (err) {
      holder.hidden = true; info.textContent = '';
      warn.textContent = t('tooLong'); warn.hidden = false;
      return;
    }

    var opts = stylingOptions(data, PREVIEW_SIZE);
    if (!qr) {
      qr = new QRCodeStyling(opts);
      holder.innerHTML = '';
      qr.append(holder);
    } else {
      qr.update(opts);
    }
    holder.hidden = false;

    var problems = [];
    var bg = style.transparent ? '#ffffff' : style.bg;
    var worst = Math.min(contrast(style.fg, bg), contrast(style.corner, bg), style.gradient ? contrast(style.grad, bg) : 99);
    if (worst < 3 || luminance(style.fg) > luminance(bg)) problems.push(t('lowContrast'));
    warn.textContent = problems.join(' ');
    warn.hidden = !problems.length;
  }
  var renderSoon = debounce(render, 60);
  form.addEventListener('input', renderSoon);

  function exportBlob() {
    var big = new QRCodeStyling(stylingOptions(lastPayload, 1200));
    return big.getRawData('png');
  }
  function fileName() { return 'qr-' + currentType + '-' + new Date().toISOString().slice(0, 10) + '.png'; }

  $('downloadBtn').addEventListener('click', function () {
    if (!lastPayload) return;
    exportBlob().then(function (blob) { downloadBlob(blob, fileName()); });
  });
  $('copyPayloadBtn').addEventListener('click', function () { if (lastPayload) copy(lastPayload); });

  if (navigator.canShare && window.File) {
    try {
      if (navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] })) $('shareBtn').hidden = false;
    } catch (e) { /* not supported */ }
  }
  $('shareBtn').addEventListener('click', function () {
    if (!lastPayload) return;
    exportBlob().then(function (blob) {
      var file = new File([blob], fileName(), { type: 'image/png' });
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
      .then(listCameras)
      .catch(function (err) {
        scanning = false; setCamButton();
        var m = String(err && (err.name || err.message || err));
        if (/NotAllowed|Permission/i.test(m)) camMsg(t('cameraDenied'));
        else if (/NotFound|Overconstrained|no camera/i.test(m)) camMsg(t('noCamera'));
        else camMsg(t('cameraError'));
      });
  }

  function stopCamera() {
    if (!scanner || !scanning) return Promise.resolve();
    scanning = false; setCamButton(); camMsg('');
    return scanner.stop().catch(function () {});
  }

  function listCameras() {
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
  // SCAN: image files (BarcodeDetector → ZXing → html5-qrcode)
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
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); // flatten transparency
    ctx.drawImage(img, pad, pad, w, h);
    return c;
  }

  function zxingDecode(canvas) {
    var hints = new Map();
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    var reader = new ZXing.MultiFormatReader();
    reader.setHints(hints);
    var src = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
    var attempts = [src, src.invert()]; // also catch light-on-dark codes
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
      // 1) Native detector (Android Chrome, some desktops) is fastest.
      var native = ('BarcodeDetector' in window)
        ? new window.BarcodeDetector().detect(img).then(function (codes) {
            return codes && codes[0] ? { text: codes[0].rawValue, format: codes[0].format } : null;
          }).catch(function () { return null; })
        : Promise.resolve(null);
      return native.then(function (hit) {
        if (hit) return hit;
        // 2) ZXing at a few sizes; small codes in big photos need the full size,
        //    noisy photos often decode better scaled down. Padding restores a quiet zone.
        var sizes = [1600, 900, 2600];
        for (var i = 0; i < sizes.length; i++) {
          var r = zxingDecode(canvasFrom(img, sizes[i], Math.round(sizes[i] * 0.04)));
          if (r) return r;
        }
        // 3) html5-qrcode's own file scanner as a last resort.
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
  var KIND_LABEL = { url: 'kindUrl', text: 'kindText', wifi: 'kindWifi', contact: 'kindContact', email: 'kindEmail', sms: 'kindSms', phone: 'kindPhone', geo: 'kindGeo' };

  function showResult(text, format) {
    lastResult = { text: text, format: format };
    renderResult();
    var card = $('resultCard');
    card.hidden = false;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderResult() {
    if (!lastResult) return;
    var p = Payloads.parse(lastResult.text);
    var fields = $('resultFields'), actions = $('resultActions'), warn = $('resultWarn');
    fields.innerHTML = ''; actions.innerHTML = ''; warn.hidden = true;
    $('resultKind').textContent = t(KIND_LABEL[p.kind]);
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
      default:
        field('text', p.text);
    }
    if (lastResult.format) field('format', String(lastResult.format).replace(/_/g, ' '), true);

    btn('copyText', function () { copy(lastResult.text); });
    btn('scanAgain', function () {
      $('resultCard').hidden = true;
      lastResult = null;
      if (window.isSecureContext) startCamera();
    });
  }

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
    } else if (isIOS) {
      showBanner(t('iosInstall'));
    }
  });

  function showBanner(text, actionLabel, action) {
    var b = $('banner');
    b.innerHTML = '';
    b.appendChild(el('span', { text: text }));
    if (actionLabel) b.appendChild(el('button', { type: 'button', 'class': 'btn btn-primary', text: actionLabel, on: { click: action } }));
    b.appendChild(el('button', { type: 'button', 'class': 'btn btn-ghost', 'aria-label': 'Close', text: '×', on: { click: function () { b.hidden = true; } } }));
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
    buildPresets();
    setCamButton();
    if (!window.isSecureContext) camMsg(t('cameraInsecure'));
    render();
    renderResult();
  });

  I18N.apply();
  syncStyleControls();
  buildPresets();
  setCamButton();
  var savedType = store('qrstudio.type');
  setType(Payloads.build[savedType] ? savedType : 'url');
  // Opening a shortcut like ./#scan lands on the scanner.
  var startTab = location.hash === '#scan' ? 'scan' : location.hash === '#create' ? 'create' : (store('qrstudio.tab') || 'create');
  showTab(startTab === 'scan' ? 'scan' : 'create');
})();
