# Bundled libraries

These files are copied unchanged from npm (except `qrcode.min.js`, which is a
browser bundle of the npm package built with esbuild) so the app works offline.

| File | Package | Version | License | Source |
|---|---|---|---|---|
| `qr-code-styling.js` | qr-code-styling | 1.9.2 | MIT | https://github.com/kozakdenys/qr-code-styling |
| `qrcode.min.js` | qrcode (node-qrcode) | 1.5.4 | MIT | https://github.com/soldair/node-qrcode |
| `html5-qrcode.min.js` | html5-qrcode | 2.3.8 | Apache-2.0 | https://github.com/mebjas/html5-qrcode |
| `bwip-js.min.js` | bwip-js (browser build) | 4.5.1 | MIT | https://github.com/metafloor/bwip-js |
| `zxing.min.js` | @zxing/library (UMD build) | 0.21.3 | MIT | https://github.com/zxing-js/library |

To rebuild `qrcode.min.js`:

```sh
npm install qrcode@1.5.4
echo "window.QRCode = require('qrcode');" > entry.js
npx esbuild entry.js --bundle --minify --platform=browser --outfile=qrcode.min.js
```
