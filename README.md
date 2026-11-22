# QR Studio · استوديو QR

Make styled QR codes and scan them, on phones and computers, even offline.
Arabic and English, with full right‑to‑left support. Everything runs on your
device; nothing is uploaded.

أنشئ رموز QR بتصاميم مختلفة واقرأها على الهاتف أو الحاسوب، حتى بدون إنترنت.
يدعم العربية والإنجليزية. كل شيء يعمل على جهازك ولا يتم رفع أي بيانات.

## What it does · الميزات

**Create · إنشاء**
- Link, text, Wi‑Fi, contact (vCard), email, SMS, phone call and map location
- Colors and gradients, dot shapes, corner shapes, a logo in the middle, error correction level, quiet zone
- Download as PNG, share (on phones), copy the encoded content
- Warns when colors are too low‑contrast to scan reliably

**Scan · مسح**
- Live camera scanning (pick front/back camera)
- Scan a photo or screenshot: choose a file, drag it in, or paste it
- Understands Wi‑Fi, contacts, email, SMS, phone, location and links, with one‑tap actions (copy password, save contact, call, open map…)

**App · التطبيق**
- Installable on Android, iPhone and desktop (Progressive Web App)
- Works fully offline after the first visit

## Run it locally · التشغيل محلياً

The camera and offline mode need `https` or `localhost`, so serve the folder
instead of double‑clicking `index.html`:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly still lets you create codes and scan images.

تحتاج الكاميرا ووضع عدم الاتصال إلى `https` أو `localhost`. شغّل الأمر أعلاه ثم افتح
`http://localhost:8000`.

## How it's built

Plain HTML, CSS and JavaScript with no build step. Libraries are vendored in
[`vendor/`](vendor/LICENSES.md):

- [qr-code-styling](https://github.com/kozakdenys/qr-code-styling): draws the styled codes
- [node-qrcode](https://github.com/soldair/node-qrcode): checks capacity and reports version/size
- [html5-qrcode](https://github.com/mebjas/html5-qrcode): live camera scanning
- [zxing-js/library](https://github.com/zxing-js/library): decoding images (after the browser's own `BarcodeDetector` when available)

Ideas also came from [segno](https://github.com/heuer/segno),
[pretty_qr_code](https://github.com/yeeroman/pretty_qr_code),
[mobile_scanner](https://github.com/juliansteenbakker/mobile_scanner) and
[zbar](https://github.com/mchehab/zbar).

| Path | What |
|---|---|
| `index.html` | the whole UI |
| `js/app.js` | generator, scanner, install logic |
| `js/payloads.js` | building and parsing Wi‑Fi / vCard / mailto / SMS / geo payloads |
| `js/i18n.js` | Arabic and English strings |
| `sw.js` | offline cache (bump `VERSION` when files change) |
| `manifest.webmanifest`, `icons/` | install metadata |
