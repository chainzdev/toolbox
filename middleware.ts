import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";

type CookieBatch = { name: string; value: string; options: CookieOptions }[];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieBatch) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && path.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();

    /**
     * Carry the intent across. A signed-in visitor clicking "upgrade" on the
     * marketing page used to be bounced to a bare /dashboard, losing both the
     * plan they picked and any `next` destination — the upgrade path simply
     * dead-ended for exactly the people most likely to pay.
     *
     * `next` is only honoured when it is a same-origin absolute path, so it
     * cannot be used as an open redirect.
     */
    const plan = request.nextUrl.searchParams.get("plan");
    const next = request.nextUrl.searchParams.get("next");
    const safeNext = next && /^\/(?!\/)/.test(next) ? next : null;

    url.search = "";
    if (plan === "pro" || plan === "agency") {
      url.pathname = "/pricing";
    } else if (safeNext) {
      const target = new URL(safeNext, request.url);
      url.pathname = target.pathname;
      url.search = target.search;
    } else {
      url.pathname = "/dashboard";
    }
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
