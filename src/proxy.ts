import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Root proxy (Next.js 16 successor to middleware): refreshes the Supabase
 * session on each navigation so server components and route handlers always
 * see a fresh, verified session.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Only the admin + auth surfaces need the Supabase session refresh. Scoping
     * the proxy to them (instead of every route) has two benefits:
     *  1. Public read-only routes (/, /vote, /screen) skip a needless Supabase
     *     round-trip on every request.
     *  2. Those public routes are no longer wrapped in the proxy's committed
     *     `NextResponse.next()` response, so a page calling `notFound()` for a
     *     missing poll correctly returns HTTP 404 (not 200 with a 404 body).
     */
    "/admin/:path*",
    "/auth/:path*",
  ],
};
