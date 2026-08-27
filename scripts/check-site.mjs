import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../public/3.html", import.meta.url), "utf8");
const teacher = await readFile(new URL("../public/teacher.html", import.meta.url), "utf8");
const login = await readFile(new URL("../public/login.html", import.meta.url), "utf8");
const required = [
  "进入故事",
  "发现文化",
  "AI角色互动",
  "跨文化协商",
  "讲好中国故事",
  "/api/chat",
  "earth-shrine-hero.png",
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
for (const item of ["前测—后测记录", "导出前后测CSV", "人工编码"]) {
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
