# QR Studio · استوديو QR

Make styled QR codes and scan them, on phones and computers, even offline.
Arabic and English, with full right‑to‑left support. Everything runs on your
device; nothing is uploaded.

أنشئ رموز QR بتصاميم مختلفة واقرأها على الهاتف أو الحاسوب، حتى بدون إنترنت.
يدعم العربية والإنجليزية. كل شيء يعمل على جهازك ولا يتم رفع أي بيانات.

## Open the app · افتح التطبيق

**https://kbs7s.github.io/qr-studio/**

<img src="docs/app-qr.png" alt="QR code for the app link" width="160">

## Install on your phone · التثبيت على الهاتف

**Android (Chrome)**
1. Open the link above in Chrome.
2. Tap **Install app** at the top, or open the ⋮ menu and choose **Install app** / **Add to Home screen**.
3. Confirm. The QR Studio icon appears on your home screen.

**iPhone / iPad (Safari)**
1. Open the link in Safari.
2. Tap the **Share** button (square with an arrow).
3. Scroll down, tap **Add to Home Screen**, then **Add**.

**Computer (Chrome or Edge):** open the link and click the install icon at the end of the address bar.

**أندرويد (Chrome)**
1. افتح الرابط أعلاه في متصفح Chrome.
2. اضغط **تثبيت التطبيق** في الأعلى، أو افتح القائمة ⋮ واختر **تثبيت التطبيق** أو **إضافة إلى الشاشة الرئيسية**.
3. أكّد التثبيت، وستظهر أيقونة استوديو QR على الشاشة الرئيسية.

**آيفون / آيباد (Safari)**
1. افتح الرابط في متصفح Safari.
2. اضغط زر **المشاركة** (المربع الذي فيه سهم).
3. انزل للأسفل واضغط **إضافة إلى الشاشة الرئيسية** ثم **إضافة**.

**الحاسوب (Chrome أو Edge):** افتح الرابط واضغط أيقونة التثبيت في نهاية شريط العنوان.

After installing, the app works without internet and updates itself. The same
steps are inside the app under **How to install** (or open
`https://kbs7s.github.io/qr-studio/#install`).

بعد التثبيت يعمل التطبيق بدون إنترنت ويتحدّث تلقائياً. تجد نفس الخطوات داخل التطبيق
تحت **طريقة التثبيت**.

## What it does · الميزات

**Create · إنشاء**
- Link, text, Wi‑Fi, contact (vCard), WhatsApp, email, SMS, phone call, map location and calendar event
- Other barcodes: EAN‑13, EAN‑8, UPC‑A, UPC‑E, Code 128, Code 39, ITF‑14, Data Matrix, PDF417, Aztec
- Colors and gradients, dot shapes, corner shapes, a logo in the middle, error correction level, quiet zone
- Download as PNG or SVG in four sizes, share (on phones), copy the encoded content
- Print a sheet of 1–20 copies with a caption (handy for Wi‑Fi cards)
- Warns when colors are too low‑contrast to scan reliably

**Scan · مسح**
- Live camera scanning (pick front/back camera, light and zoom where the phone supports it)
- Reads QR and common barcodes; product codes get a "search the web" button
- Scan a photo or screenshot: choose a file, drag it in, or paste it
- Understands Wi‑Fi, contacts, email, SMS, phone, location and links, with one‑tap actions (copy password, save contact, call, open map…)

**History · السجل**
- Everything you scan or download is kept on the device (last 100), with search, filters, reopen and delete

**App · التطبيق**
- Dark and light themes
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
- [bwip-js](https://github.com/metafloor/bwip-js): drawing the non‑QR barcodes

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
