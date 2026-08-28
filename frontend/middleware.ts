import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login"];

function redirectPath(request: NextRequest, path: string) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const isLocal = host.includes("localhost") || host.startsWith("127.0.0.1");

  if (host && !isLocal) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return NextResponse.redirect(`${proto}://${host}${path}`);
  }

  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  return NextResponse.redirect(url);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("access_token");

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    if (token && pathname === "/login") {
      return redirectPath(request, "/dashboard");
    }
    return NextResponse.next();
  }

  if (!token) {
    return redirectPath(request, "/login");
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
