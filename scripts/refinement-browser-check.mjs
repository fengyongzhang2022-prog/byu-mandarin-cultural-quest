import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "file:///C:/Users/ThinkPad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const base = process.env.GREEN_BASE || "http://127.0.0.1:3100";
const output = join(process.cwd(), "output", "playwright", "refinement");
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1680, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

await page.goto(`${base}/forest.html`, { waitUntil: "networkidle" });
await page.fill("#participantName", "Research Pilot A");
await page.click('[data-review-us="yes"]');
await page.click('[data-review-years="6–10年"]');
if (await page.locator("#teacherStart").isDisabled()) throw new Error("Participant intake did not unlock.");
await page.screenshot({ path: join(output, "01-participant-intake.png"), fullPage: true });
await page.click("#teacherStart");
await page.click("#objectivesNext");
await page.click("#enterBtn");

await page.evaluate(() => {
  const state = JSON.parse(localStorage.green_story_state);
  state.index = 5;
  state.max = 8;
  localStorage.green_story_state = JSON.stringify(state);
});
await page.reload({ waitUntil: "networkidle" });
const metrics = await page.evaluate(() => ({
  eyebrow: getComputedStyle(document.querySelector(".story-overview .eyebrow")).fontSize,
  lead: getComputedStyle(document.querySelector(".story-overview .lead")).fontSize,
  mapYear: getComputedStyle(document.querySelector(".story-overview .map-stop b")).fontSize,
  mapCopy: getComputedStyle(document.querySelector(".story-overview .map-stop span")).fontSize,
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
}));
await page.screenshot({ path: join(output, "02-story-overview-desktop.png"), fullPage: true });

await page.evaluate(() => {
  const state = JSON.parse(localStorage.green_story_state);
  state.index = 6;
  state.reframePage = 2;
  state.contextFilmsWatched = [0, 1, 2];
  state.contextFilmPlayed = true;
  state.countryOpened = state.countryDeck.slice(0, 2);
  state.omissions = ["A", "P"];
  state.editorDraft = "**英文标题**：A Gift Joined a Long Fight Against Sand **中文标题**：一份善意加入长期治沙 **两句中文导语**：1985年治沙已经开始。1999年的5000美元提供了真实帮助，但长期行动、技术与治理让绿色延续。";
  localStorage.green_story_state = JSON.stringify(state);
});
await page.reload({ waitUntil: "networkidle" });
if (await page.getByText("思考一下：这个标题准确吗？", { exact: true }).count() !== 1) throw new Error("Reframe heading was not simplified.");
if (await page.locator(".editor-table tr").count() !== 3) throw new Error("Editor result is not a three-row table.");
if ((await page.locator(".editor-draft").innerText()).includes("**")) throw new Error("Markdown markers are still visible.");
await page.screenshot({ path: join(output, "03-editor-table.png"), fullPage: true });

await page.evaluate(() => {
  const state = JSON.parse(localStorage.green_story_state);
  state.index = 8;
  localStorage.green_story_state = JSON.stringify(state);
});
await page.reload({ waitUntil: "networkidle" });
if (await page.getByText("BEAT THE AI · 打败 AI", { exact: true }).count() !== 1) throw new Error("Beat the AI is not the main heading.");
await page.screenshot({ path: join(output, "04-beat-the-ai.png"), fullPage: true });

const mobile = await context.newPage();
await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.goto(`${base}/forest.html`, { waitUntil: "networkidle" });
await mobile.evaluate(() => {
  const state = JSON.parse(localStorage.green_story_state);
  state.index = 5;
  localStorage.green_story_state = JSON.stringify(state);
});
await mobile.reload({ waitUntil: "networkidle" });
if (await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) throw new Error("Story overview overflows on mobile.");
await mobile.screenshot({ path: join(output, "05-story-overview-mobile.png"), fullPage: true });

const range = await fetch(`${base}/assets/green-story-news-2026-web-540p.mp4`, { headers: { Range: "bytes=0-1023" } });
if (![200, 206].includes(range.status)) throw new Error(`Video range request failed: ${range.status}`);
if (errors.length) throw new Error(`Browser errors:\n${errors.join("\n")}`);

console.log(JSON.stringify({ ok: true, metrics, videoStatus: range.status, videoBytes: range.headers.get("content-length") }));
await browser.close();
