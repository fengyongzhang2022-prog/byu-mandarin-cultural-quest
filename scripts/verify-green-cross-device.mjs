import { chromium } from "file:///C:/Users/ThinkPad/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const base = process.env.GREEN_BASE || "http://127.0.0.1:3100";
const browser = await chromium.launch({ headless: true, channel: "chrome" });

async function verifyHints(label, options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (let stage = 1; stage <= 8; stage += 1) {
    await page.goto(`${base}/forest.html?preview=1&stage=${stage}`, { waitUntil: "domcontentloaded" });
    await page.click("#hintBtn");
    await page.waitForSelector(".hint-modal");
    await page.click(".hint-close-x");
    if (await page.locator(".hint-modal").count()) throw new Error(`${label} stage ${stage}: close icon failed`);

    await page.click("#hintBtn");
    await page.click('[data-close-hints]:not(.hint-close-x)');
    if (await page.locator(".hint-modal").count()) throw new Error(`${label} stage ${stage}: Continue failed`);

    await page.click("#hintBtn");
    await page.locator(".hint-modal").click({ position: { x: 3, y: 3 } });
    if (await page.locator(".hint-modal").count()) throw new Error(`${label} stage ${stage}: backdrop failed`);

    await page.click("#hintBtn");
    await page.keyboard.press("Escape");
    if (await page.locator(".hint-modal").count()) throw new Error(`${label} stage ${stage}: Escape failed`);
  }
  if (errors.length) throw new Error(`${label} page errors: ${errors.join(" | ")}`);
  await context.close();
}

async function verifyRecorder(label, userAgent, expectedMime, simpleConstraints) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent });
  await context.addInitScript(() => {
    const track = new EventTarget();
    track.readyState = "live";
    track.stop = () => { track.readyState = "ended"; };
    const stream = { getTracks: () => [track], getAudioTracks: () => [track], getVideoTracks: () => [] };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async constraints => { window.__gum = constraints; return stream; } } });
    class MockRecorder {
      static isTypeSupported(type) { return type.includes("mp4") || type.includes("webm"); }
      constructor(source, options) { this.stream = source; this.state = "inactive"; this.mimeType = options?.mimeType || "audio/webm"; window.__recorderOptions = options || null; }
      start(timeslice) { this.state = "recording"; window.__timeslice = timeslice; }
      requestData() {}
      stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["audio"], { type: this.mimeType }) }); this.onstop?.(); }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: MockRecorder });
    window.__recognitionStarts = 0;
    class MockRecognition { start() { window.__recognitionStarts += 1; } stop() {} abort() {} }
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: MockRecognition });
  });
  const page = await context.newPage();
  await page.goto(`${base}/forest.html?preview=1&stage=1`, { waitUntil: "domcontentloaded" });
  if (await page.locator("text=改用文字").count()) throw new Error(`${label}: text fallback is still present`);
  await page.click("#seeMic");
  await page.waitForSelector("#seeMic.live");
  const result = await page.evaluate(() => ({ constraints: window.__gum, options: window.__recorderOptions, timeslice: window.__timeslice, recognitionStarts: window.__recognitionStarts }));
  if (Boolean(result.constraints?.audio === true) !== simpleConstraints) throw new Error(`${label}: microphone constraints are not adapted`);
  if (!String(result.options?.mimeType || "").includes(expectedMime)) throw new Error(`${label}: unexpected recording format ${result.options?.mimeType}`);
  if (result.recognitionStarts !== 0) throw new Error(`${label}: speech recognition competed with recording`);
  if (result.timeslice !== 1000) throw new Error(`${label}: recorder health chunks are disabled`);
  await page.click("#seeMic");
  await context.close();
}

async function verifyListening(userAgent) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent });
  await context.addInitScript(() => {
    window.__audioUrls = [];
    class MockAudio {
      constructor(url) { this.url = url; window.__audioUrls.push(url); }
      setAttribute() {}
      pause() {}
      play() { setTimeout(() => this.onended?.(), 5); return Promise.resolve(); }
    }
    Object.defineProperty(window, "Audio", { configurable: true, value: MockAudio });
  });
  const page = await context.newPage();
  for (const stage of [2, 3, 4]) {
    await page.goto(`${base}/forest.html?preview=1&stage=${stage}`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-chapter-predict]").first().click();
    await page.click("#playChapter");
    await page.waitForFunction(() => window.__audioUrls.length > 0);
    const urls = await page.evaluate(() => window.__audioUrls.splice(0));
    if (!urls.every(url => url.startsWith("/api/tts?") && url.includes("role=narrator"))) throw new Error(`stage ${stage}: listening did not use direct Tencent audio URLs`);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("green_story_state")).chapters[Object.keys(JSON.parse(localStorage.getItem("green_story_state")).chapters)[location.search.match(/stage=(\d+)/)[1]-2]].played > 0).catch(() => {});
  }
  await context.close();
}

