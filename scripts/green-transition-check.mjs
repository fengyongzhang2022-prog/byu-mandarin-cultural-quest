import { chromium } from "file:///C:/Users/ThinkPad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const base = process.env.GREEN_BASE || "http://127.0.0.1:3100";
const filmIndex = Math.max(0, Math.min(2, Number(process.env.GREEN_FILM_INDEX || 0)));
const watchSeconds = Math.max(0, Number(process.env.GREEN_WATCH_SECONDS || 0));
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);

await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 80,
  downloadThroughput: (4 * 1024 * 1024) / 8,
  uploadThroughput: (1 * 1024 * 1024) / 8,
  connectionType: "cellular4g",
});

await page.goto(`${base}/forest.html?preview=1&transition=${Date.now()}`, {
  waitUntil: "load",
  timeout: 60000,
});

// The first page idles, then warms only the next page's background image.
await page.waitForFunction(() => document.querySelector('link[data-green-warmup="image"]'));
const firstWarmup = await page.locator('link[data-green-warmup="image"]').getAttribute("href");

// Jump to the overview page: only the first poster is warmed, never the full video.
await page.click("#layoutPreviewBtn");
await page.click('[data-preview-stage="5"]');
await page.waitForFunction(() => [...document.querySelectorAll('link[data-green-warmup="image"]')].some((link) => link.href.includes("green-story-film-01-poster-v3.jpg")));

// Enter the film page and measure time to the first decoded frame.
await page.click("#layoutPreviewBtn");
const started = await page.evaluate(() => performance.now());
await page.click('[data-preview-stage="6"]');
if (filmIndex > 0) await page.click(`[data-film-index="${filmIndex}"]`);
await page.waitForSelector("#contextVideo");
const initialVideoRequests = await page.evaluate(() => performance.getEntriesByType("resource").filter((entry) => /\.(?:mp4|webm)(?:\?|$)/i.test(entry.name)).length);
const firstFramePromise = page.evaluate(async (start) => {
  const video = document.querySelector("#contextVideo");
  video.muted = true;
  window.__greenVideoWaits = 0;
  video.addEventListener("waiting", () => window.__greenVideoWaits++);
  await video.play();
  await Promise.race([
    new Promise((resolve) => video.requestVideoFrameCallback ? video.requestVideoFrameCallback(resolve) : video.addEventListener("playing", resolve, { once: true })),
    new Promise((_, reject) => setTimeout(() => reject(new Error("first frame timeout")), 15000)),
  ]);
  window.__greenVideoWaits = 0;
  return Math.round(performance.now() - start);
}, started);
await page.click("#playSelectedFilm");
const firstFrameMs = await firstFramePromise;

if (watchSeconds) await page.waitForTimeout(watchSeconds * 1000);
const playback = await page.evaluate(() => {
  const video = document.querySelector("#contextVideo");
  const bufferEnd = video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0;
  const data = {
    currentTime: Number(video.currentTime.toFixed(2)),
    bufferAhead: Number(Math.max(0, bufferEnd - video.currentTime).toFixed(2)),
    waitingEvents: window.__greenVideoWaits || 0,
    readyState: video.readyState,
  };
  video.pause();
  return data;
});

const result = await page.evaluate((firstWarmupValue) => {
  const videoEntries = performance.getEntriesByType("resource").filter((entry) => /\.(?:mp4|webm)(?:\?|$)/i.test(entry.name));
  return {
    firstWarmup: firstWarmupValue,
    initialVideoRequests: 0,
    videoPrefetched: Boolean(document.querySelector('link[data-green-warmup="video"]')),
    videoRequests: videoEntries.length,
    videoTransferredKB: Math.round(videoEntries.reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0) / 1024),
  };
}, firstWarmup);
result.initialVideoRequests = initialVideoRequests;

console.log(JSON.stringify({ base, filmIndex, firstFrameMs, watchSeconds, playback, ...result }, null, 2));
if (result.videoPrefetched) throw new Error("Video should not be downloaded speculatively");
if (result.initialVideoRequests) throw new Error(`Video was requested before play (${result.initialVideoRequests} request(s))`);
if (firstFrameMs > 2300) throw new Error(`First video frame took ${firstFrameMs}ms`);
if (watchSeconds && (playback.waitingEvents > 0 || playback.currentTime < watchSeconds - 1)) throw new Error("Video stalled during playback");
await browser.close();
