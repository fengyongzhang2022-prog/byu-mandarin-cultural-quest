import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/heishenhuawukong.html", import.meta.url), "utf8");
const teacher = await readFile(new URL("../public/teacher.html", import.meta.url), "utf8");
const login = await readFile(new URL("../public/login.html", import.meta.url), "utf8");

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

console.log("Xiaoxitian site content check passed.");
