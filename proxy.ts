// proxy.ts

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

const PUBLIC_PATHS = ["/login"];

type AuthProxyRequest = NextRequest & {
  auth: {
    user?: {
      id?: string;
      username?: string;
      role?: string;
      permissions?: string[];
      isSystem?: boolean;
    };
  } | null;
};

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path);
}

export default auth((req: AuthProxyRequest) => {
  const { nextUrl } = req;
  const isLoggedIn = Boolean(req.auth);
  const isPublic = isPublicPath(nextUrl.pathname);

  if (!isLoggedIn && !isPublic) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
