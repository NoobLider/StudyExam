import { promises as fs } from "fs";
import path from "path";
import { createHash, randomBytes } from "crypto";

export interface ServerUser {
  username: string;
  displayName: string;
  passwordHash: string;
  role: "admin" | "student";
  createdAt: string;
}

const DATA_DIR = process.env.STUDYEXAM_DATA_DIR ?? path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readUsers(): Promise<ServerUser[]> {
  try {
    await ensureDataDir();
    const raw = await fs.readFile(USERS_FILE, "utf-8");
    return JSON.parse(raw) as ServerUser[];
  } catch {
    return [];
  }
}

export async function writeUsers(users: ServerUser[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

export function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

interface Session {
  token: string;
  username: string;
  role: "admin" | "student";
  displayName: string;
  createdAt: number;
}

async function readSessions(): Promise<Session[]> {
  try {
    await ensureDataDir();
    const raw = await fs.readFile(SESSIONS_FILE, "utf-8");
    const sessions: Session[] = JSON.parse(raw);
    const now = Date.now();
    return sessions.filter((s) => now - s.createdAt < 7 * 24 * 60 * 60 * 1000);
  } catch {
    return [];
  }
}

async function writeSessions(sessions: Session[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2), "utf-8");
}

export async function createSession(user: ServerUser): Promise<string> {
  const sessions = await readSessions();
  const token = generateToken();
  sessions.push({
    token,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    createdAt: Date.now(),
  });
  await writeSessions(sessions);
  return token;
}

export async function getSession(token: string): Promise<Session | null> {
  if (!token) return null;
  const sessions = await readSessions();
  return sessions.find((s) => s.token === token) ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  const sessions = await readSessions();
  await writeSessions(sessions.filter((s) => s.token !== token));
}

export async function ensureDefaultAdmin(): Promise<void> {
  const users = await readUsers();
  if (users.length === 0) {
    users.push({
      username: "admin",
      displayName: "Yönetici",
      passwordHash: hashPassword("admin123"),
      role: "admin",
      createdAt: new Date().toISOString(),
    });
    await writeUsers(users);
  }
}
