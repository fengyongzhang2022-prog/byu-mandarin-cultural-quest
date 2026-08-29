import { tts } from "tencentcloud-sdk-nodejs-tts";

export const runtime = "nodejs";
export const maxDuration = 10;

const ROLES = new Set(["alex"]);

const audioCache = globalThis.__xiaoxitianRoleAudioCache || new Map();
globalThis.__xiaoxitianRoleAudioCache = audioCache;

async function synthesizeTencent(text, role, speed) {
  const secretId = process.env.TENCENTCLOUD_SECRET_ID;
  const secretKey = process.env.TENCENTCLOUD_SECRET_KEY;
  if (!secretId || !secretKey || role !== "alex") return null;
  const voiceType = Number(process.env.TENCENT_TTS_VOICE_TYPE || 502006);
  const TtsClient = tts.v20190823.Client;
  const client = new TtsClient({
    credential: { secretId, secretKey },
    region: process.env.TENCENTCLOUD_REGION || "ap-beijing",
    profile: { httpProfile: { endpoint: "tts.tencentcloudapi.com", reqTimeout: 8 } },
  });
  const result = await client.TextToVoice({
    Text: text,
    SessionId: crypto.randomUUID(),
    VoiceType: voiceType,
    Codec: "mp3",
    SampleRate: 24000,
    Speed: speed,
    Volume: 0,
    PrimaryLanguage: 1,
  });
  if (!result?.Audio) throw new Error("Tencent TTS returned no audio");
  return { buffer: Buffer.from(result.Audio, "base64"), label: `tencent-${voiceType}` };
}

function clean(value, max = 220) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const role = clean(body?.role, 20);
  const text = clean(body?.text);
  const requestedSpeed = Number(body?.speed);
  const speed = Number.isFinite(requestedSpeed) ? Math.max(-2, Math.min(2, Math.round(requestedSpeed))) : 0;
  if (!ROLES.has(role) || !text) return Response.json({ error: "Invalid role or text" }, { status: 400 });

  const cacheKey = `${role}:${speed}:${text}`;
  let result = audioCache.get(cacheKey);
  if (!result) {
    try {
      try {
        result = await synthesizeTencent(text, role, speed);
      } catch (error) {
        console.error(JSON.stringify({ level: "error", msg: "tencent_tts_failed", code: error?.code || "unknown", error: error?.message || String(error) }));
        result = null;
      }
      if (!result) throw new Error("Tencent voice unavailable");
      if (!result.buffer?.length) throw new Error("Empty audio");
      if (audioCache.size >= 60) audioCache.delete(audioCache.keys().next().value);
      audioCache.set(cacheKey, result);
    } catch {
      return Response.json({ error: "Voice unavailable" }, { status: 503 });
    }
  }

  console.log(JSON.stringify({ level: "info", msg: "tts_provider", provider: result.label, role, speed }));

  return new Response(result.buffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=86400",
      "X-Role-Voice": result.label,
    },
  });
}
