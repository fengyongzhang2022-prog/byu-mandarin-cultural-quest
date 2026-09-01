import crypto from "node:crypto";
import COS from "cos-nodejs-sdk-v5";

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
  const audioId = new URL(request.url).searchParams.get("audio");
  const endpoint = apiUrl(audioId ? `/green/teacher-feedback/${encodeURIComponent(audioId)}/audio` : "/green/teacher-feedback");
  if (!endpoint || !process.env.GREEN_PROXY_SECRET || !process.env.GREEN_TEACHER_FEEDBACK_ADMIN_KEY) {
    return Response.json({ error: "匿名反馈提交已启用；研究者汇总读取服务尚未配置。" }, { status: 503 });
  }
  try {
    const upstream = await fetch(endpoint, { headers: proxyHeaders({ "x-green-feedback-admin": process.env.GREEN_TEACHER_FEEDBACK_ADMIN_KEY }), cache: "no-store" });
    if (audioId) {
      if (!upstream.ok) return Response.json(await upstream.json().catch(() => ({})), { status: upstream.status });
      return new Response(await upstream.arrayBuffer(), { status: 200, headers: { "Content-Type": upstream.headers.get("content-type") || "audio/webm", "Cache-Control": "private, no-store" } });
    }
    return Response.json(await upstream.json().catch(() => ({})), { status: upstream.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "暂时无法读取反馈。" }, { status: 502 });
  }
}
