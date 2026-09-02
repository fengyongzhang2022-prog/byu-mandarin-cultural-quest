import { NextResponse } from "next/server";
import { verifySession } from "./lib/auth";

function cookieValue(header, name) {
  return String(header || "").split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

// The Green Story teacher trial is an open link. Visitors begin with the
// anonymous intake questions; no course account is required.
export async function middleware(request) {
  if (request.nextUrl.pathname === "/") {
    return NextResponse.rewrite(new URL("/forest.html", request.url));
  }
  if (request.nextUrl.pathname === "/teacher-feedback.html") {
    const session = await verifySession(cookieValue(request.headers.get("cookie"), "xunji_session"));
    if (session?.role !== "teacher") {
      const login = new URL("/forest-login.html", request.url);
      login.searchParams.set("next", "/teacher-feedback.html");
      return NextResponse.redirect(login);
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/", "/teacher-feedback.html"] };
