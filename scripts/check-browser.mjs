import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStaticServer } from './static-server.mjs';

const repoRoot = process.cwd();
const smokeTargets = [
  { path: '/index.html', requireCanvas: true, requireNonBlank: true, requireHudMap: true, settleMs: 1500 },
  { path: '/editor3d.html', requireCanvas: true, requireNonBlank: false, settleMs: 1000 },
  { path: '/gallery.html', requireCanvas: true, requireNonBlank: false, settleMs: 1500 },
  { path: '/pose-editor.html', requireCanvas: true, requireNonBlank: false, settleMs: 1000 },
  { path: '/sfx-editor.html', requireCanvas: true, requireNonBlank: false, settleMs: 500 },
  { path: '/bones.html', requireCanvas: true, requireNonBlank: false, settleMs: 1500 },
  { path: '/skeleton-demo.html', requireCanvas: true, requireNonBlank: false, settleMs: 1500 },
  { path: '/quat-demo.html', requireCanvas: true, requireNonBlank: false, settleMs: 1500 },
  { path: '/%E8%A7%92%E8%89%B2%E5%B1%95%E7%A4%BA%E5%8E%85.html', requireCanvas: true, requireNonBlank: false, settleMs: 1500 },
];
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
  requireHudMap = false,
  settleMs = 0,
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
              } else {
                const ctx2d = canvas.getContext('2d');
                if (ctx2d && ctx2d.getImageData) {
                  const points = [[0.5,0.5],[0.33,0.33],[0.67,0.62],[0.2,0.75],[0.8,0.25]];
                  for (const [px, py] of points) {
                    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(canvas.width * px)));
                    const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(canvas.height * py)));
                    const data = ctx2d.getImageData(x, y, 1, 1).data;
                    if (data[3] > 0 && (data[0] > 4 || data[1] > 4 || data[2] > 4)) { nonBlank = true; break; }
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
      if (canvasOk && blankOk && lastProbe?.loadingHidden) {
        if (settleMs > 0) await new Promise(resolve => setTimeout(resolve, settleMs));
        break;
      }
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
    if (requireHudMap) {
      const hudMapProbe = await cdp.send('Runtime.evaluate', {
        awaitPromise: true,
        returnByValue: true,
        expression: `(() => new Promise(resolve => {
          requestAnimationFrame(() => requestAnimationFrame(() => {
            function canvasHasInk(canvas) {
              try {
                const ctx = canvas.getContext('2d');
                const points = [[0.5,0.5],[0.25,0.25],[0.75,0.25],[0.25,0.75],[0.75,0.75]];
                for (const [px, py] of points) {
                  const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(canvas.width * px)));
                  const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(canvas.height * py)));
                  const data = ctx.getImageData(x, y, 1, 1).data;
                  if (data[3] > 0 && (data[0] > 4 || data[1] > 4 || data[2] > 4)) return true;
                }
                return false;
              } catch (error) {
                return false;
              }
            }
            const mini = document.getElementById('miniMapCanvas');
            const world = document.getElementById('worldMapCanvas');
            const mode = document.getElementById('miniMapMode');
            const compass = document.getElementById('compassLabel');
            const dock = document.getElementById('mapDockBtn');
            const overlay = document.getElementById('worldMapOverlay');
            const close = document.getElementById('closeWorldMap');
            const state = document.getElementById('state');
            const stam = document.getElementById('stamBar');
            const result = {
              miniExists: !!mini,
              worldExists: !!world,
              miniSize: mini ? [mini.width, mini.height] : null,
              worldSize: world ? [world.width, world.height] : null,
              miniInk: mini ? canvasHasInk(mini) : false,
              stateText: state?.textContent || '',
              stamWidth: stam?.style.width || '',
              modeBefore: mode?.textContent || '',
              compassBefore: compass?.textContent || ''
            };
            mode?.click();
            result.modeAfter = mode?.textContent || '';
            result.compassAfter = compass?.textContent || '';
            mode?.click();
            result.modeRestored = mode?.textContent || '';
            result.compassRestored = compass?.textContent || '';
            dock?.click();
            requestAnimationFrame(() => {
              result.overlayOpen = overlay?.classList.contains('open') || false;
              result.worldInk = world ? canvasHasInk(world) : false;
              close?.click();
              result.closeClosed = !(overlay?.classList.contains('open') || false);
              dock?.click();
              overlay?.click();
              result.overlayClosed = !(overlay?.classList.contains('open') || false);
              dock?.click();
              window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
              result.escapeClosed = !(overlay?.classList.contains('open') || false);
              const beforeCamera = globalThis.__IAMOK_TEST_PROBE__?.camera?.();
              window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'q' }));
              requestAnimationFrame(() => requestAnimationFrame(() => {
                const afterCamera = globalThis.__IAMOK_TEST_PROBE__?.camera?.();
                window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', key: 'q' }));
                result.cameraProbeExists = !!beforeCamera && !!afterCamera;
                result.cameraBefore = beforeCamera || null;
                result.cameraAfter = afterCamera || null;
                result.cameraFinite = !!afterCamera && [
                  afterCamera.x, afterCamera.y, afterCamera.z,
                  afterCamera.yaw, afterCamera.pitch,
                  afterCamera.targetYaw, afterCamera.targetPitch,
                  afterCamera.playerTargetX, afterCamera.playerTargetY, afterCamera.playerTargetZ
                ].every(Number.isFinite);
                result.cameraPitchInRange = !!afterCamera && afterCamera.pitch >= afterCamera.minPitch - 1e-6 && afterCamera.pitch <= afterCamera.maxPitch + 1e-6;
                result.cameraYawChanged = !!beforeCamera && !!afterCamera && (
                  Math.abs(afterCamera.targetYaw - beforeCamera.targetYaw) > 1e-5 ||
                  Math.abs(afterCamera.yaw - beforeCamera.yaw) > 1e-5
                );
                resolve(result);
              }));
            });
          }));
        }))()`,
      }, sessionId);
      if (hudMapProbe.exceptionDetails) {
        throw new Error(`${pathname} HUD/map probe failed: ${hudMapProbe.exceptionDetails.text || 'Runtime.evaluate failed'}`);
      }
      const probe = hudMapProbe.result?.value || {};
      const failures = [];
      if (!probe.miniExists) failures.push('missing #miniMapCanvas');
      if (!probe.worldExists) failures.push('missing #worldMapCanvas');
      if (String(probe.miniSize) !== '608,608') failures.push(`miniMapCanvas size ${JSON.stringify(probe.miniSize)}`);
      if (String(probe.worldSize) !== '1200,820') failures.push(`worldMapCanvas size ${JSON.stringify(probe.worldSize)}`);
      if (!probe.miniInk) failures.push('miniMapCanvas has no sampled ink');
      if (!probe.worldInk) failures.push('worldMapCanvas has no sampled ink after opening map');
      if (probe.modeBefore !== 'N' || probe.modeAfter !== '↑' || probe.modeRestored !== 'N') failures.push(`mini map mode text flow ${probe.modeBefore}->${probe.modeAfter}->${probe.modeRestored}`);
      if (probe.compassBefore !== 'N' || probe.compassAfter !== '' || probe.compassRestored !== 'N') failures.push(`compass text flow ${probe.compassBefore}->${probe.compassAfter}->${probe.compassRestored}`);
      if (!probe.overlayOpen) failures.push('map dock did not open overlay');
      if (!probe.closeClosed) failures.push('close button did not close overlay');
      if (!probe.overlayClosed) failures.push('overlay click did not close overlay');
      if (!probe.escapeClosed) failures.push('Escape did not close overlay');
      if (!probe.stateText.startsWith('状态: ')) failures.push(`state text not populated: ${probe.stateText}`);
      if (!probe.stamWidth.endsWith('%')) failures.push(`stamina width not populated: ${probe.stamWidth}`);
      if (!probe.cameraProbeExists) failures.push('camera test probe missing');
      if (!probe.cameraFinite) failures.push(`camera probe contains non-finite values: ${JSON.stringify(probe.cameraAfter)}`);
      if (!probe.cameraPitchInRange) failures.push(`camera pitch outside range: ${JSON.stringify(probe.cameraAfter)}`);
      if (!probe.cameraYawChanged) failures.push(`camera yaw did not respond to KeyQ: before ${JSON.stringify(probe.cameraBefore)}, after ${JSON.stringify(probe.cameraAfter)}`);
      if (failures.length) throw new Error(`${pathname} HUD/map probe failed:\n${failures.map(item => `- ${item}`).join('\n')}\nProbe: ${JSON.stringify(probe)}`);
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
  for (const target of smokeTargets) {
    await smokePage(cdp, origin, target.path, target);
  }
} catch (error) {
  if (browser?.stderr()) {
    console.error('Chromium stderr:');
    console.error(browser.stderr());
  }
  throw error;
  } finally {
    cdp?.close();
  if (browser?.child && browser.child.exitCode === null) {
    const exited = new Promise(resolve => browser.child.once('exit', resolve));
    browser.child.kill('SIGTERM');
    const didExit = await Promise.race([exited.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 3000))]);
    if (!didExit && browser.child.exitCode === null) browser.child.kill('SIGKILL');
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
