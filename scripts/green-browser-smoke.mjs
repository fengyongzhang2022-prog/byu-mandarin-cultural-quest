import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "file:///C:/Users/ThinkPad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import { createSession } from "../lib/auth.js";

const base = process.env.GREEN_BASE || "http://localhost:3000";
const output = fileURLToPath(new URL("../output/playwright/green-story/", import.meta.url));
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, permissions: ["microphone", "camera"] });
const session = await createSession({ username: "green-review", role: "student" });
await context.addCookies([{ name: "xunji_session", value: session, url: base }]);
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

await page.goto(`${base}/forest.html`, { waitUntil: "networkidle" });
await page.click("#enterBtn");
await page.waitForSelector(".stw-grid");
if (await page.locator(".stw-grid .voicebox").count() !== 3) throw new Error("See–Think–Wonder does not have three voice tasks.");
await page.screenshot({ path: join(output, "02-see-think-wonder-desktop.png"), fullPage: true });

for (const [kind, duration] of [["see", 4200], ["think", 5200], ["wonder", 5200]]) {
  await page.click(`#${kind}Mic`);
  await page.waitForSelector(`#${kind}Mic.live`);
  await page.waitForTimeout(duration);
  await page.click(`#${kind}Mic`);
  await page.waitForSelector(`#${kind}Playback audio`);
}
if (await page.locator("#preNext").isDisabled()) throw new Error("See–Think–Wonder completion did not unlock page 1.");
await page.click("#preNext");
await page.waitForSelector(".vocab-support");
await page.locator(".vocab-support summary").click();
if (await page.locator(".vocab-item h4", { hasText: "捆" }).count() !== 1) throw new Error("First-scene vocabulary is missing 捆.");
if (await page.locator(".vocab-item img").count() < 4) throw new Error("Visual vocabulary support is incomplete.");
await page.screenshot({ path: join(output, "03-first-scene-vocabulary-desktop.png"), fullPage: true });

await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("green_story_state")); s.index = 4; s.max = 8; localStorage.setItem("green_story_state", JSON.stringify(s)); });
await page.reload({ waitUntil: "networkidle" });
if (await page.getByText("治沙行动在多年中继续发展").count() !== 1) throw new Error("Third-scene gist question was not replaced.");
await page.locator(".vocab-support summary").click();
if (await page.getByText("东北、华北和西北").count() < 1) throw new Error("Three-North explanation is missing.");
await page.screenshot({ path: join(output, "05-third-scene-desktop.png"), fullPage: true });

await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("green_story_state")); s.index = 6; s.max = 8; s.contextFilmPlayed = true; s.contextFilmsWatched = [0,1,2]; localStorage.setItem("green_story_state", JSON.stringify(s)); });
await page.reload({ waitUntil: "networkidle" });
await page.locator("[data-country]").first().click();
if (await page.getByText("帮助理解", { exact: true }).count() < 1) throw new Error("China context card does not explain its connection to the story.");
await page.screenshot({ path: join(output, "07-country-card-desktop.png"), fullPage: true });

await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("green_story_state")); s.index = 7; s.max = 8; s.audience = "general"; s.voice.outline = { text: "开头讲1985年的困难，中间讲1999年的帮助，最后讲2026年的重逢和长期治沙。", mediaKey: "qa-outline", seconds: 21, bytes: 1, video: false }; s.final.feedback = "中间加一句三北工程的背景，让听众更清楚个人行动发生的时代。"; localStorage.setItem("green_story_state", JSON.stringify(s)); });
await page.reload({ waitUntil: "networkidle" });
if (await page.locator(".story-plan-grid article").count() !== 3) throw new Error("Beginning–middle–ending planner is incomplete.");
if (await page.getByText("完成至少60秒的中文讲述").count() !== 1) throw new Error("Final speaking minimum was not updated.");
if (await page.locator('[data-camera="on"]').count() !== 1) throw new Error("Optional camera recording is missing.");
await page.screenshot({ path: join(output, "08-final-speaking-desktop.png"), fullPage: true });

const mobile = await context.newPage();
await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.goto(`${base}/forest.html`, { waitUntil: "networkidle" });
await mobile.evaluate(() => { const s = JSON.parse(localStorage.getItem("green_story_state")); s.index = 1; localStorage.setItem("green_story_state", JSON.stringify(s)); });
await mobile.reload({ waitUntil: "networkidle" });
await mobile.screenshot({ path: join(output, "02-see-think-wonder-mobile.png"), fullPage: true });
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
if (overflow) throw new Error("Mobile See–Think–Wonder page has horizontal overflow.");

await browser.close();
if (errors.length) throw new Error(`Browser errors:\n${errors.join("\n")}`);
console.log("Green story browser checks passed.");
