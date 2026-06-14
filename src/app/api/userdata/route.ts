import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getSession } from "@/lib/serverAuth";

export const runtime = "nodejs";

const DATA_DIR = process.env.STUDYEXAM_DATA_DIR ?? path.join(process.cwd(), "data");

function userDataFile(username: string) {
  return path.join(DATA_DIR, `userdata_${username}.json`);
}

interface UserData {
  userStats: object | null;
  sessions: object[];
  progress: object[];
  updatedAt: string;
}

async function readUserData(username: string): Promise<UserData> {
  try {
    const raw = await fs.readFile(userDataFile(username), "utf-8");
    return JSON.parse(raw) as UserData;
  } catch {
    return { userStats: null, sessions: [], progress: [], updatedAt: new Date().toISOString() };
  }
}

async function writeUserData(username: string, data: UserData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(userDataFile(username), JSON.stringify(data, null, 2), "utf-8");
}

async function requireSession(req: NextRequest) {
  const token = req.cookies.get("studyexam_session")?.value ?? "";
  return getSession(token);
}

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const data = await readUserData(session.username);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  const body = await req.json() as Partial<UserData>;
  const current = await readUserData(session.username);
  const merged: UserData = {
    userStats: body.userStats !== undefined ? body.userStats : current.userStats,
    sessions: body.sessions !== undefined ? body.sessions : current.sessions,
    progress: body.progress !== undefined ? body.progress : current.progress,
    updatedAt: new Date().toISOString(),
  };
  await writeUserData(session.username, merged);
  return NextResponse.json({ ok: true });
}
