import crypto from "node:crypto";
import COS from "cos-nodejs-sdk-v5";
import { verifySession } from "../../../lib/auth";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
const VALID_YEARS = new Set(["1–2年", "3–5年", "6–10年", "11年以上"]);
const RATING_KEYS = ["gaiValue", "storyUnderstanding", "safeExpression", "storytelling", "adoption"];
let storagePromise;

function apiUrl(path) {
  const base = String(process.env.GREEN_DATA_API_URL || "").replace(/\/$/, "");
  return base ? `${base}${path}` : "";
}

function proxyHeaders(extra = {}) {
  return { "Content-Type": "application/json", "x-green-proxy-key": String(process.env.GREEN_PROXY_SECRET || ""), ...extra };
}

function cosClient() {
  const SecretId = process.env.TENCENT_COS_SECRET_ID || process.env.TENCENTCLOUD_SECRET_ID;
  const SecretKey = process.env.TENCENT_COS_SECRET_KEY || process.env.TENCENTCLOUD_SECRET_KEY;
  const SecurityToken = process.env.TENCENT_COS_SESSION_TOKEN;
  if (!SecretId || !SecretKey) throw new Error("腾讯云存储密钥尚未配置。");
  return new COS({ SecretId, SecretKey, ...(SecurityToken ? { SecurityToken } : {}) });
}

function cosCall(client, method, params) {
  return new Promise((resolve, reject) => client[method](params, (error, data) => error ? reject(error) : resolve(data)));
}

async function resolveStorage() {
  if (storagePromise) return storagePromise;
  storagePromise = (async () => {
    const client = cosClient();
    const configuredBucket = String(process.env.TENCENT_COS_BUCKET || "").trim();
    const configuredRegion = String(process.env.TENCENT_COS_REGION || process.env.TENCENTCLOUD_REGION || "").trim();
    if (configuredBucket && configuredRegion) return { client, Bucket: configuredBucket, Region: configuredRegion };
    const service = await cosCall(client, "getService", {});
    const buckets = Array.isArray(service?.Buckets) ? service.Buckets : [];
    if (!buckets.length) throw new Error("腾讯云账号下还没有可用的 COS 存储桶。");
    const regional = configuredRegion ? buckets.filter((item) => item.Location === configuredRegion) : buckets;
    const candidates = regional.length ? regional : buckets;
    const preferred = candidates.find((item) => /green|mandarin|teacher|feedback|byu/i.test(item.Name)) || candidates[0];
    return { client, Bucket: preferred.Name, Region: preferred.Location };
  })().catch((error) => { storagePromise = null; throw error; });
  return storagePromise;
}

