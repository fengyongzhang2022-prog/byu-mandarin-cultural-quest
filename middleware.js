import { NextResponse } from "next/server";
import { verifySession } from "./lib/auth";

export async function middleware(request) {
  const session = await verifySession(request.cookies.get("xunji_session")?.value);
  const path = request.nextUrl.pathname;
  const host = request.headers.get("host")?.split(":")[0].toLowerCase() || "";
  const isGreenHost = host.startsWith("green.");
  if (path === "/") {
    if (isGreenHost) {
      if (!session) {
        const login = new URL("/forest-login.html", request.url);
        login.searchParams.set("next", "/forest.html");
        return NextResponse.redirect(login);
      }
      return NextResponse.rewrite(new URL("/forest.html", request.url));
    }
    return NextResponse.redirect(new URL("/heishenhuawukong.html", request.url));
  }
  if (!session) {
    if (path.startsWith("/api/")) return Response.json({ error: "请先登录。" }, { status: 401 });
    const login = new URL(path === "/forest.html" ? "/forest-login.html" : "/login.html", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }
  if (path === "/teacher.html" && session.role !== "teacher") return NextResponse.redirect(new URL("/heishenhuawukong.html", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/", "/heishenhuawukong.html", "/forest.html", "/teacher.html", "/api/chat/:path*", "/api/tts/:path*"] };
