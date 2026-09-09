/**
 * Screenshot the running site at exact widths.
 *
 * Chrome's headless CLI clamps `--window-size` to a 500px minimum, so
 * `--window-size=380,820` silently lays the page out at 500px and crops the
 * image to 380 — which looks exactly like a responsive bug that isn't there.
 * Driving the DevTools protocol instead sets real device metrics, so 380px is
 * genuinely 380px. The design reference requires the layout to hold at that
 * width, so it has to be checked honestly.
 *
 * Node 22 ships a global WebSocket, so this needs no dependencies.
 *
 *   node scripts/shoot.mjs <url> <outDir> [width]x[height] ...
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const CHROME = process.env.CHROME_BIN ?? 'google-chrome';
const PORT = 9222 + Math.floor(Math.random() * 500);

const [url, outDir, ...rest] = process.argv.slice(2);
/**
 * --dark / --light force the theme the toggle would set. Forcing matters:
 * headless Chrome reports prefers-color-scheme: dark by default, so an
 * unforced capture silently tests only one of the two palettes.
 */
const theme = rest.includes('--dark') ? 'dark' : rest.includes('--light') ? 'light' : null;
const dark = theme === 'dark';
const sizeArgs = rest.filter((a) => !a.startsWith('--'));
if (!url || !outDir) {
  console.error('usage: node scripts/shoot.mjs <url> <outDir> [WxH ...]');
  process.exit(1);
}
const sizes = (sizeArgs.length ? sizeArgs : ['1440x900', '380x820']).map((s) => {
  const [w, h] = s.split('x').map(Number);
  return { w, h, name: `${w}x${h}` };
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function devtoolsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const info = await res.json();
      return info.webSocketDebuggerUrl;
    } catch {
      await sleep(250);
    }
  }
  throw new Error('Chrome never exposed a DevTools endpoint');
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    const waiting = pending.get(msg.id);
    if (!waiting) return;
    pending.delete(msg.id);
    if (msg.error) waiting.reject(new Error(JSON.stringify(msg.error)));
    else waiting.resolve(msg.result);
  });

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
    });

  return { ws, ready, send };
}

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

try {
  const { ready, send } = connect(await devtoolsUrl());
  await ready;

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

  await send('Page.enable', {}, sessionId);
  mkdirSync(outDir, { recursive: true });

  for (const size of sizes) {
    await send(
      'Emulation.setDeviceMetricsOverride',
      { width: size.w, height: size.h, deviceScaleFactor: 1, mobile: size.w < 900 },
      sessionId
    );
    await send('Page.navigate', { url }, sessionId);
    // Fonts and layout settle; there are no animations to wait on by design.
    await sleep(1800);

    if (theme) {
      await send(
        'Runtime.evaluate',
        { expression: `document.documentElement.dataset.theme = '${theme}'` },
        sessionId
      );
      await sleep(300);
    }

    const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const file = join(outDir, `${size.name}${theme ? `-${theme}` : ''}.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));

    const { result } = await send(
      'Runtime.evaluate',
      {
        expression:
          'JSON.stringify({inner: innerWidth, scroll: document.documentElement.scrollWidth, title: document.title, body: document.body.innerText.slice(0,80)})',
        returnByValue: true,
      },
      sessionId
    );
    const { inner, scroll, title, body } = JSON.parse(result.value);

    // A screenshot of Chrome's own error page reports "no overflow" and looks
    // like a pass. Refuse to call that a result.
    if (/refused to connect|can.t be reached|ERR_/i.test(body) || !title) {
      throw new Error(`the page did not load (title: ${title || 'none'}) — is the server up?`);
    }
    const overflow = scroll > inner ? `  OVERFLOW by ${scroll - inner}px` : '  no overflow';
    console.log(`${size.name}  viewport ${inner}  scrollWidth ${scroll}${overflow}  -> ${file}`);
  }
} finally {
  chrome.kill();
}
