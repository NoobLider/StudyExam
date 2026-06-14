import { NextRequest, NextResponse } from "next/server";
import { readUsers, hashPassword, createSession, ensureDefaultAdmin } from "@/lib/serverAuth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultAdmin();
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "Kullanıcı adı ve şifre zorunlu." }, { status: 400 });
    }
    const users = await readUsers();
    const user = users.find((u) => u.username === username);
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 401 });
    }
    if (user.passwordHash !== hashPassword(password)) {
      return NextResponse.json({ error: "Şifre yanlış." }, { status: 401 });
    }
    const token = await createSession(user);
    const res = NextResponse.json({
      ok: true,
      user: { username: user.username, displayName: user.displayName, role: user.role },
    });
    res.cookies.set("studyexam_session", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
