import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStaticServer } from './static-server.mjs';

const repoRoot = process.cwd();
const chromeCandidates = [
  process.env.CHROME_BIN,
  '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter(Boolean);

const chromePath = chromeCandidates.find(candidate => {
  try {
    fsSync.accessSync(candidate, fsSync.constants.X_OK);
    return true;
  } catch {
    return false;
  }
});

if (!chromePath) {
  throw new Error(`No Chromium/Chrome executable found. Tried:\n${chromeCandidates.map(item => `- ${item}`).join('\n')}`);
}

function listen(server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
}

function close(server) {
  return new Promise(resolve => server.close(resolve));
}

async function waitForFile(file, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      return await fs.readFile(file, 'utf8');
    } catch {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  throw new Error(`Timed out waiting for ${file}`);
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out connecting to Chromium CDP')), 10000);
      this.ws.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      this.ws.addEventListener('error', () => reject(new Error('Failed to connect to Chromium CDP')), { once: true });
    });
    this.ws.addEventListener('message', event => this.#handleMessage(event.data));
    this.ws.addEventListener('close', () => {
      for (const { reject } of this.pending.values()) reject(new Error('Chromium CDP connection closed'));
      this.pending.clear();
    });
  }

  close() {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.close();
  }

  on(method, listener) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set());
    this.listeners.get(method).add(listener);
    return () => this.listeners.get(method)?.delete(listener);
  }

  waitFor(method, predicate = () => true, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const off = this.on(method, message => {
        if (!predicate(message.params, message)) return;
        clearTimeout(timer);
        off();
        resolve(message.params);
      });
      const timer = setTimeout(() => {
        off();
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
    });
  }

  send(method, params = {}, sessionId = undefined) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    const promise = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
    this.ws.send(JSON.stringify(payload));
    return promise;
  }

  #handleMessage(raw) {
    const message = JSON.parse(raw);
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(`${pending.method} failed: ${message.error.message}`));
      } else {
        pending.resolve(message.result || {});
      }
      return;
    }
    for (const listener of this.listeners.get(message.method) || []) listener(message);
  }
}

async function launchChromium() {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'iamokdungeon-chrome-'));
  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--disable-translate',
    '--enable-unsafe-swiftshader',
    '--hide-scrollbars',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-first-run',
    '--remote-debugging-port=0',
    '--use-angle=swiftshader',
    '--use-gl=angle',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ];
  const child = spawn(chromePath, args, {
    cwd: repoRoot,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', chunk => {
    stderr += chunk.toString();
    if (stderr.length > 12000) stderr = stderr.slice(-12000);
  });
  child.on('exit', code => {
    if (code !== null && code !== 0) stderr += `\nChromium exited with code ${code}`;
  });
  const activePort = await waitForFile(path.join(userDataDir, 'DevToolsActivePort'));
  const [port, browserPath] = activePort.trim().split('\n');
  return {
    userDataDir,
    child,
    stderr: () => stderr.trim(),
    wsUrl: `ws://127.0.0.1:${port}${browserPath}`,
  };
}

function isAllowedRequest(url, origin) {
  return url.startsWith(`${origin}/`)
    || url === origin
    || url.startsWith('data:')
    || url.startsWith('blob:')
    || url.startsWith('about:');
}

