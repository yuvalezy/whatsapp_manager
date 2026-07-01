import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';

/** Render the QR string as ASCII in the terminal. */
export function printQrToTerminal(qr: string): void {
  qrcodeTerminal.generate(qr, { small: true });
}

/** Render the QR string as a PNG data URL for the web page. */
export async function qrToDataUrl(qr: string): Promise<string> {
  return QRCode.toDataURL(qr, { margin: 2, width: 320 });
}

/** A tiny, self-refreshing HTML page that shows the current QR / status. */
export function qrHtmlPage(dataUrl: string | null, state: string): string {
  const ready = state === 'READY' || state === 'AUTHENTICATED';
  const body = ready
    ? `<div class="ok">✅ Connected — you can close this page.</div>`
    : dataUrl
      ? `<img src="${dataUrl}" alt="WhatsApp QR code" width="320" height="320" />
         <p>Open WhatsApp → <b>Settings → Linked devices → Link a device</b>, then scan.</p>`
      : `<div class="wait">Waiting for a QR code… (state: ${state})</div>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="5" />
  <title>WhatsApp Manager — Login</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, sans-serif; display: grid; place-items: center;
           min-height: 100vh; margin: 0; text-align: center; gap: 1rem; }
    .card { padding: 2rem 2.5rem; border-radius: 16px; box-shadow: 0 6px 30px rgba(0,0,0,.12); }
    img { border-radius: 12px; }
    .status { font-size: .85rem; opacity: .6; }
    .ok { font-size: 1.25rem; color: #16a34a; }
    .wait { opacity: .7; }
    h1 { font-size: 1.1rem; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>WhatsApp Manager</h1>
    ${body}
    <div class="status">Connection state: <b>${state}</b> · auto-refreshes every 5s</div>
  </div>
</body>
</html>`;
}
