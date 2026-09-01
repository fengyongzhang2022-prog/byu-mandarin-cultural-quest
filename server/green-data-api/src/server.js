import crypto from "node:crypto";
import COS from "cos-nodejs-sdk-v5";
import express from "express";
import mysql from "mysql2/promise";

const app = express();
const port = Number(process.env.PORT || 9000);
const required = ["MYSQL_HOST", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE", "GREEN_PROXY_SECRET", "GREEN_SESSION_SECRET", "GREEN_ADMIN_SETUP_KEY"];
for (const key of required) if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 6,
  enableKeepAlive: true,
  charset: "utf8mb4",
});

app.disable("x-powered-by");
app.use(express.json({ limit: "5mb" }));

const now = () => new Date();
const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const base64url = (value) => Buffer.from(value).toString("base64url");
const cleanEmail = (value) => String(value || "").trim().toLowerCase();
const cleanCourseCode = (value) => String(value || "").trim().toUpperCase().replace(/\s+/g, "");
const cleanText = (value, max = 120) => String(value || "").trim().slice(0, max);
const MAX_TEACHER_AUDIO_BYTES = 3 * 1024 * 1024;

function same(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function passwordHash(password, salt = crypto.randomBytes(16).toString("base64url")) {
  const key = crypto.scryptSync(String(password), salt, 64).toString("base64url");
  return `scrypt$${salt}$${key}`;
}

function passwordMatches(password, saved) {
  const [kind, salt, value] = String(saved || "").split("$");
  if (kind !== "scrypt" || !salt || !value) return false;
  return same(passwordHash(password, salt), saved);
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 10 && password.length <= 128;
}

function issueSession(user) {
  const payload = base64url(JSON.stringify({ sub: user.id, role: user.role, courseId: user.course_id, exp: Date.now() + 8 * 60 * 60 * 1000 }));
  const signature = crypto.createHmac("sha256", process.env.GREEN_SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function sessionFrom(request) {
  const token = String(request.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [payload, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", process.env.GREEN_SESSION_SECRET).update(payload || "").digest("base64url");
  if (!payload || !same(signature, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return session.exp > Date.now() && session.sub && session.courseId ? session : null;
  } catch { return null; }
}

function requireProxy(request, response, next) {
  if (!same(request.get("x-green-proxy-key"), process.env.GREEN_PROXY_SECRET)) return response.status(403).json({ error: "forbidden" });
  next();
}

function requireSession(request, response, next) {
  const session = sessionFrom(request);
  if (!session) return response.status(401).json({ error: "请重新登录。" });
  request.greenSession = session;
  next();
}

function requireTeacherFeedbackAdmin(request, response, next) {
  const key = process.env.GREEN_TEACHER_FEEDBACK_ADMIN_KEY;
  if (!key || !same(request.get("x-green-feedback-admin"), key)) return response.status(403).json({ error: "forbidden" });
  next();
}

function teacherFeedbackCos() {
  const {
    TENCENT_COS_SECRET_ID,
    TENCENT_COS_SECRET_KEY,
    TENCENT_COS_SESSION_TOKEN,
    TENCENTCLOUD_SECRETID,
    TENCENTCLOUD_SECRETKEY,
    TENCENTCLOUD_SESSIONTOKEN,
    TENCENT_COS_BUCKET: Bucket,
    TENCENT_COS_REGION: Region,
  } = process.env;
  const SecretId = TENCENT_COS_SECRET_ID || TENCENTCLOUD_SECRETID;
  const SecretKey = TENCENT_COS_SECRET_KEY || TENCENTCLOUD_SECRETKEY;
  const SecurityToken = TENCENT_COS_SESSION_TOKEN || TENCENTCLOUD_SESSIONTOKEN;
  if (!SecretId || !SecretKey || !Bucket || !Region) return null;
  return { client: new COS({ SecretId, SecretKey, ...(SecurityToken ? { SecurityToken } : {}) }), Bucket, Region };
}

function cosRequest(client, method, options) {
  return new Promise((resolve, reject) => client[method](options, (error, data) => error ? reject(error) : resolve(data)));
}

async function ensureSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS green_courses (
    id CHAR(36) PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    invite_hash CHAR(64) NOT NULL UNIQUE,
    teacher_email VARCHAR(254) NOT NULL,
    created_at DATETIME NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS green_users (
    id CHAR(36) PRIMARY KEY,
    course_id CHAR(36) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('teacher','student') NOT NULL,
    created_at DATETIME NOT NULL,
    last_login_at DATETIME NULL,
    INDEX green_users_course_idx (course_id),
    CONSTRAINT green_users_course_fk FOREIGN KEY (course_id) REFERENCES green_courses(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS green_learning_records (
    user_id CHAR(36) PRIMARY KEY,
    course_id CHAR(36) NOT NULL,
    state_json JSON NOT NULL,
    updated_at DATETIME NOT NULL,
    completed_at DATETIME NULL,
    INDEX green_records_course_idx (course_id),
    CONSTRAINT green_records_user_fk FOREIGN KEY (user_id) REFERENCES green_users(id),
    CONSTRAINT green_records_course_fk FOREIGN KEY (course_id) REFERENCES green_courses(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS green_teacher_feedback (
    id CHAR(36) PRIMARY KEY,
    participant_alias VARCHAR(40) NOT NULL,
    taught_in_us TINYINT(1) NOT NULL,
    teaching_years VARCHAR(20) NOT NULL,
    ratings_json JSON NOT NULL,
    comments_json JSON NOT NULL,
    voice_key VARCHAR(512) NULL,
    voice_mime VARCHAR(100) NULL,
    voice_seconds SMALLINT UNSIGNED NULL,
    submitted_at DATETIME NOT NULL,
    INDEX green_teacher_feedback_submitted_idx (submitted_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  for (const statement of [
    "ALTER TABLE green_teacher_feedback ADD COLUMN participant_alias VARCHAR(40) NULL AFTER id",
    "ALTER TABLE green_teacher_feedback ADD COLUMN voice_key VARCHAR(512) NULL",
    "ALTER TABLE green_teacher_feedback ADD COLUMN voice_mime VARCHAR(100) NULL",
    "ALTER TABLE green_teacher_feedback ADD COLUMN voice_seconds SMALLINT UNSIGNED NULL",
  ]) {
    try { await pool.query(statement); }
    catch (error) { if (error?.code !== "ER_DUP_FIELDNAME") throw error; }
  }
}

async function userByEmail(email) {
  const [rows] = await pool.execute("SELECT id, course_id, email, password_hash, role FROM green_users WHERE email = ? LIMIT 1", [email]);
  return rows[0] || null;
}

async function publicUser(user) {
  const [courseRows] = await pool.execute("SELECT title FROM green_courses WHERE id = ? LIMIT 1", [user.course_id]);
  return { id: user.id, email: user.email, role: user.role, courseTitle: courseRows[0]?.title || "课程" };
}

app.get("/green/health", requireProxy, async (_request, response) => {
  try { await pool.query("SELECT 1"); response.json({ ok: true }); }
  catch { response.status(503).json({ ok: false }); }
});

app.post("/green/auth/bootstrap", requireProxy, async (request, response) => {
  if (!same(request.get("x-green-admin-setup"), process.env.GREEN_ADMIN_SETUP_KEY)) return response.status(403).json({ error: "forbidden" });
  const teacherEmail = cleanEmail(request.body?.teacherEmail);
  const teacherPassword = String(request.body?.teacherPassword || "");
  const title = cleanText(request.body?.courseTitle, 160) || "共同种下：5000美元与5万棵树";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacherEmail) || !validatePassword(teacherPassword)) return response.status(400).json({ error: "教师邮箱或临时密码不符合要求。" });
  await ensureSchema();
  const [existing] = await pool.query("SELECT id FROM green_courses LIMIT 1");
  if (existing.length) return response.status(409).json({ error: "课程已初始化；请使用已有教师账号。" });
  const courseId = crypto.randomUUID();
  const teacherId = crypto.randomUUID();
  const inviteCode = `GREEN-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  await pool.execute("INSERT INTO green_courses (id, title, invite_hash, teacher_email, created_at) VALUES (?, ?, ?, ?, ?)", [courseId, title, sha256(inviteCode), teacherEmail, now()]);
  await pool.execute("INSERT INTO green_users (id, course_id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'teacher', ?)", [teacherId, courseId, teacherEmail, passwordHash(teacherPassword), now()]);
  response.status(201).json({ inviteCode, teacher: { email: teacherEmail, role: "teacher" } });
});

app.post("/green/auth/register", requireProxy, async (request, response) => {
  const email = cleanEmail(request.body?.email);
  const password = String(request.body?.password || "");
  const inviteCode = cleanCourseCode(request.body?.inviteCode);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !validatePassword(password) || !inviteCode) return response.status(400).json({ error: "请填写有效邮箱、邀请码和至少10位密码。" });
  await ensureSchema();
  const [courses] = await pool.execute("SELECT id FROM green_courses WHERE invite_hash = ? AND active = 1 LIMIT 1", [sha256(inviteCode)]);
  if (!courses[0]) return response.status(401).json({ error: "邀请码无效。" });
  if (await userByEmail(email)) return response.status(409).json({ error: "该邮箱已经注册，请直接登录。" });
  const user = { id: crypto.randomUUID(), course_id: courses[0].id, email, role: "student" };
  await pool.execute("INSERT INTO green_users (id, course_id, email, password_hash, role, created_at, last_login_at) VALUES (?, ?, ?, ?, 'student', ?, ?)", [user.id, user.course_id, user.email, passwordHash(password), now(), now()]);
  response.status(201).json({ user: await publicUser(user), token: issueSession(user) });
});

app.post("/green/auth/login", requireProxy, async (request, response) => {
  const email = cleanEmail(request.body?.email);
  const password = String(request.body?.password || "");
  const user = await userByEmail(email);
  if (!user || !passwordMatches(password, user.password_hash)) return response.status(401).json({ error: "邮箱或密码不正确。" });
  await pool.execute("UPDATE green_users SET last_login_at = ? WHERE id = ?", [now(), user.id]);
  response.json({ user: await publicUser(user), token: issueSession(user) });
});

app.get("/green/auth/me", requireProxy, requireSession, async (request, response) => {
  const [users] = await pool.execute("SELECT id, course_id, email, role FROM green_users WHERE id = ? LIMIT 1", [request.greenSession.sub]);
  if (!users[0]) return response.status(401).json({ error: "请重新登录。" });
  response.json({ user: await publicUser(users[0]) });
});

app.get("/green/progress", requireProxy, requireSession, async (request, response) => {
  const [rows] = await pool.execute("SELECT state_json, updated_at, completed_at FROM green_learning_records WHERE user_id = ? AND course_id = ? LIMIT 1", [request.greenSession.sub, request.greenSession.courseId]);
  response.json(rows[0] ? { state: rows[0].state_json, updatedAt: rows[0].updated_at, completedAt: rows[0].completed_at } : { state: null });
});

app.put("/green/progress", requireProxy, requireSession, async (request, response) => {
  if (request.greenSession.role !== "student") return response.status(403).json({ error: "仅学习者可以保存任务记录。" });
  const state = request.body?.state;
  if (!state || typeof state !== "object" || Array.isArray(state)) return response.status(400).json({ error: "学习记录格式不正确。" });
  const complete = Boolean(request.body?.completed);
  await pool.execute(`INSERT INTO green_learning_records (user_id, course_id, state_json, updated_at, completed_at)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = VALUES(updated_at), completed_at = COALESCE(VALUES(completed_at), completed_at)`,
  [request.greenSession.sub, request.greenSession.courseId, JSON.stringify(state), now(), complete ? now() : null]);
  response.json({ ok: true });
});

app.get("/green/teacher/records", requireProxy, requireSession, async (request, response) => {
  if (request.greenSession.role !== "teacher") return response.status(403).json({ error: "仅教师可以查看班级记录。" });
  const [rows] = await pool.execute(`SELECT u.email, u.created_at AS registered_at, u.last_login_at, r.state_json, r.updated_at, r.completed_at
    FROM green_users u LEFT JOIN green_learning_records r ON r.user_id = u.id
    WHERE u.course_id = ? AND u.role = 'student' ORDER BY r.updated_at DESC, u.created_at DESC`, [request.greenSession.courseId]);
  response.json({ records: rows.map((row) => ({ email: row.email, registeredAt: row.registered_at, lastLoginAt: row.last_login_at, state: row.state_json || null, updatedAt: row.updated_at, completedAt: row.completed_at })) });
});

const feedbackRatingKeys = ["gaiValue", "storyUnderstanding", "safeExpression", "storytelling", "adoption"];
const feedbackCommentKeys = ["value", "revision"];

function cleanFeedbackText(value) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, 2400);
}

app.post("/green/teacher-feedback", requireProxy, async (request, response) => {
  const participantAlias = cleanText(request.body?.participantAlias || request.body?.comments?.participantAlias, 40);
  const taughtInUs = request.body?.taughtInUs === true;
  const teachingYears = cleanText(request.body?.teachingYears, 20);
  const sourceVersion = cleanText(request.body?.sourceVersion, 40);
  const ratings = request.body?.ratings && typeof request.body.ratings === "object" ? request.body.ratings : {};
  const comments = request.body?.comments && typeof request.body.comments === "object" ? request.body.comments : {};
  const voice = request.body?.voice && typeof request.body.voice === "object" ? request.body.voice : null;
  if (!participantAlias) return response.status(400).json({ error: "参与者代称不能为空。" });
  if (!taughtInUs || !["1–2年", "3–5年", "6–10年", "11年以上"].includes(teachingYears)) return response.status(400).json({ error: "请确认美国中文教学经历与教龄。" });
  const cleanRatings = {};
  for (const key of feedbackRatingKeys) {
    const value = Number(ratings[key]);
    if (!Number.isInteger(value) || value < 1 || value > 5) return response.status(400).json({ error: "请完成全部量表题。" });
    cleanRatings[key] = value;
  }
  const cleanComments = Object.fromEntries(feedbackCommentKeys.map((key) => [key, cleanFeedbackText(comments[key])]));
  let voiceFile = null;
  if (voice) {
    const mime = String(voice.mime || "").trim().toLowerCase();
    const seconds = Number(voice.seconds);
    const encoded = String(voice.data || "").replace(/\s/g, "");
    if (!["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg"].includes(mime) || !Number.isInteger(seconds) || seconds < 1 || seconds > 480 || !/^[a-z0-9+/]+={0,2}$/i.test(encoded)) return response.status(400).json({ error: "语音反馈格式不正确。" });
    const body = Buffer.from(encoded, "base64");
    if (!body.length || body.length > MAX_TEACHER_AUDIO_BYTES) return response.status(413).json({ error: "语音反馈过大；请控制在 8 分钟内后重试。" });
    voiceFile = { mime, seconds, body };
  }
  if (!cleanComments.value && !voiceFile) return response.status(400).json({ error: "请以文字或语音回答第 6 题。" });
  if (!cleanComments.revision && !voiceFile) return response.status(400).json({ error: "请以文字或语音回答第 7 题。" });
  await ensureSchema();
  const id = crypto.randomUUID();
  let voiceKey = null;
  if (voiceFile) {
    const cos = teacherFeedbackCos();
    if (!cos) return response.status(503).json({ error: "教师语音存储服务尚未配置。" });
    const extension = voiceFile.mime === "audio/mpeg" ? "mp3" : voiceFile.mime === "audio/mp4" ? "m4a" : voiceFile.mime === "audio/ogg" ? "ogg" : "webm";
    voiceKey = `teacher-feedback/${new Date().toISOString().slice(0, 10)}/${id}.${extension}`;
    try {
      await cosRequest(cos.client, "putObject", { Bucket: cos.Bucket, Region: cos.Region, Key: voiceKey, Body: voiceFile.body, ContentType: voiceFile.mime, ACL: "private" });
    } catch {
      return response.status(502).json({ error: "语音暂时无法保存到腾讯云 COS，请稍后重试。" });
    }
  }
  try {
    await pool.execute("INSERT INTO green_teacher_feedback (id, participant_alias, taught_in_us, teaching_years, ratings_json, comments_json, voice_key, voice_mime, voice_seconds, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, participantAlias, 1, teachingYears, JSON.stringify({ ...cleanRatings, sourceVersion }), JSON.stringify(cleanComments), voiceKey, voiceFile?.mime || null, voiceFile?.seconds || null, now()]);
  } catch (error) {
    if (voiceKey) { const cos = teacherFeedbackCos(); if (cos) cosRequest(cos.client, "deleteObject", { Bucket: cos.Bucket, Region: cos.Region, Key: voiceKey }).catch(() => {}); }
    throw error;
  }
  response.status(201).json({ ok: true });
});

app.get("/green/teacher-feedback", requireProxy, requireTeacherFeedbackAdmin, async (_request, response) => {
  await ensureSchema();
  const [rows] = await pool.query("SELECT id, participant_alias, taught_in_us, teaching_years, ratings_json, comments_json, voice_key, voice_seconds, submitted_at FROM green_teacher_feedback ORDER BY submitted_at DESC");
  response.json({ records: rows.map((row) => ({ id: row.id, participantAlias: row.participant_alias, taughtInUs: Boolean(row.taught_in_us), teachingYears: row.teaching_years, ratings: row.ratings_json, comments: row.comments_json, hasVoice: Boolean(row.voice_key), voiceSeconds: row.voice_seconds || 0, submittedAt: row.submitted_at })) });
});

app.get("/green/teacher-feedback/:id/audio", requireProxy, requireTeacherFeedbackAdmin, async (request, response) => {
  const id = String(request.params.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return response.status(400).json({ error: "反馈记录不存在。" });
  await ensureSchema();
  const [rows] = await pool.execute("SELECT voice_key, voice_mime FROM green_teacher_feedback WHERE id = ? LIMIT 1", [id]);
  const row = rows[0];
  const cos = teacherFeedbackCos();
  if (!row?.voice_key || !cos) return response.status(404).json({ error: "未找到语音反馈。" });
  try {
    const object = await cosRequest(cos.client, "getObject", { Bucket: cos.Bucket, Region: cos.Region, Key: row.voice_key });
    response.set("Content-Type", row.voice_mime || object.headers?.["content-type"] || "audio/webm");
    response.set("Cache-Control", "private, no-store");
    response.send(object.Body);
  } catch {
    response.status(502).json({ error: "语音暂时无法读取。" });
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "服务暂时不可用，请稍后重试。" });
});

app.listen(port, "0.0.0.0", () => console.log(`green-data-api listening on ${port}`));
