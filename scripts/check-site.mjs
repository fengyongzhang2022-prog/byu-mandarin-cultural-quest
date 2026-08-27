import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/3.html", import.meta.url), "utf8");
const teacher = await readFile(new URL("../public/teacher.html", import.meta.url), "utf8");
const login = await readFile(new URL("../public/login.html", import.meta.url), "utf8");
const required = [
  "ENTER · 进入故事／角色扮演",
  "DISCOVER · 发现文化／文化探究",
  "INTERACT · AI角色互动",
  "COMPARE · 跨文化协商",
  "EXPLAIN · 讲好中国故事／初次产出",
  "国际文化旅行者",
  "西游行者",
  "引导表达",
  "自主协商",
  "批判探究",
  "pre-quiz",
  "recordPreAudio",
  "建议至少1分钟，最长3分钟",
  "post-quiz",
  "学习日记",
  "访谈线索",
  "GAI整理的“中国故事卡”",
  "/api/chat",
  "black-myth-official-1.jpg",
  "black-myth-shrine-gameplay.jpg",
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
for (const item of ["完整学习链路", "导出研究CSV", "人工编码", "支持方式", "GAI故事卡", "学习日记", "访谈线索"]) {
  if (!teacher.includes(item)) {
    console.error(`Missing research dashboard content: ${item}`);
    process.exit(1);
  }
}
for (const item of ["进入寻迹", "/api/auth/login", "研究者发放的匿名课程账号"]) {
  if (!login.includes(item)) {
    console.error(`Missing login content: ${item}`);
    process.exit(1);
  }
}
console.log("Site content check passed.");
