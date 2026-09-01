import { NextResponse } from "next/server";

// The Green Story teacher trial is an open link. Visitors begin with the
// anonymous intake questions; no course account is required.
export function middleware(request) {
  if (request.nextUrl.pathname === "/") {
    return NextResponse.rewrite(new URL("/forest.html", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/"] };
