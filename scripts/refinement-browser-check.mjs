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

const infoPreview = await context.newPage();
await infoPreview.goto(`${base}/forest.html?preview=1&info=teacher`, { waitUntil: "networkidle" });
if (await infoPreview.getByRole("heading", { name: "教学设计与任务难度" }).count() !== 1) throw new Error("The teacher-notes preview URL is unavailable.");
if (await infoPreview.getByText(/学习者不会看到|Learners will not see it/).count() !== 0) throw new Error("The learner-visibility note remains on the teacher page.");
if (await infoPreview.getByText(/学习活动从分段听力和图片观察开始/).count() !== 0) throw new Error("The deleted learning-process description remains.");
if (await infoPreview.getByText(/Goal 0[1-3]/).count() !== 0) throw new Error("Goal 01–03 labels remain on the teacher page.");
if (!(await infoPreview.locator(".hero-media img").evaluate((image) => image.complete && image.naturalWidth > 0))) throw new Error("The teacher preview background image did not load.");
await infoPreview.screenshot({ path: join(output, "00-teacher-preview.png"), fullPage: true });
await infoPreview.click("#teacherNotesNext");
if (!infoPreview.url().includes("info=goals")) throw new Error("The teacher preview cannot move to the learner-goals preview.");
await infoPreview.click("#objectivesBack");
if (!infoPreview.url().includes("info=teacher")) throw new Error("The learner-goals preview cannot return to the teacher preview.");
await infoPreview.close();

const filePreview = await context.newPage();
const fileUrl = new URL("../public/forest.html?preview=1&info=teacher", import.meta.url).href;
await filePreview.goto(fileUrl, { waitUntil: "load" });
await filePreview.locator(".hero-media img").waitFor();
if (!(await filePreview.locator(".hero-media img").evaluate((image) => image.complete && image.naturalWidth > 0))) throw new Error("The background image does not load from a file:// preview.");
await filePreview.close();

await page.goto(`${base}/forest.html`, { waitUntil: "networkidle" });
await page.fill("#participantName", "Research Pilot A");
await page.click('[data-review-us="yes"]');
await page.click('[data-review-years="6–10年"]');
if (await page.locator("#teacherStart").isDisabled()) throw new Error("Participant intake did not unlock.");
await page.screenshot({ path: join(output, "01-participant-intake.png"), fullPage: true });
await page.click("#teacherStart");
if (await page.getByRole("heading", { name: "教学设计与任务难度" }).count() !== 1) throw new Error("The teacher-only notes page is missing.");
await page.screenshot({ path: join(output, "01b-teacher-notes.png"), fullPage: true });
await page.click("#teacherNotesNext");
await page.click("#enterBtn");
if (await page.getByRole("heading", { name: "完成这节课后，我能……" }).count() !== 1) throw new Error("The learner goals page is missing.");
if (await page.getByText(/我能结合故事、视频、时间线和国情卡片/).count() !== 1) throw new Error("Learning Goal 02 does not integrate the context cards with the story.");
if (await page.locator(".learner-objectives .start-guide-row").count() !== 3) throw new Error("The learner page should contain exactly three progressive goals.");
await page.screenshot({ path: join(output, "01c-learner-goals.png"), fullPage: true });
await page.click("#objectivesNext");
await page.waitForSelector("#stwImage");
if (!(await page.locator("#stwImage").evaluate((image) => image.complete && image.naturalWidth > 0))) throw new Error("See–Think–Wonder image did not load.");
await page.screenshot({ path: join(output, "02-see-think-wonder.png"), fullPage: true });
await page.locator("#stwImage").evaluate((image) => image.dispatchEvent(new Event("error")));
if (!(await page.locator("#stwImageFallback").isVisible())) throw new Error("Image failure recovery was not shown.");
await page.click("#stwImageRetry");
await page.waitForFunction(() => document.getElementById("stwImage")?.naturalWidth > 0 && document.getElementById("stwImageFallback")?.hidden);

