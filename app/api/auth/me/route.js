import { verifySession } from "../../../../lib/auth";

export const runtime = "edge";

function cookieValue(header, name) {
  return String(header || "").split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

export async function GET(request) {
  const session = await verifySession(cookieValue(request.headers.get("cookie"), "xunji_session"));
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ username: session.sub, role: session.role }, { headers: { "Cache-Control": "no-store" } });
}

