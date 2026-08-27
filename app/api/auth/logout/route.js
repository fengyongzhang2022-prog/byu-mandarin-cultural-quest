export const runtime = "edge";

export async function POST() {
  return Response.json({ ok: true }, {
    headers: {
      "Cache-Control": "no-store",
      "Set-Cookie": "xunji_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
    },
  });
}

