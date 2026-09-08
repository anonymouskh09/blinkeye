import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login"];

function isSafeNext(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.startsWith("/login")) return false;
  return true;
}

function redirectTo(request: NextRequest, target: string) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const isLocal = host.includes("localhost") || host.startsWith("127.0.0.1");

  const qIndex = target.indexOf("?");
  const pathname = qIndex >= 0 ? target.slice(0, qIndex) : target;
  const search = qIndex >= 0 ? target.slice(qIndex) : "";

  if (host && !isLocal) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return NextResponse.redirect(`${proto}://${host}${pathname}${search}`);
  }

  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  return NextResponse.redirect(url);
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get("access_token");

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    if (token && pathname === "/login") {
      const next = request.nextUrl.searchParams.get("next");
      if (isSafeNext(next)) return redirectTo(request, next);
      return redirectTo(request, "/dashboard");
    }
    return NextResponse.next();
  }

  if (!token) {
    const returnTo = `${pathname}${search || ""}`;
    const loginPath = isSafeNext(returnTo)
      ? `/login?next=${encodeURIComponent(returnTo)}`
      : "/login";
    return redirectTo(request, loginPath);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