async function verifyTeacherSurvey() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${base}/forest.html?preview=1&stage=2`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-chapter-predict]").first().click();
  await page.goto(`${base}/forest.html?preview=1&stage=8`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("green_story_state"));
    state.teacherReview = { taughtInUs: "yes", years: "3–5年", startedAt: new Date().toISOString() };
    state.final.modelStory = "";
    localStorage.setItem("green_story_state", JSON.stringify(state));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  const finish = page.locator("#finishTeacherSurvey");
  if (!await finish.isEnabled()) throw new Error("Teacher survey is still gated behind the optional AI example");
  if (!await page.locator(".teacher-survey-reminder").isVisible()) throw new Error("Persistent teacher survey reminder is missing");
  await page.click("#openTeacherSurveyReminder");
  await page.waitForSelector('.survey-modal[role="dialog"]');
  if (await page.locator("[data-rating]").count() !== 25) throw new Error("Teacher survey rating choices are incomplete");
  await context.close();
}

async function verifyTeacherEntryAndPreviewCTA() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${base}/forest.html?preview=1`, { waitUntil: "domcontentloaded" });
  if (!await page.locator("#teacherStart").isEnabled()) throw new Error("Teacher start button is disabled before the form can explain missing fields");
  await page.fill("#participantName", "Teacher Preview");
  await page.click('[data-review-us="yes"]');
  await page.click('[data-review-years="3–5年"]');
  if (!await page.locator("#teacherStartStatus").getByText("信息已完整，可以开始。").count()) throw new Error("Teacher entry does not show a ready state");
  await page.click("#teacherStart");
  await page.waitForSelector(".teacher-notes-page");

  await page.goto(`${base}/forest.html?preview=1&stage=8`, { waitUntil: "domcontentloaded" });
  if (!await page.locator("#finishTeacherSurvey").isVisible()) throw new Error("Preview final page is missing the embedded teacher-survey CTA");
  if (!await page.locator("#openTeacherSurveyReminder").isVisible()) throw new Error("Preview final page is missing the persistent teacher-survey reminder");
  await page.click("#openTeacherSurveyReminder");
  await page.waitForSelector('.survey-modal[role="dialog"]');
  await context.close();
}

async function verifyStandaloneSurvey(label, options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  let payload = null;
  await page.route("**/api/teacher-feedback", async route => {
    if (route.request().method() !== "POST") return route.continue();
    payload = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: "test-feedback" }) });
  });
  await page.goto(`${base}/forest-feedback.html`, { waitUntil: "domcontentloaded" });
  if (!await page.locator('a[href="/forest.html?teacher=1"]').isVisible()) throw new Error(`${label}: full teacher trial link is missing`);
  await page.fill("#participantAlias", "Teacher Test");
  await page.click('[data-year="3–5年"]');
  await page.check("#taughtInUs");
  await page.click("#continueButton");
  if (!await page.locator("#surveyPanel").isVisible()) throw new Error(`${label}: survey step did not open`);
  if (await page.locator("[data-key]").count() !== 25) throw new Error(`${label}: standalone ratings are incomplete`);
  for (const key of ["gaiValue", "storyUnderstanding", "safeExpression", "storytelling", "adoption"]) {
    await page.click(`[data-key="${key}"][data-value="4"]`);
  }
  await page.fill("#valueComment", "时间线和国情卡片有助于理解。 ");
  await page.fill("#revisionComment", "继续改善移动端录音体验。 ");
  await page.click("#submitButton");
  await page.waitForSelector("#successPanel.active");
  if (!payload || payload.participantAlias !== "Teacher Test" || payload.teachingYears !== "3–5年") throw new Error(`${label}: profile data was not submitted`);
  if (payload.cohort !== "teacher-pilot-standalone" || Object.keys(payload.ratings || {}).length !== 5) throw new Error(`${label}: feedback payload is incomplete`);
  if (await page.evaluate(() => localStorage.getItem("green_teacher_feedback_draft_v1")) !== null) throw new Error(`${label}: submitted draft was not cleared`);
  await context.close();
}