function cleanText(value, max = 4000) {
  return String(value || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").trim().slice(0, max);
}

function cookieValue(header, name) {
  return String(header || "").split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

async function requireTeacher(request) {
  const session = await verifySession(cookieValue(request.headers.get("cookie"), "xunji_session"));
  if (!session) return { error: Response.json({ error: "请先使用研究者账号登录。" }, { status: 401, headers: { "Cache-Control": "private, no-store" } }) };
  if (session.role !== "teacher") return { error: Response.json({ error: "当前账号没有查看教师反馈的权限。" }, { status: 403, headers: { "Cache-Control": "private, no-store" } }) };
  return { session };
}

async function listFeedbackKeys(storage) {
  const keys = [];
  let Marker;
  do {
    const page = await cosCall(storage.client, "getBucket", {
      Bucket: storage.Bucket,
      Region: storage.Region,
      Prefix: "private/teacher-feedback/",
      ...(Marker ? { Marker } : {}),
      MaxKeys: 1000,
    });
    for (const item of Array.isArray(page?.Contents) ? page.Contents : []) {
      if (String(item?.Key || "").endsWith(".json")) keys.push(item.Key);
    }
    Marker = page?.IsTruncated === "true" || page?.IsTruncated === true ? page?.NextMarker : "";
  } while (Marker);
  return keys;
}

async function readCosJson(storage, Key) {
  const object = await cosCall(storage.client, "getObject", { Bucket: storage.Bucket, Region: storage.Region, Key });
  const text = Buffer.isBuffer(object?.Body) ? object.Body.toString("utf8") : String(object?.Body || "");
  return JSON.parse(text);
}

function publicRecord(record) {
  const voiceParts = ["value", "revision"].flatMap((part) => {
    const item = record?.voice?.[part];
    return item?.key ? [{ part, seconds: Math.max(0, Number(item.seconds) || 0) }] : [];
  });
  return {
    id: cleanText(record?.id, 80),
    participantAlias: cleanText(record?.participantAlias, 40),
    teachingYears: cleanText(record?.teachingYears, 20),
    ratings: Object.fromEntries(RATING_KEYS.map((key) => [key, Number(record?.ratings?.[key]) || 0])),
    comments: { value: cleanText(record?.comments?.value), revision: cleanText(record?.comments?.revision) },
    submittedAt: cleanText(record?.submittedAt, 40),
    hasVoice: voiceParts.length > 0,
    voiceSeconds: voiceParts.reduce((sum, item) => sum + item.seconds, 0),
    voiceParts,
  };
}

async function readDirectFeedback() {
  const storage = await resolveStorage();
  const keys = await listFeedbackKeys(storage);
  const records = [];
  for (let index = 0; index < keys.length; index += 20) {
    const batch = await Promise.all(keys.slice(index, index + 20).map((key) => readCosJson(storage, key).catch(() => null)));
    records.push(...batch.filter(Boolean).map(publicRecord));
  }
  records.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  return records;
}

async function readDirectAudio(audioId, part) {
  if (!/^[0-9a-f-]{36}$/i.test(audioId) || !new Set(["value", "revision"]).has(part)) return null;
  const storage = await resolveStorage();
  const key = (await listFeedbackKeys(storage)).find((item) => item.endsWith(`/${audioId}.json`));
  if (!key) return null;
  const record = await readCosJson(storage, key);
  const voice = record?.voice?.[part];
  const voiceKey = String(voice?.key || "");
  const expectedPrefix = key.slice(0, -5);
  if (!voiceKey.startsWith(`${expectedPrefix}-${part}.`) || !voiceKey.startsWith("private/teacher-feedback/")) return null;
  const object = await cosCall(storage.client, "getObject", { Bucket: storage.Bucket, Region: storage.Region, Key: voiceKey });
  return { body: object.Body, mime: cleanText(voice?.mime, 80) || object?.headers?.["content-type"] || "audio/webm" };
}

function validateSubmission(body) {
  if (body?.taughtInUs !== true || !VALID_YEARS.has(body?.teachingYears)) throw new Error("教师试用信息不完整。");
  const ratings = {};
  for (const key of RATING_KEYS) {
    const value = Number(body?.ratings?.[key]);
    if (!Number.isInteger(value) || value < 1 || value > 5) throw new Error("请完成全部总体评价题。");
    ratings[key] = value;
  }
  const comments = { value: cleanText(body?.comments?.value), revision: cleanText(body?.comments?.revision) };
  const rawVoice = body?.voice && typeof body.voice === "object" ? body.voice : null;
  const voice = rawVoice && (rawVoice.value || rawVoice.revision || rawVoice.data) ? rawVoice : null;
  const voiceValue = voice?.value || (voice?.data ? voice : null);
  const voiceRevision = voice?.revision || null;
  if (!comments.value && !voiceValue) throw new Error("请以文字或语音回答第 6 题。");
  if (!comments.revision && !voiceRevision && !voice?.data) throw new Error("请以文字或语音回答第 7 题。");
  const participantAlias = cleanText(body?.participantAlias || body?.comments?.participantAlias, 40);
  if (!participantAlias) throw new Error("参与者代称不能为空。");
  return { participantAlias, ratings, comments, voice, cohort: cleanText(body?.cohort, 40) || "teacher-pilot", sourceVersion: cleanText(body?.sourceVersion, 80) };
}

async function saveDirectlyToCos(body) {
  const submission = validateSubmission(body);
  const { client, Bucket, Region } = await resolveStorage();
  const id = crypto.randomUUID();
  const month = new Date().toISOString().slice(0, 7);
  const prefix = `private/teacher-feedback/${month}/${id}`;
  let voiceKeys = {};
  try {
    const audioEntries = [
      submission.voice?.value?.data ? ["value", submission.voice.value] : submission.voice?.data ? ["value", submission.voice] : null,
      submission.voice?.revision?.data ? ["revision", submission.voice.revision] : null,
    ].filter(Boolean);
    for (const [voicePart, voiceData] of audioEntries) {
      const audio = Buffer.from(String(voiceData.data), "base64");
      if (!audio.length || audio.length > MAX_AUDIO_BYTES) throw new Error("语音文件超过上传上限，请缩短后重试。");
      const mime = cleanText(voiceData.mime, 80) || "audio/webm";
      const extension = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
      const key = `${prefix}-${voicePart}.${extension}`;
      voiceKeys[voicePart] = key;
      await cosCall(client, "putObject", { Bucket, Region, Key: key, Body: audio, ContentType: mime });
    }
    const record = {
      id,
      participantAlias: submission.participantAlias,
      taughtInUs: true,
      teachingYears: body.teachingYears,
      ratings: submission.ratings,
      comments: submission.comments,
      voice: Object.keys(voiceKeys).length ? Object.fromEntries(Object.entries(voiceKeys).map(([part,key]) => [part, { key, mime: cleanText(submission.voice?.[part]?.mime, 80) || "audio/webm", seconds: Number(submission.voice?.[part]?.seconds) || 0 }])) : null,
      cohort: submission.cohort,
      sourceVersion: submission.sourceVersion,
      submittedAt: new Date().toISOString(),
      privacy: "pseudonymous-teacher-feedback",
    };
    const recordKey = `${prefix}.json`;
    await cosCall(client, "putObject", { Bucket, Region, Key: recordKey, Body: Buffer.from(JSON.stringify(record)), ContentType: "application/json; charset=utf-8" });
    if (submission.sourceVersion === "codex-service-smoke-test") {
      await cosCall(client, "deleteObject", { Bucket, Region, Key: recordKey });
      return { ok: true, id, smoke: true };
    }
    return { ok: true, id };
  } catch (error) {
    for (const key of Object.values(voiceKeys || {})) await cosCall(client, "deleteObject", { Bucket, Region, Key: key }).catch(() => {});
    throw error;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const endpoint = apiUrl("/green/teacher-feedback");
    if (endpoint && process.env.GREEN_PROXY_SECRET) {
      const upstream = await fetch(endpoint, { method: "POST", headers: proxyHeaders(), body: JSON.stringify(body), cache: "no-store" });
      const data = await upstream.json().catch(() => ({}));
      return Response.json(data, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json(await saveDirectlyToCos(body), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = cleanText(error?.message, 180) || "反馈暂时无法提交，请稍后重试。";
    const clientError = /不完整|完成全部|回答第|超过上传上限/.test(message);
    return Response.json({ error: message }, { status: clientError ? 400 : 502, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(request) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  const audioId = url.searchParams.get("audio");
  const audioPart = url.searchParams.get("part") === "revision" ? "revision" : "value";
  const endpoint = apiUrl(audioId ? `/green/teacher-feedback/${encodeURIComponent(audioId)}/audio` : "/green/teacher-feedback");
  try {
    if (endpoint && process.env.GREEN_PROXY_SECRET && process.env.GREEN_TEACHER_FEEDBACK_ADMIN_KEY) {
      const upstream = await fetch(endpoint, { headers: proxyHeaders({ "x-green-feedback-admin": process.env.GREEN_TEACHER_FEEDBACK_ADMIN_KEY }), cache: "no-store" });
      if (audioId) {
        if (!upstream.ok) return Response.json(await upstream.json().catch(() => ({})), { status: upstream.status });
        return new Response(await upstream.arrayBuffer(), { status: 200, headers: { "Content-Type": upstream.headers.get("content-type") || "audio/webm", "Cache-Control": "private, no-store" } });
      }
      return Response.json(await upstream.json().catch(() => ({})), { status: upstream.status, headers: { "Cache-Control": "private, no-store" } });
    }
    if (audioId) {
      const audio = await readDirectAudio(audioId, audioPart);
      if (!audio) return Response.json({ error: "没有找到这段语音反馈。" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
      return new Response(audio.body, { status: 200, headers: { "Content-Type": audio.mime, "Cache-Control": "private, no-store", "Content-Disposition": "inline" } });
    }
    return Response.json({ records: await readDirectFeedback() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("teacher-feedback read failed", error);
    return Response.json({ error: "暂时无法读取教师反馈，请稍后重试。" }, { status: 502, headers: { "Cache-Control": "private, no-store" } });
  }
}
