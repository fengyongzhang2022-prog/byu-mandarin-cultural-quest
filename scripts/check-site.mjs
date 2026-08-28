import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/heishenhuawukong.html", import.meta.url), "utf8");
const teacher = await readFile(new URL("../public/teacher.html", import.meta.url), "utf8");
const login = await readFile(new URL("../public/login.html", import.meta.url), "utf8");
const required = [
  "进入故事",
  "PRE · 任务前文化解释",
  "DISCOVER · 发现袈裟",
  "INTERACT · 角色追问",
  "COMPARE · 跨文化协商",
  "EXPLAIN · 讲好这件衣服",
  "EXTEND · 山外见闻",
  "袈裟",
  "金池长老",
  "黑熊精",
  "最长3分钟",
  "录完可以回听和重说",
  "给我一点提示",
  "打开摄像头",
  "重播角色的话",
  "bmw_research_sessions_v4",
  "kasayaQuestMedia",
  "/api/chat",
  "kasaya-hero-v1.png",
  "black-myth-elder-jinchi.jpg",
  "black-myth-black-bear-guai.jpg",
  "点击圆点开始说话",
];
const missing = required.filter((item) => !html.includes(item));
if (missing.length) {
  console.error(`Missing required site content: ${missing.join(", ")}`);
  process.exit(1);
}
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
if (!scriptMatch) {
  console.error("Main client script was not found.");
  process.exit(1);
}
try {
  new Function(scriptMatch[1]);
} catch (error) {
  console.error(`Client script syntax error: ${error.message}`);
  process.exit(1);
}
const teacherScript = teacher.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
if (!teacherScript) {
  console.error("Research dashboard script was not found.");
  process.exit(1);
}
try {
  new Function(teacherScript[1]);
} catch (error) {
  console.error(`Research dashboard script syntax error: ${error.message}`);
  process.exit(1);
}
for (const item of ["教师研究工作台", "学习者产出", "金池长老", "黑熊精", "Hint使用次数", "导出汇总 CSV", "语音交际过程"]) {
  if (!teacher.includes(item)) {
    console.error(`Missing research dashboard content: ${item}`);
    process.exit(1);
  }
}
for (const item of ["袈裟文化任务", "/api/auth/login", "匿名课程账号", "kasaya-hero-v1.png"]) {
  if (!login.includes(item)) {
    console.error(`Missing login content: ${item}`);
    process.exit(1);
  }
}
console.log("Site content check passed.");