async function verifySurveyVoice(label, userAgent, expectedMime) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent });
  await context.addInitScript(() => {
    const track = new EventTarget();
    track.readyState = "live";
    track.stop = () => { track.readyState = "ended"; };
    const makeStream = () => ({ getTracks: () => [track], getAudioTracks: () => [track] });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async constraints => { window.__surveyGum = constraints; track.readyState = "live"; return makeStream(); } } });
    class MockRecorder {
      static isTypeSupported(type) { return type.includes("mp4") || type.includes("webm"); }
      constructor(source, options) { this.state = "inactive"; this.mimeType = options?.mimeType || "audio/webm"; window.__surveyRecorderOptions = options || null; window.__surveyRecorder = this; }
      start() { this.state = "recording"; }
      requestData() {}
      stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["survey audio"], { type: this.mimeType }) }); this.onstop?.(); }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: MockRecorder });
  });
  const page = await context.newPage();
  let standalonePayload = null;
  await page.route("**/api/teacher-feedback", async route => {
    if (route.request().method() !== "POST") return route.continue();
    standalonePayload = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto(`${base}/forest-feedback.html`, { waitUntil: "domcontentloaded" });
  await page.fill("#participantAlias", "Voice Teacher");
  await page.click('[data-year="6–10年"]');
  await page.check("#taughtInUs");
  await page.click("#continueButton");
  if (!await page.locator("text=最长8分钟").count()) throw new Error(`${label}: standalone survey does not show the 8-minute limit`);
  for (const key of ["gaiValue", "storyUnderstanding", "safeExpression", "storytelling", "adoption"]) await page.click(`[data-key="${key}"][data-value="5"]`);
  for (const part of ["value", "revision"]) {
    const repetitions = part === "value" ? 2 : 1;
    for (let attempt = 0; attempt < repetitions; attempt += 1) {
      await page.click(`#${part}VoiceButton`);
      const config = await page.evaluate(() => ({ constraints: window.__surveyGum, options: window.__surveyRecorderOptions }));
      if (config.constraints?.audio !== true) throw new Error(`${label}: standalone voice did not use simple mobile constraints`);
      if (!String(config.options?.mimeType || "").includes(expectedMime)) throw new Error(`${label}: standalone voice chose ${config.options?.mimeType}`);
      if (part === "value" && attempt === 0) {
        await page.evaluate(() => window.__surveyRecorder.stop());
        await page.waitForFunction(partName => document.getElementById(`${partName}VoiceStatus`).textContent.includes("浏览器中断"), part);
      } else {
        await page.click(`#${part}VoiceButton`);
      }
      await page.waitForFunction(([partName,count]) => document.getElementById(`${partName}VoiceStatus`).textContent.includes(`已保存 ${count} 段`), [part, attempt + 1]);
    }
  }
  await page.click("#submitButton");
  await page.waitForSelector("#successPanel.active");
  if (standalonePayload?.voice?.value?.segments?.length !== 2 || standalonePayload?.voice?.revision?.segments?.length !== 1) throw new Error(`${label}: segmented standalone audio was not submitted`);

  await page.goto(`${base}/forest.html?preview=1&stage=2`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-chapter-predict]").first().click();
  await page.goto(`${base}/forest.html?preview=1&stage=8`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("green_story_state"));
    state.teacherReview = { taughtInUs: "yes", years: "6–10年", startedAt: new Date().toISOString() };
    localStorage.setItem("green_story_state", JSON.stringify(state));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.click("#finishTeacherSurvey");
  await page.click("#teacherVoiceButton");
  const embeddedConfig = await page.evaluate(() => ({ constraints: window.__surveyGum, options: window.__surveyRecorderOptions }));
  if (embeddedConfig.constraints?.audio !== true) throw new Error(`${label}: embedded survey did not use simple mobile constraints`);
  if (!String(embeddedConfig.options?.mimeType || "").includes(expectedMime)) throw new Error(`${label}: embedded survey chose ${embeddedConfig.options?.mimeType}`);
  await page.click("#teacherVoiceButton");
  await page.waitForFunction(() => document.getElementById("teacherVoiceStatus").textContent.includes("已保存 1 段"));
  await context.close();
}

async function verifyBackNavigation() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${base}/forest.html?preview=1&stage=8`, { waitUntil: "domcontentloaded" });
  await page.click("#stageBack");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("green_story_state")).index === 7);
  if (!await page.locator("text=把治沙故事讲给一个具体听众").count()) throw new Error("Page 10 top back button did not return to the speaking task");
  await context.close();
}

const iphoneWechat = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.50";
const ipadWechat = "Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.50";
const huaweiWechat = "Mozilla/5.0 (Linux; Android 14; HUAWEI Pura 70 Pro) AppleWebKit/537.36 Chrome/122.0 Mobile Safari/537.36 MicroMessenger/8.0.50";
const desktopChrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36";

await verifyHints("desktop", { viewport: { width: 1440, height: 1000 }, userAgent: desktopChrome });
await verifyHints("iPhone WeChat", { viewport: { width: 390, height: 844 }, userAgent: iphoneWechat });
await verifyHints("iPad WeChat", { viewport: { width: 820, height: 1180 }, userAgent: ipadWechat });
await verifyHints("Huawei WeChat", { viewport: { width: 412, height: 915 }, userAgent: huaweiWechat });
await verifyRecorder("iPhone WeChat", iphoneWechat, "mp4", true);
await verifyRecorder("iPad WeChat", ipadWechat, "mp4", true);
await verifyRecorder("Huawei WeChat", huaweiWechat, "webm", true);
await verifyRecorder("desktop Chrome", desktopChrome, "webm", false);
await verifyListening(iphoneWechat);
await verifyListening(huaweiWechat);
await verifyTeacherSurvey();
await verifyTeacherEntryAndPreviewCTA();
await verifyStandaloneSurvey("desktop", { viewport: { width: 1440, height: 1000 }, userAgent: desktopChrome });
await verifyStandaloneSurvey("iPhone WeChat", { viewport: { width: 390, height: 844 }, userAgent: iphoneWechat });
await verifySurveyVoice("iPhone WeChat", iphoneWechat, "mp4");
await verifySurveyVoice("Huawei WeChat", huaweiWechat, "webm");
await verifyBackNavigation();

await browser.close();
console.log("Cross-device hints, recording, listening, and both teacher-feedback paths passed.");
