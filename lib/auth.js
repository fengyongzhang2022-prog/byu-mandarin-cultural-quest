const encoder = new TextEncoder();

const USERS = {
  "byu-student01": { role: "student", hash: "27a4549d4f071fad08b350ba4eb549da047a3fc49983241f5adfc338f3462fb0" },
  "byu-student02": { role: "student", hash: "b86065ea7aea929950a201bd131d6bc0b7693619f6a38f90f7a46bf0c0314ecd" },
  "byu-student03": { role: "student", hash: "ad48133d9d5663ef1a3f6c5bd39ed4645f692bfa44e3a98d1f79caeec1d596a7" },
  "byu-researcher": { role: "teacher", hash: "49582d90c17b5d0b73b4020fbab0f17e27f5dfc4f866f78b7b3c035f483996d4" },
};

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64url(value) {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
}

function sessionSecret() {
  return process.env.AUTH_SESSION_SECRET || "local-development-session-secret-change-before-deploy";
}

async function hmac(value) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(sessionSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)))));
}

export async function authenticate(username, password) {
  const normalized = String(username || "").trim().toLowerCase();
  const user = USERS[normalized];
  if (!user) return null;
  const digest = toHex(await crypto.subtle.digest("SHA-256", encoder.encode(`${normalized}:${String(password || "")}`)));
  let different = digest.length ^ user.hash.length;
  for (let index = 0; index < Math.max(digest.length, user.hash.length); index += 1) {
    different |= (digest.charCodeAt(index) || 0) ^ (user.hash.charCodeAt(index) || 0);
  }
  return different === 0 ? { username: normalized, role: user.role } : null;
}

export async function createSession(user) {
  const payload = base64url(JSON.stringify({ sub: user.username, role: user.role, exp: Date.now() + 8 * 60 * 60 * 1000 }));
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySession(token) {
  try {
    const [payload, signature] = String(token || "").split(".");
    if (!payload || !signature || signature !== await hmac(payload)) return null;
    const session = JSON.parse(fromBase64url(payload));
    if (!session.sub || !session.role || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

