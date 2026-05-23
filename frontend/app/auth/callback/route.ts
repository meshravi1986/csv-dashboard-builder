import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase-server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/upload";

  const ALLOWED_PATHS = ["/upload", "/dashboards", "/profile", "/semantic", "/metrics", "/my-metrics"];
  const safeNext = ALLOWED_PATHS.includes(next) ? next : "/upload";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
