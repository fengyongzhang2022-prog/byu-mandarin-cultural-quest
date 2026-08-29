import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "file:///C:/Users/ThinkPad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import { createSession } from "../lib/auth.js";

const base = "http://localhost:3100";
const output = fileURLToPath(new URL("../output/playwright/", import.meta.url));
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});

const errors = [];
function observe(page, label) {
  page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${label} console: ${message.text()}`);
  });
}

async function addSession(context, role) {
  const value = await createSession({ username: role === "teacher" ? "qa-teacher" : "qa-student", role });
  await context.addCookies([{ name: "xunji_session", value, url: base }]);
}

const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  permissions: ["microphone", "camera"],
});
await addSession(context, "student");
const page = await context.newPage();
observe(page, "student");
await page.goto(`${base}/heishenhuawukong.html`, { waitUntil: "networkidle" });
await page.screenshot({ path: join(output, "student-enter-desktop.png") });
await page.fill("#participant", "QA-01");
await page.click("#enterBtn");
await page.click("#recordBtn");
await page.waitForSelector("#recordBtn.live");
await page.waitForTimeout(1300);
await page.click("#recordBtn");
await page.waitForSelector("#prePlayback audio, #prePlayback video");
await page.click("#preNext");
for (const id of ["temple", "game", "traffic"]) {
  await page.click(`.evidence[data-fact="${id}"]`);
  await page.click("[data-viewset]");
  await page.waitForSelector("#viewer.open");
  await page.click("#zoomIn");
  const zoom = await page.locator("#zoomReadout").textContent();
  if (zoom === "100%") throw new Error(`Visual viewer did not zoom for ${id}.`);
  if (await page.locator("[data-view-angle]").count() > 1) await page.locator("[data-view-angle]").nth(1).click();
  await page.click("#viewerClose");
  await page.waitForTimeout(240);
  await page.locator("[data-observe]").first().click();
}
await page.screenshot({ path: join(output, "student-discover-desktop.png") });
await page.click("#discoverNext");
if (await page.locator("[data-talk-view]").count() < 2) throw new Error("Alex dialogue did not retain the selected visual evidence.");
await page.locator("[data-talk-view]").first().click();
await page.waitForSelector("#viewer.open");
await page.click("#zoomIn");
if ((await page.locator("#zoomReadout").textContent()) === "100%") throw new Error("Alex visual evidence did not zoom.");
await page.click("#viewerClose");
await page.waitForTimeout(240);
await page.screenshot({ path: join(output, "student-alex-evidence-desktop.png") });
await page.click("#conversationBtn");
await page.waitForSelector("#talkOrb.live");
await page.waitForTimeout(1400);
await page.click("#talkOrb");
await page.waitForTimeout(900);
if (await page.locator("#conversationBtn").count()) await page.click("#conversationBtn");
await page.click("#talkNext");
for (const id of ["reserve", "digital", "community"]) await page.click(`[data-plan="${id}"]`);
await page.click('[data-role="volunteer"]');
await page.click("#conversationBtn");
await page.waitForSelector("#talkOrb.live");
await page.waitForTimeout(1300);
await page.click("#talkOrb");
await page.waitForTimeout(900);
if ((await page.locator("#conversationBtn").textContent())?.includes("结束")) await page.click("#conversationBtn");
await page.click("#decideNext");
await page.click('[data-axis="protect"]');
await page.click('[data-viewset="yosemiteCompare"]');
await page.waitForSelector("#viewer.open");
await page.click("#zoomIn");
await page.click("#viewerClose");
await page.waitForTimeout(240);
await page.screenshot({ path: join(output, "student-compare-desktop.png") });
await page.click("#conversationBtn");
await page.waitForSelector("#talkOrb.live");
await page.waitForTimeout(1300);
await page.click("#talkOrb");
await page.waitForTimeout(900);
if ((await page.locator("#conversationBtn").textContent())?.includes("结束")) await page.click("#conversationBtn");
await page.click("#compareNext");
await page.click("#cameraToggle");
await page.waitForSelector("#camera:not(.hidden)");
await page.click("#explainBtn");
await page.waitForSelector("#explainBtn.live");
await page.waitForTimeout(1400);
await page.click("#explainBtn");
await page.waitForSelector("#explainPlayback audio, #explainPlayback video");
await page.click("#feedbackBtn");
await page.waitForSelector("#revisionBtn");
await page.click("#revisionBtn");
await page.waitForSelector("#revisionBtn.live");
await page.waitForTimeout(1100);
await page.click("#revisionBtn");
await page.waitForSelector("#revisionPlayback audio, #revisionPlayback video");
await page.click("#storyBtn");
await page.waitForSelector(".story");
await page.screenshot({ path: join(output, "student-explain-desktop.png") });
await page.click("#finishBtn");
await page.waitForSelector("text=当地的真实回应");
await page.screenshot({ path: join(output, "student-reveal-desktop.png") });
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("xiaoxitian_quest_state_v1")));
if (saved.plans.length !== 3 || Object.keys(saved.observations || {}).length !== 3 || !saved.explain.mediaKey || !saved.explain.revisionKey) throw new Error("Student state did not retain the full task output.");
await context.close();

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await addSession(mobile, "student");
const mobilePage = await mobile.newPage();
observe(mobilePage, "mobile");
await mobilePage.goto(`${base}/heishenhuawukong.html`, { waitUntil: "networkidle" });
const widths = await mobilePage.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }));
if (widths.scroll > widths.inner + 1) throw new Error(`Mobile overflow: ${JSON.stringify(widths)}`);
await mobilePage.click("#previewWorld");
await mobilePage.waitForSelector("#viewer.open");
await mobilePage.click("#zoomIn");
const mobileZoom = await mobilePage.locator("#zoomReadout").textContent();
if (mobileZoom === "100%") throw new Error("Mobile visual viewer did not zoom.");
const mobileViewerWidths = await mobilePage.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }));
if (mobileViewerWidths.scroll > mobileViewerWidths.inner + 1) throw new Error(`Mobile viewer overflow: ${JSON.stringify(mobileViewerWidths)}`);
await mobilePage.click("#viewerClose");
await mobilePage.waitForTimeout(240);
await mobilePage.screenshot({ path: join(output, "student-enter-mobile.png") });
await mobilePage.evaluate(() => {
  const state = JSON.parse(localStorage.getItem("xiaoxitian_quest_state_v1"));
  state.participant = "QA-mobile";
  state.index = 3;
  state.maxIndex = 3;
  state.opened = ["temple", "game", "traffic"];
  state.observations = { temple: "人物和楼阁密集排列", game: "高密度的悬塑空间", traffic: "观看空间拥挤" };
  localStorage.setItem("xiaoxitian_quest_state_v1", JSON.stringify(state));
});
await mobilePage.reload({ waitUntil: "networkidle" });
if (await mobilePage.locator("[data-talk-view]").count() !== 3) throw new Error("Mobile Alex dialogue did not retain all selected visuals.");
const mobileTalkWidths = await mobilePage.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }));
if (mobileTalkWidths.scroll > mobileTalkWidths.inner + 1) throw new Error(`Mobile Alex dialogue overflow: ${JSON.stringify(mobileTalkWidths)}`);
await mobilePage.screenshot({ path: join(output, "student-alex-evidence-mobile.png") });
await mobile.close();

const teacherContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await addSession(teacherContext, "teacher");
const teacherPage = await teacherContext.newPage();
observe(teacherPage, "teacher");
await teacherPage.goto(`${base}/teacher.html`, { waitUntil: "networkidle" });
await teacherPage.evaluate(() => localStorage.setItem("xiaoxitian_research_sessions_v1", JSON.stringify([{
  participant:"QA-01",startedAt:new Date().toISOString(),completedAt:new Date().toISOString(),pre:{audioKey:"",seconds:42,transcript:"初步解释"},
  task:{focus:"一座古寺的第二次生命",factsOpened:["temple","game","traffic"],visualObservations:{temple:"人物和楼阁密集排列",game:"高密度的悬塑空间",traffic:"观看空间拥挤"},dialogues:{alex:[{role:"user",seconds:7,content:"小西天是真实古寺"},{role:"assistant",content:"你会用哪个事实提醒玩家？"}],stakeholder:[],compare:[{role:"user",seconds:11,content:"两地都管理游客"}]},stakeholder:"volunteer",plans:["reserve","digital","community"],finalSeconds:74,revisionSeconds:24,feedback:"补充因果",hints:{compare:2},extension:["heritage"]},events:[]
}])));
await teacherPage.reload({ waitUntil: "networkidle" });
await teacherPage.click("[data-row]");
await teacherPage.waitForSelector("#detail.open");
await teacherPage.screenshot({ path: join(output, "teacher-detail-desktop.png") });
await teacherContext.close();

await browser.close();
if (errors.length) throw new Error(errors.join("\n"));
console.log("Browser smoke test passed: desktop flow, media capture, camera, mobile layout, and teacher dashboard.");
