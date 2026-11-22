/* QR Studio — build QR payload strings and parse scanned ones.
 * Formats follow the de-facto standards most phone cameras understand
 * (ZXing "barcode contents" conventions, vCard 3.0, RFC 6068 mailto, RFC 5870 geo).
 */
(function () {
  'use strict';

  function trim(v) { return (v == null ? '' : String(v)).trim(); }

  // ---------- building ----------

  // Wi-Fi: special characters \ ; , : " must be backslash-escaped.
  function escWifi(s) { return String(s).replace(/([\\;,:"])/g, '\\$1'); }

  // vCard text values: escape \ , ; and newlines.
  function escVcard(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  }

  function normalizeUrl(u) {
    u = trim(u);
    if (!u) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
    return u;
  }

  function cleanPhone(p) { return trim(p).replace(/[^\d+*#]/g, ''); }

  var build = {
    url: function (f) { return normalizeUrl(f.url); },

    text: function (f) { return f.text == null ? '' : String(f.text); },

    wifi: function (f) {
      var ssid = trim(f.ssid);
      if (!ssid) return '';
      var sec = f.security || 'WPA';
      var out = 'WIFI:T:' + (sec === 'nopass' ? 'nopass' : sec) + ';S:' + escWifi(ssid) + ';';
      if (sec !== 'nopass' && f.password) out += 'P:' + escWifi(f.password) + ';';
      if (f.hidden) out += 'H:true;';
      return out + ';';
    },

    contact: function (f) {
      var first = trim(f.firstName), last = trim(f.lastName);
      var fn = [first, last].filter(Boolean).join(' ');
      var phone = trim(f.phone), email = trim(f.email), org = trim(f.org);
      if (!fn && !phone && !email && !org) return '';
      var lines = ['BEGIN:VCARD', 'VERSION:3.0'];
      lines.push('N:' + escVcard(last) + ';' + escVcard(first) + ';;;');
      lines.push('FN:' + escVcard(fn || org || phone || email));
      if (org) lines.push('ORG:' + escVcard(org));
      if (trim(f.jobTitle)) lines.push('TITLE:' + escVcard(trim(f.jobTitle)));
      if (phone) lines.push('TEL;TYPE=CELL:' + phone);
      if (email) lines.push('EMAIL:' + email);
      if (trim(f.website)) lines.push('URL:' + normalizeUrl(f.website));
      if (trim(f.address)) lines.push('ADR:;;' + escVcard(trim(f.address)) + ';;;;');
      if (trim(f.note)) lines.push('NOTE:' + escVcard(trim(f.note)));
      lines.push('END:VCARD');
      return lines.join('\n');
    },

    email: function (f) {
      var to = trim(f.to);
      if (!to) return '';
      var q = [];
      if (trim(f.subject)) q.push('subject=' + encodeURIComponent(trim(f.subject)));
      if (f.body && String(f.body).trim()) q.push('body=' + encodeURIComponent(String(f.body)));
      return 'mailto:' + to + (q.length ? '?' + q.join('&') : '');
    },

    sms: function (f) {
      var num = cleanPhone(f.number);
      if (!num) return '';
      return 'SMSTO:' + num + ':' + (f.message || '');
    },

    phone: function (f) {
      var num = cleanPhone(f.number);
      return num ? 'tel:' + num : '';
    },

    geo: function (f) {
      var lat = parseFloat(f.lat), lng = parseFloat(f.lng);
      if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return '';
      var s = 'geo:' + round(lat) + ',' + round(lng);
      if (trim(f.label)) s += '?q=' + round(lat) + ',' + round(lng) + '(' + encodeURIComponent(trim(f.label)) + ')';
      return s;
    }
  };

  function round(n) { return Math.round(n * 1e6) / 1e6; }

  // ---------- parsing ----------

  // Split "K:v;K:v;;" respecting backslash escapes.
  function splitFields(body) {
    var out = {}, key = '', val = '', inKey = true;
    for (var i = 0; i < body.length; i++) {
      var c = body[i];
      if (c === '\\' && i + 1 < body.length) {
        if (inKey) key += body[++i]; else val += body[++i];
        continue;
      }
      if (inKey && c === ':') { inKey = false; continue; }
      if (!inKey && c === ';') {
        if (key) out[key.toUpperCase()] = out[key.toUpperCase()] ? out[key.toUpperCase()] + '\n' + val : val;
        key = ''; val = ''; inKey = true;
        continue;
      }
      if (inKey) key += c; else val += c;
    }
    if (key && !inKey) out[key.toUpperCase()] = val;
    return out;
  }

  function unescVcard(s) {
    return String(s).replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
  }

  function parseVcard(raw) {
    var text = raw.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, ''); // unfold
    var c = { phones: [], emails: [], urls: [] };
    text.split('\n').forEach(function (line) {
      var idx = line.indexOf(':');
      if (idx < 0) return;
      var key = line.slice(0, idx).split(';')[0].toUpperCase().replace(/^ITEM\d+\./, '');
      var val = line.slice(idx + 1);
      switch (key) {
        case 'FN': c.name = unescVcard(val); break;
        case 'N':
          if (!c.name) c.name = val.split(';').slice(0, 2).reverse().map(unescVcard).join(' ').trim();
          break;
        case 'TEL': if (val) c.phones.push(val); break;
        case 'EMAIL': if (val) c.emails.push(val); break;
        case 'URL': if (val) c.urls.push(val); break;
        case 'ORG': c.org = unescVcard(val.split(';').join(' ')).trim(); break;
        case 'TITLE': c.title = unescVcard(val); break;
        case 'ADR': c.address = val.split(';').map(unescVcard).filter(Boolean).join(', '); break;
        case 'NOTE': c.note = unescVcard(val); break;
      }
    });
    return c;
  }

  function parseMecard(raw) {
    var f = splitFields(raw.slice(7));
    var name = f.N ? f.N.split(',').reverse().join(' ').trim() : '';
    return {
      name: name,
      phones: f.TEL ? f.TEL.split('\n') : [],
      emails: f.EMAIL ? f.EMAIL.split('\n') : [],
      urls: f.URL ? f.URL.split('\n') : [],
      org: f.ORG || '',
      address: f.ADR || '',
      note: f.NOTE || ''
    };
  }

  function safeDecode(s) {
    try { return decodeURIComponent(s.replace(/\+/g, '%20')); } catch (e) { return s; }
  }

  function parse(raw) {
    var s = raw == null ? '' : String(raw);
    var t = s.trim();
    var up = t.toUpperCase();

    if (up.indexOf('WIFI:') === 0) {
      var w = splitFields(t.slice(5));
      return {
        kind: 'wifi', raw: s,
        ssid: w.S || '', password: w.P || '',
        security: (w.T || (w.P ? 'WPA' : 'nopass')),
        hidden: /^true$/i.test(w.H || '')
      };
    }
    if (up.indexOf('BEGIN:VCARD') === 0) {
      var vc = parseVcard(t); vc.kind = 'contact'; vc.raw = s; vc.vcard = t; return vc;
    }
    if (up.indexOf('MECARD:') === 0) {
      var mc = parseMecard(t); mc.kind = 'contact'; mc.raw = s; return mc;
    }
    if (up.indexOf('MAILTO:') === 0) {
      var rest = t.slice(7), qi = rest.indexOf('?');
      var to = safeDecode(qi >= 0 ? rest.slice(0, qi) : rest);
      var params = {};
      if (qi >= 0) rest.slice(qi + 1).split('&').forEach(function (kv) {
        var p = kv.split('='); params[p[0].toLowerCase()] = safeDecode(p.slice(1).join('='));
      });
      return { kind: 'email', raw: s, to: to, subject: params.subject || '', body: params.body || '' };
    }
    if (up.indexOf('MATMSG:') === 0) {
      var m = splitFields(t.slice(7));
      return { kind: 'email', raw: s, to: m.TO || '', subject: m.SUB || '', body: m.BODY || '' };
    }
    if (up.indexOf('SMSTO:') === 0 || up.indexOf('MMSTO:') === 0) {
      var body = t.slice(6), ci = body.indexOf(':');
      return { kind: 'sms', raw: s, number: ci >= 0 ? body.slice(0, ci) : body, message: ci >= 0 ? body.slice(ci + 1) : '' };
    }
    if (up.indexOf('SMS:') === 0) {
      var sb = t.slice(4), sq = sb.indexOf('?'), msg = '';
      if (sq >= 0) {
        var mm = /(?:^|&)body=([^&]*)/i.exec(sb.slice(sq + 1));
        if (mm) msg = safeDecode(mm[1]);
        sb = sb.slice(0, sq);
      } else if (sb.indexOf(':') >= 0) {
        msg = sb.slice(sb.indexOf(':') + 1); sb = sb.slice(0, sb.indexOf(':'));
      }
      return { kind: 'sms', raw: s, number: sb, message: msg };
    }
    if (up.indexOf('TEL:') === 0) {
      return { kind: 'phone', raw: s, number: t.slice(4) };
    }
    if (up.indexOf('GEO:') === 0) {
      var g = /^geo:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i.exec(t);
      if (g) {
        var lm = /\(([^)]*)\)/.exec(t);
        return { kind: 'geo', raw: s, lat: parseFloat(g[1]), lng: parseFloat(g[2]), label: lm ? safeDecode(lm[1]) : '' };
      }
    }
    if (/^https?:\/\/\S+$/i.test(t)) {
      return { kind: 'url', raw: s, url: t };
    }
    if (/^www\.\S+\.\S+$/i.test(t)) {
      return { kind: 'url', raw: s, url: 'https://' + t };
    }
    return { kind: 'text', raw: s, text: s };
  }

  window.Payloads = { build: build, parse: parse, normalizeUrl: normalizeUrl };
})();
