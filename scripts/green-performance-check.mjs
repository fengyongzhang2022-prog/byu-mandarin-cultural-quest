import { chromium } from "file:///C:/Users/ThinkPad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const base = process.env.GREEN_BASE || "https://green.usmandarincurriculumlab.com";
const throttle = process.env.GREEN_THROTTLE !== "0";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);

await cdp.send("Network.enable");
await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
if (throttle) {
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 80,
    downloadThroughput: (4 * 1024 * 1024) / 8,
    uploadThroughput: (1 * 1024 * 1024) / 8,
    connectionType: "cellular4g",
  });
}

await page.addInitScript(() => {
  window.__greenLcp = 0;
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    window.__greenLcp = entries.at(-1)?.startTime || window.__greenLcp;
  }).observe({ type: "largest-contentful-paint", buffered: true });
});

const started = Date.now();
await page.goto(`${base}/forest.html?perf=${Date.now()}`, {
  waitUntil: "load",
  timeout: 60000,
});
await page.waitForTimeout(5000);

const metrics = await page.evaluate(() => {
  const resources = performance.getEntriesByType("resource").map((entry) => ({
    name: entry.name.replace(location.origin, ""),
    type: entry.initiatorType,
    bytes: entry.transferSize || entry.encodedBodySize || 0,
    duration: Math.round(entry.duration),
  }));
  const images = resources.filter((entry) => /\.(?:png|jpe?g|webp|svg)(?:\?|$)/i.test(entry.name));
  const video = resources.filter((entry) => /\.(?:mp4|webm)(?:\?|$)/i.test(entry.name));
  return {
    lcpMs: Math.round(window.__greenLcp || 0),
    totalKB: Math.round(resources.reduce((sum, entry) => sum + entry.bytes, 0) / 1024),
    imageKB: Math.round(images.reduce((sum, entry) => sum + entry.bytes, 0) / 1024),
    videoKB: Math.round(video.reduce((sum, entry) => sum + entry.bytes, 0) / 1024),
    imageRequests: images.length,
    videoRequests: video.length,
    largest: resources.sort((a, b) => b.bytes - a.bytes).slice(0, 12),
  };
});

console.log(JSON.stringify({ base, throttle, wallMs: Date.now() - started, ...metrics }, null, 2));
if (throttle && metrics.lcpMs > 3000) throw new Error(`首屏最大内容仍在 ${metrics.lcpMs}ms 才完成`);
await browser.close();
