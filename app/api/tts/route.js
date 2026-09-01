import { tts } from "tencentcloud-sdk-nodejs-tts";

export const runtime = "nodejs";
export const maxDuration = 10;

const VOICE_TYPES = {
  alex: Number(process.env.TENCENT_TTS_VOICE_TYPE || 502006),
  american: Number(process.env.TENCENT_TTS_AMERICAN_VOICE_TYPE || 502006),
  planter: Number(process.env.TENCENT_TTS_PLANTER_VOICE_TYPE || 502001),
  narrator: Number(process.env.TENCENT_TTS_NARRATOR_VOICE_TYPE || 101013),
};

const audioCache = globalThis.__xiaoxitianRoleAudioCache || new Map();
globalThis.__xiaoxitianRoleAudioCache = audioCache;

async function synthesizeTencent(text, role, speed, codec = "mp3") {
  const secretId = process.env.TENCENTCLOUD_SECRET_ID;
  const secretKey = process.env.TENCENTCLOUD_SECRET_KEY;
  if (!secretId || !secretKey || !VOICE_TYPES[role]) return null;
  const voiceType = VOICE_TYPES[role];
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
    Codec: codec,
    SampleRate: codec === "wav" && voiceType === 101013 ? 16000 : 24000,
    Speed: speed,
    Volume: 0,
    PrimaryLanguage: 1,
    EnableSubtitle: true,
  });
  if (!result?.Audio) throw new Error("Tencent TTS returned no audio");
  return { buffer: Buffer.from(result.Audio, "base64"), subtitles: result.Subtitles || [], label: `tencent-${role}-${voiceType}` };
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
  if (!Object.hasOwn(VOICE_TYPES, role) || !text) return Response.json({ error: "Invalid role or text" }, { status: 400 });

  const codec = body?.timestamps === true ? "wav" : "mp3";
  const cacheKey = `${role}:${speed}:${codec}:${text}`;
  let result = audioCache.get(cacheKey);
  if (!result) {
    try {
      try {
        result = await synthesizeTencent(text, role, speed, codec);
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

  if (body?.timestamps === true) {
    return Response.json({
      audio: result.buffer.toString("base64"),
      subtitles: result.subtitles,
      provider: result.label,
    }, { headers: { "Cache-Control": "private, no-store" } });
  }

  return new Response(result.buffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=86400",
      "X-Role-Voice": result.label,
    },
  });
}