async function smokePage(cdp, origin, pathname, {
  requireCanvas = true,
  requireNonBlank = true,
  timeoutMs = 25000,
} = {}) {
  const pageUrl = `${origin}${pathname}`;
  const externalRequests = [];
  const badResponses = [];
  const loadingFailures = [];
  const exceptions = [];
  const consoleErrors = [];
  const requestUrls = new Map();

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

  const handlers = [
    cdp.on('Fetch.requestPaused', message => {
      if (message.sessionId !== sessionId) return;
      const url = message.params.request.url;
      if (!isAllowedRequest(url, origin)) {
        externalRequests.push(url);
        cdp.send('Fetch.failRequest', {
          requestId: message.params.requestId,
          errorReason: 'BlockedByClient',
        }, sessionId).catch(() => {});
        return;
      }
      cdp.send('Fetch.continueRequest', { requestId: message.params.requestId }, sessionId).catch(() => {});
    }),
    cdp.on('Network.responseReceived', message => {
      if (message.sessionId !== sessionId) return;
      const response = message.params.response;
      if (response.url.endsWith('/favicon.ico')) return;
      if (response.status >= 400) badResponses.push(`${response.status} ${response.url}`);
    }),
    cdp.on('Network.requestWillBeSent', message => {
      if (message.sessionId !== sessionId) return;
      requestUrls.set(message.params.requestId, message.params.request.url);
    }),
    cdp.on('Network.loadingFailed', message => {
      if (message.sessionId !== sessionId) return;
      const reason = message.params.errorText || 'unknown';
      const url = requestUrls.get(message.params.requestId) || message.params.requestId;
      if (reason === 'net::ERR_ABORTED' && String(url).endsWith('/favicon.ico')) return;
      if (reason === 'net::ERR_ABORTED' && isAllowedRequest(String(url), origin)) return;
      if (reason === 'net::ERR_BLOCKED_BY_CLIENT') return;
      loadingFailures.push(`${reason} ${url}`);
    }),
    cdp.on('Runtime.exceptionThrown', message => {
      if (message.sessionId !== sessionId) return;
      const detail = message.params.exceptionDetails;
      const text = detail.exception?.description || detail.text || 'Runtime exception';
      exceptions.push(text);
    }),
    cdp.on('Runtime.consoleAPICalled', message => {
      if (message.sessionId !== sessionId) return;
      if (message.params.type !== 'error') return;
      const text = message.params.args.map(arg => arg.value ?? arg.description ?? '').join(' ');
      consoleErrors.push(text || 'console.error');
    }),
  ];

  try {
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Network.enable', {}, sessionId);
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] }, sessionId);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        globalThis.__IAMOK_ENABLE_TEST_PROBE__ = true;
        (() => {
          const original = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function(type, attrs) {
            if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
              attrs = Object.assign({}, attrs || {}, { preserveDrawingBuffer: true });
            }
            return original.call(this, type, attrs);
          };
        })();
      `,
    }, sessionId);

    const loadEvent = cdp.waitFor('Page.loadEventFired', (_params, message) => message.sessionId === sessionId, timeoutMs);
    await cdp.send('Page.navigate', { url: pageUrl }, sessionId);
    await loadEvent;

    const started = Date.now();
    let lastProbe = null;
    while (Date.now() - started < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 250));
      const evaluation = await cdp.send('Runtime.evaluate', {
        awaitPromise: false,
        returnByValue: true,
        expression: `(() => {
          const canvas = document.querySelector('canvas#c') || document.querySelector('canvas');
          const loading = document.querySelector('#loading');
          const loadingStyle = loading ? getComputedStyle(loading) : null;
          const loadingHidden = !loading || loadingStyle.display === 'none' || loadingStyle.visibility === 'hidden' || loadingStyle.opacity === '0';
          let nonBlank = false;
          let canvasSize = null;
          try {
            if (canvas) {
              canvasSize = { width: canvas.width, height: canvas.height, clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight };
              const dataUrl = canvas.toDataURL('image/png');
              nonBlank = typeof dataUrl === 'string' && dataUrl.length > 2000;
              if (!nonBlank) {
                const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (gl && gl.readPixels) {
                  const width = gl.drawingBufferWidth;
                  const height = gl.drawingBufferHeight;
                  const pixel = new Uint8Array(4);
                  const points = [[0.5,0.5],[0.33,0.33],[0.67,0.62],[0.2,0.75],[0.8,0.25]];
                  for (const [px, py] of points) {
                    gl.readPixels(Math.max(0, Math.floor(width * px)), Math.max(0, Math.floor(height * py)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
                    if (pixel[0] > 4 || pixel[1] > 4 || pixel[2] > 4) { nonBlank = true; break; }
                  }
                }
              }
            }
          } catch (error) {
            return { canvas: !!canvas, loadingHidden, nonBlank, canvasSize, probeError: error.message };
          }
          return { canvas: !!canvas, loadingHidden, nonBlank, canvasSize, title: document.title };
        })()`,
      }, sessionId);
      if (evaluation.exceptionDetails) {
        lastProbe = { probeError: evaluation.exceptionDetails.text || 'Runtime.evaluate failed' };
      } else {
        lastProbe = evaluation.result?.value;
      }
      const canvasOk = !requireCanvas || lastProbe?.canvas;
      const blankOk = !requireNonBlank || lastProbe?.nonBlank;
      if (canvasOk && blankOk && lastProbe?.loadingHidden) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    if (externalRequests.length || badResponses.length || loadingFailures.length || exceptions.length || consoleErrors.length) {
      throw new Error(formatSmokeFailure(pathname, { externalRequests, badResponses, loadingFailures, exceptions, consoleErrors, lastProbe }));
    }
    if (requireCanvas && !lastProbe?.canvas) {
      throw new Error(`${pathname} did not expose a canvas. Last probe: ${JSON.stringify(lastProbe)}`);
    }
    if (!lastProbe?.loadingHidden) {
      throw new Error(`${pathname} loading indicator did not clear. Last probe: ${JSON.stringify(lastProbe)}`);
    }
    if (requireNonBlank && !lastProbe?.nonBlank) {
      throw new Error(`${pathname} canvas stayed blank. Last probe: ${JSON.stringify(lastProbe)}`);
    }
    console.log(`Browser smoke passed: ${pathname}`);
  } finally {
    for (const off of handlers) off();
    await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
  }
}

function formatSmokeFailure(pathname, data) {
  const sections = [`Browser smoke failed for ${pathname}`];
  for (const [label, values] of Object.entries(data)) {
    if (label === 'lastProbe') continue;
    if (values.length) sections.push(`${label}:\n${values.map(value => `- ${value}`).join('\n')}`);
  }
  sections.push(`lastProbe: ${JSON.stringify(data.lastProbe)}`);
  return sections.join('\n\n');
}

const server = createStaticServer({ root: 'prototype/3d' });
let browser;
let cdp;

await listen(server);
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;

try {
  browser = await launchChromium();
  cdp = new CdpClient(browser.wsUrl);
  await cdp.connect();
  await smokePage(cdp, origin, '/index.html');
} catch (error) {
  if (browser?.stderr()) {
    console.error('Chromium stderr:');
    console.error(browser.stderr());
  }
  throw error;
  } finally {
    cdp?.close();
  if (browser?.child && !browser.child.killed) {
    const exited = new Promise(resolve => browser.child.once('exit', resolve));
    browser.child.kill('SIGTERM');
    await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 3000))]);
    if (!browser.child.killed) browser.child.kill('SIGKILL');
  }
  if (browser?.userDataDir) {
    for (let i = 0; i < 5; i++) {
      try {
        await fs.rm(browser.userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        break;
      } catch (error) {
        if (i === 4) throw error;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
  }
  await close(server);
}
