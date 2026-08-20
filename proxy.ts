import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }
});

export const config = {
  matcher: [
    "/((?!api/auth|api/cron|api/notify|api/test-emails|_next/static|_next/image|favicon.ico|login|.*\\.png|.*\\.svg).*)",
  ],
};
