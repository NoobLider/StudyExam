import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/serverAuth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("studyexam_session")?.value ?? "";
  if (token) await deleteSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("studyexam_session", "", { maxAge: 0, path: "/" });
  return res;
}
