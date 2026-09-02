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
if (await page.locator("#teacherStart").count()) {
  await page.fill("#participantName", "Browser smoke");
  await page.click('[data-review-us="yes"]');
  await page.click('[data-review-years="3–5年"]');
  await page.click("#teacherStart");
  await page.click("#teacherNotesNext");
}
await page.click("#enterBtn");
await page.click("#objectivesNext");
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
if (await page.locator(".vocab-item h4", { hasText: "铁锹" }).count() < 1) throw new Error("First-scene visual vocabulary is missing 铁锹.");
if (await page.locator(".vocab-item img").count() < 4) throw new Error("Visual vocabulary support is incomplete.");
await page.screenshot({ path: join(output, "03-first-scene-vocabulary-desktop.png"), fullPage: true });

await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("green_story_state")); s.index = 4; s.max = 8; localStorage.setItem("green_story_state", JSON.stringify(s)); });
await page.reload({ waitUntil: "networkidle" });
if (await page.getByText("二十多年里，殷玉珍的治沙怎么样了？", { exact: true }).count() !== 1) throw new Error("Third-scene gist question is missing.");
await page.locator(".vocab-support summary").click();
if (await page.getByText("机械提高了运苗效率。", { exact: true }).count() < 1) throw new Error("Third-scene vocabulary explanation is missing.");
await page.screenshot({ path: join(output, "05-third-scene-desktop.png"), fullPage: true });

await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("green_story_state")); s.index = 6; s.max = 8; s.contextFilmPlayed = true; s.contextFilmsWatched = [0,1,2]; localStorage.setItem("green_story_state", JSON.stringify(s)); });
await page.reload({ waitUntil: "networkidle" });
await page.locator("[data-country]").first().click();
await page.locator("[data-country]:not(.open)").first().click();
if (await page.getByText(/先读这一句/).count() < 2) throw new Error("China context cards do not provide a concise first layer.");
if (await page.getByText(/展开更多背景/).count() < 2) throw new Error("China context cards do not progressively disclose deeper context.");
await page.locator("[data-country-depth]").first().click();
if (await page.getByText(/这条信息有什么用/).count() < 1) throw new Error("China context card deeper layer cannot be opened.");
await page.locator("[data-country-focus]").first().click();
if (await page.locator('[data-country-focus][aria-pressed="true"]').count() !== 1) throw new Error("China context evidence cannot be carried into the next task.");
await page.screenshot({ path: join(output, "07-country-card-desktop.png"), fullPage: true });

await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("green_story_state")); s.reframePage = 2; s.countryOpened = s.countryDeck.slice(0, 2); s.countryFocus = s.countryOpened[0]; s.causeTaskVersion = 1; s.causeMap = { start: "A", support: "B", continue: "D" }; s.causeCriteria = ["answer", "before", "after", "relation"]; localStorage.setItem("green_story_state", JSON.stringify(s)); });
await page.reload({ waitUntil: "networkidle" });
if (await page.locator(".can-do-item").count() !== 3) throw new Error("Explanatory task is missing differentiated support levels.");
if (await page.locator("[data-cause-role]").count() !== 3) throw new Error("Explanatory task does not organize the three time-based facts.");
if (await page.getByRole("heading", { name: /第二步：回答同学的问题/ }).count() !== 1) throw new Error("Core oral explanation target is missing.");
await page.screenshot({ path: join(output, "07b-explanation-task-desktop.png"), fullPage: true });

await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("green_story_state")); s.index = 7; s.max = 8; s.audience = "general"; s.voice.final = { text: "", mediaKey: "qa-first-segment", mediaKeys: ["qa-first-segment"], segments: [{ mediaKey: "qa-first-segment", seconds: 25, bytes: 1, video: false, interrupted: true }], seconds: 25, bytes: 1, video: false, interrupted: true }; s.final.contentCriteria = []; localStorage.setItem("green_story_state", JSON.stringify(s)); });
await page.reload({ waitUntil: "networkidle" });
if (await page.locator(".story-plan-grid article").count() !== 3) throw new Error("Beginning–middle–ending planner is incomplete.");
if (await page.getByText("完成至少60秒的中文讲述").count() !== 1) throw new Error("Final speaking minimum was not updated.");
if (await page.locator('[data-camera="on"]').count() !== 1) throw new Error("Optional camera recording is missing.");
if (await page.getByRole("button", { name: "继续录音" }).count() !== 1) throw new Error("Interrupted recording cannot be resumed.");
await page.click("#finalMic");
await page.waitForSelector("#finalMic.live");
await page.waitForTimeout(4200);
await page.click("#finalMic");
await page.waitForFunction(() => JSON.parse(localStorage.getItem("green_story_state")).voice.final.seconds >= 28);
const resumed = await page.evaluate(() => JSON.parse(localStorage.getItem("green_story_state")).voice.final);
if (resumed.mediaKeys.length !== 2 || resumed.seconds < 28) throw new Error("Resumed recording did not accumulate saved segments.");
if (await page.locator("[data-criterion]").count() !== 4) throw new Error("Final content criteria are incomplete.");
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
