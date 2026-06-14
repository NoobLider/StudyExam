import { NextRequest, NextResponse } from "next/server";
import { getSession, ensureDefaultAdmin } from "@/lib/serverAuth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  await ensureDefaultAdmin();
  const token = req.cookies.get("studyexam_session")?.value ?? "";
  const session = await getSession(token);
  if (!session) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { username: session.username, displayName: session.displayName, role: session.role },
  });
}
