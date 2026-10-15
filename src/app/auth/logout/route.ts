import { createClient } from "@/lib/supabase/server";
import { apiFailure, isSameOriginRequest } from "@/lib/api/http";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return apiFailure("Origen de solicitud no permitido.", 403);
  }

  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/login", req.url), {
    status: 302,
  });
}
