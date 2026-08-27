import { authenticate, createSession } from "../../../../lib/auth";

export const runtime = "edge";

export async function POST(request) {
  try {
    const body = await request.json();
    const user = await authenticate(body?.username, body?.password);
    if (!user) return Response.json({ error: "账号或密码不正确。" }, { status: 401 });
    const token = await createSession(user);
    return Response.json(user, {
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": `xunji_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
      },
    });
  } catch {
    return Response.json({ error: "暂时无法登录，请重试。" }, { status: 400 });
  }
}

