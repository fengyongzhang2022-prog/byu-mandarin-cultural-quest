import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/heishenhuawukong.html", import.meta.url), "utf8");
const teacher = await readFile(new URL("../public/teacher.html", import.meta.url), "utf8");
const login = await readFile(new URL("../public/login.html", import.meta.url), "utf8");
const culture = await readFile(new URL("../public/culture.html", import.meta.url), "utf8");
const cultureLogin = await readFile(new URL("../public/culture-login.html", import.meta.url), "utf8");
const middleware = await readFile(new URL("../middleware.js", import.meta.url), "utf8");
const forest = await readFile(new URL("../public/forest.html", import.meta.url), "utf8");

const required = [
  "一座古寺的第二次生命",
  "PRE · 任务前文化解释",
  "DISCOVER · 看图寻找文化证据",
  "INTERACT · 进入角色对话",
  "DECIDE · 设计交互式文化项目",
  "COMPARE · 把文化差异变成学习资源",
  "EXPLAIN · 讲好中国故事",
  "REVEAL · 当地的真实回应",
  "日均游客约300至400人",
  "1978尊明代悬塑",
  "小西天 × Yosemite",
  "多角度图片观察",
  "边看边说",
  "固定成年男声 · 云健",
  "放大 · 换角度",
  "visualObservations",
  "一座古寺每天迎来",
  "yosemite-traffic.webp",
  "xxt-angle-02.webp",
  "给我一点提示",
  "打开摄像头",
  "开始对话",
  "语音未能转写",
  "xiaoxitian_research_sessions_v1",
  "xiaoxitianQuestMedia",
  "/api/chat",
  "/api/tts",
  "xiaoxitian-game.jpg",
  "xiaoxitian-sculpture.jpg",
  "60至90秒",
  "20至30秒",
];

const missing = required.filter((item) => !html.includes(item));
if (missing.length) {
  console.error(`Missing required site content: ${missing.join(", ")}`);
  process.exit(1);
}

for (const [name, source] of [["student", html], ["teacher", teacher]]) {
  const match = source.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!match) {
    console.error(`${name} client script was not found.`);
    process.exit(1);
  }
  try {
    new Function(match[1]);
  } catch (error) {
    console.error(`${name} script syntax error: ${error.message}`);
    process.exit(1);
  }
}

for (const item of ["从“识别文化”到", "AI语音轮次", "跨文化比较", "看图观察", "播放前测录音", "播放最终解释", "导入记录"]) {
  if (!teacher.includes(item)) {
    console.error(`Missing teacher dashboard content: ${item}`);
    process.exit(1);
  }
}

for (const item of ["一座古寺的", "第二次生命", "/api/auth/login", "匿名课程账号", "xiaoxitian-mist.jpg"]) {
  if (!login.includes(item)) {
    console.error(`Missing login content: ${item}`);
    process.exit(1);
  }
}

for (const old of ["金池长老", "黑熊精", "袈裟文化任务", "土地神", "Maya"]) {
  if (html.includes(old) || teacher.includes(old) || login.includes(old)) {
    console.error(`Old theme content remains in the active site: ${old}`);
    process.exit(1);
  }
}

for (const item of [
  "一座古寺，一件袈裟",
  "一座古寺的第二次生命",
  "一件不该被抢的衣服",
  "先看见，再解释",
  "kasaya_jinchi",
  "kasaya_feedback",
  "跨文化比较",
  "语音输入",
  "导出本章记录",
]) {
  if (!culture.includes(item)) {
    console.error(`Missing culture collection content: ${item}`);
    process.exit(1);
  }
}

for (const [name, source] of [["culture", culture], ["culture login", cultureLogin]]) {
  const match = source.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!match) {
    console.error(`${name} client script was not found.`);
    process.exit(1);
  }
  try {
    new Function(match[1]);
  } catch (error) {
    console.error(`${name} script syntax error: ${error.message}`);
    process.exit(1);
  }
}

const forestRequired = [
  "Intermediate High<br>中级高段",
  "Advanced Low<br>高级低段",
  "完成这节课后，我能……",
  "By the end of this lesson, I can…",
  "我能结合故事、视频、时间线和国情卡片",
  "对照学习目标 02 自查",
  "Check your work against Learning Goal 02",
  "对照学习目标 03 核对内容",
  "照片没有成功显示",
  "按时间整理三项信息",
  "5000美元到底起了什么作用",
  "CAUSE_ROLES",
  "先读这一句",
  "这条信息有什么用",
  "和视频一起理解",
  "FILM_CARD_LINKS",
  "选择一条稍后要用的信息",
  "根据故事，哪句话说得最准确",
  "听前热身 · 不计入评价",
  "这两个人是谁？",
  "他们现在还在联系吗？",
  "图片中的土地后来变成森林了吗？",
  "CAUSE_CRITERIA",
  "可点击“继续录音”",
  "FINAL_CRITERIA",
  "readMediaDuration",
  "MicroMessenger",
  "recordingTechNote",
  "requestData",
  "Listening comprehension · Replay as needed",
  "Check your work against Learning Goal 03",
  "Watch the clips, then open the context cards",
];
const forestMissing = forestRequired.filter((item) => !forest.includes(item));
if (forestMissing.length) {
  console.error(`Missing Green Story refinement: ${forestMissing.join(", ")}`);
  process.exit(1);
}
const forestForbidden = [
  "听前热身 · 不计入完成评价",
  "学习活动从分段听力和图片观察开始，再引入时间线与国情卡片",
  "Goal 01<br>",
  "Goal 02<br>",
  "Goal 03<br>",
  "主旨检查：哪一句得到整条时间线的支持",
  "2026年的重逢让森林快速形成",
  "BEAT THE AI · 打败 AI",
  "可选挑战 · OPTIONAL",
  "可选挑战 · CHOOSE ONE",
  "Vocabulary support · 需要时点击打开",
];
const forestUnexpected = forestForbidden.filter((item) => forest.includes(item));
if (forestUnexpected.length) {
  console.error(`Outdated Green Story copy remains: ${forestUnexpected.join(", ")}`);
  process.exit(1);
}
const forestScript = forest.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
if (!forestScript) {
  console.error("Green Story client script was not found.");
  process.exit(1);
}
try {
  new Function(forestScript[1]);
} catch (error) {
  console.error(`Green Story script syntax error: ${error.message}`);
  process.exit(1);
}

for (const item of ['"/forest.html"', 'NextResponse.rewrite', 'matcher: ["/", "/teacher-feedback.html"]']) {
  if (!middleware.includes(item)) {
    console.error(`Missing culture host routing: ${item}`);
    process.exit(1);
  }
}

console.log("Xiaoxitian and culture collection content checks passed.");
