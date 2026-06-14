import { NextRequest, NextResponse } from "next/server";
import { readUsers, writeUsers, hashPassword, getSession } from "@/lib/serverAuth";

export const runtime = "nodejs";

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get("studyexam_session")?.value ?? "";
  const session = await getSession(token);
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  const users = await readUsers();
  return NextResponse.json(users.map(({ passwordHash: _, ...u }) => u));
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  const body = await req.json();
  const { action, username, displayName, password, role, newPassword } = body;

  const users = await readUsers();

  if (action === "create") {
    if (!username || !password) {
      return NextResponse.json({ error: "Kullanıcı adı ve şifre zorunlu." }, { status: 400 });
    }
    if (users.find((u) => u.username === username)) {
      return NextResponse.json({ error: "Bu kullanıcı adı zaten alınmış." }, { status: 409 });
    }
    users.push({
      username,
      displayName: displayName || username,
      passwordHash: hashPassword(password),
      role: role ?? "student",
      createdAt: new Date().toISOString(),
    });
    await writeUsers(users);
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    if (username === admin.username) {
      return NextResponse.json({ error: "Kendi hesabını silemezsin." }, { status: 400 });
    }
    await writeUsers(users.filter((u) => u.username !== username));
    return NextResponse.json({ ok: true });
  }

  if (action === "changePassword") {
    const idx = users.findIndex((u) => u.username === username);
    if (idx === -1) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    users[idx].passwordHash = hashPassword(newPassword);
    await writeUsers(users);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
}