await page.evaluate(() => {
  const state = JSON.parse(localStorage.green_story_state);
  state.index = 5;
  state.max = 8;
  state.comprehension.storyClaim = "5000美元帮助购买树苗，治沙在此前开始、此后继续";
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
  state.countryFocus = state.countryOpened[0];
  state.causeTaskVersion = 1;
  state.causeMap = { start: "A", support: "B", continue: "D" };
  state.causeCriteria = ["answer", "before", "after", "relation"];
  state.editorDraft = "**一句话回答**：5000美元帮助购买了树苗，但森林还来自长期治沙 **事情经过**：1985年开始→1999年得到帮助→此后二十多年继续 **表达提示**：用‘不过’和‘后来’连接";
  localStorage.green_story_state = JSON.stringify(state);
});
await page.reload({ waitUntil: "networkidle" });
if ((await page.locator(".trail-current span").innerText()).trim() !== "8 / 10") throw new Error("The information-and-speaking page number is incorrect.");
if (await page.getByRole("heading", { name: /这片森林是怎样形成的/ }).count() !== 0) throw new Error("The repeated explanatory heading was not removed.");
if (await page.locator(".reframe-intro, .reframe-intro-en").count() !== 0) throw new Error("The previous video instructions remain on the second page.");
if (await page.locator(".can-do-item").count() !== 3) throw new Error("Differentiated task supports are missing.");
if (await page.locator("[data-cause-role]").count() !== 3) throw new Error("The three time-based information prompts are incomplete.");
if (await page.locator("[data-cause-criterion]").count() !== 4) throw new Error("Oral-answer self-check is incomplete.");
if (await page.getByRole("heading", { name: /对照学习目标 02 自查/ }).count() !== 1) throw new Error("The explanatory rubric is not aligned with Learning Goal 02.");
if (await page.locator('[data-cause-role="support"] option:checked').getAttribute("value") !== "B") throw new Error("The donation role is not persisted.");
if (await page.locator(".editor-table tr").count() !== 3) throw new Error("Editor result is not a three-row table.");
if ((await page.locator(".editor-draft").innerText()).includes("**")) throw new Error("Markdown markers are still visible.");
await page.screenshot({ path: join(output, "03-speaking-outline.png"), fullPage: true });

await page.evaluate(() => {
  const state = JSON.parse(localStorage.green_story_state);
  state.index = 7;
  state.max = 8;
  state.audience = "general";
  state.voice.final = { text: "", mediaKey: "mock-1", mediaKeys: ["mock-1"], segments: [{ mediaKey: "mock-1", seconds: 25, bytes: 1, video: false, interrupted: true }], seconds: 25, bytes: 1, video: false, interrupted: true };
  state.final.contentCriteria = [];
  localStorage.green_story_state = JSON.stringify(state);
});
await page.reload({ waitUntil: "networkidle" });
if (await page.getByRole("button", { name: "继续录音" }).count() !== 1) throw new Error("Interrupted recording cannot be continued.");
if (await page.getByText("本次录音被浏览器提前中断。", { exact: true }).count() !== 1) throw new Error("Recording interruption is not explained.");
if (await page.locator("[data-criterion]").count() !== 4) throw new Error("Final content criteria are incomplete.");
if (await page.getByRole("heading", { name: /对照学习目标 03 核对内容/ }).count() !== 1) throw new Error("The final rubric is not aligned with Learning Goal 03.");
for (const criterion of await page.locator("[data-criterion]").all()) await criterion.click();
if (!(await page.locator("#tellNext").isDisabled())) throw new Error("Content checks bypassed the 60-second minimum.");
await page.evaluate(() => { const state = JSON.parse(localStorage.green_story_state); state.voice.final.seconds = 60; state.voice.final.interrupted = false; localStorage.green_story_state = JSON.stringify(state); });
await page.reload({ waitUntil: "networkidle" });
if (await page.locator("#tellNext").isDisabled()) throw new Error("Duration plus content criteria did not unlock completion.");
await page.screenshot({ path: join(output, "04-final-speaking-recovery.png"), fullPage: true });

