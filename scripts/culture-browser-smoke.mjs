import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "file:///C:/Users/ThinkPad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import { createSession } from "../lib/auth.js";

const base = "http://localhost:3000";
const output = fileURLToPath(new URL("../output/playwright/", import.meta.url));
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const errors = [];

async function contextFor(viewport, mobile = false) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const session = await createSession({ username: "qa-student", role: "student" });
  await context.addCookies([{ name: "xunji_session", value: session, url: base }]);
  return context;
}

function observe(page, label) {
  page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${label} console: ${message.text()}`);
  });
}

async function completeOpening(page) {
  await page.locator("[data-choice]").nth(1).click();
  await page.click("#enterNext");
  await page.locator('[data-observe="0"]').first().click();
  await page.locator('[data-observe="1"]').first().click();
  await page.click("[data-next]");
  for (let index = 0; index < 3; index += 1) await page.click(`[data-open="${index}"]`);
  await page.fill("#relation", "原来它有自己的文化功能，后来人物和传播改变了它的处境。");
  await page.click("[data-next]");
}

async function completeRole(page) {
  await page.fill("#roleText", "我认为要先看它原来的文化意义，也要看人物后来怎样行动。为什么还想占有？");
  await page.click("#roleSend");
  await page.waitForFunction(() => document.querySelectorAll(".bubble").length >= 3);
  await page.fill("#roleText", "材料说明价值会影响行动。如果只追求自己的需要，其他人会受到什么影响？");
  await page.click("#roleSend");
  await page.waitForFunction(() => document.querySelectorAll(".bubble").length >= 5);
  await page.click("[data-next]");
}

const desktop = await contextFor({ width: 1440, height: 1000 });
const page = await desktop.newPage();
observe(page, "desktop");
await page.goto(`${base}/culture.html`, { waitUntil: "networkidle" });
await page.screenshot({ path: join(output, "culture-hub-desktop.png"), fullPage: true });

await page.click('[data-start="temple"]');
await completeOpening(page);
await completeRole(page);
for (const id of ["reserve", "digital", "community"]) await page.click(`[data-plan="${id}"]`);
await page.click("[data-next]");
await page.locator("[data-axis]").nth(1).click();
await page.fill("#same", "两地都需要管理突然增加的游客。");
await page.fill("#different", "小西天空间小而且保存悬塑，Yosemite的自然空间更大。");
await page.fill("#boundary", "这个比较能帮助理解进入管理，但不能说明两地文化价值相同。");
await page.click("[data-next]");
await page.fill("#outline", "古寺、游戏、游客、预约、保护、社区、比较边界");
await page.click("[data-next]");
await page.waitForSelector("text=古寺的“第二次生命”不是重新建一座寺");
await page.screenshot({ path: join(output, "culture-temple-reflect-desktop.png"), fullPage: true });

await page.click("#otherStory");
await completeOpening(page);
await completeRole(page);
for (let index = 0; index < 4; index += 1) await page.click(`[data-chain="${index}"]`);
await page.click("[data-next]");
await page.locator("[data-object]").nth(1).click();
await page.fill("#same", "它们都可能因为稀缺而被收藏。");
await page.fill("#different", "袈裟还有宗教身份和修行意义。");
await page.fill("#boundary", "这个比较能解释收藏欲，但不能把宗教意义只解释成价格。");
await page.click("[data-next]");
await page.fill("#outline", "本来、宝衣、收藏、欲望、行动、后果、比较边界");
await page.click("[data-next]");
await page.waitForSelector("text=袈裟不会自己制造欲望");
await page.screenshot({ path: join(output, "culture-kasaya-reflect-desktop.png"), fullPage: true });
await desktop.close();

const mobile = await contextFor({ width: 390, height: 844 }, true);
const mobilePage = await mobile.newPage();
observe(mobilePage, "mobile");
await mobilePage.goto(`${base}/culture.html`, { waitUntil: "networkidle" });
const hubWidth = await mobilePage.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }));
if (hubWidth.scroll > hubWidth.inner + 1) throw new Error(`Mobile hub overflow: ${JSON.stringify(hubWidth)}`);
await mobilePage.screenshot({ path: join(output, "culture-hub-mobile.png"), fullPage: true });
await mobilePage.click('[data-start="temple"]');
const questWidth = await mobilePage.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }));
if (questWidth.scroll > questWidth.inner + 1) throw new Error(`Mobile quest overflow: ${JSON.stringify(questWidth)}`);
await mobilePage.screenshot({ path: join(output, "culture-temple-mobile.png"), fullPage: true });
await mobile.close();

await browser.close();
if (errors.length) throw new Error(errors.join("\n"));
console.log("Culture collection browser smoke test passed: both quests and mobile layout.");