await page.evaluate(() => {
  const state = JSON.parse(localStorage.green_story_state);
  state.index = 8;
  state.final.pkFocus = "organize";
  state.final.modelFocus = "organize";
  state.final.modelStory = "1985年，殷玉珍开始治沙。1999年，5000美元帮助购买树苗。此后二十多年，治沙一直继续。2026年，两人重逢。";
  localStorage.green_story_state = JSON.stringify(state);
});
await page.reload({ waitUntil: "networkidle" });
if (await page.getByText("和 AI 比一比", { exact: true }).count() !== 1) throw new Error("The optional AI comparison heading is missing.");
if (await page.getByRole("button", { name: /听腾讯云语音范例/ }).count() !== 1) throw new Error("The AI example is not labeled as Tencent Cloud voice.");
await page.screenshot({ path: join(output, "05-beat-the-ai.png"), fullPage: true });
await page.route("**/api/tts", (route) => route.fulfill({ status: 200, contentType: "audio/mpeg", body: "" }));
await page.evaluate(() => { window.__browserVoiceCalls = 0; window.speechSynthesis.speak = () => { window.__browserVoiceCalls += 1; }; });
await page.click("#listenModel");
await page.locator("#modelAudioStatus").getByText(/腾讯云语音暂时不可用/).waitFor();
if (await page.evaluate(() => window.__browserVoiceCalls) !== 0) throw new Error("The AI example fell back to browser speech synthesis.");
await page.click("#skipAI");
if (await page.locator(".survey-modal").count() !== 1) throw new Error("Ending the teacher pilot did not open the questionnaire.");

const mobile = await context.newPage();
await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.goto(`${base}/forest.html`, { waitUntil: "networkidle" });
await mobile.evaluate(() => {
  const state = JSON.parse(localStorage.green_story_state);
  state.index = 0;
  state.introSeen = true;
  state.learningObjectivesSeen = false;
  state.teacherReview.teacherNotesSeen = true;
  localStorage.green_story_state = JSON.stringify(state);
});
await mobile.reload({ waitUntil: "networkidle" });
if (await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) throw new Error("Learner goals overflow on mobile.");
await mobile.screenshot({ path: join(output, "05b-learner-goals-mobile.png"), fullPage: true });
await mobile.evaluate(() => {
  const state = JSON.parse(localStorage.green_story_state);
  state.index = 5;
  localStorage.green_story_state = JSON.stringify(state);
});
await mobile.reload({ waitUntil: "networkidle" });
if (await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) throw new Error("Story overview overflows on mobile.");
await mobile.screenshot({ path: join(output, "06-story-overview-mobile.png"), fullPage: true });

await mobile.evaluate(() => {
  const state = JSON.parse(localStorage.green_story_state);
  state.index = 6;
  state.reframePage = 1;
  state.contextFilmPlayed = true;
  state.contextFilmsWatched = [0, 1, 2];
  state.countryOpened = state.countryDeck.slice(0, 2);
  state.countryFocus = state.countryOpened[0];
  localStorage.green_story_state = JSON.stringify(state);
});
await mobile.reload({ waitUntil: "networkidle" });
if ((await mobile.locator(".trail-current span").innerText()).trim() !== "7 / 10") throw new Error("The video-and-context page number is incorrect.");
if (await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) throw new Error("Country-card task overflows on mobile.");
await mobile.screenshot({ path: join(output, "07-country-card-mobile.png"), fullPage: true });
await mobile.evaluate(() => { const state = JSON.parse(localStorage.green_story_state); state.reframePage = 2; state.causeTaskVersion = 1; state.causeMap = { start: "A", support: "B", continue: "D" }; state.causeCriteria = ["answer", "before", "after", "relation"]; localStorage.green_story_state = JSON.stringify(state); });
await mobile.reload({ waitUntil: "networkidle" });
if ((await mobile.locator(".trail-current span").innerText()).trim() !== "8 / 10") throw new Error("The mobile information-and-speaking page number is incorrect.");
if (await mobile.locator(".reframe-intro, .reframe-intro-en").count() !== 0) throw new Error("The previous video instructions remain on the mobile second page.");
if (await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) throw new Error("Explanatory task overflows on mobile.");
await mobile.screenshot({ path: join(output, "08-explanation-task-mobile.png"), fullPage: true });

const range = await fetch(`${base}/assets/green-story-news-2026-web-540p.mp4`, { headers: { Range: "bytes=0-1023" } });
if (![200, 206].includes(range.status)) throw new Error(`Video range request failed: ${range.status}`);
if (errors.length) throw new Error(`Browser errors:\n${errors.join("\n")}`);

console.log(JSON.stringify({ ok: true, metrics, videoStatus: range.status, videoBytes: range.headers.get("content-length") }));
await browser.close();
